/**
 * Time and slot-grid helpers.
 *
 * Campus life runs on IST, so every wall-clock rule (opening hours, "today",
 * peak windows) is evaluated in Asia/Kolkata, while every stored value is an
 * absolute timestamptz. Mixing those two up is the classic booking-system bug
 * that shows up only during a DST-style offset change or a server in UTC.
 */

export const APP_TZ = "Asia/Kolkata";
/** IST is a fixed +05:30 offset with no daylight saving. */
export const IST_OFFSET = "+05:30";

/** `YYYY-MM-DD` for a Date, as seen in IST. */
export function istDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today in IST, as `YYYY-MM-DD`. */
export function todayKey(): string {
  return istDateKey(new Date());
}

/** Build an absolute instant from an IST date key and a `HH:MM[:SS]` time. */
export function istInstant(dateKey: string, time: string): Date {
  const hhmmss = time.length === 5 ? `${time}:00` : time;
  return new Date(`${dateKey}T${hhmmss}${IST_OFFSET}`);
}

/** `HH:MM` label for an instant, in IST. */
export function istTimeLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Friendly label like `6:00 PM`. */
export function istClock(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Friendly label like `Mon, 1 Sep`. */
export function istDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00${IST_OFFSET}`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00${IST_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return istDateKey(d);
}

/** How many days ahead a booking may be made. */
export const BOOKING_HORIZON_DAYS = 7;

export type SlotSpec = {
  /** Absolute start instant. */
  start: Date;
  /** Absolute end instant. */
  end: Date;
  /** `HH:MM` start label in IST. */
  label: string;
  /** `HH:MM–HH:MM` in IST. */
  range: string;
  /** True when the slot begins at or after the facility's peak threshold. */
  peak: boolean;
};

/**
 * Generate the canonical slot grid for one facility on one IST day.
 *
 * The grid is derived, never stored. That keeps the schema free of millions of
 * empty "available slot" rows: availability is the *absence* of a booking over
 * a generated range, which is exactly what the exclusion constraint reasons
 * about too.
 */
export function generateSlots(
  dateKey: string,
  opensAt: string,
  closesAt: string,
  slotMinutes: number,
  peakFrom?: string | null,
): SlotSpec[] {
  const dayStart = istInstant(dateKey, opensAt);
  const dayEnd = istInstant(dateKey, closesAt);
  const peakStart = peakFrom ? istInstant(dateKey, peakFrom) : null;

  const slots: SlotSpec[] = [];
  const stepMs = slotMinutes * 60_000;

  for (let t = dayStart.getTime(); t + stepMs <= dayEnd.getTime(); t += stepMs) {
    const start = new Date(t);
    const end = new Date(t + stepMs);
    slots.push({
      start,
      end,
      label: istTimeLabel(start),
      range: `${istTimeLabel(start)}–${istTimeLabel(end)}`,
      peak: peakStart ? start.getTime() >= peakStart.getTime() : false,
    });
  }

  return slots;
}

/** Parse a Postgres `tstzrange` literal such as `["2026-09-01 18:00:00+05:30",...)`. */
export function parseRange(literal: string): { start: Date; end: Date } {
  const inner = literal.slice(1, -1);
  const [rawStart, rawEnd] = inner.split(",").map((s) => s.replace(/"/g, ""));
  return { start: new Date(rawStart), end: new Date(rawEnd) };
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}
