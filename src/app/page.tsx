import Link from "next/link";
import Image from "next/image";
import { listFacilities, daySummaries } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import {
  todayKey, istDayLabel, istClock, BOOKING_HORIZON_DAYS,
} from "@/lib/time";
import { DayRail } from "@/components/DayRail";
import { Hero } from "@/components/Hero";
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
    <>
      <Hero
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

      <div className="shell">
        <section id="grid" className="scroll-mt-24 pt-10">
          <SectionHead
            index="01"
            rule={false}
            title="The grid"
            action={
              <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
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
            }
            note={`Slots run on each facility's own timetable, in IST. Booking opens ${BOOKING_HORIZON_DAYS} days ahead.`}
          />

          <div className="mt-6">
            <DayRail current={dateKey} today={today} sport={sport} />
          </div>

          {shown.length === 0 ? (
            <p className="prose-news py-16 text-center">
              No {sport} facilities are listed.{" "}
              <Link
                href={buildHref(dateKey, null)}
                className="font-semibold text-signal underline underline-offset-4"
              >
                Show every sport
              </Link>
              .
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

        {/* The case for the engineering, told beside a picture of the place. */}
        <section className="pt-16">
          <SectionHead
            index="02"
            title="Why this is hard"
            note="The part of the brief that is not a form over a table."
          />

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.35fr_0.9fr]">
            <div data-reveal>
              <h3 className="hed-md text-navy">
                At six, fifty students want the same court. Exactly one may win.
              </h3>
              <div className="gold-rule mt-4" />

              <div className="prose-news mt-6 space-y-4 md:columns-2 md:gap-8 [&>p]:break-inside-avoid">
                <p>
                  <strong>The decision is not made in application code.</strong>{" "}
                  A check-then-write leaves a gap, and under load another
                  request commits inside it. Both requests were individually
                  correct; the court is double-booked anyway.
                </p>
                <p>
                  Here the write <em>is</em> the decision. Every confirmed
                  booking is a row carrying a time range, and one exclusion
                  constraint forbids two overlapping ranges on the same
                  facility. Postgres rejects the loser with SQLSTATE{" "}
                  <span className="fig">23P01</span> before it ever becomes a
                  row.
                </p>
                <p>
                  That also covers the case a unique key cannot see: a booking
                  from 18:30 to 19:30 does not have the same start time as one
                  from 18:00 to 19:00, but it does overlap it — and overlap is
                  the thing that actually matters to a student holding a
                  racket.
                </p>
                <p>
                  Losing is a first-class outcome, not an error page. A
                  rejected request comes back typed, with three alternative
                  slots on the same grid, and the queue position if the student
                  wants to wait.
                </p>
              </div>

              <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-3">
                <Result k="Confirmed" v="1" />
                <Result k="Rejected, typed" v="199" />
                <Result k="Overlapping pairs" v="0" accent />
              </dl>
            </div>

            <figure data-reveal style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-rule shadow-[var(--shadow-card)]">
                <Image
                  src="/campus/academic-complex.jpg"
                  alt="The IIT Guwahati academic complex, with the Brahmaputra behind it"
                  fill
                  sizes="(max-width: 1024px) 100vw, 32vw"
                  className="halftone object-cover"
                />
              </div>
              <figcaption className="mt-3 text-[12px] leading-relaxed text-ink-3">
                The academic complex. Six thousand students, twelve bookable
                facilities. Photograph by Satyadeep Karnati, public domain.
              </figcaption>

              <Link href="/race" className="btn btn-signal mt-6 w-full">
                Run the race yourself
              </Link>
            </figure>
          </div>
        </section>
      </div>
    </>
  );
}

function Result({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="bg-paper p-5">
      <dd
        className={cn(
          "fig text-3xl font-bold leading-none",
          accent ? "text-signal" : "text-navy",
        )}
      >
        {v}
      </dd>
      <dt className="mt-2 text-[11px] uppercase tracking-[0.1em] text-ink-3">
        {k}
      </dt>
    </div>
  );
}

function buildHref(date: string, sport: string | null) {
  const p = new URLSearchParams({ date });
  if (sport) p.set("sport", sport);
  return `/?${p}`;
}

/**
 * The sport filter, set as a row of tabs rather than as chips: an underline
 * that slides under the active word is the pattern a reader already knows
 * from every institutional site, and it does not add twelve filled pills to
 * a page that already has twelve cards.
 */
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
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative px-2.5 py-1.5 text-[14px] capitalize transition-colors duration-200",
        "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:origin-center after:bg-burgundy after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)]",
        active
          ? "font-semibold text-burgundy after:scale-x-100"
          : "text-ink-2 hover:text-burgundy after:scale-x-0 hover:after:scale-x-100",
      )}
    >
      {children}
    </Link>
  );
}
