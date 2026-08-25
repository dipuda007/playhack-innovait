import { NextResponse } from "next/server";
import { facilityDay } from "@/lib/availability";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polling fallback for clients whose SSE connection cannot be established. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("facility");
  const date = url.searchParams.get("date");
  if (!slug || !date) {
    return NextResponse.json({ error: "facility and date required" }, { status: 400 });
  }

  const user = await currentUser();
  const day = await facilityDay(slug, date, user?.id ?? null);
  if (!day) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(day, {
    headers: { "cache-control": "no-store" },
  });
}
