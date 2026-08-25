/**
 * Analytics queries.
 *
 * All aggregate over the same `bookings` table the booking path writes — there
 * is no separate reporting store to drift out of sync. Every number here is
 * therefore reconcilable against a booking a student can actually point at.
 */
import { sql } from "@/db/client";

/** Utilisation by facility × hour, over the trailing fortnight. */
export async function utilisationHeatmap() {
  return sql<
    {
      facility_id: string;
      facility_name: string;
      emoji: string;
      hour: number;
      bookings: number;
    }[]
  >`
    SELECT f.id AS facility_id, f.name AS facility_name, f.emoji,
           extract(hour FROM lower(b.during) AT TIME ZONE 'Asia/Kolkata')::int
             AS hour,
           count(*)::int AS bookings
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    WHERE b.kind = 'booking'
      AND b.status IN ('confirmed', 'completed', 'no_show')
      AND lower(b.during) > now() - interval '14 days'
    GROUP BY f.id, f.name, f.emoji, hour
    ORDER BY f.name, hour
  `;
}

/** Peak hours across the whole campus. */
export async function peakHours() {
  return sql<{ hour: number; bookings: number }[]>`
    SELECT extract(hour FROM lower(during) AT TIME ZONE 'Asia/Kolkata')::int
             AS hour,
           count(*)::int AS bookings
    FROM bookings
    WHERE kind = 'booking'
      AND status IN ('confirmed', 'completed', 'no_show')
      AND lower(during) > now() - interval '14 days'
    GROUP BY hour
    ORDER BY hour
  `;
}

/**
 * No-show rate per facility.
 *
 * The operationally useful number: a court that is fully booked and half empty
 * is a worse problem than one that is simply busy, because the slots were
 * denied to students who would have turned up.
 */
export async function noShowRates() {
  return sql<
    {
      facility_name: string;
      emoji: string;
      total: number;
      no_shows: number;
      rate: number;
    }[]
  >`
    SELECT f.name AS facility_name, f.emoji,
           count(*)::int AS total,
           count(*) FILTER (WHERE b.status = 'no_show')::int AS no_shows,
           round(
             100.0 * count(*) FILTER (WHERE b.status = 'no_show')
                   / nullif(count(*), 0)
           )::int AS rate
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    WHERE b.kind = 'booking'
      AND b.status IN ('completed', 'no_show')
      AND lower(b.during) > now() - interval '30 days'
    GROUP BY f.name, f.emoji
    HAVING count(*) > 0
    ORDER BY rate DESC, total DESC
  `;
}

/** Headline counters. */
export async function headline() {
  const [row] = await sql<
    {
      upcoming: number;
      last7: number;
      students: number;
      waitlisted: number;
      no_show_rate: number;
    }[]
  >`
    SELECT
      (SELECT count(*)::int FROM bookings
        WHERE status = 'confirmed' AND kind = 'booking'
          AND lower(during) > now()) AS upcoming,
      (SELECT count(*)::int FROM bookings
        WHERE kind = 'booking'
          AND lower(during) BETWEEN now() - interval '7 days' AND now()) AS last7,
      (SELECT count(DISTINCT user_id)::int FROM bookings
        WHERE lower(during) > now() - interval '30 days') AS students,
      (SELECT count(*)::int FROM waitlist WHERE state = 'waiting') AS waitlisted,
      (SELECT coalesce(round(
         100.0 * count(*) FILTER (WHERE status = 'no_show')
               / nullif(count(*), 0)), 0)::int
         FROM bookings
        WHERE status IN ('completed', 'no_show')
          AND lower(during) > now() - interval '30 days') AS no_show_rate
  `;
  return row;
}

/**
 * Under-used slots at times students actually want.
 *
 * Answers the question the brief hints at: "opportunities to improve access".
 * A court sitting empty at 7 p.m. is a genuine finding, because 7 p.m. is when
 * demand exists — the same court empty at 6 a.m. is not news.
 */
export async function underusedPeakSlots() {
  return sql<
    {
      facility_name: string;
      emoji: string;
      hour: number;
      free_days: number;
    }[]
  >`
    WITH grid AS (
      SELECT f.id, f.name, f.emoji,
             gs AS slot_start,
             gs + make_interval(mins => f.slot_minutes) AS slot_end
      FROM facilities f
      CROSS JOIN LATERAL generate_series(
        now() - interval '14 days', now(), make_interval(mins => f.slot_minutes)
      ) AS gs
      WHERE f.is_active
        AND (gs AT TIME ZONE 'Asia/Kolkata')::time
              BETWEEN time '17:00' AND time '21:00'
    )
    SELECT g.name AS facility_name, g.emoji,
           extract(hour FROM g.slot_start AT TIME ZONE 'Asia/Kolkata')::int AS hour,
           count(*)::int AS free_days
    FROM grid g
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.facility_id = g.id
        AND b.status IN ('confirmed', 'completed', 'no_show')
        AND b.during && tstzrange(g.slot_start, g.slot_end, '[)')
    )
    GROUP BY g.name, g.emoji, hour
    HAVING count(*) >= 3
    ORDER BY free_days DESC
    LIMIT 8
  `;
}
