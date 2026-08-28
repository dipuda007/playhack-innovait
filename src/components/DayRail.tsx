"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { addDaysToKey, istDayLabel, BOOKING_HORIZON_DAYS } from "@/lib/time";
import { cn } from "@/lib/cn";

/**
 * The day rail.
 *
 * A fixture list runs across the page as one ruled strip of dates, not as a
 * row of pills. Each day is a cell in a table: weekday over date, hairline
 * between, and the selected one inverted to solid ink — the same fill
 * language the slot grid uses for a taken slot, so "selected" and "occupied"
 * read as the same kind of fact throughout the paper.
 */
export function DayRail({
  current,
  today,
  sport,
}: {
  current: string;
  today: string;
  sport?: string | null;
}) {
  const pathname = usePathname();

  const days = Array.from({ length: BOOKING_HORIZON_DAYS + 1 }, (_, i) =>
    addDaysToKey(today, i),
  );

  return (
    <div
      className="flex overflow-x-auto border-y border-ink"
      role="tablist"
      aria-label="Choose a day"
    >
      {days.map((key, i) => {
        const params = new URLSearchParams({ date: key });
        if (sport) params.set("sport", sport);
        const active = key === current;
        const [weekday, date] = istDayLabel(key).split(", ");

        return (
          <Link
            key={key}
            href={`${pathname}?${params}`}
            role="tab"
            aria-selected={active}
            className={cn(
              "min-w-[6.5rem] flex-1 border-r border-rule px-3 py-3 text-center transition-colors last:border-r-0",
              active ? "bg-ink text-paper" : "hover:bg-paper-2",
            )}
          >
            <span
              className={cn(
                "block font-mono text-[9px] uppercase tracking-[0.16em]",
                active ? "text-paper/70" : "text-ink-3",
              )}
            >
              {i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday}
            </span>
            <span className="mt-1 block whitespace-nowrap font-display text-sm uppercase">
              {date}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
