-- ===========================================================================
-- PlayHack — schema
-- Team InnovAIT · IIT Guwahati Sports Board x Tech Board
--
-- The correctness of this entire product rests on ONE database object:
-- the `bookings_no_overlap` EXCLUDE constraint defined below.
-- Everything else in this file is ergonomics.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $do$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- 'confirmed'  : occupies the court. Counted by the exclusion constraint.
-- 'cancelled'  : released. Deliberately NOT counted, so the slot frees up
--                instantly without deleting history.
-- 'no_show'    : slot elapsed, user never turned up. Not counted.
-- 'completed'  : slot elapsed, attended. Not counted.
DO $do$ BEGIN
  CREATE TYPE booking_status AS ENUM
    ('confirmed', 'cancelled', 'no_show', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- A maintenance closure is not a special table. It is a booking with
-- kind='block'. One invariant therefore protects two features: students
-- cannot double-book each other, AND nobody can book over a closure.
DO $do$ BEGIN
  CREATE TYPE booking_kind AS ENUM ('booking', 'block');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TYPE waitlist_state AS ENUM
    ('waiting', 'offered', 'claimed', 'expired', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL UNIQUE,
  name               text NOT NULL,
  roll_number        text,
  hostel             text,
  role               user_role NOT NULL DEFAULT 'student',
  -- Starts at 100. Drops on no-show, recovers slowly with attendance.
  -- Feeds the fair-allocation lottery weight.
  reliability_score  integer NOT NULL DEFAULT 100
                     CHECK (reliability_score BETWEEN 0 AND 100),
  -- Anti-hoarding: max confirmed upcoming bookings per rolling 7 days.
  weekly_quota       integer NOT NULL DEFAULT 6 CHECK (weekly_quota > 0),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Facilities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  sport         text NOT NULL,
  location      text NOT NULL,
  description   text,
  -- Informational: how many players the court comfortably holds. Booking is
  -- still exclusive-use; capacity drives the party-size hint and analytics.
  capacity      integer NOT NULL DEFAULT 4 CHECK (capacity > 0),
  opens_at      time NOT NULL DEFAULT '06:00',
  closes_at     time NOT NULL DEFAULT '22:00',
  slot_minutes  integer NOT NULL DEFAULT 60 CHECK (slot_minutes > 0),
  -- Slots starting at or after this time are contested, so they are released
  -- through the fair-allocation lottery instead of raw first-come-first-serve.
  peak_from     time,
  color         text NOT NULL DEFAULT '#f97316',
  emoji         text NOT NULL DEFAULT '',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Bookings — the table that must never hold two overlapping live rows
-- ---------------------------------------------------------------------------

-- Human-quotable booking references come from a sequence, not from random
-- characters in application code.
--
-- A short random code looks fine until you count: four base-32 characters is
-- about a million values, and the birthday bound means collisions start
-- appearing in the low thousands of rows — surfacing as a unique-violation
-- 500 on an otherwise valid booking. A sequence is collision-free by
-- construction, needs no retry loop, and is readable at a service desk.
-- Sequences are not transactional, so a rolled-back booking leaves a gap in
-- the numbering. That is the correct trade: gaps are harmless, duplicates are not.
CREATE SEQUENCE IF NOT EXISTS booking_code_seq START 1000;

CREATE TABLE IF NOT EXISTS bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  -- NULL only for kind='block' (facility closures have no owning student).
  user_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  kind             booking_kind NOT NULL DEFAULT 'booking',
  status           booking_status NOT NULL DEFAULT 'confirmed',

  -- The slot as a single range value, NOT two loose timestamp columns.
  -- Half-open '[)' bounds mean 18:00-19:00 and 19:00-20:00 are adjacent,
  -- not overlapping — back-to-back bookings stay legal.
  during           tstzrange NOT NULL,

  -- Idempotency. A transaction cannot tell a network retry apart from a
  -- genuine second intent, so the client stamps each booking intent with a
  -- UUID and replay becomes a no-op instead of a duplicate row.
  idempotency_key  text NOT NULL UNIQUE,

  party_size       integer NOT NULL DEFAULT 1 CHECK (party_size > 0),
  note             text,
  booking_code     text NOT NULL UNIQUE
                   DEFAULT ('PH-' || lpad(nextval('booking_code_seq')::text, 5, '0')),
  -- Set when this row was created by winning a fair-allocation lottery.
  lottery_id       uuid,
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT during_is_bounded CHECK (
    lower(during) IS NOT NULL AND upper(during) IS NOT NULL
  ),
  CONSTRAINT during_is_forward CHECK (lower(during) < upper(during)),
  CONSTRAINT block_has_no_owner CHECK (
    (kind = 'block' AND user_id IS NULL) OR kind = 'booking'
  )
);

-- ===========================================================================
-- *** THE CONSTRAINT ***
--
-- For any one facility, no two LIVE rows may hold overlapping time ranges.
--
-- Why EXCLUDE rather than UNIQUE (facility_id, starts_at):
--   * A unique key only catches byte-identical slots. It cheerfully permits
--     18:00-19:00 alongside 18:30-19:30 on the same court. Overlap is the
--     actual bug, and a unique index cannot see it.
--   * This is enforced inside the storage engine. No application code path,
--     no ORM escape hatch, no stray psql session, no future teammate and no
--     second app instance behind a load balancer can route around it.
--   * It holds under plain READ COMMITTED. We do not need SERIALIZABLE, do
--     not need to retry on serialization failure, and do not need any
--     external lock service.
--
-- The partial predicate is what makes cancellation cheap: flipping status to
-- 'cancelled' drops the row out of the index and frees the slot in the same
-- instant, with zero deletes and complete history retained.
-- ===========================================================================
DO $do$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (facility_id WITH =, during WITH &&)
    WHERE (status = 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

CREATE INDEX IF NOT EXISTS bookings_facility_time_idx
  ON bookings (facility_id, lower(during));
CREATE INDEX IF NOT EXISTS bookings_user_idx
  ON bookings (user_id, lower(during) DESC);
CREATE INDEX IF NOT EXISTS bookings_live_idx
  ON bookings (facility_id) WHERE status = 'confirmed';

-- ---------------------------------------------------------------------------
-- Waitlist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waitlist (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  during            tstzrange NOT NULL,
  state             waitlist_state NOT NULL DEFAULT 'waiting',
  enqueued_at       timestamptz NOT NULL DEFAULT now(),
  -- On promotion the user gets a bounded window to accept. If it lapses the
  -- offer cascades to the next person rather than stranding the slot.
  claim_expires_at  timestamptz,
  notified_at       timestamptz
);

-- One live queue entry per user per exact slot.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_one_live_per_user
  ON waitlist (facility_id, user_id, during)
  WHERE state IN ('waiting', 'offered');

-- At most ONE outstanding offer per slot. Promotion is itself a concurrency
-- problem, so it gets its own database-enforced constraint rather than a
-- comment promising that the background job behaves.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_one_offer_per_slot
  ON waitlist (facility_id, during)
  WHERE state = 'offered';

CREATE INDEX IF NOT EXISTS waitlist_queue_idx
  ON waitlist (facility_id, during, enqueued_at)
  WHERE state = 'waiting';

-- ---------------------------------------------------------------------------
-- Fair-allocation lottery — the answer to the 6 PM stampede
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lotteries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id   uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  during        tstzrange NOT NULL,
  opens_at      timestamptz NOT NULL DEFAULT now(),
  -- Requests arriving inside this window are entrants, not racers.
  closes_at     timestamptz NOT NULL,
  -- Published up front so the draw can be recomputed and audited afterwards.
  seed          text NOT NULL,
  drawn_at      timestamptz,
  winner_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  booking_id    uuid REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS lotteries_one_open_per_slot
  ON lotteries (facility_id, during) WHERE drawn_at IS NULL;

CREATE TABLE IF NOT EXISTS lottery_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id  uuid NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight      integer NOT NULL DEFAULT 100,
  entered_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lottery_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Event log — audit trail and transactional outbox in one table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_events (
  id           bigserial PRIMARY KEY,
  booking_id   uuid REFERENCES bookings(id) ON DELETE CASCADE,
  facility_id  uuid REFERENCES facilities(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  type         text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_events_recent_idx
  ON booking_events (at DESC);
CREATE INDEX IF NOT EXISTS booking_events_facility_idx
  ON booking_events (facility_id, at DESC);

-- ---------------------------------------------------------------------------
-- Race-demo telemetry. Lets the UI replay exactly what every competing
-- request did, with real server-side timings, instead of us asserting it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS race_attempts (
  id           bigserial PRIMARY KEY,
  run_id       uuid NOT NULL,
  mode         text NOT NULL,            -- 'safe' | 'naive'
  attempt_no   integer NOT NULL,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  user_name    text,
  outcome      text NOT NULL,            -- 'CONFIRMED' or a rejection code
  sqlstate     text,
  started_at   timestamptz NOT NULL,
  finished_at  timestamptz NOT NULL,
  duration_ms  integer NOT NULL
);

CREATE INDEX IF NOT EXISTS race_attempts_run_idx
  ON race_attempts (run_id, attempt_no);

-- ---------------------------------------------------------------------------
-- The naive table. Structurally the same as `bookings` but with NO exclusion
-- constraint, so the demo can show what identical traffic does to a schema
-- that trusts application code to check first. It exists in order to fail.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS naive_bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  uuid NOT NULL,
  user_id      uuid,
  user_name    text,
  during       tstzrange NOT NULL,
  status       text NOT NULL DEFAULT 'confirmed',
  run_id       uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS naive_bookings_run_idx ON naive_bookings (run_id);
