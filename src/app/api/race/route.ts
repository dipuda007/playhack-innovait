import { NextResponse } from "next/server";
import { z } from "zod";
import { runRace, invariantCheck } from "@/lib/race";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { publish } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A 200-way burst plus the invariant sweep needs more than the default budget.
export const maxDuration = 60;

const Body = z.object({
  facilityId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  count: z.number().int().min(2).max(200),
  mode: z.enum(["safe", "naive"]),
});

export async function POST(req: Request) {
  // Thirty bursts in ten minutes. A race takes about a second, so a demo
  // cannot reach this; a loop against the public URL can.
  const gate = await rateLimit(`race:${clientKey(req)}`, 30, 600);
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await runRace({
    facilityId: parsed.data.facilityId,
    startsAt: new Date(parsed.data.startsAt),
    endsAt: new Date(parsed.data.endsAt),
    count: parsed.data.count,
    mode: parsed.data.mode,
  });

  // The sweep runs after every race, on the whole table. Claiming correctness
  // for the slot we just hammered would be a much weaker claim.
  const invariant = await invariantCheck();

  publish({ type: "race", facilityId: parsed.data.facilityId });

  return NextResponse.json({ ...result, invariant });
}
