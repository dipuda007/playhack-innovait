import Link from "next/link";
import Image from "next/image";
import { listFacilities, daySummaries } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import {
  todayKey, istDayLabel, istClock, BOOKING_HORIZON_DAYS,
} from "@/lib/time";
import { DayRail } from "@/components/DayRail";
import { LeadStory } from "@/components/LeadStory";
import { FacilityEntry } from "@/components/FacilityEntry";
import { SectionHead } from "@/components/SectionHead";
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
    <div>
      <LeadStory
        headline={firstName ? `Where are you playing, ${firstName}?` : "Find a court."}
        standfirst={
          dayIsOver
            ? `Today is done — every slot has already started. Pick another day below; the grid opens ${BOOKING_HORIZON_DAYS} days ahead.`
            : `${totalFree} of ${totalRemaining} remaining slots are open across campus. Take one and it is yours — confirmed the moment the database says so, and never before.`
        }
        dateLabel={istDayLabel(dateKey)}
        open={totalFree}
        remaining={totalRemaining}
        facilities={facilities.length}
      />

      <section id="index" className="scroll-mt-16 pt-10">
        <SectionHead
          index="01"
          rule={false}
          title="The grid"
          note={`Slots run on each facility's own timetable, in IST. Booking opens ${BOOKING_HORIZON_DAYS} days ahead.`}
        />

        <div className="mt-5">
          <DayRail current={dateKey} today={today} sport={sport} />
        </div>

        {/* Sport filter, set as a ruled index line rather than as chips. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-rule pb-4">
          <span className="kicker mr-2">Filter</span>
          <FilterLink href={buildHref(dateKey, null)} active={!sport}>
            All
          </FilterLink>
          {sports.map((s) => (
            <FilterLink
              key={s}
              href={buildHref(dateKey, s)}
              active={sport === s}
            >
              {s}
            </FilterLink>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="prose-news border-b border-rule py-12 text-center">
            No {sport} facilities are listed.{" "}
            <Link
              href={buildHref(dateKey, null)}
              className="text-signal underline underline-offset-4"
            >
              Show every sport
            </Link>
            .
          </p>
        ) : (
          /*
           * A negative gap of one pixel collapses adjacent borders, so the
           * grid reads as one ruled table rather than as twelve boxes with a
           * doubled line between each. It is the oldest trick in table
           * layout and it is why this looks printed.
           */
          <div className="mt-6 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f, i) => {
              const s = summaries.get(f.id) ?? {
                free: 0, remaining: 0, total: 0, nextFree: null,
              };
              return (
                <FacilityEntry
                  key={f.id}
                  index={i + 1}
                  dateKey={dateKey}
                  facility={{
                    slug: f.slug,
                    name: f.name,
                    sport: f.sport,
                    location: f.location,
                    capacity: f.capacity,
                  }}
                  summary={{
                    free: s.free,
                    remaining: s.remaining,
                    nextFreeLabel: s.nextFree
                      ? istClock(new Date(s.nextFree))
                      : null,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* The case, set as an opinion column with a picture. */}
      <section className="pt-14">
        <SectionHead
          index="02"
          title="Why this is hard"
          note="The part of the brief that is not a form over a table."
        />

        <div className="mt-6 grid gap-8 border-t border-ink pt-6 lg:grid-cols-[1fr_1.25fr_0.85fr]">
          <div>
            <h3 className="hed-md font-display uppercase">
              At six, fifty students want the same court.
            </h3>
            <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-signal">
              Exactly one may win
            </p>
          </div>

          <div className="prose-news space-y-4 lg:columns-2 lg:gap-7 [&>p]:break-inside-avoid">
            <p>
              <strong>The decision is not made in application code.</strong> A
              check-then-write leaves a gap, and under load another request
              commits inside it. Both requests were individually correct; the
              court is double-booked anyway.
            </p>
            <p>
              Here the write <em>is</em> the decision. Every confirmed booking
              is a row carrying a time range, and one exclusion constraint
              forbids two overlapping ranges on the same facility. Postgres
              rejects the loser with SQLSTATE <span className="fig">23P01</span>{" "}
              before it ever becomes a row.
            </p>
            <p>
              That also covers the case a unique key cannot see: a booking from
              18:30 to 19:30 does not have the same start time as one from
              18:00 to 19:00, but it does overlap it — and overlap is the thing
              that actually matters to a student holding a racket.
            </p>
            <p>
              Losing is a first-class outcome, not an error page. A rejected
              request comes back typed, with three alternative slots on the
              same grid, and the queue position if the student wants to wait.
            </p>
          </div>

          <figure>
            <div className="relative aspect-[4/3] w-full border border-ink">
              <Image
                src="/campus/academic-complex.jpg"
                alt="The IIT Guwahati academic complex, with the Brahmaputra behind it"
                fill
                sizes="(max-width: 1024px) 100vw, 25vw"
                className="halftone object-cover"
              />
            </div>
            <figcaption className="mt-2 text-[11px] leading-tight text-ink-3">
              The academic complex. Six thousand students, twelve bookable
              facilities.{" "}
              <span className="font-mono uppercase tracking-wider">
                Public domain
              </span>
            </figcaption>

            <dl className="mt-5 border-t-2 border-ink">
              <Result k="Confirmed" v="1" />
              <Result k="Rejected, typed" v="199" />
              <Result k="Overlapping pairs" v="0" accent />
            </dl>

            <Link href="/race" className="btn btn-signal mt-5 w-full">
              Run it yourself
            </Link>
          </figure>
        </div>
      </section>
    </div>
  );
}

function Result({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-rule py-2">
      <dt className="text-[11px] uppercase tracking-[0.1em] text-ink-3">{k}</dt>
      <dd
        className={cn(
          "fig text-lg font-bold",
          accent ? "text-signal" : "text-ink",
        )}
      >
        {v}
      </dd>
    </div>
  );
}

function buildHref(date: string, sport: string | null) {
  const p = new URLSearchParams({ date });
  if (sport) p.set("sport", sport);
  return `/?${p}`;
}

function FilterLink({
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
        "px-2.5 py-1 text-[12px] uppercase tracking-[0.08em] transition-colors",
        active
          ? "bg-ink text-paper"
          : "text-ink-2 hover:bg-paper-2 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
