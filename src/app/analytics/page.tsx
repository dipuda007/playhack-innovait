import { TrendingUp, Users, ListPlus, UserX, CalendarCheck } from "lucide-react";
import {
  headline, peakHours, noShowRates, utilisationHeatmap, underusedPeakSlots,
} from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { SportIcon } from "@/components/SportIcon";

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
    <div className="space-y-8">
      <section className="rail pl-5">
        <p className="eyebrow">Operations · Insights</p>
        <h1 className="display mt-3 text-[clamp(1.8rem,4vw,2.5rem)]">
          Where the campus actually plays.
        </h1>
        <p className="mt-2 max-w-2xl text-ink-dim">
          Every figure here aggregates the same <code className="font-mono text-violet-soft">bookings</code>{" "}
          table the booking path writes to — there is no separate reporting copy
          that can drift out of step with reality.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={<CalendarCheck className="h-4 w-4" />} label="Upcoming bookings" value={stats.upcoming} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Booked last 7 days" value={stats.last7} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Active students" value={stats.students} />
        <Kpi icon={<ListPlus className="h-4 w-4" />} label="On waitlists" value={stats.waitlisted} />
        <Kpi
          icon={<UserX className="h-4 w-4" />}
          label="No-show rate"
          value={`${stats.no_show_rate}%`}
          tone={stats.no_show_rate > 15 ? "stop" : stats.no_show_rate > 8 ? "warn" : "go"}
        />
      </div>

      {/* Peak hours */}
      <section className="panel p-5">
        <h2 className="font-semibold">Demand by hour</h2>
        <p className="mt-1 text-xs text-ink-dim">
          Bookings started in each hour, trailing 14 days.
        </p>
        {/*
          Each column is a fixed-height flex track: label row, then a flex-1
          plot area the bar's percentage height resolves against. Sizing the
          bar as a percentage of an auto-height parent silently collapses it
          to nothing, which is exactly what happened the first time.
        */}
        <div className="mt-5 flex h-48 items-stretch gap-1.5">
          {peaks.map((p) => {
            const pct = (p.bookings / maxPeak) * 100;
            const isPeak = pct > 70;
            return (
              <div
                key={p.hour}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                title={`${hourLabel(p.hour)} · ${p.bookings} bookings`}
              >
                <span className="font-mono text-[9px] tabular-nums text-ink-faint">
                  {p.bookings}
                </span>
                <div className="flex min-h-0 w-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      isPeak ? "bg-chart-1" : "bg-chart-2/70",
                    )}
                    style={{ height: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-ink-faint">
                  {hourLabel(p.hour)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-4 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-chart-1" /> Peak demand
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-chart-2/70" /> Off-peak
          </span>
        </p>
      </section>

      {/* Heatmap */}
      <section className="panel p-5">
        <h2 className="font-semibold">Utilisation by facility and hour</h2>
        <p className="mt-1 text-xs text-ink-dim">
          Darker means busier. The empty band on the right of a row is capacity
          nobody is using.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th className="w-40" />
                {hours.map((h) => (
                  <th
                    key={h}
                    className="pb-1 font-mono text-[9px] font-normal text-ink-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.facility_id}>
                  <td className="pr-3 text-right text-xs text-ink-dim">
                    <span className="flex items-center justify-end gap-1.5">
                      <SportIcon sport={f.sport} size={14} className="shrink-0 text-ink-faint" />
                      {f.facility_name}
                    </span>
                  </td>
                  {hours.map((h) => {
                    const v = cell.get(`${f.facility_id}:${h}`) ?? 0;
                    const intensity = v / maxCell;
                    return (
                      <td key={h} className="p-0">
                        <div
                          className="h-6 rounded-sm"
                          title={`${f.facility_name} · ${hourLabel(h)} · ${v}`}
                          style={{
                            background:
                              v === 0
                                ? "var(--color-line-soft)"
                                : `color-mix(in oklab, var(--color-chart-1) ${
                                    18 + intensity * 82
                                  }%, transparent)`,
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* No-show */}
        <section className="panel p-5">
          <h2 className="font-semibold">No-show rate by facility</h2>
          <p className="mt-1 text-xs text-ink-dim">
            A booked-but-empty court is worse than a busy one: the slot was
            denied to someone who would have turned up.
          </p>
          <div className="mt-4 space-y-2.5">
            {noShows.slice(0, 8).map((n) => (
              <div key={n.facility_name} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-xs">
                  <span className="flex items-center gap-1.5">
                    <SportIcon sport={n.sport} size={14} className="shrink-0 text-ink-faint" />
                    {n.facility_name}
                  </span>
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      n.rate > 15 ? "bg-stop" : n.rate > 8 ? "bg-warn" : "bg-go",
                    )}
                    style={{ width: `${Math.min(100, n.rate * 4)}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-xs tabular-nums text-ink-dim">
                  {n.rate}% <span className="text-ink-faint">/{n.total}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Access opportunities */}
        <section className="panel p-5">
          <h2 className="font-semibold">Under-used prime slots</h2>
          <p className="mt-1 text-xs text-ink-dim">
            Evening slots (5–9 pm) that sat empty on three or more of the last
            fourteen days. These are the openings worth advertising.
          </p>
          <div className="mt-4 space-y-2">
            {underused.length === 0 ? (
              <p className="text-sm text-ink-faint">
                Every evening slot is being used. No spare prime capacity.
              </p>
            ) : (
              underused.map((u) => (
                <div
                  key={`${u.facility_name}-${u.hour}`}
                  className="flex items-center justify-between rounded-lg border border-line bg-raised/40 px-3 py-2"
                >
                  <span className="text-sm">
                    <span className="flex items-center gap-1.5">
                      <SportIcon sport={u.sport} size={14} className="shrink-0 text-ink-faint" />
                      {u.facility_name}
                    </span>
                    <span className="ml-2 font-mono text-xs text-flame">
                      {hourLabel(u.hour)}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-ink-dim">
                    free {u.free_days} days
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "go" | "warn" | "stop";
}) {
  return (
    <div className="rounded-xl border border-line bg-raised/40 p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          tone === "go" && "text-go",
          tone === "warn" && "text-warn",
          tone === "stop" && "text-stop",
        )}
      >
        {value}
      </p>
    </div>
  );
}
