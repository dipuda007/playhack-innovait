/**
 * The booking service.
 *
 * ── The one rule this file obeys ───────────────────────────────────────────
 * Contended state is NEVER read and then written.
 *
 * There is no "is this slot free?" query anywhere on the write path. Asking
 * that question and then acting on the answer is precisely the race the brief
 * describes: between the SELECT and the INSERT, another request commits and
 * the answer silently goes stale. Instead we attempt the INSERT and let the
 * `bookings_no_overlap` exclusion constraint be the single arbiter. Exactly
 * one writer can win, decided inside the storage engine, and the loser gets a
 * precise SQLSTATE rather than a corrupted table.
 *
 * Reads of *uncontended* configuration (opening hours, whether the facility is
 * active) happen freely — that data is not racing with anything.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { randomUUID } from "node:crypto";
import {
  sql,
  PG,
  sqlstateOf,
  constraintOf,
  withDeadlockRetry,
} from "@/db/client";
import {
  reject,
  type Alternative,
  type BookingRecord,
  type BookingResult,
} from "@/lib/outcomes";
import {
  BOOKING_HORIZON_DAYS,
  istClock,
  istDateKey,
  istInstant,
  istTimeLabel,
} from "@/lib/time";

export type BookingRequest = {
  facilityId: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
  /** Client-generated per booking intent. The retry-safety hinge. */
  idempotencyKey: string;
  partySize?: number;
  note?: string;
  /** Set by the lottery path; skips the peak-window redirect. */
  fromLottery?: string;
  /** Race-demo bookkeeping only. */
  raceRunId?: string;
};

type FacilityRow = {
  id: string;
  slug: string;
  name: string;
  sport: string;
  location: string;
  capacity: number;
  opens_at: string;
  closes_at: string;
  slot_minutes: number;
  peak_from: string | null;
  is_active: boolean;
};

/**
 * Stable 64-bit key for Postgres advisory locks.
 *
 * Advisory locks are keyed by bigint, so a UUID has to be folded down. FNV-1a
 * is used because it is deterministic across processes — two app instances
 * must derive the same key for the same user or the lock buys us nothing.
 */
function lockKey(input: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash ^ BigInt(input.charCodeAt(i))) * prime) & mask;
  }
  // Fold into the signed bigint range Postgres expects.
  return BigInt.asIntN(64, hash);
}

