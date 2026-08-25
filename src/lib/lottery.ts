/**
 * Fair allocation for contested peak slots.
 *
 * ── The problem with winning a race ────────────────────────────────────────
 * The exclusion constraint guarantees that exactly one booking survives a
 * stampede. It says nothing about WHO should win, and first-come-first-serve
 * answers that question badly: at 6 p.m. on a shared campus the winner is
 * whoever has the best wifi, the newest phone, or a script. That is a correct
 * system producing an unfair outcome.
 *
 * So peak slots are not released as a race at all. Requests arriving inside a
 * short window become ENTRIES, and when the window closes a single weighted
 * draw picks the winner. The winner's booking is then inserted through exactly
 * the same constrained path as any other booking — fairness is a policy layer
 * on top of the correctness layer, never a replacement for it.
 *
 * ── Why the draw is auditable ──────────────────────────────────────────────
 * The seed is generated and stored when the window OPENS, before anybody has
 * entered. Weights come from stored reliability scores. Anyone can therefore
 * recompute the draw from the recorded inputs and check they get the same
 * winner — the draw cannot be quietly re-rolled in favour of a friend.
 */
import { createHash, randomUUID } from "node:crypto";
import { sql, withDeadlockRetry } from "@/db/client";

export type LotteryView = {
  id: string;
  facilityId: string;
  facilityName: string;
  startsAt: string;
  endsAt: string;
  opensAt: string;
  closesAt: string;
  seed: string;
  drawnAt: string | null;
  winnerId: string | null;
  winnerName: string | null;
  bookingCode: string | null;
  entries: LotteryEntry[];
};

export type LotteryEntry = {
  userId: string;
  userName: string;
  reliability: number;
  weight: number;
  /** Share of the total weight, as a percentage. */
  chance: number;
  enteredAt: string;
  won: boolean;
};

/**
 * Entry weight from a student's reliability score.
 *
 * Deliberately compressed rather than proportional. A student on 100 gets
 * roughly twice the chance of one on 40 — not twenty times. The score should
 * tilt the draw, not turn it into a ranking where a few no-shows lock somebody
 * out of prime slots for the rest of term.
 */
export function weightFor(reliability: number): number {
  return 50 + Math.round(reliability / 2);
}

/**
 * Deterministic draw.
 *
 * A seeded hash rather than Math.random: the same seed and the same entrant
 * list must always produce the same winner, or the result is not auditable.
 * Entries are sorted by user id so that the order rows come back from the
 * database cannot change the outcome.
 */
export function drawWinner(
  seed: string,
  entries: { userId: string; weight: number }[],
): string | null {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => a.userId.localeCompare(b.userId));
  const total = sorted.reduce((sum, e) => sum + e.weight, 0);

  // 52 bits of the seed hash, mapped into [0, 1). Ample for this purpose and
  // exactly reproducible in any language, which matters for an audit.
  const digest = createHash("sha256").update(seed).digest("hex");
  const roll = parseInt(digest.slice(0, 13), 16) / 2 ** 52;

  let cursor = roll * total;
  for (const entry of sorted) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.userId;
  }
  return sorted[sorted.length - 1].userId;
}

