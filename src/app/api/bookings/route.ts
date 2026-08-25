import { NextResponse } from "next/server";
import { z } from "zod";
import { createBooking } from "@/lib/booking";
import { currentUser } from "@/lib/session";
import { statusFor, reject } from "@/lib/outcomes";
import { publish } from "@/lib/events";

export const runtime = "nodejs";
// Booking is a write path; nothing about it may be cached or prerendered.
export const dynamic = "force-dynamic";

const Body = z.object({
  facilityId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  /**
   * Supplied by the client, one per booking intent. Absent keys are NOT
   * auto-generated server-side: a server-generated key would be fresh on every
   * retry and would defeat the entire point of having one.
   */
  idempotencyKey: z.string().min(8).max(128),
  partySize: z.number().int().min(1).max(40).optional(),
  note: z.string().max(280).optional(),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    const failure = reject("UNAUTHENTICATED");
    return NextResponse.json(failure, { status: statusFor(failure.code) });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", message: "Malformed booking request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createBooking({
    facilityId: parsed.data.facilityId,
    // The acting user always comes from the signed session, never from the
    // request body — otherwise anyone could book on anyone else's behalf.
    userId: user.id,
    startsAt: new Date(parsed.data.startsAt),
    endsAt: new Date(parsed.data.endsAt),
    idempotencyKey: parsed.data.idempotencyKey,
    partySize: parsed.data.partySize,
    note: parsed.data.note,
  });

  if (result.ok) {
    // Nudge every open availability view; the writer already committed, so
    // this is a notification, never part of the transaction.
    publish({ type: "booking", facilityId: parsed.data.facilityId });
    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.json(result, { status: statusFor(result.code) });
}
