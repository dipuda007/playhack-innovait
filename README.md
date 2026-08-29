<div align="center">

# PlayHack

### Campus sports facility booking for IIT Guwahati

**Fifty students tap “Book” on the same court at 6:00 PM.
Exactly one gets it — and that decision is made by Postgres, not by our code.**

[**▶ Live demo**](https://innovait-hackathon.vercel.app) · [Run the race yourself](https://innovait-hackathon.vercel.app/race) · [Architecture](docs/ARCHITECTURE.md) · [Deploying](docs/DEPLOY.md)

[![CI](https://github.com/dipuda007/playhack-innovait/actions/workflows/ci.yml/badge.svg)](https://github.com/dipuda007/playhack-innovait/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-15.5-22201e?style=flat-square&labelColor=22201e&color=f7f4ee)
![Postgres](https://img.shields.io/badge/Postgres-17-22201e?style=flat-square&labelColor=22201e&color=f7f4ee)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-22201e?style=flat-square&labelColor=22201e&color=f7f4ee)
![Tests](https://img.shields.io/badge/tests-19%20unit%20%2B%2011%20browser-b4512a?style=flat-square&labelColor=22201e)
![Overlaps](https://img.shields.io/badge/overlapping%20bookings-0-b4512a?style=flat-square&labelColor=22201e)
![Audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-22201e?style=flat-square&labelColor=22201e&color=f7f4ee)

<br>

![The browse page](docs/media/home.jpg)

</div>

---

## The problem, stated exactly

> At 6:00 PM, many students request the same facility and time slot at once. The
> system must confirm **exactly one** and reject the rest, without corrupting
> data.
>
> — PlayHack SDE Track brief

Almost every booking system answers this the same way, and almost every one of
them is wrong:

```ts
const taken = await isSlotTaken(court, slot);   // ← the question
if (!taken) await insertBooking(court, slot);   // ← the answer
```

Both lines are individually reasonable. Between them is a gap, and under load
another request commits inside it. Two students walk to the same court.

## The answer, in one statement

```sql
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (facility_id WITH =, during WITH &&)
  WHERE (status = 'confirmed');
```

There is no question and no answer — **the write *is* the decision.** A booking
carries a time range, and the database physically cannot store two overlapping
ranges for the same facility. The loser is rejected with SQLSTATE `23P01`
before it ever becomes a row.

Three things follow from that, and they are why this beats a `UNIQUE` key:

| | `UNIQUE (facility_id, starts_at)` | `EXCLUDE … WITH &&` |
|---|---|---|
| Two bookings at 18:00 | rejected | rejected |
| 18:00–19:00 vs **18:30–19:30** | **both stored** | rejected |
| Two-hour maintenance block over four slots | not expressible | one row |
| Cancelling frees the slot | needs a delete | status flip, free |

Partial overlap is the case that actually happens, and it is the case a unique
index cannot see.

![How a booking is decided](docs/media/how-it-decides.png)

<sub>Every figure above was measured against the deployed app. Source:
<a href="docs/infographic/how-it-decides.html">docs/infographic/how-it-decides.html</a> —
re-render with <code>npm run infographic</code>.</sub>

---

## Watch it happen

The same burst, fired twice: once at a textbook check-then-write, once at the
constrained path. Nothing is simulated — both write to real Postgres tables
through a real HTTP endpoint.

![The race demo running](docs/media/race-demo.gif)

<table>
<tr>
<td width="50%"><img src="docs/media/verdict-naive.png" alt="Naive mode: 50 bookings for one court"></td>
<td width="50%"><img src="docs/media/verdict-safe.png" alt="Safe mode: exactly one survives"></td>
</tr>
<tr>
<td align="center"><b>Naive.</b> Every request succeeded. Nothing errored.<br>Fifty students hold the same court.</td>
<td align="center"><b>Constrained.</b> One row. 199 typed rejections,<br>each carrying alternatives the student can act on.</td>
</tr>
</table>

### Measured on the deployed app

Vercel functions in `sin1`, Neon Postgres in `ap-southeast-1`. Server time is
the median of three warm runs, each after a reset:

| Mode | Requests | Server time | Confirmed | Rows in DB | Overlapping pairs |
|---|---:|---:|---:|---:|---:|
| naive | 50 | 37 ms | 50 | 50 | **1 225** |
| safe | 10 | 47 ms | 1 | 1 | 0 |
| safe | 50 | 116 ms | 1 | 1 | 0 |
| safe | 100 | 251 ms | 1 | 1 | 0 |
| safe | **200** | **546 ms** | **1** | **1** | **0** |

Sub-linear, not linear: twenty times the load for about ten times the time.
Nothing in the write path serialises on *n* — all contenders attempt the
insert at once, one wins, the rest block on its uncommitted row and are
released together the moment it commits.

**Cold start is real.** The first race fired after an idle period runs about
three times slower than the numbers above while the function and the
connection pool warm up. Fire one before demoing.

The overlapping-pair count is not a check of the slot just tested — it is a
whole-table sweep, every confirmed row against every other row on the same
court, run after every single race.

---

## Beyond “it does not double-book”

Correctness is the floor. Five things are built on top of it, each solving a
problem the constraint alone does not.

| | What it does | Why it is not obvious |
|---|---|---|
| **Idempotency keys** | A retried submit returns the original booking | Transactions cannot tell a retry from a second intent — both are valid requests. A double-tap on a flaky hostel connection is the common case, not the edge case |
| **Typed rejections** | Losing returns `SLOT_TAKEN`, `QUOTA_EXCEEDED`, `OVERLAPS_OWN`… with three alternative slots | An error page tells a student nothing. A reason plus a next action is a product |
| **Waitlist promotion** | Cancelling releases the slot *and* offers it to the next student in the **same transaction** | A background job leaves a window where the slot is free but unowned — precisely when a race would take it |
| **Maintenance closures** | A closure is a `bookings` row with `kind='block'` | One invariant, two features. A manager cannot close a court out from under a student's confirmed booking, because the same constraint refuses it |
| **Fair draw** | Peak slots go to a seeded, weighted, published lottery | Winning a race is not deserving the court. First-come-first-served rewards the best wifi. The seed is printed with the result so anyone can recompute the winner |

---

## How a booking is decided

```mermaid
sequenceDiagram
    participant A as Student A
    participant B as Student B (+198 more)
    participant API as Route handler
    participant PG as Postgres

    Note over A,B: 18:00:00.000 — everyone taps Book
    A->>API: POST /api/bookings (idempotency key)
    B->>API: POST /api/bookings (idempotency key)

    API->>PG: BEGIN · advisory lock on user · quota + self-clash check
    API->>PG: BEGIN · advisory lock on user · quota + self-clash check

    API->>PG: INSERT booking (facility, tstzrange)
    API->>PG: INSERT booking (facility, tstzrange)

    PG-->>API: A committed · PH-01042
    Note over PG: bookings_no_overlap rejects the rest
    PG-->>API: 23P01 exclusion_violation ×199

    API-->>A: 201 CONFIRMED · PH-01042
    API-->>B: 409 SLOT_TAKEN + 3 alternatives + queue position
```

No availability check on the write path. No application-level lock on the slot.
The only lock taken is per **user**, because the quota check is a genuine
read-then-write and one student firing ten parallel requests would otherwise
pass ten quota checks.

### Availability is derived, never stored

```mermaid
flowchart LR
    F[facilities<br/>opens_at · closes_at · slot_minutes] -->|generate_series| G[slot grid<br/>computed per request]
    B[bookings<br/>during: tstzrange] -->|NOT EXISTS … during &&| G
    G --> V[what the student sees]
```

There is no `slots` table. A row per court per hour per day would be a *second*
source of truth about occupancy, and the moment it disagrees with `bookings`
the brief's consistency requirement is already lost.

---

## The interface

Set as a printed institutional prospectus. There is deliberately **no brand
hue**: chrome is charcoal, paper is a warm off-white, and the only saturated
colours on a screen are the ones that mean something — rust for the single
action, brass for a hairline, forest and brick for status. A page whose
colours are all load-bearing cannot look like a theme picked from a palette
generator.

Every grey is warm, mixed toward the paper rather than toward blue. Headings
are Playfair Display, everything a reader reads or clicks is Inter, and
anything that has to line up in a column is JetBrains Mono.

Slot state is carried by **fill, not hue** — open is paper, taken is solid
charcoal, yours is rust, closed is hatched — so the grid stays readable in
greyscale, to a colourblind reader, and through a badly calibrated projector.
Availability is stated three ways on every card: a coloured dot, a word, and
a count.

Motion is a response, never decoration. Cards rise into view once as you reach
them, the hero photograph settles over twelve seconds, and every transition is
dropped entirely under `prefers-reduced-motion`.

<table>
<tr>
<td width="50%"><img src="docs/media/facility.png" alt="A facility day grid"><br><sub><b>Booking.</b> The day as a fixture table, live over SSE.</sub></td>
<td width="50%"><img src="docs/media/bookings.png" alt="A student's bookings"><br><sub><b>My bookings.</b> Standing, upcoming, and every booking on record.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/media/fair.png" alt="The fair draw page"><br><sub><b>Fair draw.</b> Rules and seed published before the draw.</sub></td>
<td width="50%"><img src="docs/media/ops.png" alt="The ops console"><br><sub><b>Ops.</b> Closures refused by the same constraint.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/media/insights.png" alt="The insights page"><br><sub><b>Insights.</b> Aggregated from the booking table itself.</sub></td>
<td width="50%" align="center"><img src="docs/media/mobile.png" width="260" alt="The browse page on a phone"><br><sub><b>Mobile.</b> Students book from phones, so this is not an afterthought.</sub></td>
</tr>
</table>

---

## Identity, and what is deliberately out of scope

**There are no passwords.** Identity is a signed cookie over a seeded roster,
and the header carries a "switch reader" control that swaps between the
seeded students and managers in two clicks.

That is a deliberate trade, not an oversight. The judged criteria are booking
correctness under concurrency; campus SSO would add real setup cost and touch
none of them. Racing two students against one slot — the thing the brief asks
to see demonstrated — has to be doable in front of a judge without two browser
profiles.

What that costs, stated plainly rather than left to be discovered:

| | |
|---|---|
| `POST /api/session` | Takes a user id and issues that identity. No credential is required, and the roster ids are in the page HTML, so **anyone can become a manager.** The role check on `/api/ops` is therefore a demo guard, not a security boundary. |
| `POST /api/race`, `/api/race/reset` | Unauthenticated. The race writes up to 200 rows per call; the reset deletes only rows keyed `race-%` plus the two demo tables, so it cannot touch a student booking — but both are open to anyone with the URL. |
| Rate limiting | None. |

Swapping in real auth is a contained change: every write path already derives
the acting user from the signed cookie on the server and never from the
request body, and no call site reads the cookie directly. Replacing
`currentUser()` in `src/lib/session.ts` is the whole job.

What *is* enforced, and is not a demo guard:

- **Ownership.** Cancelling scopes to `user_id` inside the `UPDATE`, and
  claiming a waitlist offer scopes to `user_id` inside a `SELECT … FOR UPDATE`.
  A forged booking id matches no row rather than cancelling someone else's.
- **Input.** Every route body is parsed by a zod schema before it reaches SQL.
- **SQL.** Every query is a `postgres` tagged template, so every value is a
  bind parameter. There is no `sql.unsafe` in the codebase.
- **Headers.** `X-Frame-Options: DENY`, `nosniff`, a referrer policy and a
  permissions policy on every response. There is no CSP yet — Next's inline
  bootstrap needs per-request nonces, which is a change to the rendering path
  rather than a config line.

---

## Run it

**Requirements:** Node 20+, and a Postgres 17 with `btree_gist` available
(local, Neon, Supabase — all fine).

```bash
git clone https://github.com/dipuda007/playhack-innovait
cd playhack-innovait
npm install

cp .env.example .env          # then set DATABASE_URL and SESSION_SECRET
npm run db:reset              # migrate + seed 201 students and 12 facilities
npm run dev                   # http://localhost:3000
```

`db:push` refuses to finish unless `bookings_no_overlap` exists afterwards, so
a silently unconstrained database is not a state you can reach.

### Prove it rather than trust it

```bash
npm test              # 19 unit tests — the concurrency suite included
npm run invariant     # whole-table sweep, exits non-zero on any violation
npx tsx scripts/e2e.mts   # 11 browser checks: book → confirm → cancel → reopen
```

What the concurrency suite actually asserts:

- 50 simultaneous identical attempts → exactly 1 booking, 49 × `23P01`
- staggered **partially overlapping** attempts → exactly 1 survives
- six adjacent slots → all six succeed (half-open bounds are not overlaps)
- five different courts at the same instant → all five succeed
- 40 concurrent product-level bookings → 1 confirmed, 39 typed rejections
- a replayed idempotency key → at most one row, ever
- cancel → the next request wins the freed slot
- 200 concurrent attempts across 10 slots → exactly 10 bookings
- **whole-table sweep: zero overlapping confirmed pairs across every row**
- the naive implementation, for contrast → double-books on demand

---

## Repository map

```
migrations/0001_init.sql   the schema — and the constraint that is the product
src/db/client.ts           pool, SQLSTATE constants, deadlock retry
src/lib/booking.ts         the write path: create, cancel, promote, suggest
src/lib/race.ts            the race harness and the whole-table invariant sweep
src/lib/lottery.ts         seeded weighted draw, deterministic and auditable
src/lib/availability.ts    derived availability — no slots table
src/app/                   Next.js App Router: pages and route handlers
src/components/            UI, court diagrams, sport glyphs
tests/                     vitest — concurrency and lottery suites
scripts/                   migrate · seed · invariant · e2e · media · infographic
docs/ARCHITECTURE.md       data model, trade-offs, what we would do next
docs/DEPLOY.md             Neon + Vercel, and the region that matters
docs/infographic/          the README graphic, as editable HTML rather than a bitmap
```

### Checking it yourself

```bash
npm run test          # 19 unit tests — concurrency and the lottery
npm run invariant     # whole-table sweep for any overlapping confirmed pair
npm run e2e           # 11 browser checks; E2E_BASE=<url> to point at a deployment
npm run media         # re-capture the README screenshots and the race GIF
npm run infographic   # re-render the graphic above from its HTML source
```

`npm run e2e` books a real slot and cancels it again, so it is safe to run
against the live app — and it is how the numbers in this README were checked.

---

## Credits

Built by **Team InnovAIT** for PlayHack, IIT Guwahati Sports Board × Tech Board.

Campus photography from Wikimedia Commons — Tihor lake by Ganesh Mohan T
(CC BY-SA 4.0), academic complex by Satyadeep Karnati (public domain). Full
details in [`public/campus/CREDITS.md`](public/campus/CREDITS.md).

Code is MIT licensed — see [LICENSE](LICENSE). The photographs and fonts
keep their own terms, recorded in [NOTICE](NOTICE).
