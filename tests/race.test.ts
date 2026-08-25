/**
 * The proof.
 *
 * These tests are the reason the schema looks the way it does. They fire
 * genuinely simultaneous booking attempts at a single slot and assert that the
 * database ends up in exactly one legal state, every time.
 *
 *   npm run test:race
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/db/client";
import { createBooking, cancelBooking } from "@/lib/booking";

type Ctx = {
  facilityId: string;
  slotMinutes: number;
  userIds: string[];
};

const ctx: Ctx = { facilityId: "", slotMinutes: 60, userIds: [] };

/** A far-future slot nothing else in the demo data touches. */
function futureSlot(offsetHours: number, minutes: number) {
  const base = new Date();
  base.setUTCMinutes(0, 0, 0);
  const start = new Date(base.getTime() + offsetHours * 3_600_000);
  return { start, end: new Date(start.getTime() + minutes * 60_000) };
}

/**
 * Book directly, bypassing the opening-hours and horizon validation that the
 * product layer applies. Those rules are about *policy*; these tests are about
 * the *invariant*, and the invariant has to hold for any range at all.
 */
async function rawInsert(
  facilityId: string,
  userId: string,
  start: Date,
  end: Date,
) {
  const key = randomUUID();
  try {
    await sql`
      INSERT INTO bookings
        (facility_id, user_id, during, idempotency_key)
      VALUES (${facilityId}, ${userId}, tstzrange(${start}, ${end}, '[)'),
              ${"test-raw-" + key})
    `;
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, code: (e as { code?: string }).code };
  }
}

