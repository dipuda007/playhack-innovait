import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelBooking } from "@/lib/booking";
import { currentUser } from "@/lib/session";
import { publish } from "@/lib/events";
import { sql } from "@/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ bookingId: z.string().uuid() });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const [row] = await sql<{ facility_id: string }[]>`
    SELECT facility_id FROM bookings WHERE id = ${parsed.data.bookingId}
  `;

  // Ownership is checked inside cancelBooking's UPDATE ... WHERE user_id,
  // so a forged booking id simply matches no row.
  const result = await cancelBooking(parsed.data.bookingId, user.id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", message: "No cancellable booking with that id." },
      { status: 404 },
    );
  }

  if (row) publish({ type: "cancellation", facilityId: row.facility_id });
  return NextResponse.json(result);
}
