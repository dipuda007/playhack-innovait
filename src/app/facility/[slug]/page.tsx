import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Users, Info } from "lucide-react";
import { facilityDay } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import { todayKey, istDayLabel } from "@/lib/time";
import { DayPicker } from "@/components/DayPicker";
import { SlotGrid } from "@/components/SlotGrid";

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
    <div className="space-y-6">
      <Link
        href={`/?date=${dateKey}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All facilities
      </Link>

      <header className="panel relative overflow-hidden p-6">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: facility.color }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{facility.emoji}</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {facility.name}
                </h1>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-dim">
                  <MapPin className="h-3.5 w-3.5" />
                  {facility.location}
                </p>
              </div>
            </div>
            {facility.description && (
              <p className="mt-3 max-w-xl text-sm text-ink-dim">
                {facility.description}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Open
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {facility.opensAt.slice(0, 5)}–{facility.closesAt.slice(0, 5)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Slot
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {facility.slotMinutes} min
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Capacity
              </dt>
              <dd className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold">
                <Users className="h-3.5 w-3.5" />
                {facility.capacity}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <DayPicker current={dateKey} today={today} />

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{istDayLabel(dateKey)}</h2>
        <p className="text-sm text-ink-dim">
          <span className="font-semibold text-go">{day.freeCount}</span> of{" "}
          {day.totalCount} open
        </p>
      </div>

      <SlotGrid
        facilityId={facility.id}
        facilitySlug={facility.slug}
        dateKey={dateKey}
        initialSlots={day.slots}
        signedIn={Boolean(user)}
      />

      <p className="flex items-start gap-2 rounded-xl border border-line-soft bg-raised/40 p-4 text-xs text-ink-dim">
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
