# PlayHack — Sports Facility Booking

**Team InnovAIT** · IIT Guwahati Sports Board × Tech Board · SDE Track

A booking system for IIT Guwahati's sports facilities, built around one claim:

> **Two students cannot book the same court at the same time. Not "usually" — not
> "we use transactions". The database will not physically store it.**

---

## Quickstart

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL to any Postgres 14+
npm run setup                  # migrate + seed
npm run dev                    # http://localhost:3000
```

Prove the claim before you look at anything else:

```bash
npm run test:race
```

That fires 50, then 200 genuinely simultaneous booking attempts at a single
slot and asserts exactly one row survives, every time.

**Postgres is required, not incidental.** The entire design rests on an
`EXCLUDE USING gist` constraint over a range type. MySQL, MongoDB and Firebase
cannot express it. Postgres 14+ works; the app is developed on 17.

---

## The problem, precisely

At 6:00 PM many students submit a request for the same facility and the same
slot. A correct system must confirm exactly one and reject the rest without
corrupting anything.

The usual implementation looks like this, and it is wrong:

```ts
const taken = await db.query("SELECT 1 FROM bookings WHERE ...");
if (!taken) await db.query("INSERT INTO bookings ...");   // ← the bug
```

Nothing in those two lines is individually incorrect. The bug lives in the gap
*between* them: another request commits there, and the answer the first request
is acting on has already gone stale. Wrapping both lines in a transaction does
not close the gap under `READ COMMITTED` — the read simply does not see the
other transaction's uncommitted row, and both go on to insert.

You can watch this happen, on demand, at **`/race`** in naive mode.

---

## The answer

### 1. The constraint

```sql
CREATE EXTENSION btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (facility_id WITH =, during WITH &&)
  WHERE (status = 'confirmed');
