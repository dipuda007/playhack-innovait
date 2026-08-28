import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, PG, sqlstateOf } from "@/db/client";
import { currentUser } from "@/lib/session";
import { publish } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Block = z.object({
  action: z.literal("block"),
  facilityId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  note: z.string().min(1).max(200),
});

const Toggle = z.object({
  action: z.literal("toggle"),
  facilityId: z.string().uuid(),
  isActive: z.boolean(),
});

const Body = z.discriminatedUnion("action", [Block, Toggle]);

export async function POST(req: Request) {
  const user = await currentUser();
  // Managers only. Authorisation is checked server-side from the signed
  // session; the Ops page hiding the controls is a convenience, not a control.
  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "Manager access required." },
      { status: 403 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.action === "toggle") {
    await sql`
      UPDATE facilities SET is_active = ${parsed.data.isActive}
      WHERE id = ${parsed.data.facilityId}
    `;
    publish({ type: "booking", facilityId: parsed.data.facilityId });
    return NextResponse.json({ ok: true });
  }

  const { facilityId, startsAt, endsAt, note } = parsed.data;

  try {
    // A closure is a booking with kind='block'. It therefore goes through the
    // exact same exclusion constraint as a student booking — a manager cannot
    // close a court out from under a confirmed reservation by accident.
    const [row] = await sql<{ id: string; booking_code: string }[]>`
      INSERT INTO bookings (facility_id, user_id, kind, during, idempotency_key, note)
      VALUES (${facilityId}, NULL, 'block',
              tstzrange(${new Date(startsAt)}, ${new Date(endsAt)}, '[)'),
              ${`block-${crypto.randomUUID()}`}, ${note})
      RETURNING id, booking_code
    `;
    publish({ type: "booking", facilityId });
    return NextResponse.json({ ok: true, id: row.id, code: row.booking_code });
  } catch (e) {
    if (sqlstateOf(e) === PG.EXCLUSION_VIOLATION) {
      const clashes = await sql<
        { user_name: string | null; kind: string; note: string | null; starts_at: string }[]
      >`
        SELECT u.name AS user_name, b.kind, b.note,
               lower(b.during) AS starts_at
        FROM bookings b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.facility_id = ${facilityId} AND b.status = 'confirmed'
          AND b.during && tstzrange(${new Date(startsAt)}, ${new Date(endsAt)}, '[)')
        ORDER BY lower(b.during)
      `;

      // The constraint does not care who is in the way, but the manager does.
      // An existing closure is a duplicate action; a student booking is a
      // conflict with a person, and the two need different next steps.
      const students = clashes.filter((c) => c.kind !== "block");
      const message = students.length
        ? "Students already hold slots in that window. Cancel or contact them first."
        : "That window is already closed for maintenance.";

      return NextResponse.json(
        {
          ok: false,
          code: students.length ? "CLASHES_WITH_BOOKINGS" : "ALREADY_CLOSED",
          message,
          sqlstate: PG.EXCLUSION_VIOLATION,
          clashes,
        },
        { status: 409 },
      );
    }
    throw e;
  }
}
