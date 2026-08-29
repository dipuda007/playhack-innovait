import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/db/client";
import {
  openLottery, enterLottery, drawLottery, getLottery, weightFor,
} from "@/lib/lottery";
import { publish } from "@/lib/events";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("simulate"),
    facilityId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    entrants: z.number().int().min(2).max(200),
  }),
  z.object({ action: z.literal("draw"), lotteryId: z.string().uuid() }),
]);

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const view = await getLottery(id);
  if (!view) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(view);
}

export async function POST(req: Request) {
  // `simulate` seeds up to two hundred entrants and `draw` writes a booking.
  const gate = await rateLimit(`lottery:${clientKey(req)}`, 30, 600);
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.action === "draw") {
    const result = await drawLottery(parsed.data.lotteryId);
    const view = await getLottery(parsed.data.lotteryId);
    return NextResponse.json({ result, lottery: view });
  }

  const { facilityId, startsAt, endsAt, entrants } = parsed.data;
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  // Fresh slot for each simulation so the draw has something to award.
  await sql`
    DELETE FROM lotteries
    WHERE facility_id = ${facilityId}
      AND during = tstzrange(${start}, ${end}, '[)')
  `;
  await sql`
    DELETE FROM bookings
    WHERE facility_id = ${facilityId}
      AND during && tstzrange(${start}, ${end}, '[)')
  `;

  // A short window: everyone who arrives inside it is an entrant, not a racer.
  const opened = await openLottery({
    facilityId, startsAt: start, endsAt: end, windowSeconds: 30,
  });

  const students = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM users WHERE role = 'student'
    ORDER BY md5(id::text || ${opened.id}) LIMIT ${entrants}
  `;

  // Everyone piles in at once — the same stampede, absorbed as entries rather
  // than resolved by whoever's packet arrived first.
  await Promise.all(students.map((s) => enterLottery(opened.id, s.id)));

  publish({ type: "race", facilityId });
  return NextResponse.json({ lotteryId: opened.id, lottery: await getLottery(opened.id) });
}
