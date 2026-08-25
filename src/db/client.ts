import postgres from "postgres";

/**
 * One postgres.js pool per process.
 *
 * Next dev reloads modules on every edit, so the pool is stashed on
 * globalThis — otherwise each hot reload leaks a fresh set of sockets and the
 * race demo starts failing on connection limits rather than on the constraint,
 * which would be a deeply misleading thing to demo.
 */
const globalForDb = globalThis as unknown as {
  __playhackSql?: ReturnType<typeof postgres>;
};

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  /**
   * A transaction-mode connection pooler (Neon's pooler, PgBouncer) hands a
   * different backend to each transaction, so a prepared statement created on
   * one is not there on the next — which surfaces as intermittent
   * "prepared statement does not exist" errors under exactly the concurrent
   * load this app is built to survive. Disabling prepared statements is the
   * documented fix and costs a little planning time per query.
   *
   * Detected from the host rather than configured, so a direct connection
   * string keeps the faster prepared path automatically.
   */
  const behindPooler = url.includes("-pooler.");

  return postgres(url, {
    // Headroom above the largest race burst the demo fires, so queueing
    // happens inside Postgres where we can reason about it.
    max: 40,
    idle_timeout: 30,
    // Neon scales an idle branch to zero, so the first connection after a
    // quiet period pays a cold start. Generous enough to absorb that rather
    // than fail the judge's first page load.
    connect_timeout: 30,
    prepare: !behindPooler,
    // Neon and most hosted providers require TLS; local dev does not have it.
    ssl: isLocal ? false : "require",
    // Ranges come back as raw strings and are parsed where they are needed.
    // The default parser would hand us objects that lose the bound style.
    types: {},
    onnotice: () => {},
  });
}

function pool() {
  if (!globalForDb.__playhackSql) {
    globalForDb.__playhackSql = create();
  }
  return globalForDb.__playhackSql;
}

/**
 * The pool is created on first use, not on import.
 *
 * Creating it at module scope means importing this file throws when
 * DATABASE_URL is absent — which fails the build on any machine without a
 * database, since Next statically generates the 404 page and that pulls in the
 * layout, which pulls in this module. Deferring construction lets the shell
 * render and confines the error to code that actually talks to the database.
 *
 * The proxy forwards both the tagged-template call and every property
 * (`begin`, `json`, `unsafe`, `end`), so callers see an ordinary postgres.js
 * instance and nothing downstream needs to know.
 */
export const sql = new Proxy((() => {}) as unknown as ReturnType<typeof postgres>, {
  apply(_target, _thisArg, args: unknown[]) {
    return (pool() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const value = (pool() as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(pool()) : value;
  },
}) as ReturnType<typeof postgres>;

/** Postgres SQLSTATE codes we translate into product-level outcomes. */
export const PG = {
  /** exclusion_violation — a live booking already overlaps this range. */
  EXCLUSION_VIOLATION: "23P01",
  /** unique_violation — most often a replayed idempotency key. */
  UNIQUE_VIOLATION: "23505",
  /** check_violation */
  CHECK_VIOLATION: "23514",
  /** lock_not_available — NOWAIT lock was already held. */
  LOCK_NOT_AVAILABLE: "55P03",
  /**
   * deadlock_detected.
   *
   * Reachable here, and worth knowing why. When two transactions insert
   * *partially overlapping* ranges, the exclusion-constraint check makes each
   * one wait on the other's uncommitted row, and the two waits can form a
   * cycle. Postgres breaks it after `deadlock_timeout` (1s by default) by
   * rolling one side back with this code.
   *
   * Identical ranges cannot deadlock — every waiter queues behind the same
   * row, so there is no cycle — which is why the fixed slot grid almost never
   * hits this. Variable-length rows (maintenance blocks spanning several
   * slots) can and do.
   *
   * The victim's transaction is rolled back cleanly, so a retry is always
   * safe: see `withDeadlockRetry`.
   */
  DEADLOCK_DETECTED: "40P01",
  /** serialization_failure — retryable for the same reason. */
  SERIALIZATION_FAILURE: "40001",
} as const;

/** SQLSTATEs where the transaction rolled back cleanly and a retry is valid. */
const RETRYABLE = new Set<string>([
  PG.DEADLOCK_DETECTED,
  PG.SERIALIZATION_FAILURE,
]);

/**
 * Run `fn` inside a bounded retry for cleanly-rolled-back conflicts.
 *
 * Deliberately narrow: only deadlock and serialization failures qualify. An
 * exclusion violation is NOT retried — that is a settled result, the slot is
 * genuinely gone, and retrying it would just spin.
 */
export async function withDeadlockRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const state = sqlstateOf(err);
      if (!state || !RETRYABLE.has(state)) throw err;
      lastErr = err;
      // Jittered backoff so the retrying pair does not re-collide in lockstep.
      const backoff = 15 * 2 ** i + Math.floor(Math.random() * 25);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

export function sqlstateOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return undefined;
}

export function constraintOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "constraint_name" in err) {
    return String((err as { constraint_name: unknown }).constraint_name);
  }
  return undefined;
}
