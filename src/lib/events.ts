/**
 * In-process pub/sub feeding the live availability stream.
 *
 * Scope, stated honestly: this fans out within ONE server process. On a single
 * instance — which is what the demo and a campus-scale deployment both run —
 * it is exactly right, and it costs nothing.
 *
 * It is deliberately not the source of truth. A missed notification degrades
 * to "the grid refreshes a couple of seconds later" because the client also
 * polls, and every client reconciles against the database rather than against
 * the event payload. Nothing here can cause a wrong booking; the worst case is
 * a briefly stale screen.
 *
 * Multi-instance path, when it is needed: swap the body of `publish` and
 * `subscribe` for Postgres LISTEN/NOTIFY on the same channel names. No caller
 * changes, because callers only ever see these two functions.
 */

export type AvailabilityEvent = {
  type: "booking" | "cancellation" | "waitlist" | "race";
  facilityId: string;
  at?: number;
};

type Listener = (event: AvailabilityEvent) => void;

const globalForEvents = globalThis as unknown as {
  __playhackListeners?: Set<Listener>;
};

const listeners: Set<Listener> =
  globalForEvents.__playhackListeners ?? new Set();
globalForEvents.__playhackListeners = listeners;

export function publish(event: AvailabilityEvent) {
  const enriched = { ...event, at: Date.now() };
  for (const listener of listeners) {
    // One bad subscriber must not stop the others from being told.
    try {
      listener(enriched);
    } catch {
      /* ignore */
    }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listenerCount() {
  return listeners.size;
}
