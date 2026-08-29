import Link from "next/link";
import { notFound } from "next/navigation";
import { facilityDay } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import { todayKey, istDayLabel } from "@/lib/time";
import { DayRail } from "@/components/DayRail";
import { SlotGrid } from "@/components/SlotGrid";
import { CourtArt } from "@/components/CourtArt";
import { SectionHead } from "@/components/SectionHead";

export const dynamic = "force-dynamic";

export default async function FacilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const { date } = await searchParams;
  const today = todayKey();
  const dateKey = date ?? today;

  const user = await currentUser();
  const day = await facilityDay(slug, dateKey, user?.id ?? null);
  if (!day) notFound();

  const { facility } = day;

  return (
    <div className="shell pb-16">
      <p className="pt-5">
        <Link
          href={`/?date=${dateKey}`}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3 underline-offset-4 hover:text-signal hover:underline"
        >
          ← Back to the grid
        </Link>
      </p>

      {/*
        The facility head is set like the top of a match report: name at
        headline size, the plan drawn beside it, and the standing details in a
        ruled fact table underneath. The court drawing is the same artwork the
        index entry carried, printed here at the size it deserves.
      */}
      <header className="mt-4 border-y border-rule py-7">
        <div className="grid gap-7 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
          <div>
            <p className="kicker kicker-signal">{facility.sport}</p>
            <h2 className="hed-lg mt-3 font-display uppercase">
              {facility.name}
            </h2>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
              {facility.location}
            </p>
            {facility.description && (
              <p className="standfirst mt-4 max-w-[48ch]">
                {facility.description}
              </p>
            )}

            <dl className="mt-6 grid max-w-lg grid-cols-3 border-t border-ink">
              <Fact
                label="Hours"
                value={`${facility.opensAt.slice(0, 5)}–${facility.closesAt.slice(0, 5)}`}
              />
              <Fact label="Slot" value={`${facility.slotMinutes} min`} />
              <Fact label="Capacity" value={String(facility.capacity)} />
            </dl>
          </div>

          <figure className="hidden lg:block">
            <div className="border border-rule p-6 text-ink">
              <CourtArt sport={facility.sport} className="h-44 w-full" />
            </div>
            <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              Playing surface, markings to scale
            </figcaption>
          </figure>
        </div>
      </header>

      <section className="pt-9">
        <SectionHead
          index="01"
          rule={false}
          title={istDayLabel(dateKey)}
          note="A slot is yours only once the confirmation appears. Nothing is held by clicking."
          action={
            <p className="shrink-0 text-right">
              <span className="fig text-3xl font-bold leading-none">
                {String(day.freeCount).padStart(2, "0")}
              </span>
              <span className="ml-2 text-[11px] uppercase tracking-[0.1em] text-ink-3">
                of {day.totalCount} open
              </span>
            </p>
          }
        />

        <div className="mt-5">
          <DayRail current={dateKey} today={today} />
        </div>

        <div className="mt-6">
          <SlotGrid
            facilityId={facility.id}
            facilitySlug={facility.slug}
            dateKey={dateKey}
            initialSlots={day.slots}
            signedIn={Boolean(user)}
          />
        </div>

        <p className="prose-news mt-6 border-t border-rule pt-4 text-[15px]">
          This grid updates live as other students book. The database decides
          the winner of every contested slot, and it decides at the moment of
          writing — not when the page was rendered.
        </p>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-rule py-3 pr-4 last:border-r-0">
      <dt className="kicker">{label}</dt>
      <dd className="fig mt-1.5 text-lg font-bold leading-none">{value}</dd>
    </div>
  );
}
