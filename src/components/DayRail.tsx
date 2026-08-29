"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { addDaysToKey, istDayLabel, BOOKING_HORIZON_DAYS } from "@/lib/time";
import { cn } from "@/lib/cn";

/**
 * The day rail.
 *
 * Eight days as one scrollable strip of tiles. The selected day inverts to
 * solid navy — the same fill the slot grid uses for a taken slot, so the
 * language of "this cell is claimed" is identical everywhere in the product.
 *
 * The strip scrolls horizontally on a phone rather than wrapping. A wrapped
 * date row puts Thursday under Sunday, and the sequence is the whole point.
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
      className="flex gap-2 overflow-x-auto pb-1"
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
              "min-w-[6.25rem] flex-1 rounded-lg border px-3 py-3 text-center transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
              active
                ? "border-navy bg-navy text-white shadow-[0_8px_20px_-10px_rgb(0_33_71/0.6)]"
                : "border-rule bg-paper text-ink hover:-translate-y-0.5 hover:border-rule-2 hover:shadow-[var(--shadow-card)]",
            )}
          >
            <span
              className={cn(
                "block text-[10px] font-bold uppercase tracking-[0.12em]",
                active ? "text-white/70" : "text-ink-3",
              )}
            >
              {i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday}
            </span>
            <span className="mt-1.5 block whitespace-nowrap text-sm font-semibold">
              {date}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
