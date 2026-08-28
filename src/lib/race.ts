/**
 * The race harness.
 *
 * Fires N booking attempts at ONE slot as simultaneously as the runtime
 * allows, in either of two modes, and records what each attempt did with real
 * server-side timings.
 *
 * Why the burst runs on the server rather than as N fetches from the browser:
 * browsers cap concurrent connections per origin (six-ish on HTTP/1.1), so a
 * client-side burst is silently serialised into waves and never actually
 * races. Firing from the server makes the contention genuine — and it is the
 * contention, not the animation, that we are claiming to have solved.
 */
import { randomUUID } from "node:crypto";
import { sql } from "@/db/client";
import { createBooking } from "@/lib/booking";

export type RaceMode = "safe" | "naive";

export type RaceAttempt = {
  attemptNo: number;
  userId: string;
  userName: string;
  outcome: string;
  sqlstate: string | null;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  bookingCode: string | null;
};

export type RaceResult = {
  runId: string;
  mode: RaceMode;
  facilityId: string;
  facilityName: string;
  startsAt: string;
  endsAt: string;
  requested: number;
  confirmed: number;
  rejected: number;
  /**
   * Rows actually in the database for this slot afterwards. This is the number
   * that matters: it is read back from Postgres, not tallied from the
   * responses, so it cannot flatter the implementation.
   */
  rowsInDb: number;
  /** True when the run produced a state the product forbids. */
  doubleBooked: boolean;
  wallClockMs: number;
  attempts: RaceAttempt[];
  outcomeCounts: Record<string, number>;
};

/** Clears whatever a previous run left on the slot, so each run starts level. */
async function resetSlot(facilityId: string, start: Date, end: Date) {
  await sql`
    DELETE FROM bookings
    WHERE facility_id = ${facilityId}
      AND during && tstzrange(${start}, ${end}, '[)')
      AND (idempotency_key LIKE 'race-%' OR idempotency_key LIKE 'seed-%')
  `;
  await sql`
    DELETE FROM naive_bookings
    WHERE facility_id = ${facilityId}
      AND during && tstzrange(${start}, ${end}, '[)')
  `;
}

/**
 * The unsafe path, written the way this is usually written.
 *
 * Check whether the slot is free, then insert if it looked free. Every line is
 * individually reasonable. It is wrong only because another request can commit
 * in the gap between the question and the answer — which is precisely the
 * window the exclusion constraint removes.
 *
 * ── On making the failure deterministic ──────────────────────────────────
 * This used to sleep 20 ms between the read and the write and hope that all
 * contenders got their read in first. That held while the database was a
 * continent away and every query cost ~250 ms; once the functions moved next
 * to Postgres in `sin1`, round trips fell to about a millisecond, some reads
 * landed *after* the first insert had committed, and a demo run could come
 * back with one booking — from the implementation that has no protection at
 * all. Right answer, no reasoning: exactly the kind of accident that teaches
 * a team the wrong lesson.
 *
 * So the gap is now structural instead of temporal. `gap` resolves only once
 * every contender has finished its read, which is the interleaving a
 * read-then-write is *always* exposed to and hits sooner or later in
 * production. Nothing about the unsafe code changed — it is still check,
 * then write, with no constraint and no lock. What changed is that the
 * scheduler no longer gets to hide the bug on a fast network.
 */
async function naiveAttempt(
  facilityId: string,
  userId: string,
  userName: string,
  start: Date,
  end: Date,
  runId: string,
  gap: () => Promise<void>,
) {
  const existing = await sql`
    SELECT 1 FROM naive_bookings
    WHERE facility_id = ${facilityId}
      AND status = 'confirmed'
      AND during && tstzrange(${start}, ${end}, '[)')
    LIMIT 1
  `;
  const looksFree = existing.length === 0;

  // The gap. In production this is network latency, a validation call, or a
  // payment hop.
  await gap();

  if (!looksFree) {
    return { outcome: "SLOT_TAKEN", sqlstate: null as string | null };
  }

  await sql`
    INSERT INTO naive_bookings (facility_id, user_id, user_name, during, run_id)
    VALUES (${facilityId}, ${userId}, ${userName},
            tstzrange(${start}, ${end}, '[)'), ${runId})
  `;
  return { outcome: "CONFIRMED", sqlstate: null as string | null };
}

