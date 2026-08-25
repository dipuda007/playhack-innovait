/**
 * Every way a booking attempt can end.
 *
 * A rejection is a first-class, machine-readable outcome — never a 500 and
 * never a bare string. Under a 200-way race, 199 of these fire at once; if any
 * of them surfaced as an unhandled exception the demo would look like a crash
 * rather than a correctly enforced invariant.
 */

export const REJECTIONS = {
  SLOT_TAKEN: "Someone else confirmed this slot first.",
  OVERLAPS_EXISTING: "This overlaps a booking already on the court.",
  OVERLAPS_OWN: "You already have a booking that overlaps this time.",
  QUOTA_EXCEEDED: "You have used all your bookings for this week.",
  FACILITY_CLOSED: "The facility is closed at this time.",
  FACILITY_INACTIVE: "This facility is not accepting bookings.",
  UNDER_MAINTENANCE: "This slot is blocked for maintenance.",
  PAST_SLOT: "That slot has already started.",
  BEYOND_HORIZON: "Bookings open only 7 days in advance.",
  MISALIGNED_SLOT: "That is not a valid slot boundary for this facility.",
  LOTTERY_OPEN: "This peak slot is in a fair-draw window.",
  LOTTERY_LOST: "The fair draw for this slot went to another student.",
  NOT_FOUND: "That facility or slot does not exist.",
  UNAUTHENTICATED: "Sign in to book a slot.",
} as const;

export type RejectionCode = keyof typeof REJECTIONS;

/** A suggested slot offered alongside a rejection, so failure is never a dead end. */
export type Alternative = {
  facilityId: string;
  facilityName: string;
  facilitySlug: string;
  sport: string;
  startsAt: string;
  endsAt: string;
  label: string;
  /** Why this one is being suggested, in plain words. */
  reason: string;
  /** Lower is a better match. */
  distance: number;
};

export type BookingRecord = {
  id: string;
  bookingCode: string;
  facilityId: string;
  facilityName: string;
  userId: string | null;
  userName: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  kind: string;
  partySize: number;
  note: string | null;
  createdAt: string;
};

export type BookingSuccess = {
  ok: true;
  booking: BookingRecord;
  /**
   * True when this request replayed an idempotency key that had already been
   * committed. The caller gets the original booking rather than a second one.
   */
  replayed: boolean;
  /** How the winner was decided, for the demo overlay. */
  mechanism: "exclusion-constraint" | "idempotent-replay" | "lottery";
};

export type BookingFailure = {
  ok: false;
  code: RejectionCode;
  message: string;
  /** Raw Postgres SQLSTATE when the database itself made the decision. */
  sqlstate?: string;
  /** Which database object refused, when applicable. */
  constraint?: string;
  alternatives: Alternative[];
  /** Present when the slot is contested and the user can queue instead. */
  waitlistable?: boolean;
};

export type BookingResult = BookingSuccess | BookingFailure;

export function reject(
  code: RejectionCode,
  extra: Partial<Omit<BookingFailure, "ok" | "code" | "message">> = {},
): BookingFailure {
  return {
    ok: false,
    code,
    message: REJECTIONS[code],
    alternatives: [],
    ...extra,
  };
}

/** HTTP status for each outcome — rejections are client-correctable, not errors. */
export function statusFor(code: RejectionCode): number {
  switch (code) {
    case "SLOT_TAKEN":
    case "OVERLAPS_EXISTING":
    case "OVERLAPS_OWN":
    case "UNDER_MAINTENANCE":
    case "LOTTERY_OPEN":
    case "LOTTERY_LOST":
      return 409; // Conflict — the request was well-formed, it simply lost.
    case "QUOTA_EXCEEDED":
      return 429;
    case "UNAUTHENTICATED":
      return 401;
    case "NOT_FOUND":
      return 404;
    default:
      return 422; // Unprocessable — the slot itself was never bookable.
  }
}
