import Link from "next/link";
import { ArrowRight, MapPin, Users, Clock } from "lucide-react";
import { listFacilities, daySummaries } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import {
  todayKey, addDaysToKey, istDayLabel, istClock, BOOKING_HORIZON_DAYS,
} from "@/lib/time";
import { DayPicker } from "@/components/DayPicker";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sport?: string }>;
}) {
  const params = await searchParams;
  const today = todayKey();
  const dateKey = params.date ?? today;
  const sport = params.sport ?? null;

  const [facilities, summaries, user] = await Promise.all([
    listFacilities(),
    daySummaries(dateKey),
    currentUser(),
  ]);

  const sports = [...new Set(facilities.map((f) => f.sport))].sort();
  const shown = sport ? facilities.filter((f) => f.sport === sport) : facilities;

  const totalFree = [...summaries.values()].reduce((a, s) => a + s.free, 0);
  const totalRemaining = [...summaries.values()].reduce((a, s) => a + s.remaining, 0);
  const dayIsOver = totalRemaining === 0;

  return (
    <div className="space-y-8">
      <section className="rail pl-5">
        <p className="eyebrow">IIT Guwahati · Sports Board × Tech Board</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {user ? `Where are you playing, ${user.name.split(" ")[0]}?` : "Find a court."}
        </h1>
        <p className="mt-2 max-w-2xl text-ink-dim">
          {dayIsOver ? (
            <>
              Today is done — every slot has already started. Pick another day
              to book; slots open {BOOKING_HORIZON_DAYS} days ahead.
            </>
          ) : (
            <>
              {totalFree} of {totalRemaining} remaining slots are open on{" "}
              {istDayLabel(dateKey)}. Pick a facility, take a slot, and it is
              yours — confirmed the moment the database says so, never before.
            </>
          )}
        </p>
      </section>

      <DayPicker current={dateKey} today={today} sport={sport} />

      <div className="flex flex-wrap gap-2">
        <FilterChip href={buildHref(dateKey, null)} active={!sport}>
          All sports
        </FilterChip>
        {sports.map((s) => (
          <FilterChip key={s} href={buildHref(dateKey, s)} active={sport === s}>
            {s}
          </FilterChip>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((f) => {
          const s = summaries.get(f.id) ??
            { free: 0, remaining: 0, total: 0, nextFree: null };
          const over = s.remaining === 0;
          const pct = s.remaining ? Math.round((s.free / s.remaining) * 100) : 0;
          const busy = !over && pct <= 25;

          return (
            <Link
              key={f.id}
              href={`/facility/${f.slug}?date=${dateKey}`}
              className="group panel relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-violet"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 opacity-70"
                style={{ background: f.color }}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{f.emoji}</span>
                    <h2 className="truncate font-semibold">{f.name}</h2>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{f.location}</span>
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{ background: `${f.color}22`, color: f.color }}
                >
                  {f.sport}
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-1.5">
                {over ? (
                  <span className="text-sm text-ink-faint">
                    No slots left today
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        "text-2xl font-bold tabular-nums",
                        busy ? "text-warn" : "text-go",
                      )}
                    >
                      {s.free}
                    </span>
                    <span className="text-sm text-ink-faint">
                      of {s.remaining} left open
                    </span>
                  </>
                )}
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    over ? "bg-line" : busy ? "bg-warn" : "bg-go",
                  )}
                  style={{ width: `${over ? 100 : pct}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-ink-dim">
                  <Clock className="h-3 w-3" />
                  {s.nextFree
                    ? `Next free ${istClock(new Date(s.nextFree))}`
                    : over
                      ? "Closed for today"
                      : "Fully booked"}
                </span>
                <span className="flex items-center gap-1 text-ink-faint">
                  <Users className="h-3 w-3" />
                  {f.capacity}
                </span>
              </div>

              <span className="mt-4 flex items-center gap-1 text-sm font-medium text-flame opacity-0 transition-opacity group-hover:opacity-100">
                View slots <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function buildHref(date: string, sport: string | null) {
  const p = new URLSearchParams({ date });
  if (sport) p.set("sport", sport);
  return `/?${p}`;
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-flame bg-flame/15 text-flame"
          : "border-line text-ink-dim hover:border-violet hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
