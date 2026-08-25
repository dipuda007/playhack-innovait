/**
 * Availability reads.
 *
 * Availability is *derived*, never stored. There is no `slots` table holding a
 * row per court per hour per day waiting to be flipped to "taken" — that table
 * would be a second source of truth about occupancy, and the moment it can
 * disagree with `bookings` the brief's consistency requirement is already lost.
 *
 * Instead the slot grid is generated on the fly and left-joined against live
 * bookings. One query per facility-day, and the answer is by construction the
 * same fact the exclusion constraint enforces on writes.
 */
import { sql } from "@/db/client";
import { istInstant, istTimeLabel, type SlotSpec } from "@/lib/time";

export type SlotState =
  | "free"
  | "taken"
  | "mine"
  | "blocked"
  | "past"
  | "waitlisted";

export type SlotView = {
  startsAt: string;
  endsAt: string;
  label: string;
  range: string;
  state: SlotState;
  peak: boolean;
  /** Who holds it, when it is taken and the viewer is allowed to know. */
  holder: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  /** Reason text for a maintenance block. */
  blockNote: string | null;
  waitlistCount: number;
  /** Viewer's position in the queue, when they are on it. */
  myQueuePosition: number | null;
};

export type FacilityView = {
  id: string;
  slug: string;
  name: string;
  sport: string;
  location: string;
  description: string | null;
  capacity: number;
  opensAt: string;
  closesAt: string;
  slotMinutes: number;
  peakFrom: string | null;
  color: string;
  emoji: string;
  isActive: boolean;
};

export type FacilityDay = {
  facility: FacilityView;
  dateKey: string;
  slots: SlotView[];
  freeCount: number;
  totalCount: number;
};

/** Built on call — see the note on the lazy pool in db/client.ts. */
const facilityColumns = () => sql`
  id, slug, name, sport, location, description, capacity,
  opens_at, closes_at, slot_minutes, peak_from, color, emoji, is_active
`;

type FacilityRow = {
  id: string; slug: string; name: string; sport: string; location: string;
  description: string | null; capacity: number; opens_at: string;
  closes_at: string; slot_minutes: number; peak_from: string | null;
  color: string; emoji: string; is_active: boolean;
};

function toFacilityView(r: FacilityRow): FacilityView {
  return {
    id: r.id, slug: r.slug, name: r.name, sport: r.sport,
    location: r.location, description: r.description, capacity: r.capacity,
    opensAt: r.opens_at, closesAt: r.closes_at, slotMinutes: r.slot_minutes,
    peakFrom: r.peak_from, color: r.color, emoji: r.emoji,
    isActive: r.is_active,
  };
}

export async function listFacilities(): Promise<FacilityView[]> {
  const rows = await sql<FacilityRow[]>`
    SELECT ${facilityColumns()} FROM facilities
    ORDER BY is_active DESC, sport, name
  `;
  return rows.map(toFacilityView);
}

export async function getFacility(slug: string): Promise<FacilityView | null> {
  const [row] = await sql<FacilityRow[]>`
    SELECT ${facilityColumns()} FROM facilities WHERE slug = ${slug}
  `;
  return row ? toFacilityView(row) : null;
}

/**
 * Occupancy summary for a set of facilities on one day — used by the browse
 * grid, where rendering every slot for every court would be wasteful.
 *
 * One query for all facilities, not one per facility: the browse page must not
 * degrade into N+1 as the campus adds courts.
 */
export type DaySummary = {
  /** Slots still bookable right now. */
  free: number;
  /** Slots in the day that have not already started. */
  remaining: number;
  /** Every slot in the day, past included. */
  total: number;
  nextFree: string | null;
};