```

`during` is a single `tstzrange`, not two loose timestamps.

**Why this rather than `UNIQUE (facility_id, starts_at)`:**

| | unique index | exclusion constraint |
|---|---|---|
| 18:00–19:00 twice | blocked | blocked |
| 18:00–19:00 vs **18:30–19:30** | **allowed — the bug** | blocked |
| 18:00–19:00 vs 19:00–20:00 | allowed | allowed (correct — adjacent) |
| 2-hour maintenance over 4 slots | needs separate logic | same constraint |

A unique key only catches byte-identical slots. Overlap is the actual bug, and
a unique index cannot see it.

The partial `WHERE status = 'confirmed'` makes cancellation free: flipping the
status drops the row out of the index and releases the slot instantly, with no
deletes and full history retained.

### 2. No read-modify-write on the write path

There is no "is this slot free?" query anywhere in
[`createBooking`](src/lib/booking.ts). The insert *is* the decision. Losers get
SQLSTATE `23P01`, mapped to a typed `SLOT_TAKEN` outcome with three suggested
alternatives — never a 500.

### 3. Idempotency keys

Transactions cannot distinguish a retry from a second intent — both requests are
individually valid. The client stamps each booking intent with a UUID, held in a
`UNIQUE` column, and a replay returns the original booking instead of creating a
second one. This is the double-tap / flaky-network case that transactions alone
do not cover.

### 4. One lock, and where it is measured

The booking transaction takes exactly one advisory lock, keyed on the **user**,
because the quota check is a genuine read-then-write: one student firing ten
parallel requests would otherwise pass ten quota checks and commit ten
bookings. Different students hash to different keys, so in a race between fifty
students that lock is uncontended.

There is deliberately **no per-slot lock**. An earlier version took one, in
sorted key order alongside the user lock, and on a co-located database it was
faster — contenders queued on a cheap lock instead of piling into the
constraint's wait-for-uncommitted-row path.

Over a network it is a disaster. It serialises every contender, so each one
pays a full round-trip budget in turn. Measured in production, Vercel functions
in `iad1` (Washington DC) against Neon in Singapore:

| n | with slot lock |
|---|---|
| 2 | 6.3 s |
| 5 | 10.6 s |
| 10 | 19.2 s |
| 20 | 36.4 s |
| 50 | function timeout |

Dead linear at ~1.8 s per contender. Correctness was never in question — every
run confirmed exactly one booking — but throughput collapsed.

Two changes fixed it. The slot lock was removed, so all contenders attempt the
insert at once: one wins, the rest block on its uncommitted row and are
released together the instant it commits, each getting `23P01`. Total time is
one transaction plus a round trip, whatever *n* is. Then `vercel.json` pinned
the functions to `sin1`, next to the database, turning a ~250 ms round trip
into a ~1 ms one.

Same production deployment, after both:

| n | wall clock | confirmed | overlapping pairs |
|---|---|---|---|
| 10 | 702 ms | 1 | 0 |
| 20 | 350 ms | 1 | 0 |
| 50 | 555 ms | 1 | 0 |
| 100 | 529 ms | 1 | 0 |
| 200 | **1,244 ms** | 1 | 0 |

Flat, not linear — which is the shape you want when the whole campus opens the
app at 6:00 PM.

Removing the slot lock also removed the deadlock it used to guard against: a
cycle needs two locks taken in varying order, and there is now only one.

Partial-range overlaps (a maintenance block spanning several slots) can still
deadlock legitimately, so `withDeadlockRetry` remains — a deadlock victim rolls
back cleanly, so retrying is always safe. Exclusion violations are *never*
retried: that is a settled result.

---

## Proof

```
npm run test:race     # the concurrency suite
npm test              # everything
npm run invariant     # whole-table sweep, standalone
```

The suite asserts:

- 50 simultaneous identical attempts → exactly 1 booking, 49 × `23P01`
- staggered **partially overlapping** attempts → exactly 1 survives
- six adjacent slots → all six succeed (half-open bounds are not overlaps)
- five different courts, same instant → all five succeed (no false contention)
- 40 concurrent product-level bookings → 1 confirmed, 39 typed rejections, each
  carrying alternatives
- a replayed idempotency key → at most one row, ever
- cancel → the next request wins the freed slot
- 200 concurrent attempts across 10 slots → exactly 10 bookings
- **whole-table sweep: zero overlapping confirmed pairs across every row**
- the naive implementation, for contrast → double-books on demand

---

## Beyond the reservation

Chosen to extend the concurrency thesis rather than decorate it.

**Fair draw (`/fair`)** — the brief's own 6 PM scenario. The constraint decides
*that* one booking wins; first-come-first-serve decides *who* badly, rewarding
the best wifi. Peak slots instead open a short window where requests become
entries, then one seeded, reliability-weighted draw picks the winner — whose
booking still goes through the same constrained path. The seed is published when
the window opens, before anyone enters, so the draw can be recomputed and
audited. Weighting is compressed (a perfect record gets ~2× the pull, not 20×)
so it tilts the draw without locking anyone out.

**Waitlists** — cancellation and promotion commit in the *same transaction*, so
a released slot is never briefly unowned, and `waitlist_one_offer_per_slot`
enforces at most one outstanding offer per slot at the database level. Offers
expire after 15 minutes and cascade.

**Closures as bookings** — a maintenance window is a row with `kind = 'block'`.
One invariant protects two features, and a manager cannot schedule a closure
over a reservation a student is relying on. Try it at `/ops`.

**Anti-hoarding & reliability** — a rolling weekly quota, and no-shows lower a
reliability score that feeds the draw weighting.

**Insights (`/analytics`)** — utilisation heatmap, peak hours, no-show rates,
and under-used prime slots. Every figure aggregates the same `bookings` table the
booking path writes to; there is no reporting copy that can drift.

---

## Scale

- **Contention is naturally sharded by `facility_id`.** Two courts never block
  each other — a property the test suite asserts, not a hope.
- **Correctness lives in the database**, so the app tier is stateless and scales
  horizontally with zero coordination.
- **Availability is derived, never stored.** No `slots` table to fall out of sync
  with `bookings`; there is exactly one source of truth about occupancy.
- Next: PgBouncer, a cached materialised day-view with tag revalidation, and
  monthly partitioning of `bookings` with a GiST index per partition.

---

## Layout

```
migrations/0001_init.sql   the schema — read this first
src/lib/booking.ts         the write path and the rejection taxonomy
src/lib/race.ts            the race harness (safe and naive)
src/lib/lottery.ts         seeded, weighted, auditable draw
src/lib/availability.ts    derived slot grids
src/app/race/              the live proof
tests/race.test.ts         the concurrency suite
docs/ARCHITECTURE.md       data model, sequence diagrams, trade-offs
```

## Scope, stated plainly

Identity is a signed cookie over a seeded roster, not a credential system —
there is no password. The brief is about booking correctness, and campus SSO
would add setup cost without touching a judged criterion. Every write derives
the acting user from the signed cookie server-side, never from the request body,
and swapping in institute SSO means replacing `currentUser()` and nothing else.

Live updates fan out in-process, which is right for one instance; the documented
path to multi-instance is Postgres `LISTEN`/`NOTIFY` behind the same two
functions. Clients reconcile against the database rather than the event payload,
so a dropped event costs a stale screen, never a wrong booking.
