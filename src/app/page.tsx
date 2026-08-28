import Link from "next/link";
import Image from "next/image";
import { Activity, ShieldCheck, Sparkles } from "lucide-react";
import { listFacilities, daySummaries } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import {
  todayKey, istDayLabel, istClock, BOOKING_HORIZON_DAYS,
} from "@/lib/time";
import { DayPicker } from "@/components/DayPicker";
import { Hero } from "@/components/Hero";
import { FacilityCard } from "@/components/FacilityCard";
import { Reveal, Stagger, StaggerItem } from "@/components/Motion";
import { SportIcon } from "@/components/SportIcon";
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
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="space-y-14">
      <Hero
        greeting="IIT Guwahati · Sports Board × Tech Board"
        headline={firstName ? `Where are you playing, ${firstName}?` : "Find a court."}
        sub={
          dayIsOver
            ? `Today is done — every slot has already started. Pick another day below; the grid opens ${BOOKING_HORIZON_DAYS} days ahead.`
            : `${totalFree} of ${totalRemaining} remaining slots are open on ${istDayLabel(dateKey)}. Take one and it is yours — confirmed the moment the database says so, never before.`
        }
        freeNow={totalFree}
        facilities={facilities.length}
        dayLabel={istDayLabel(dateKey).split(",")[0]}
      />

      <section id="courts" className="scroll-mt-24 space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="metric-label">Step 1 — pick a day</p>
              <h2 className="display mt-1.5 text-2xl">
                {istDayLabel(dateKey)}
              </h2>
            </div>
            <p className="text-xs text-ink-faint">
              Slots run on each facility&apos;s own grid, in IST.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <DayPicker current={dateKey} today={today} sport={sport} />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="flex flex-wrap gap-2">
            <FilterChip href={buildHref(dateKey, null)} active={!sport}>
              <Sparkles className="h-3.5 w-3.5" />
              All sports
            </FilterChip>
            {sports.map((s) => (
              <FilterChip
                key={s}
                href={buildHref(dateKey, s)}
                active={sport === s}
              >
                <SportIcon sport={s} size={14} />
                {s}
              </FilterChip>
            ))}
          </div>
        </Reveal>

        <Stagger
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          delay={0.08}
        >
          {shown.map((f) => {
            const s = summaries.get(f.id) ?? {
              free: 0, remaining: 0, total: 0, nextFree: null,
            };
            return (
              <StaggerItem key={f.id}>
                <FacilityCard
                  dateKey={dateKey}
                  facility={{
                    slug: f.slug,
                    name: f.name,
                    sport: f.sport,
                    location: f.location,
                    capacity: f.capacity,
                    color: f.color,
                  }}
                  summary={{
                    free: s.free,
                    remaining: s.remaining,
                    nextFreeLabel: s.nextFree
                      ? istClock(new Date(s.nextFree))
                      : null,
                  }}
                />
              </StaggerItem>
            );
          })}
        </Stagger>

        {shown.length === 0 && (
          <p className="panel p-8 text-center text-sm text-ink-dim">
            No {sport} facilities are listed.{" "}
            <Link href={buildHref(dateKey, null)} className="text-flame underline">
              Show every sport
            </Link>
            .
          </p>
        )}
      </section>

      {/* Why this is not just a form over a table. */}
      <Reveal>
        <section className="panel relative overflow-hidden">
          <div className="grid lg:grid-cols-[1.05fr_1fr]">
            <div className="p-7 sm:p-9">
              <p className="eyebrow">The hard part</p>
              <h2 className="display mt-3 text-[clamp(1.6rem,3vw,2.2rem)]">
                At 6:00 PM, fifty students want the same court.
              </h2>
              <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-ink-dim">
                Exactly one has to win, and the rest need an answer they can
                act on — not a spinner, and never a second confirmation for a
                slot that is already gone. That decision is not made in
                application code here. It is made by a single constraint inside
                Postgres, on the write itself, where no code path can go around
                it.
              </p>

              <div className="mt-6 overflow-x-auto">
                <code className="block whitespace-pre rounded-xl border border-line bg-void/60 p-4 font-mono text-[11px] leading-relaxed text-violet-soft">
{`EXCLUDE USING gist (
  facility_id WITH =,
  during      WITH &&
) WHERE (status = 'confirmed')`}
                </code>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href="/race" className="btn-primary px-4 py-2 text-sm">
                  <Activity className="h-4 w-4" />
                  Run the race live
                </Link>
                <Link href="/fair" className="btn-ghost px-4 py-2 text-sm">
                  See the fair draw
                </Link>
              </div>
            </div>

            <div className="relative min-h-[15rem] border-t border-line lg:border-l lg:border-t-0">
              <Image
                src="/campus/academic-complex.jpg"
                alt="The IIT Guwahati academic complex, with the Brahmaputra behind it"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover opacity-45"
              />
              <div className="absolute inset-0 bg-[linear-gradient(120deg,var(--color-ground)_0%,rgba(10,8,24,0.55)_45%,rgba(10,8,24,0.75)_100%)]" />
              <div className="absolute inset-0 flex items-end p-6">
                <dl className="grid w-full grid-cols-3 gap-3">
                  <Stat value="1" label="booking survives" tone="text-go" />
                  <Stat value="199" label="typed rejections" tone="text-flame" />
                  <Stat value="0" label="overlapping pairs" tone="text-violet-soft" />
                </dl>
              </div>
              <p className="absolute right-3 top-3 font-mono text-[9px] text-ink-faint/70">
                Academic complex · public domain
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-ink-faint">
          <ShieldCheck className="h-3.5 w-3.5 text-go" />
          Availability on this page is derived from live bookings on every
          request — there is no slot table to fall out of sync.
        </p>
      </Reveal>
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line/80 bg-surface-solid/70 p-3 backdrop-blur">
      <dd className={cn("display text-2xl tabular-nums", tone)}>{value}</dd>
      <dt className="mt-1 text-[11px] leading-tight text-ink-faint">{label}</dt>
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
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm capitalize transition-all duration-300",
        active
          ? "border-flame/70 bg-flame/15 text-flame shadow-[0_0_20px_-8px_var(--color-flame)]"
          : "border-line bg-white/[0.02] text-ink-dim hover:border-violet/60 hover:bg-violet/10 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
