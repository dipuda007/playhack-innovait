import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Info, MapPin, Users } from "lucide-react";
import { facilityDay } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import { todayKey, istDayLabel } from "@/lib/time";
import { DayPicker } from "@/components/DayPicker";
import { SlotGrid } from "@/components/SlotGrid";
import { CourtArt } from "@/components/CourtArt";
import { SportIcon } from "@/components/SportIcon";
import { Reveal } from "@/components/Motion";

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
  const pct = day.totalCount
    ? Math.round((day.freeCount / day.totalCount) * 100)
    : 0;

  return (
    <div className="space-y-7">
      <Link
        href={`/?date=${dateKey}`}
        className="group inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        All facilities
      </Link>

      {/*
        The banner carries the court drawing at full size, in the facility's
        colour. It is the same artwork as the browse card, at the scale the
        card could not give it — so arriving here feels like walking through
        the card rather than landing on an unrelated page.
      */}
      <header className="panel relative isolate overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-3 right-4 w-[46%] opacity-[0.22] [mask-image:linear-gradient(90deg,transparent,black_35%)]"
          style={{ color: facility.color }}
        >
          <CourtArt
            sport={facility.sport}
            fit="meet-right"
            className="h-full w-full"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(28rem 16rem at 2% 0%, ${facility.color}, transparent 68%)`,
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, ${facility.color}, transparent 70%)` }}
        />

        <div className="relative flex flex-wrap items-start justify-between gap-6 p-6 sm:p-7">
          <div className="min-w-0">
            <div className="flex items-center gap-3.5">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border"
                style={{
                  color: facility.color,
                  borderColor: `${facility.color}55`,
                  background: `${facility.color}1a`,
                }}
              >
                <SportIcon sport={facility.sport} size={24} />
              </span>
              <div className="min-w-0">
                <p className="metric-label">{facility.sport}</p>
                <h1 className="display mt-1 text-[clamp(1.6rem,3.6vw,2.35rem)]">
                  {facility.name}
                </h1>
              </div>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-dim">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {facility.location}
            </p>

            {facility.description && (
              <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-ink-dim">
                {facility.description}
              </p>
            )}
          </div>

          <dl className="flex shrink-0 gap-2.5">
            <Fact
              label="Hours"
              value={`${facility.opensAt.slice(0, 5)}–${facility.closesAt.slice(0, 5)}`}
              icon={<Clock3 className="h-3.5 w-3.5" />}
            />
            <Fact label="Slot" value={`${facility.slotMinutes} min`} />
            <Fact
              label="Capacity"
              value={String(facility.capacity)}
              icon={<Users className="h-3.5 w-3.5" />}
            />
          </dl>
        </div>
      </header>

      <Reveal>
        <DayPicker current={dateKey} today={today} />
      </Reveal>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="metric-label">Step 2 — take a slot</p>
          <h2 className="display mt-1.5 text-2xl">{istDayLabel(dateKey)}</h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-dim">
            <span className="display text-2xl text-go">{day.freeCount}</span>{" "}
            of {day.totalCount} open
          </p>
          <div className="mt-1.5 h-1 w-36 overflow-hidden rounded-full bg-line/70">
            <div
              className="h-full rounded-full bg-go transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <SlotGrid
        facilityId={facility.id}
        facilitySlug={facility.slug}
        dateKey={dateKey}
        initialSlots={day.slots}
        signedIn={Boolean(user)}
      />

      <p className="flex items-start gap-2.5 rounded-xl border border-line-soft bg-white/[0.02] p-4 text-xs leading-relaxed text-ink-dim">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
        <span>
          This grid updates live as other students book. A slot is yours only
          once the confirmation appears — the database decides the winner, and
          nothing is reserved by clicking.
        </span>
      </p>
    </div>
  );
}

function Fact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-solid/80 px-3.5 py-2.5 text-center backdrop-blur-sm">
      <dt className="metric-label">{label}</dt>
      <dd className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
        {icon}
        {value}
      </dd>
    </div>
  );
}