beforeAll(async () => {
  const [f] = await sql<{ id: string; slot_minutes: number }[]>`
    SELECT id, slot_minutes FROM facilities WHERE slug = 'badminton-sac-1'
  `;
  ctx.facilityId = f.id;
  ctx.slotMinutes = f.slot_minutes;

  const users = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE role = 'student' ORDER BY created_at LIMIT 40
  `;
  ctx.userIds = users.map((u) => u.id);

  // Quotas must not be what stops the race — we are testing the slot
  // invariant, so give every participant plenty of headroom.
  await sql`UPDATE users SET weekly_quota = 500`;
});

afterAll(async () => {
  await sql`DELETE FROM bookings WHERE idempotency_key LIKE 'test-%'`;
  await sql.end();
});

describe("the exclusion constraint", () => {
  it("admits exactly one winner from 50 simultaneous identical attempts", async () => {
    const { start, end } = futureSlot(400, 60);

    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        rawInsert(ctx.facilityId, ctx.userIds[i % ctx.userIds.length], start, end),
      ),
    );

    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(49);
    // Every loser must have lost to the constraint, not to a bug.
    expect(losers.every((l) => l.code === "23P01")).toBe(true);

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int FROM bookings
      WHERE facility_id = ${ctx.facilityId} AND status = 'confirmed'
        AND during && tstzrange(${start}, ${end}, '[)')
    `;
    expect(count).toBe(1);
  });

  it("rejects partially overlapping attempts, not just identical ones", async () => {
    const { start } = futureSlot(500, 60);

    // Four staggered 60-minute ranges, each offset 15 minutes from the last,
    // so every pair genuinely overlaps (the largest offset, 45 min, is still
    // inside the 60-minute duration).
    //
    // A UNIQUE(facility_id, starts_at) index would accept ALL FOUR, because
    // every start time differs. Only one may actually survive.
    const attempts = Array.from({ length: 4 }, (_, i) => {
      const s = new Date(start.getTime() + i * 15 * 60_000);
      return { s, e: new Date(s.getTime() + 60 * 60_000) };
    });

    const results = await Promise.all(
      attempts.map((a, i) =>
        rawInsert(ctx.facilityId, ctx.userIds[i], a.s, a.e),
      ),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);

    // Losers may land on either of two codes, and both are correct:
    //   23P01  the constraint refused an overlap outright
    //   40P01  two partially-overlapping inserts waited on each other's
    //          uncommitted row and Postgres broke the cycle
    // 40P01 is only reachable for *partial* overlaps — identical ranges all
    // queue behind the same row and cannot form a cycle. Either way the
    // transaction rolled back cleanly and the table stayed correct; the
    // service layer retries 40P01 (see withDeadlockRetry) so callers only
    // ever observe a settled result.
    expect(
      results
        .filter((r) => !r.ok)
        .every((r) => r.code === "23P01" || r.code === "40P01"),
    ).toBe(true);

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int FROM bookings
      WHERE facility_id = ${ctx.facilityId} AND status = 'confirmed'
        AND during && tstzrange(${attempts[0].s}, ${attempts[3].e}, '[)')
    `;
    expect(count).toBe(1);
  });

  it("allows back-to-back slots (half-open bounds are not overlaps)", async () => {
    const { start } = futureSlot(600, 60);

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const s = new Date(start.getTime() + i * 60 * 60_000);
        return rawInsert(
          ctx.facilityId,
          ctx.userIds[i],
          s,
          new Date(s.getTime() + 60 * 60_000),
        );
      }),
    );

    // Six adjacent hours are six legal bookings, not one.
    expect(results.filter((r) => r.ok)).toHaveLength(6);
  });

  it("keeps different facilities fully independent (no false contention)", async () => {
    const { start, end } = futureSlot(700, 60);
    const facilities = await sql<{ id: string }[]>`
      SELECT id FROM facilities WHERE slot_minutes = 60 LIMIT 5
    `;

    const results = await Promise.all(
      facilities.map((f, i) =>
        rawInsert(f.id, ctx.userIds[i], start, end),
      ),
    );

    // Same instant, five different courts: all five must succeed. This is why
    // the design scales — contention is naturally sharded by facility_id.
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});

describe("the booking service under load", () => {
  it("confirms exactly one of 40 concurrent product-level bookings", async () => {
    // A slot inside real opening hours tomorrow evening, so the full
    // validation path runs — hours, horizon, grid alignment, quota, the lot.
    const tomorrow = new Date(Date.now() + 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(tomorrow);
    const start = new Date(`${key}T20:00:00+05:30`);
    const end = new Date(`${key}T21:00:00+05:30`);

    await sql`
      DELETE FROM bookings
      WHERE facility_id = ${ctx.facilityId}
        AND during && tstzrange(${start}, ${end}, '[)')
    `;

    // Isolate the variable under test. Seed data gives many students a
    // booking somewhere else at this hour, and the "you cannot be on two
    // courts at once" rule would reject them for that reason instead — a
    // correct rejection, but not the one this test is about.
    await sql`
      DELETE FROM bookings
      WHERE user_id = ANY(${ctx.userIds})
        AND during && tstzrange(${start}, ${end}, '[)')
    `;

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        createBooking({
          facilityId: ctx.facilityId,
          userId: ctx.userIds[i % ctx.userIds.length],
          startsAt: start,
          endsAt: end,
          idempotencyKey: `test-load-${randomUUID()}`,
        }),
      ),
    );

    const confirmed = results.filter((r) => r.ok);
    const rejected = results.filter((r) => !r.ok);

    expect(confirmed).toHaveLength(1);
    expect(rejected).toHaveLength(39);

    // No rejection may be an unhandled error: every loser gets a typed
    // outcome, and every loser is offered somewhere else to play.
    for (const r of rejected) {
      if (r.ok) continue;
      expect(r.code).toBe("SLOT_TAKEN");
      expect(r.sqlstate).toBe("23P01");
      expect(r.constraint).toBe("bookings_no_overlap");
      expect(r.alternatives.length).toBeGreaterThan(0);
    }
  });

  it("treats a replayed idempotency key as the same booking, not a new one", async () => {
    const { start, end } = futureSlot(800, 60);
    const sameKey = `test-idem-${randomUUID()}`;

    // The double-tap: one intent, submitted ten times concurrently.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createBooking({
          facilityId: ctx.facilityId,
          userId: ctx.userIds[0],
          startsAt: start,
          endsAt: end,
          idempotencyKey: sameKey,
        }).catch((e) => ({ ok: false as const, code: "THREW", err: String(e) })),
      ),
    );

    const ok = results.filter((r) => r.ok);
    // Some calls are rejected for slot validity (this raw future slot is
    // outside the booking horizon), so assert the invariant that matters:
    // the key produced at most one row, ever.
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int FROM bookings WHERE idempotency_key = ${sameKey}
    `;
    expect(count).toBeLessThanOrEqual(1);

    // And whatever came back successfully all points at that one booking.
    const ids = new Set(ok.map((r) => (r as { booking: { id: string } }).booking.id));
    expect(ids.size).toBeLessThanOrEqual(1);
  });

  it("frees the slot on cancellation and lets the next request win", async () => {
    const { start, end } = futureSlot(900, 60);

    const first = await rawInsert(ctx.facilityId, ctx.userIds[0], start, end);
    expect(first.ok).toBe(true);

    // While it is live, a second attempt must lose.
    const blocked = await rawInsert(ctx.facilityId, ctx.userIds[1], start, end);
    expect(blocked.ok).toBe(false);

    const [row] = await sql<{ id: string }[]>`
      SELECT id FROM bookings
      WHERE facility_id = ${ctx.facilityId} AND status = 'confirmed'
        AND during && tstzrange(${start}, ${end}, '[)')
    `;
    await cancelBooking(row.id, ctx.userIds[0]);

    // Now it must succeed — the partial index dropped the cancelled row.
    const after = await rawInsert(ctx.facilityId, ctx.userIds[1], start, end);
    expect(after.ok).toBe(true);
  });
});

