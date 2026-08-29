import { NextResponse } from "next/server";
import { sql } from "@/db/client";
import { publish } from "@/lib/events";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clears everything a demo run left behind, so the story can be retold. */
export async function POST(req: Request) {
  // The reset is scoped to demo rows and cannot touch a student booking, but
  // it is still an unauthenticated DELETE on a public URL.
  const gate = await rateLimit(`reset:${clientKey(req)}`, 60, 600);
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  await sql`DELETE FROM bookings WHERE idempotency_key LIKE 'race-%'`;
  await sql`DELETE FROM naive_bookings`;
  await sql`DELETE FROM race_attempts`;
  publish({ type: "race", facilityId: "*" });
  return NextResponse.json({ ok: true });
}
