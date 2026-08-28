import Link from "next/link";
import { CourtArt } from "@/components/CourtArt";
import { cn } from "@/lib/cn";

export type EntryFacility = {
  slug: string;
  name: string;
  sport: string;
  location: string;
  capacity: number;
};

export type EntrySummary = {
  free: number;
  remaining: number;
  nextFreeLabel: string | null;
};

/**
 * One facility, as an index entry.
 *
 * This is a listing, not a card: no radius, no shadow, no fill. It is set off
 * from its neighbours by the hairline rules of the grid it sits in, exactly
 * the way a results table or a classified column works. Hovering darkens the
 * rule and tints the paper; nothing lifts, because nothing on a page lifts.
 *
 * The court drawing is printed as a technical diagram in the corner — line
 * art at 8% ink, which is how a paper prints a pitch plan beside a fixture.
 */
export function FacilityEntry({
  index,
  facility,
  summary,
  dateKey,
}: {
  index: number;
  facility: EntryFacility;
  summary: EntrySummary;
  dateKey: string;
}) {
  const { free, remaining, nextFreeLabel } = summary;
  const dayOver = remaining === 0;
  const full = !dayOver && free === 0;
  const tight = !dayOver && !full && free / remaining <= 0.25;

  const status = dayOver
    ? "Day closed"
    : full
      ? "Fully booked"
      : nextFreeLabel
        ? `Next free ${nextFreeLabel}`
        : "Open";

  return (
    <Link
      href={`/facility/${facility.slug}?date=${dateKey}`}
      className="box box-link group relative flex min-h-[13.5rem] flex-col overflow-hidden p-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-8 h-40 w-56 text-ink opacity-[0.09] transition-opacity duration-200 group-hover:opacity-[0.16]"
      >
        <CourtArt sport={facility.sport} className="h-full w-full" />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <span className="fig text-[11px] text-ink-3">
          {String(index).padStart(2, "0")}
        </span>
        <span className="tag text-ink-3">{facility.sport}</span>
      </div>

      <h3 className="hed-sm relative mt-3 font-display uppercase">
        {facility.name}
      </h3>

      <p className="relative mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        {facility.location} · {facility.capacity} players
      </p>

      <div className="relative mt-auto pt-5">
        {dayOver ? (
          <p className="fig text-[2.5rem] font-bold leading-none text-ink-3">
            —
          </p>
        ) : (
          <p className="flex items-baseline gap-2">
            <span
              className={cn(
                "fig text-[2.75rem] font-bold leading-none",
                full ? "text-ink-3" : tight ? "text-signal" : "text-ink",
              )}
            >
              {String(free).padStart(2, "0")}
            </span>
            <span className="text-[11px] uppercase tracking-[0.1em] text-ink-3">
              of {remaining} open
            </span>
          </p>
        )}

        {/*
          Occupancy as a segmented bar — one cell per remaining slot, filled
          for the ones already gone. At sixteen slots it is still countable,
          which a percentage bar never is.
        */}
        {!dayOver && (
          <div className="mt-3 flex gap-px" aria-hidden>
            {Array.from({ length: Math.min(remaining, 24) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 flex-1",
                  i < remaining - free ? "bg-ink" : "bg-paper-3",
                )}
              />
            ))}
          </div>
        )}

        <p className="mt-3 flex items-center justify-between border-t border-rule pt-2.5 text-[11px] uppercase tracking-[0.08em]">
          <span className={cn(tight && !full ? "text-signal" : "text-ink-3")}>
            {status}
          </span>
          <span className="text-ink opacity-0 transition-opacity group-hover:opacity-100">
            Open grid →
          </span>
        </p>
      </div>
    </Link>
  );
}
