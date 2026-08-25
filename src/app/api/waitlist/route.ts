import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/db/client";
import { currentUser } from "@/lib/session";
import { publish } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  facilityId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

/** Join the queue for a slot that is currently taken. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { facilityId, startsAt, endsAt } = parsed.data;

  try {
    const [row] = await sql<{ id: string; position: number }[]>`
      WITH inserted AS (
        INSERT INTO waitlist (facility_id, user_id, during)
        VALUES (${facilityId}, ${user.id},
                tstzrange(${new Date(startsAt)}, ${new Date(endsAt)}, '[)'))
        RETURNING id, facility_id, during, enqueued_at
      )
      SELECT i.id,
             (SELECT count(*)::int FROM waitlist w
               WHERE w.facility_id = i.facility_id AND w.during = i.during
                 AND w.state = 'waiting' AND w.enqueued_at <= i.enqueued_at) AS position
      FROM inserted i
    `;
    publish({ type: "waitlist", facilityId });
    return NextResponse.json({ ok: true, id: row.id, position: row.position });
  } catch (e) {
    // waitlist_one_live_per_user rejected a second entry for the same slot.
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json(
        { ok: false, code: "ALREADY_QUEUED", message: "You are already on this queue." },
        { status: 409 },
      );
    }
    throw e;
  }
}

/** Leave a queue. */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  await sql`
    UPDATE waitlist SET state = 'withdrawn'
    WHERE id = ${id} AND user_id = ${user.id} AND state IN ('waiting', 'offered')
  `;
  return NextResponse.json({ ok: true });
}
