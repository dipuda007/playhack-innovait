import { Wrench, ShieldAlert, Activity } from "lucide-react";
import { sql } from "@/db/client";
import { listFacilities } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import { istClock, istDateKey, istDayLabel, todayKey, addDaysToKey } from "@/lib/time";
import { OpsConsole } from "@/components/OpsConsole";
import { ReopenButton } from "@/components/ReopenButton";
import { cn } from "@/lib/cn";
import { SportIcon } from "@/components/SportIcon";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const user = await currentUser();
  const isManager = user?.role === "manager" || user?.role === "admin";

  const [facilities, blocks, events, queues] = await Promise.all([
    listFacilities(),
    sql<
      {
        id: string; note: string | null; starts_at: string; ends_at: string;
        facility_name: string; sport: string;
      }[]
    >`
      SELECT b.id, b.note, lower(b.during) AS starts_at, upper(b.during) AS ends_at,
             f.name AS facility_name, f.sport
      FROM bookings b JOIN facilities f ON f.id = b.facility_id
      WHERE b.kind = 'block' AND b.status = 'confirmed' AND upper(b.during) > now()
      ORDER BY lower(b.during)
    `,
    sql<
      {
        id: string; type: string; at: string;
        facility_name: string | null; user_name: string | null;
      }[]
    >`
      SELECT e.id, e.type, e.at, f.name AS facility_name, u.name AS user_name
      FROM booking_events e
      LEFT JOIN facilities f ON f.id = e.facility_id
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.at DESC
      LIMIT 25
    `,
    sql<
      { facility_name: string; sport: string; starts_at: string; waiting: number }[]
    >`
      SELECT f.name AS facility_name, f.sport,
             lower(w.during) AS starts_at, count(*)::int AS waiting
      FROM waitlist w JOIN facilities f ON f.id = w.facility_id
      WHERE w.state = 'waiting' AND lower(w.during) > now()
      GROUP BY f.name, f.sport, w.during
      ORDER BY count(*) DESC
      LIMIT 10
    `,
  ]);

  return (
    <div className="space-y-8">
      <section className="rail pl-5">
        <p className="eyebrow">Facility management</p>
        <h1 className="display mt-3 text-[clamp(1.8rem,4vw,2.5rem)]">Ops console</h1>
        <p className="mt-2 max-w-3xl text-ink-dim">
          Closures are not a separate system. A maintenance window is a row in{" "}
          <code className="font-mono text-violet-soft">bookings</code> with{" "}
          <code className="font-mono text-violet-soft">kind = &apos;block&apos;</code>, so
          the same constraint that stops two students double-booking also stops
          a closure being scheduled over a reservation somebody is relying on.
        </p>
      </section>

      {!isManager && (
        <p className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You are signed in as a student, so the controls below are read-only.
            Switch to <strong>Sports Office</strong> in the identity menu to act
            as a manager. Authorisation is enforced on the server, not by hiding
            these buttons.
          </span>
        </p>
      )}

      <OpsConsole
        facilities={facilities}
        isManager={Boolean(isManager)}
        defaultDate={addDaysToKey(todayKey(), 2)}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wrench className="h-4 w-4 text-warn" />
            Scheduled closures
          </h2>
          {blocks.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">
              No maintenance windows scheduled.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {blocks.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          <SportIcon sport={b.sport} size={15} className="shrink-0 text-warn" />
                          {b.facility_name}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-dim">
                        {istDayLabel(istDateKey(new Date(b.starts_at)))} ·{" "}
                        {istClock(new Date(b.starts_at))}–
                        {istClock(new Date(b.ends_at))}
                      </p>
                      {b.note && (
                        <p className="mt-1 text-xs text-warn">{b.note}</p>
                      )}
                    </div>
                    <ReopenButton blockId={b.id} disabled={!isManager} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="mt-6 font-semibold">Queue pressure</h3>
          <p className="mt-1 text-xs text-ink-dim">
            Slots with students waiting — where demand exceeds supply.
          </p>
          <div className="mt-3 space-y-1.5">
            {queues.length === 0 ? (
              <p className="text-sm text-ink-faint">No active waitlists.</p>
            ) : (
              queues.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-line bg-raised/40 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="flex items-center gap-1.5">
                      <SportIcon sport={q.sport} size={15} className="shrink-0 text-ink-faint" />
                      {q.facility_name}
                    </span>
                    <span className="ml-2 font-mono text-xs text-ink-faint">
                      {istClock(new Date(q.starts_at))}
                    </span>
                  </span>
                  <span className="rounded-full bg-info/20 px-2 py-0.5 font-mono text-[10px] text-info">
                    {q.waiting} waiting
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Activity className="h-4 w-4 text-violet" />
            Event log
          </h2>
          <p className="mt-1 text-xs text-ink-dim">
            Written inside the same transaction as the booking it describes, so
            the audit trail cannot disagree with what actually happened.
          </p>
          <div className="mt-4 max-h-[26rem] space-y-1 overflow-y-auto">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-raised/30"
              >
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase",
                    e.type.includes("cancel")
                      ? "bg-stop/15 text-stop"
                      : e.type.includes("waitlist")
                        ? "bg-info/15 text-info"
                        : "bg-go/15 text-go",
                  )}
                >
                  {e.type.replace("booking.", "").replace("waitlist.", "wl.")}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-dim">
                  {e.user_name ?? "system"}
                  {e.facility_name && ` · ${e.facility_name}`}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                  {istClock(new Date(e.at))}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