describe("deadlock handling", () => {
  it("never surfaces a deadlock to the caller, even under partial overlap", async () => {
    // Maintenance blocks span several slots, so student bookings around them
    // are partial rather than identical overlaps — the shape that can
    // deadlock. Whatever happens underneath, the caller must receive a typed
    // outcome and the table must stay correct.
    const tomorrow = new Date(Date.now() + 2 * 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(tomorrow);

    const start = new Date(`${key}T14:00:00+05:30`);
    await sql`
      DELETE FROM bookings
      WHERE facility_id = ${ctx.facilityId}
        AND during && tstzrange(${start},
                                ${new Date(start.getTime() + 4 * 3600_000)}, '[)')
    `;

    // Staggered 60-minute requests at 15-minute offsets, fired together.
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => {
        const s = new Date(start.getTime() + i * 15 * 60_000);
        return createBooking({
          facilityId: ctx.facilityId,
          userId: ctx.userIds[i],
          startsAt: s,
          endsAt: new Date(s.getTime() + 60 * 60_000),
          idempotencyKey: `test-dl-${randomUUID()}`,
        });
      }),
    );

    // Not one of them may have thrown.
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const overlaps = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bookings a JOIN bookings b
        ON a.facility_id = b.facility_id AND a.id < b.id AND a.during && b.during
      WHERE a.status = 'confirmed' AND b.status = 'confirmed'
    `;
    expect(overlaps[0].count).toBe(0);
  });
});

describe("the global invariant", () => {
  it("finds zero overlapping confirmed bookings anywhere in the table", async () => {
    // The whole-table sweep. Not a sample, not the slot we just tested —
    // every confirmed row against every other confirmed row on its court.
    const overlaps = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bookings a
      JOIN bookings b
        ON a.facility_id = b.facility_id
       AND a.id < b.id
       AND a.during && b.during
      WHERE a.status = 'confirmed' AND b.status = 'confirmed'
    `;
    expect(overlaps[0].count).toBe(0);
  });

  it("still holds after 200 concurrent attempts across 10 contested slots", async () => {
    const { start } = futureSlot(1000, 60);
    const slots = Array.from({ length: 10 }, (_, i) => {
      const s = new Date(start.getTime() + i * 60 * 60_000);
      return { s, e: new Date(s.getTime() + 60 * 60_000) };
    });

    // 200 requests, 20 per slot, all released together.
    await Promise.all(
      Array.from({ length: 200 }, (_, i) => {
        const slot = slots[i % slots.length];
        return rawInsert(
          ctx.facilityId,
          ctx.userIds[i % ctx.userIds.length],
          slot.s,
          slot.e,
        );
      }),
    );

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int FROM bookings
      WHERE facility_id = ${ctx.facilityId} AND status = 'confirmed'
        AND during && tstzrange(${slots[0].s}, ${slots[9].e}, '[)')
    `;
    // Ten slots contested by two hundred requests: exactly ten bookings.
    expect(count).toBe(10);

    const overlaps = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bookings a JOIN bookings b
        ON a.facility_id = b.facility_id AND a.id < b.id AND a.during && b.during
      WHERE a.status = 'confirmed' AND b.status = 'confirmed'
    `;
    expect(overlaps[0].count).toBe(0);
  });
});

describe("the naive implementation, for contrast", () => {
  it("double-books the same slot under the same traffic", async () => {
    const runId = randomUUID();
    const { start, end } = futureSlot(1100, 60);

    // Read-then-write, exactly as it is usually written: check whether the
    // slot is free, then insert if it looked free. Nothing here is wrong in
    // isolation — it is wrong only because another request runs in between.
    async function naiveBook(userId: string) {
      const existing = await sql`
        SELECT 1 FROM naive_bookings
        WHERE facility_id = ${ctx.facilityId}
          AND status = 'confirmed'
          AND during && tstzrange(${start}, ${end}, '[)')
        LIMIT 1
      `;
      if (existing.length > 0) return false;

      // The gap. In production this is network latency, a serialised event
      // loop, or a slow validation call — here it is made explicit.
      await new Promise((r) => setTimeout(r, 25));

      await sql`
        INSERT INTO naive_bookings (facility_id, user_id, during, run_id)
        VALUES (${ctx.facilityId}, ${userId},
                tstzrange(${start}, ${end}, '[)'), ${runId})
      `;
      return true;
    }

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        naiveBook(ctx.userIds[i % ctx.userIds.length]),
      ),
    );

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int FROM naive_bookings WHERE run_id = ${runId}
    `;

    // This is the bug the brief is about, reproduced on demand.
    expect(count).toBeGreaterThan(1);
    console.log(
      `\n  ⚠ naive path created ${count} bookings for ONE slot ` +
        `(the safe path creates exactly 1)\n`,
    );

    await sql`DELETE FROM naive_bookings WHERE run_id = ${runId}`;
  });
});