/**
 * A barrier that opens once `total` participants have arrived, or after
 * `timeoutMs` regardless.
 *
 * The timeout matters: if one read fails or hangs, the run must still finish
 * and report rather than deadlock the whole demo on a missing arrival.
 */
function makeBarrier(total: number, timeoutMs = 5_000) {
  let arrived = 0;
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const timer = setTimeout(open, timeoutMs);
  return async () => {
    if (++arrived >= total) {
      clearTimeout(timer);
      open();
    }
    await gate;
  };
}

export async function runRace(opts: {
  facilityId: string;
  startsAt: Date;
  endsAt: Date;
  count: number;
  mode: RaceMode;
}): Promise<RaceResult> {
  const runId = randomUUID();
  const { facilityId, startsAt, endsAt, mode } = opts;
  const count = Math.max(2, Math.min(200, opts.count));

  const [facility] = await sql<{ name: string }[]>`
    SELECT name FROM facilities WHERE id = ${facilityId}
  `;
  if (!facility) throw new Error("facility not found");

  // Distinct students, so a run reads as fifty people rather than one person
  // hammering a button. Shuffled per run so repeat demos are not identical.
  const roster = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM users WHERE role = 'student'
    ORDER BY md5(id::text || ${runId}) LIMIT ${count}
  `;
  if (roster.length === 0) throw new Error("no students seeded");

  // If the roster is smaller than the requested burst, cycle it rather than
  // silently shrinking the run — the requested concurrency is the whole point,
  // and an attempt count that quietly differs from what was asked for would
  // make the demo misleading.
  const contenders = Array.from({ length: count }, (_, i) => roster[i % roster.length]);

  await resetSlot(facilityId, startsAt, endsAt);

  // Clear the contenders' own clashing bookings, otherwise most of them are
  // rejected by the "you cannot be on two courts at once" rule and the run
  // stops testing the thing it is meant to test.
  await sql`
    DELETE FROM bookings
    WHERE user_id = ANY(${[...new Set(contenders.map((c) => c.id))]})
      AND during && tstzrange(${startsAt}, ${endsAt}, '[)')
  `;

  /**
   * The starting gun.
   *
   * Every attempt is constructed up front and then blocks on one shared
   * promise, so none of them can begin before the others are ready. Without
   * this barrier the first request would be milliseconds ahead of the last and
   * would simply win on latency — which would prove nothing.
   */
  let fire!: () => void;
  const gun = new Promise<void>((resolve) => {
    fire = resolve;
  });

  const attempts: RaceAttempt[] = [];

  // Opens once every naive contender has read the slot — see naiveAttempt.
  const gap = makeBarrier(count);

  const runners = contenders.map(async (contender, i) => {
    await gun;
    const startedAt = Date.now();
    let outcome = "ERROR";
    let sqlstate: string | null = null;
    let bookingCode: string | null = null;

    try {
      if (mode === "naive") {
        const r = await naiveAttempt(
          facilityId, contender.id, contender.name, startsAt, endsAt, runId,
          gap,
        );
        outcome = r.outcome;
        sqlstate = r.sqlstate;
      } else {
        const r = await createBooking({
          facilityId,
          userId: contender.id,
          startsAt,
          endsAt,
          // A distinct key per attempt: these are forty genuinely different
          // intents, not one intent retried.
          idempotencyKey: `race-${runId}-${i}`,
          raceRunId: runId,
        });
        if (r.ok) {
          outcome = r.replayed ? "IDEMPOTENT_REPLAY" : "CONFIRMED";
          bookingCode = r.booking.bookingCode;
        } else {
          outcome = r.code;
          sqlstate = r.sqlstate ?? null;
        }
      }
    } catch (e) {
      outcome = "ERROR";
      sqlstate = (e as { code?: string })?.code ?? null;
    }

    const finishedAt = Date.now();
    attempts.push({
      attemptNo: i + 1,
      userId: contender.id,
      userName: contender.name,
      outcome,
      sqlstate,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      bookingCode,
    });
  });

  const wallStart = Date.now();
  fire();
  await Promise.all(runners);
  const wallClockMs = Date.now() - wallStart;

  attempts.sort((a, b) => a.attemptNo - b.attemptNo);

  // Read the truth back out of the database rather than trusting our tally.
  const [{ rows_in_db }] = mode === "naive"
    ? await sql<{ rows_in_db: number }[]>`
        SELECT count(*)::int AS rows_in_db FROM naive_bookings
        WHERE facility_id = ${facilityId}
          AND during && tstzrange(${startsAt}, ${endsAt}, '[)')
      `
    : await sql<{ rows_in_db: number }[]>`
        SELECT count(*)::int AS rows_in_db FROM bookings
        WHERE facility_id = ${facilityId} AND status = 'confirmed'
          AND during && tstzrange(${startsAt}, ${endsAt}, '[)')
      `;

  // Persist the run so the waterfall can be reopened later — a judge asking
  // "can you show that again?" should not need a re-run.
  if (attempts.length) {
    await sql`
      INSERT INTO race_attempts ${sql(
        attempts.map((a) => ({
          run_id: runId,
          mode,
          attempt_no: a.attemptNo,
          user_id: a.userId,
          user_name: a.userName,
          outcome: a.outcome,
          sqlstate: a.sqlstate,
          started_at: new Date(a.startedAt),
          finished_at: new Date(a.finishedAt),
          duration_ms: a.durationMs,
        })),
      )}
    `;
  }

  const outcomeCounts: Record<string, number> = {};
  for (const a of attempts) {
    outcomeCounts[a.outcome] = (outcomeCounts[a.outcome] ?? 0) + 1;
  }

  const confirmed = attempts.filter((a) => a.outcome === "CONFIRMED").length;

  return {
    runId,
    mode,
    facilityId,
    facilityName: facility.name,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    requested: count,
    confirmed,
    rejected: attempts.length - confirmed,
    rowsInDb: rows_in_db,
    doubleBooked: rows_in_db > 1,
    wallClockMs,
    attempts,
    outcomeCounts,
  };
}

/**
 * Whole-table sweep for overlapping live bookings.
 *
 * Deliberately checks BOTH tables. Reporting only the protected one would let
 * the panel read "invariant holds" in green immediately after the naive run
 * has just corrupted its own table — technically true of `bookings`, and
 * thoroughly misleading as a claim about the demo the judge just watched.
 *
 * The comparison is every confirmed row against every other confirmed row on
 * the same court — not a sample, and not restricted to the slot under test.
 */
export async function invariantCheck() {
  const [row] = await sql<
    {
      overlaps: number;
      confirmed: number;
      facilities: number;
      naive_overlaps: number;
      naive_rows: number;
    }[]
  >`
    SELECT
      (SELECT count(*)::int
         FROM bookings a JOIN bookings b
           ON a.facility_id = b.facility_id
          AND a.id < b.id
          AND a.during && b.during
        WHERE a.status = 'confirmed' AND b.status = 'confirmed') AS overlaps,
      (SELECT count(*)::int FROM bookings WHERE status = 'confirmed') AS confirmed,
      (SELECT count(*)::int FROM facilities) AS facilities,
      (SELECT count(*)::int
         FROM naive_bookings a JOIN naive_bookings b
           ON a.facility_id = b.facility_id
          AND a.id < b.id
          AND a.during && b.during
        WHERE a.status = 'confirmed' AND b.status = 'confirmed') AS naive_overlaps,
      (SELECT count(*)::int FROM naive_bookings) AS naive_rows
  `;
  return {
    overlaps: row.overlaps,
    confirmedRows: row.confirmed,
    facilities: row.facilities,
    naiveOverlaps: row.naive_overlaps,
    naiveRows: row.naive_rows,
    holds: row.overlaps === 0,
  };
}