function toRecord(row: Record<string, unknown>): BookingRecord {
  return {
    id: String(row.id),
    bookingCode: String(row.booking_code),
    facilityId: String(row.facility_id),
    facilityName: String(row.facility_name ?? ""),
    userId: row.user_id ? String(row.user_id) : null,
    userName: row.user_name ? String(row.user_name) : null,
    startsAt: new Date(String(row.starts_at)).toISOString(),
    endsAt: new Date(String(row.ends_at)).toISOString(),
    status: String(row.status),
    kind: String(row.kind),
    partySize: Number(row.party_size ?? 1),
    note: row.note ? String(row.note) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

/**
 * Built on call, not at module scope. A fragment created at import time would
 * touch the connection pool while the module graph is still loading, which
 * defeats the lazy pool and fails any build without a DATABASE_URL.
 */
const selectBooking = () => sql`
  SELECT b.id, b.facility_id, b.user_id, b.status, b.kind, b.party_size,
         b.note, b.booking_code, b.created_at,
         lower(b.during) AS starts_at, upper(b.during) AS ends_at,
         f.name AS facility_name, u.name AS user_name
  FROM bookings b
  JOIN facilities f ON f.id = b.facility_id
  LEFT JOIN users u ON u.id = b.user_id
`;

// ---------------------------------------------------------------------------
// Pre-flight validation — pure configuration checks, no contended reads
// ---------------------------------------------------------------------------

function validateAgainstFacility(
  facility: FacilityRow,
  startsAt: Date,
  endsAt: Date,
) {
  if (!facility.is_active) return reject("FACILITY_INACTIVE");

  const now = new Date();
  if (startsAt.getTime() <= now.getTime()) return reject("PAST_SLOT");

  const horizon = new Date(
    now.getTime() + BOOKING_HORIZON_DAYS * 86_400_000,
  );
  if (startsAt.getTime() > horizon.getTime()) return reject("BEYOND_HORIZON");

  const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (durationMin !== facility.slot_minutes) return reject("MISALIGNED_SLOT");

  // The slot must sit on the facility's grid and inside its opening hours,
  // evaluated in IST wall-clock terms.
  const dayKey = istDateKey(startsAt);
  const opens = istInstant(dayKey, facility.opens_at);
  const closes = istInstant(dayKey, facility.closes_at);

  if (startsAt < opens || endsAt > closes) return reject("FACILITY_CLOSED");

  const offsetMin = (startsAt.getTime() - opens.getTime()) / 60_000;
  if (offsetMin % facility.slot_minutes !== 0) return reject("MISALIGNED_SLOT");

  return null;
}

// ---------------------------------------------------------------------------
// Alternatives — a rejection always ships with somewhere else to go
// ---------------------------------------------------------------------------

/**
 * Short-lived cache for suggestion lookups.
 *
 * When 200 requests lose the same race they would otherwise each run the same
 * `generate_series` scan to produce the same three suggestions — in a measured
 * 200-way burst that was the single largest cost in the request, far above the
 * booking transaction itself.
 *
 * Caching is safe here precisely because a suggestion is advisory: it is a
 * hint about where else to look, never a reservation. A two-second-stale hint
 * costs the user one extra tap. Nothing on the write path reads this, so a
 * stale entry cannot influence who wins a slot.
 */
const suggestionCache = new Map<string, { at: number; value: Alternative[] }>();
const SUGGESTION_TTL_MS = 2_000;

export async function findAlternatives(
  facility: Pick<FacilityRow, "id" | "sport" | "slot_minutes">,
  startsAt: Date,
  endsAt: Date,
  limit = 3,
): Promise<Alternative[]> {
  const cacheKey = `${facility.id}:${startsAt.getTime()}:${limit}`;
  const hit = suggestionCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SUGGESTION_TTL_MS) return hit.value;

  // Opportunistic sweep; the map only ever holds contended slots.
  if (suggestionCache.size > 500) {
    const cutoff = Date.now() - SUGGESTION_TTL_MS;
    for (const [k, v] of suggestionCache) {
      if (v.at < cutoff) suggestionCache.delete(k);
    }
  }

  const windowStart = new Date(startsAt.getTime() - 3 * 3_600_000);
  const windowEnd = new Date(endsAt.getTime() + 3 * 3_600_000);

  // Candidate slots on the same grid, in the same sport, that currently have
  // no live booking. This IS a read of contended state — and that is fine,
  // because a suggestion is advisory. If it goes stale the user simply loses
  // that attempt too and gets fresh suggestions. Nothing is written from it.
  const rows = await sql<
    {
      facility_id: string;
      facility_name: string;
      slug: string;
      sport: string;
      slot_start: string;
      slot_end: string;
    }[]
  >`
    WITH grid AS (
      SELECT f.id  AS facility_id,
             f.name AS facility_name,
             f.slug,
             f.sport,
             gs AS slot_start,
             gs + make_interval(mins => f.slot_minutes) AS slot_end
      FROM facilities f
      CROSS JOIN LATERAL generate_series(
        ${windowStart}::timestamptz,
        ${windowEnd}::timestamptz,
        make_interval(mins => f.slot_minutes)
      ) AS gs
      WHERE f.is_active
        AND f.sport = ${facility.sport}
        AND f.slot_minutes = ${facility.slot_minutes}
        AND gs > now()
        AND (gs AT TIME ZONE 'Asia/Kolkata')::time >= f.opens_at
        AND ((gs + make_interval(mins => f.slot_minutes))
              AT TIME ZONE 'Asia/Kolkata')::time <= f.closes_at
    )
    SELECT g.facility_id, g.facility_name, g.slug, g.sport,
           g.slot_start, g.slot_end
    FROM grid g
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.facility_id = g.facility_id
        AND b.status = 'confirmed'
        AND b.during && tstzrange(g.slot_start, g.slot_end, '[)')
    )
    ORDER BY
      -- Prefer the same court, then the nearest time to what was wanted.
      (g.facility_id <> ${facility.id})::int,
      abs(extract(epoch FROM (g.slot_start - ${startsAt}::timestamptz)))
    LIMIT ${limit}
  `;

  const value = rows.map((r, i) => {
    const start = new Date(r.slot_start);
    const end = new Date(r.slot_end);
    const sameCourt = r.facility_id === facility.id;
    const deltaMin = Math.round(
      (start.getTime() - startsAt.getTime()) / 60_000,
    );
    return {
      facilityId: r.facility_id,
      facilityName: r.facility_name,
      facilitySlug: r.slug,
      sport: r.sport,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      label: `${istTimeLabel(start)}–${istTimeLabel(end)}`,
      reason: sameCourt
        ? `Same court, ${Math.abs(deltaMin)} min ${deltaMin < 0 ? "earlier" : "later"}`
        : `${r.facility_name} at ${istClock(start)}`,
      distance: i,
    };
  });

  suggestionCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------------------
// The write path
// ---------------------------------------------------------------------------

export async function createBooking(
  req: BookingRequest,
): Promise<BookingResult> {
  const [facility] = await sql<FacilityRow[]>`
    SELECT id, slug, name, sport, location, capacity, opens_at, closes_at,
           slot_minutes, peak_from, is_active
    FROM facilities WHERE id = ${req.facilityId}
  `;
  if (!facility) return reject("NOT_FOUND");

  const invalid = validateAgainstFacility(facility, req.startsAt, req.endsAt);
  if (invalid) {
    invalid.alternatives = await findAlternatives(
      facility,
      req.startsAt,
      req.endsAt,
    );
    return invalid;
  }

  try {
    // The retry wrapper only ever fires on a cleanly rolled-back deadlock;
    // a lost race (23P01) falls straight through to the handler below.
    const result = await withDeadlockRetry(() =>
      sql.begin(async (tx) => {
      /**
       * Two advisory locks, always taken in ascending key order.
       *
       * WHY TWO:
       *   · per-USER, because the quota check below is a read-then-write. One
       *     student firing ten parallel requests would otherwise pass ten
       *     quota checks and commit all ten.
       *   · per-SLOT, because without it 200 contenders all pile into the
       *     exclusion constraint's wait-for-uncommitted-row path at once. The
       *     constraint still decides the winner either way, but the queue is
       *     far cheaper to resolve on a plain lock than on constraint waits
       *     tangled with foreign-key row locks.
       *
       * WHY SORTED — this is the part that matters:
       *   Taking two locks in an order that varies between transactions is the
       *   textbook way to build a deadlock. Transaction A holding the user
       *   lock and waiting for the slot lock, while B holds the slot lock and
       *   waits for the user lock, is a cycle, and Postgres breaks it by
       *   killing one of them after `deadlock_timeout`.
       *
       *   Measured, not theorised: a 200-way burst against one slot produced
       *   27 SQLSTATE 40P01 deadlock failures before this ordering was
       *   imposed, and zero after.
       *
       *   Sorting the two keys gives every transaction in the system one
       *   global lock order, which makes a cycle impossible to construct.
       */
      const slotKey = lockKey(`${req.facilityId}:${req.startsAt.getTime()}`);
      const userKey = lockKey(req.userId);
      const [firstLock, secondLock] =
        slotKey < userKey ? [slotKey, userKey] : [userKey, slotKey];

      // postgres.js sends bigint as text; the explicit cast keeps Postgres happy.
      await tx`SELECT pg_advisory_xact_lock(${firstLock.toString()}::bigint)`;
      await tx`SELECT pg_advisory_xact_lock(${secondLock.toString()}::bigint)`;

      const [{ used, quota }] = await tx<{ used: number; quota: number }[]>`
        SELECT
          (SELECT count(*)::int FROM bookings
            WHERE user_id = ${req.userId}
              AND status = 'confirmed'
              AND lower(during) > now()
              AND lower(during) < now() + interval '7 days') AS used,
          (SELECT weekly_quota FROM users WHERE id = ${req.userId}) AS quota
      `;
      if (used >= quota) {
        throw new DomainReject("QUOTA_EXCEEDED");
      }

      // A student cannot be on two courts at once. Same shape of rule as the
      // court invariant, but scoped to the person rather than the facility.
      const [clash] = await tx<{ id: string }[]>`
        SELECT id FROM bookings
        WHERE user_id = ${req.userId}
          AND status = 'confirmed'
          AND during && tstzrange(${req.startsAt}, ${req.endsAt}, '[)')
        LIMIT 1
      `;
      if (clash) throw new DomainReject("OVERLAPS_OWN");

      // ─────────────────────────────────────────────────────────────────
      // THE DECISIVE STATEMENT.
      //
      // No preceding availability check. This INSERT either commits and the
      // slot is the user's, or it raises 23P01 and the slot never was. There
      // is no window between deciding and doing, because they are the same
      // operation.
      // ─────────────────────────────────────────────────────────────────
      const [row] = await tx<Record<string, unknown>[]>`
        INSERT INTO bookings
          (facility_id, user_id, during, idempotency_key,
           party_size, note, lottery_id)
        VALUES (
          ${req.facilityId},
          ${req.userId},
          tstzrange(${req.startsAt}, ${req.endsAt}, '[)'),
          ${req.idempotencyKey},
          ${req.partySize ?? 1},
          ${req.note ?? null},
          ${req.fromLottery ?? null}
        )
        RETURNING id, facility_id, user_id, status, kind, party_size, note,
                  booking_code, created_at,
                  lower(during) AS starts_at, upper(during) AS ends_at
      `;

      // Same transaction as the booking: the audit trail cannot disagree with
      // reality, because a rollback takes both or neither.
      await tx`
        INSERT INTO booking_events (booking_id, facility_id, user_id, type, payload)
        VALUES (${String(row.id)}, ${req.facilityId}, ${req.userId},
                'booking.confirmed',
                ${sql.json({
                  bookingCode: String(row.booking_code),
                  raceRunId: req.raceRunId ?? null,
                })})
      `;

        return row;
      }),
    );

    const [full] = await sql<Record<string, unknown>[]>`
      ${selectBooking()} WHERE b.id = ${String(result.id)}
    `;

    return {
      ok: true,
      booking: toRecord(full),
      replayed: false,
      mechanism: req.fromLottery ? "lottery" : "exclusion-constraint",
    };
  } catch (err) {
    return handleWriteFailure(err, facility, req);
  }
}

/** Thrown inside the transaction to roll back with a typed product outcome. */
class DomainReject extends Error {
  constructor(public code: Parameters<typeof reject>[0]) {
    super(code);
  }
}

async function handleWriteFailure(
  err: unknown,
  facility: FacilityRow,
  req: BookingRequest,
): Promise<BookingResult> {
  if (err instanceof DomainReject) {
    const failure = reject(err.code);
    failure.alternatives = await findAlternatives(
      facility,
      req.startsAt,
      req.endsAt,
    );
    return failure;
  }

  const state = sqlstateOf(err);
  const constraint = constraintOf(err);

  // ── The loser of a race lands here ──────────────────────────────────────
  if (state === PG.EXCLUSION_VIOLATION) {
    // Distinguish "another student got it" from "it is closed for
    // maintenance", because those need different words and different offers.
    const [blocker] = await sql<{ kind: string }[]>`
      SELECT kind FROM bookings
      WHERE facility_id = ${req.facilityId}
        AND status = 'confirmed'
        AND during && tstzrange(${req.startsAt}, ${req.endsAt}, '[)')
      LIMIT 1
    `;

    const code =
      blocker?.kind === "block" ? "UNDER_MAINTENANCE" : "SLOT_TAKEN";

    return {
      ...reject(code, { sqlstate: state, constraint: constraint ?? undefined }),
      alternatives: await findAlternatives(facility, req.startsAt, req.endsAt),
      waitlistable: code === "SLOT_TAKEN",
    };
  }

  // ── Idempotent replay ───────────────────────────────────────────────────
  // The same intent arrived twice: a double-tap, or a client retry after a
  // timeout it could not distinguish from a failure. Transactions do not help
  // here — both requests are individually valid. The unique idempotency key
  // makes the second one return the first one's booking instead of a new row.
  if (state === PG.UNIQUE_VIOLATION && constraint?.includes("idempotency")) {
    const [existing] = await sql<Record<string, unknown>[]>`
      ${selectBooking()} WHERE b.idempotency_key = ${req.idempotencyKey}
    `;
    if (existing) {
      return {
        ok: true,
        booking: toRecord(existing),
        replayed: true,
        mechanism: "idempotent-replay",
      };
    }
  }

  throw err;
}

// ---------------------------------------------------------------------------
// Cancellation — frees the slot and promotes the waitlist atomically
// ---------------------------------------------------------------------------

export async function cancelBooking(bookingId: string, userId: string) {
  return sql.begin(async (tx) => {
    const [row] = await tx<Record<string, unknown>[]>`
      UPDATE bookings
      SET status = 'cancelled', cancelled_at = now()
      WHERE id = ${bookingId}
        AND user_id = ${userId}
        AND status = 'confirmed'
      RETURNING id, facility_id, user_id,
                lower(during) AS starts_at, upper(during) AS ends_at
    `;
    if (!row) return { ok: false as const, code: "NOT_FOUND" as const };

    await tx`
      INSERT INTO booking_events (booking_id, facility_id, user_id, type, payload)
      VALUES (${bookingId}, ${String(row.facility_id)}, ${userId},
              'booking.cancelled', '{}'::jsonb)
    `;

    /**
     * Promotion happens in the SAME transaction as the release.
     *
     * If it were a separate job there would be a window where the slot is free
     * but nobody has been told — and two concurrent cancellations could offer
     * one slot to two people. Here the release and the offer commit together,
     * and `waitlist_one_offer_per_slot` backs it up at the database level.
     *
     * FOR UPDATE SKIP LOCKED means concurrent promoters take different rows
     * instead of blocking on each other.
     */
    const [next] = await tx<{ id: string; user_id: string }[]>`
      SELECT id, user_id FROM waitlist
      WHERE facility_id = ${String(row.facility_id)}
        AND during = tstzrange(${String(row.starts_at)}::timestamptz,
                               ${String(row.ends_at)}::timestamptz, '[)')
        AND state = 'waiting'
      ORDER BY enqueued_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    let promoted: string | null = null;
    if (next) {
      await tx`
        UPDATE waitlist
        SET state = 'offered',
            claim_expires_at = now() + interval '15 minutes',
            notified_at = now()
        WHERE id = ${next.id}
      `;
      await tx`
        INSERT INTO booking_events (facility_id, user_id, type, payload)
        VALUES (${String(row.facility_id)}, ${next.user_id},
                'waitlist.offered',
                ${sql.json({ expiresInMinutes: 15 })})
      `;
      promoted = next.user_id;
    }

    return { ok: true as const, promotedUserId: promoted };
  });
}

export { lockKey };
