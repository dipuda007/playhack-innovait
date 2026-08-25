import { NextResponse } from "next/server";
import { sql } from "@/db/client";
import { publish } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clears everything a demo run left behind, so the story can be retold. */
export async function POST() {
  await sql`DELETE FROM bookings WHERE idempotency_key LIKE 'race-%'`;
  await sql`DELETE FROM naive_bookings`;
  await sql`DELETE FROM race_attempts`;
  publish({ type: "race", facilityId: "*" });
  return NextResponse.json({ ok: true });
}
