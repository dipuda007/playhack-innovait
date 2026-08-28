import {
  headline, peakHours, noShowRates, utilisationHeatmap, underusedPeakSlots,
} from "@/lib/analytics";
import { SectionHead } from "@/components/SectionHead";
import { SportIcon } from "@/components/SportIcon";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

function hourLabel(h: number) {
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${suffix}`;
}

export default async function AnalyticsPage() {
  const [stats, peaks, noShows, heat, underused] = await Promise.all([
    headline(),
    peakHours(),
    noShowRates(),
    utilisationHeatmap(),
    underusedPeakSlots(),
  ]);

  const maxPeak = Math.max(1, ...peaks.map((p) => p.bookings));

  // Pivot the heatmap rows into facility × hour.
  const facilities = [...new Map(heat.map((h) => [h.facility_id, h])).values()];
  const hours = [...new Set(heat.map((h) => h.hour))].sort((a, b) => a - b);
  const maxCell = Math.max(1, ...heat.map((h) => h.bookings));
  const cell = new Map(heat.map((h) => [`${h.facility_id}:${h.hour}`, h.bookings]));

  return (
    <div>
      <header className="border-b-2 border-ink pb-8 pt-8">
        <p className="kicker kicker-signal">Operations · Insights</p>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <h2 className="hed-xl font-display uppercase">
            Where the campus actually plays
          </h2>
          <div className="prose-news space-y-4 self-end">
            <p>
              Every figure on this page aggregates the same{" "}
              <span className="fig">bookings</span> table the booking path
              writes to. There is no reporting copy, no nightly export and
              nothing that can drift out of step with what actually happened.
            </p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 border-t border-ink sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label="Upcoming bookings" value={stats.upcoming} />
          <Kpi label="Booked last 7 days" value={stats.last7} />
          <Kpi label="Active students" value={stats.students} />
          <Kpi label="On waitlists" value={stats.waitlisted} />
          <Kpi
            label="No-show rate"
            value={`${stats.no_show_rate}%`}
            accent={stats.no_show_rate > 15}
          />
        </dl>
      </header>

      {/* ── Demand by hour ───────────────────────────────────────────── */}
      <section className="pt-10">
        <SectionHead
          index="01"
          rule={false}
          title="Demand by hour"
          note="Bookings started in each hour, trailing 14 days. Solid bars are the peak band."
        />

        {/*
          Each column is a fixed-height flex track: count, then a flex-1 plot
          area the bar's percentage height resolves against. Sizing the bar as
          a percentage of an auto-height parent silently collapses it to
          nothing, which is exactly what happened the first time.
        */}
        <div className="mt-6 flex h-52 items-stretch gap-px border-b border-ink">
          {peaks.map((p) => {
            const pct = (p.bookings / maxPeak) * 100;
            const isPeak = pct > 70;
            return (
              <div
                key={p.hour}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                title={`${hourLabel(p.hour)} · ${p.bookings} bookings`}
              >
                <span className="fig text-[9px] text-ink-3">{p.bookings}</span>
                <div className="flex min-h-0 w-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full",
                      isPeak ? "bg-ink" : "border-t-2 border-ink bg-paper-3",
                    )}
                    style={{ height: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-px">
          {peaks.map((p) => (
            <span
              key={p.hour}
              className="fig min-w-0 flex-1 pt-1 text-center text-[9px] text-ink-3"
            >
              {hourLabel(p.hour)}
            </span>
          ))}
        </div>
      </section>

      {/* ── Heatmap ──────────────────────────────────────────────────── */}
      <section className="pt-12">
        <SectionHead
          index="02"
          title="Utilisation by facility and hour"
          note="Denser hatching means busier. An empty band at the right of a row is capacity nobody is using."
        />

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse">
            <thead>
              <tr>
                <th className="w-44" />
                {hours.map((h) => (
                  <th key={h} className="kicker pb-1.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.facility_id} className="border-t border-rule">
                  <td className="py-0.5 pr-3 text-right text-[12px]">
                    <span className="flex items-center justify-end gap-1.5">
                      <SportIcon
                        sport={f.sport}
                        size={13}
                        className="shrink-0 text-ink-3"
                      />
                      {f.facility_name}
                    </span>
                  </td>
                  {hours.map((h) => {
                    const v = cell.get(`${f.facility_id}:${h}`) ?? 0;
                    const intensity = v / maxCell;
                    return (
                      <td key={h} className="p-px">
                        {/*
                          Density in ink, not in hue: an alpha ramp on one
                          colour reads correctly in greyscale and does not
                          smuggle in a second accent.
                        */}
                        <div
                          className="h-6 border border-paper"
                          title={`${f.facility_name} · ${hourLabel(h)} · ${v}`}
                          style={{
                            background:
                              v === 0
                                ? "var(--color-paper-2)"
                                : `color-mix(in oklab, var(--color-ink) ${
                                    12 + intensity * 88
                                  }%, var(--color-paper))`,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-10 pt-12 lg:grid-cols-2">
        {/* ── No-show ────────────────────────────────────────────────── */}
        <section>
          <SectionHead index="03" title="No-show rate" />
          <p className="prose-news mt-3 text-[15px]">
            A booked-but-empty court is worse than a busy one: the slot was
            denied to somebody who would have turned up.
          </p>

          <div className="mt-4 border-t border-ink">
            {noShows.slice(0, 8).map((n) => (
              <div
                key={n.facility_name}
                className="flex items-center gap-3 border-b border-rule py-2"
              >
                <span className="flex w-44 shrink-0 items-center gap-1.5 truncate text-[12px]">
                  <SportIcon
                    sport={n.sport}
                    size={13}
                    className="shrink-0 text-ink-3"
                  />
                  {n.facility_name}
                </span>
                <span className="h-2.5 flex-1 border border-rule">
                  <span
                    className={cn(
                      "block h-full",
                      n.rate > 15 ? "bg-signal" : "bg-ink",
                    )}
                    style={{ width: `${Math.min(100, n.rate * 4)}%` }}
                  />
                </span>
                <span className="fig w-16 shrink-0 text-right text-[11px]">
                  {n.rate}%
                  <span className="text-ink-3"> /{n.total}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Access opportunities ───────────────────────────────────── */}
        <section>
          <SectionHead index="04" title="Under-used prime slots" />
          <p className="prose-news mt-3 text-[15px]">
            Evening slots between five and nine that sat empty on three or more
            of the last fourteen days. These are the openings worth advertising
            to students who think the courts are always full.
          </p>

          {underused.length === 0 ? (
            <p className="mt-4 border-t border-ink py-4 text-[13px] text-ink-3">
              Every evening slot is being used. No spare prime capacity.
            </p>
          ) : (
            <div className="mt-4 border-t border-ink">
              {underused.map((u) => (
                <div
                  key={`${u.facility_name}-${u.hour}`}
                  className="flex items-center gap-3 border-b border-rule py-2"
                >
                  <SportIcon
                    sport={u.sport}
                    size={13}
                    className="shrink-0 text-ink-3"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {u.facility_name}
                  </span>
                  <span className="fig text-[12px] font-bold text-signal">
                    {hourLabel(u.hour)}
                  </span>
                  <span className="fig w-24 shrink-0 text-right text-[11px] text-ink-3">
                    free {u.free_days} days
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="border-b border-r border-rule py-4 pr-4 last:border-r-0">
      <dt className="kicker">{label}</dt>
      <dd
        className={cn(
          "fig mt-2 text-[1.9rem] font-bold leading-none",
          accent ? "text-signal" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
