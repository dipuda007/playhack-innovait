import Link from "next/link";
import { MapPin, Users, ArrowRight } from "lucide-react";
import { CourtArt } from "@/components/CourtArt";
import { SportIcon } from "@/components/SportIcon";
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
 * One facility, as a card.
 *
 * Two zones, split by a rule: the facts on white, and the court plan on a
 * tinted strip beneath. The split is what stops a grid of twelve cards from
 * turning into a wall of text — the eye can navigate the row by court shape
 * alone, and the shapes are genuinely different from each other.
 *
 * Availability is stated three ways on purpose: a coloured dot, a word, and
 * a count. The dot is the fast read, the word survives colourblindness, and
 * the count is the one a student actually plans around.
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

  const state = dayOver ? "closed" : full ? "taken" : "open";
  const stateLabel = dayOver ? "Day closed" : full ? "Fully booked" : "Available";

  const note = dayOver
    ? "No slots remain today"
    : full
      ? "Join the waitlist for a release"
      : nextFreeLabel
        ? `Next free ${nextFreeLabel}`
        : "Open now";

  return (
    <Link
      href={`/facility/${facility.slug}?date=${dateKey}`}
      data-reveal
      style={{ "--reveal-delay": `${Math.min(index, 8) * 55}ms` } as React.CSSProperties}
      className={cn(
        "box box-link group flex flex-col overflow-hidden",
        dayOver && "opacity-80",
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="hed-sm uppercase text-ink transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-rust">
            {facility.name}
          </h3>
          <SportIcon
            sport={facility.sport}
            size={22}
            className="mt-0.5 shrink-0 text-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
          />
        </div>

        <p
          className={cn(
            "status mt-2.5",
            state === "open" && "status-open",
            state === "taken" && "status-taken",
            state === "closed" && "status-closed",
          )}
        >
          {stateLabel}
        </p>

        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-2">
          <MapPin size={14} className="shrink-0 text-ink-3" aria-hidden />
          {facility.location}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2">
          <Users size={14} className="shrink-0 text-ink-3" aria-hidden />
          Capacity: <span className="fig">{facility.capacity}</span>
        </p>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-1">
          <p className="basis-full whitespace-nowrap">
            {dayOver ? (
              <span className="fig text-[2.25rem] font-bold leading-none text-ink-3">
                —
              </span>
            ) : (
              <>
                <span
                  className={cn(
                    "fig text-[2.25rem] font-bold leading-none",
                    full ? "text-ink-3" : tight ? "text-signal" : "text-ink",
                  )}
                >
                  {String(free).padStart(2, "0")}
                </span>
                <span className="ml-2 text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  of {remaining} open
                </span>
              </>
            )}
          </p>

          {!dayOver && !full && (
            <span className="btn btn-solid btn-sm ml-auto">Quick book</span>
          )}
        </div>

        {/*
          Occupancy as a segmented bar — one cell per remaining slot, filled
          for the ones already gone. At sixteen slots it is still countable,
          which a percentage bar never is.
        */}
        {!dayOver && (
          <div className="mt-3 flex gap-px overflow-hidden rounded-full" aria-hidden>
            {Array.from({ length: Math.min(remaining, 24) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1",
                  i < remaining - free ? "bg-ink" : "bg-paper-3",
                )}
              />
            ))}
          </div>
        )}

        <p className="mt-3 flex items-center justify-between border-t border-rule pt-3 text-[11px] text-ink-3">
          <span className={cn(tight && !full && "font-semibold text-signal")}>
            {note}
          </span>
          <ArrowRight
            size={14}
            aria-hidden
            className="shrink-0 -translate-x-1 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-hover:opacity-100"
          />
        </p>
      </div>

      {/* The court plan. A drawing of the actual playing surface, to scale. */}
      <div className="relative h-24 overflow-hidden border-t border-rule bg-paper-2">
        {dayOver ? (
          <span className="hatch absolute inset-0 grid place-items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            Day closed
          </span>
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 p-2.5 text-ink opacity-40 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07] group-hover:opacity-65"
          >
            <CourtArt sport={facility.sport} className="h-full w-full" />
          </div>
        )}
      </div>
    </Link>
  );
}