export async function daySummaries(
  dateKey: string,
): Promise<Map<string, DaySummary>> {
  const dayStart = istInstant(dateKey, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const rows = await sql<
    {
      facility_id: string;
      total: number;
      remaining: number;
      taken: number;
      next_free: string | null;
    }[]
  >`
    WITH grid AS (
      SELECT f.id AS facility_id,
             gs AS slot_start,
             gs + make_interval(mins => f.slot_minutes) AS slot_end
      FROM facilities f
      CROSS JOIN LATERAL generate_series(
        ${dayStart}::timestamptz + f.opens_at - time '00:00',
        ${dayStart}::timestamptz + f.closes_at - time '00:00'
          - make_interval(mins => f.slot_minutes),
        make_interval(mins => f.slot_minutes)
      ) AS gs
      WHERE f.is_active
        AND gs >= ${dayStart}::timestamptz
        AND gs <  ${dayEnd}::timestamptz
    ),
    marked AS (
      SELECT g.facility_id,
             g.slot_start,
             EXISTS (
               SELECT 1 FROM bookings b
               WHERE b.facility_id = g.facility_id
                 AND b.status = 'confirmed'
                 AND b.during && tstzrange(g.slot_start, g.slot_end, '[)')
             ) AS is_taken,
             g.slot_start < now() AS is_past
      FROM grid g
    )
    SELECT facility_id,
           count(*)::int AS total,
           -- Slots that have not started yet. Counting an 8 a.m. slot as
           -- "taken" at 8 p.m. is technically true and completely useless to
           -- a student: on today's view it makes every court read "fully
           -- booked" when the real answer is "the day is over".
           count(*) FILTER (WHERE NOT is_past)::int AS remaining,
           count(*) FILTER (WHERE is_taken AND NOT is_past)::int AS taken,
           min(slot_start) FILTER (WHERE NOT is_taken AND NOT is_past)
             AS next_free
    FROM marked
    GROUP BY facility_id
  `;

  const out = new Map<string, DaySummary>();
  for (const r of rows) {
    out.set(r.facility_id, {
      free: r.remaining - r.taken,
      remaining: r.remaining,
      total: r.total,
      nextFree: r.next_free ? new Date(r.next_free).toISOString() : null,
    });
  }
  return out;
}

/**
 * The full slot grid for one facility on one day, resolved against live data.
 */
export async function facilityDay(
  slug: string,
  dateKey: string,
  viewerId: string | null,
): Promise<FacilityDay | null> {
  const facility = await getFacility(slug);
  if (!facility) return null;

  const dayStart = istInstant(dateKey, facility.opensAt);
  const dayEnd = istInstant(dateKey, facility.closesAt);

  const [bookings, queues] = await Promise.all([
    sql<
      {
        id: string; user_id: string | null; user_name: string | null;
        kind: string; note: string | null; booking_code: string;
        starts_at: string; ends_at: string;
      }[]
    >`
      SELECT b.id, b.user_id, u.name AS user_name, b.kind, b.note,
             b.booking_code,
             lower(b.during) AS starts_at, upper(b.during) AS ends_at
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      WHERE b.facility_id = ${facility.id}
        AND b.status = 'confirmed'
        AND b.during && tstzrange(${dayStart}, ${dayEnd}, '[)')
    `,
    sql<
      { starts_at: string; ends_at: string; total: number; my_pos: number | null }[]
    >`
      SELECT lower(during) AS starts_at, upper(during) AS ends_at,
             count(*)::int AS total,
             min(rn) FILTER (WHERE user_id = ${viewerId}) AS my_pos
      FROM (
        SELECT during, user_id,
               row_number() OVER (PARTITION BY during ORDER BY enqueued_at) AS rn
        FROM waitlist
        WHERE facility_id = ${facility.id}
          AND state IN ('waiting', 'offered')
          AND during && tstzrange(${dayStart}, ${dayEnd}, '[)')
      ) ranked
      GROUP BY during
    `,
  ]);

  const now = Date.now();

  const slots: SlotSpec[] = [];
  const stepMs = facility.slotMinutes * 60_000;
  for (let t = dayStart.getTime(); t + stepMs <= dayEnd.getTime(); t += stepMs) {
    const start = new Date(t);
    const end = new Date(t + stepMs);
    const peakStart = facility.peakFrom
      ? istInstant(dateKey, facility.peakFrom).getTime()
      : Infinity;
    slots.push({
      start, end,
      label: istTimeLabel(start),
      range: `${istTimeLabel(start)}–${istTimeLabel(end)}`,
      peak: t >= peakStart,
    });
  }

  const views: SlotView[] = slots.map((slot) => {
    const s = slot.start.getTime();
    const e = slot.end.getTime();

    // Overlap, not equality: a two-hour maintenance block covers two slots.
    const hit = bookings.find((b) => {
      const bs = new Date(b.starts_at).getTime();
      const be = new Date(b.ends_at).getTime();
      return bs < e && be > s;
    });

    const queue = queues.find((q) => {
      const qs = new Date(q.starts_at).getTime();
      return qs === s;
    });

    let state: SlotState;
    if (hit) {
      if (hit.kind === "block") state = "blocked";
      else if (viewerId && hit.user_id === viewerId) state = "mine";
      else state = "taken";
    } else if (s < now) {
      state = "past";
    } else if (queue?.my_pos != null) {
      state = "waitlisted";
    } else {
      state = "free";
    }

    return {
      startsAt: slot.start.toISOString(),
      endsAt: slot.end.toISOString(),
      label: slot.label,
      range: slot.range,
      state,
      peak: slot.peak,
      // Names are shown only for taken slots, so the grid reads as a real
      // campus. Nothing beyond a display name is exposed.
      holder: hit && hit.kind !== "block" ? hit.user_name : null,
      bookingId: hit?.id ?? null,
      bookingCode: hit?.booking_code ?? null,
      blockNote: hit?.kind === "block" ? hit.note : null,
      waitlistCount: queue?.total ?? 0,
      myQueuePosition: queue?.my_pos ?? null,
    };
  });

  return {
    facility,
    dateKey,
    slots: views,
    freeCount: views.filter((v) => v.state === "free").length,
    totalCount: views.length,
  };
}

/** A student's own bookings, upcoming first. */
export async function myBookings(userId: string) {
  return sql<
    {
      id: string; booking_code: string; status: string; party_size: number;
      note: string | null; starts_at: string; ends_at: string;
      facility_name: string; facility_slug: string; sport: string;
      emoji: string; color: string; location: string;
    }[]
  >`
    SELECT b.id, b.booking_code, b.status, b.party_size, b.note,
           lower(b.during) AS starts_at, upper(b.during) AS ends_at,
           f.name AS facility_name, f.slug AS facility_slug, f.sport,
           f.emoji, f.color, f.location
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    WHERE b.user_id = ${userId} AND b.kind = 'booking'
    ORDER BY (b.status = 'confirmed' AND lower(b.during) > now()) DESC,
             lower(b.during) DESC
    LIMIT 60
  `;
}

/** Outstanding waitlist offers and queue positions for a student. */
export async function myWaitlist(userId: string) {
  return sql<
    {
      id: string; state: string; claim_expires_at: string | null;
      starts_at: string; ends_at: string; position: number;
      facility_name: string; facility_slug: string; emoji: string;
    }[]
  >`
    SELECT w.id, w.state, w.claim_expires_at,
           lower(w.during) AS starts_at, upper(w.during) AS ends_at,
           f.name AS facility_name, f.slug AS facility_slug, f.emoji,
           (SELECT count(*)::int + 1 FROM waitlist w2
            WHERE w2.facility_id = w.facility_id AND w2.during = w.during
              AND w2.state = 'waiting' AND w2.enqueued_at < w.enqueued_at)
             AS position
    FROM waitlist w
    JOIN facilities f ON f.id = w.facility_id
    WHERE w.user_id = ${userId} AND w.state IN ('waiting', 'offered')
    ORDER BY lower(w.during)
  `;
}