/** Open a draw window for a slot. Idempotent per (facility, slot). */
export async function openLottery(opts: {
  facilityId: string;
  startsAt: Date;
  endsAt: Date;
  windowSeconds: number;
}) {
  const seed = randomUUID();
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO lotteries (facility_id, during, closes_at, seed)
      VALUES (${opts.facilityId},
              tstzrange(${opts.startsAt}, ${opts.endsAt}, '[)'),
              now() + make_interval(secs => ${opts.windowSeconds}),
              ${seed})
      RETURNING id
    `;
    return { ok: true as const, id: row.id };
  } catch (e) {
    // lotteries_one_open_per_slot: a window is already running for this slot.
    if ((e as { code?: string }).code === "23505") {
      const [existing] = await sql<{ id: string }[]>`
        SELECT id FROM lotteries
        WHERE facility_id = ${opts.facilityId}
          AND during = tstzrange(${opts.startsAt}, ${opts.endsAt}, '[)')
          AND drawn_at IS NULL
      `;
      return { ok: true as const, id: existing.id, existing: true };
    }
    throw e;
  }
}

/** Join an open draw. */
export async function enterLottery(lotteryId: string, userId: string) {
  const [lottery] = await sql<{ closes_at: string; drawn_at: string | null }[]>`
    SELECT closes_at, drawn_at FROM lotteries WHERE id = ${lotteryId}
  `;
  if (!lottery) return { ok: false as const, code: "NOT_FOUND" as const };
  if (lottery.drawn_at) return { ok: false as const, code: "ALREADY_DRAWN" as const };
  if (new Date(lottery.closes_at).getTime() < Date.now()) {
    return { ok: false as const, code: "WINDOW_CLOSED" as const };
  }

  const [user] = await sql<{ reliability_score: number }[]>`
    SELECT reliability_score FROM users WHERE id = ${userId}
  `;
  if (!user) return { ok: false as const, code: "NOT_FOUND" as const };

  await sql`
    INSERT INTO lottery_entries (lottery_id, user_id, weight)
    VALUES (${lotteryId}, ${userId}, ${weightFor(user.reliability_score)})
    ON CONFLICT (lottery_id, user_id) DO NOTHING
  `;
  return { ok: true as const };
}

/**
 * Close the window and commit the winner's booking.
 *
 * The draw and the booking happen in ONE transaction, and the lottery row is
 * locked first. Two concurrent calls to this function therefore cannot both
 * draw: the second finds `drawn_at` already set and returns the same winner.
 * Fairness machinery is itself concurrent code, and gets the same treatment as
 * everything else on the write path.
 */
export async function drawLottery(lotteryId: string) {
  return withDeadlockRetry(() =>
    sql.begin(async (tx) => {
      const [lottery] = await tx<
        {
          id: string; facility_id: string; seed: string;
          drawn_at: string | null; starts_at: string; ends_at: string;
        }[]
      >`
        SELECT id, facility_id, seed, drawn_at,
               lower(during) AS starts_at, upper(during) AS ends_at
        FROM lotteries WHERE id = ${lotteryId}
        FOR UPDATE
      `;
      if (!lottery) return { ok: false as const, code: "NOT_FOUND" as const };
      if (lottery.drawn_at) return { ok: true as const, alreadyDrawn: true };

      const entries = await tx<{ user_id: string; weight: number }[]>`
        SELECT user_id, weight FROM lottery_entries WHERE lottery_id = ${lotteryId}
      `;

      const winnerId = drawWinner(
        lottery.seed,
        entries.map((e) => ({ userId: e.user_id, weight: e.weight })),
      );

      if (!winnerId) {
        await tx`
          UPDATE lotteries SET drawn_at = now() WHERE id = ${lotteryId}
        `;
        return { ok: true as const, winnerId: null, noEntrants: true };
      }

      // The winner's booking still goes through the constraint. If a
      // maintenance block landed on the slot while the window was open, the
      // insert fails here and nobody is told they won something that does not
      // exist.
      const [booking] = await tx<{ id: string; booking_code: string }[]>`
        INSERT INTO bookings
          (facility_id, user_id, during, idempotency_key, lottery_id)
        VALUES (${lottery.facility_id}, ${winnerId},
                tstzrange(${lottery.starts_at}::timestamptz,
                          ${lottery.ends_at}::timestamptz, '[)'),
                ${`lottery-${lotteryId}`}, ${lotteryId})
        RETURNING id, booking_code
      `;

      await tx`
        UPDATE lotteries
        SET drawn_at = now(), winner_id = ${winnerId}, booking_id = ${booking.id}
        WHERE id = ${lotteryId}
      `;

      await tx`
        INSERT INTO booking_events (booking_id, facility_id, user_id, type, payload)
        VALUES (${booking.id}, ${lottery.facility_id}, ${winnerId},
                'lottery.drawn',
                ${sql.json({
                  lotteryId,
                  entrants: entries.length,
                  seed: lottery.seed,
                })})
      `;

      return {
        ok: true as const,
        winnerId,
        bookingCode: booking.booking_code,
        entrants: entries.length,
      };
    }),
  );
}

/** Everything needed to render and audit one draw. */
export async function getLottery(lotteryId: string): Promise<LotteryView | null> {
  const [lottery] = await sql<
    {
      id: string; facility_id: string; facility_name: string; seed: string;
      opens_at: string; closes_at: string; drawn_at: string | null;
      winner_id: string | null; winner_name: string | null;
      booking_code: string | null; starts_at: string; ends_at: string;
    }[]
  >`
    SELECT l.id, l.facility_id, f.name AS facility_name, l.seed,
           l.opens_at, l.closes_at, l.drawn_at, l.winner_id,
           u.name AS winner_name, b.booking_code,
           lower(l.during) AS starts_at, upper(l.during) AS ends_at
    FROM lotteries l
    JOIN facilities f ON f.id = l.facility_id
    LEFT JOIN users u ON u.id = l.winner_id
    LEFT JOIN bookings b ON b.id = l.booking_id
    WHERE l.id = ${lotteryId}
  `;
  if (!lottery) return null;

  const entries = await sql<
    {
      user_id: string; user_name: string; weight: number;
      reliability_score: number; entered_at: string;
    }[]
  >`
    SELECT e.user_id, u.name AS user_name, e.weight,
           u.reliability_score, e.entered_at
    FROM lottery_entries e JOIN users u ON u.id = e.user_id
    WHERE e.lottery_id = ${lotteryId}
    ORDER BY e.entered_at
  `;

  const total = entries.reduce((s, e) => s + e.weight, 0) || 1;

  return {
    id: lottery.id,
    facilityId: lottery.facility_id,
    facilityName: lottery.facility_name,
    startsAt: new Date(lottery.starts_at).toISOString(),
    endsAt: new Date(lottery.ends_at).toISOString(),
    opensAt: new Date(lottery.opens_at).toISOString(),
    closesAt: new Date(lottery.closes_at).toISOString(),
    seed: lottery.seed,
    drawnAt: lottery.drawn_at ? new Date(lottery.drawn_at).toISOString() : null,
    winnerId: lottery.winner_id,
    winnerName: lottery.winner_name,
    bookingCode: lottery.booking_code,
    entries: entries.map((e) => ({
      userId: e.user_id,
      userName: e.user_name,
      reliability: e.reliability_score,
      weight: e.weight,
      chance: Math.round((e.weight / total) * 1000) / 10,
      enteredAt: new Date(e.entered_at).toISOString(),
      won: e.user_id === lottery.winner_id,
    })),
  };
}
