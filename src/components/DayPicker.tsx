"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { addDaysToKey, istDayLabel } from "@/lib/time";
import { cn } from "@/lib/cn";
import { BOOKING_HORIZON_DAYS } from "@/lib/time";

export function DayPicker({
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

        return (
          <Link
            key={key}
            href={`${pathname}?${params}`}
            role="tab"
            aria-selected={active}
            className={cn(
              "shrink-0 rounded-xl border px-4 py-2.5 text-center transition-colors",
              active
                ? "border-flame bg-flame/15"
                : "border-line hover:border-violet",
            )}
          >
            <span
              className={cn(
                "block font-mono text-[10px] uppercase tracking-wider",
                active ? "text-flame" : "text-ink-faint",
              )}
            >
              {i === 0 ? "Today" : i === 1 ? "Tomorrow" : istDayLabel(key).split(",")[0]}
            </span>
            <span
              className={cn(
                "block text-sm font-semibold",
                active ? "text-ink" : "text-ink-dim",
              )}
            >
              {istDayLabel(key).split(", ")[1]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
