/**
 * A fixed-window rate limiter for the demo endpoints, counted in Postgres.
 *
 * ── Why not in memory ─────────────────────────────────────────────────────
 * The first version of this kept counters in a module-level Map. It was
 * measured against the deployment and did nothing at all: sixty-six
 * consecutive requests under a single key were every one of them allowed,
 * because Vercel did not reuse the instance and each request began with an
 * empty map. A counter that never counts is worse than no counter, because
 * it reads like protection in a code review.
 *
 * Postgres is the only state every instance already shares, so the count goes
 * there. It costs one round trip on endpoints that already spend hundreds of
 * milliseconds writing rows.
 *
 * ── What this is for ──────────────────────────────────────────────────────
 * `/api/race` writes up to two hundred rows per call, `/api/lottery` seeds up
 * to two hundred entrants, and `/api/race/reset` deletes the demo tables —
 * all without a credential, on a public URL. One person with the link and a
 * loop could empty the demo mid-presentation or run up the database bill.
 *
 * It is still not an authentication boundary. `x-forwarded-for` is
 * client-controlled, so a determined caller can rotate the key freely. It
 * raises the cost of casual abuse, which is the size of the actual problem.
 *
 * ── Fail-open ─────────────────────────────────────────────────────────────
 * If the table is missing or the query fails, the request is ALLOWED. A demo
 * that refuses to run because its rate limiter is broken has turned a
 * nice-to-have into an outage. That does mean the limit is inactive until
 * `npm run db:push` has created the table.
 */
import { sql } from "@/db/client";

/**
 * The client's address, as far as it can be known behind Vercel's proxy. The
 * left-most `x-forwarded-for` entry is the one the edge saw.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    /*
     * The window start is floored in SQL from the database clock, so every
     * instance lands on the same window without having to agree on a time.
     * The upsert is the whole check: it increments and returns the new count
     * in one statement, so two simultaneous callers cannot both read "under
     * the limit" and both proceed.
     */
    const [row] = await sql<{ count: number; reset_at: Date }[]>`
      WITH w AS (
        SELECT to_timestamp(
                 floor(extract(epoch FROM now()) / ${windowSeconds})
                 * ${windowSeconds}
               ) AS start
      )
      INSERT INTO rate_limit (bucket, window_start, count)
      SELECT ${bucket}, w.start, 1 FROM w
      ON CONFLICT (bucket, window_start)
        DO UPDATE SET count = rate_limit.count + 1
      RETURNING count,
                window_start + make_interval(secs => ${windowSeconds}) AS reset_at
    `;

    if (!row || row.count <= limit) return { ok: true };

    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000),
    );
    return { ok: false, retryAfter };
  } catch {
    // See the fail-open note above: a broken limiter must not break the demo.
    return { ok: true };
  }
}

/**
 * The 429 these endpoints return — typed, like every other rejection in this
 * codebase, so a caller can say something useful instead of failing silently.
 */
export function tooManyRequests(retryAfter: number) {
  return Response.json(
    {
      ok: false,
      code: "RATE_LIMITED",
      message:
        "This demo endpoint is rate limited. Wait a moment and run it again.",
      retryAfter,
    },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}
