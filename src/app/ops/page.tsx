import { sql } from "@/db/client";
import { listFacilities } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import { istClock, istDateKey, istDayLabel, todayKey, addDaysToKey } from "@/lib/time";
import { OpsConsole } from "@/components/OpsConsole";
import { SectionHead } from "@/components/SectionHead";
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
    <div className="shell pb-16">
      <header className="border-b border-rule pb-8 pt-8">
        <p className="kicker kicker-signal">Facility management</p>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <h2 className="hed-xl font-display uppercase text-ink">Ops console</h2>

          <div className="prose-news space-y-4 self-end">
            <p>
              Closures are not a separate system. A maintenance window is a row
              in <span className="fig">bookings</span> with{" "}
              <span className="fig">kind = &apos;block&apos;</span>, which means
              the constraint that stops two students double-booking also stops a
              closure being scheduled over a reservation somebody is relying on.
            </p>
            <p>
              One invariant, two features, and no second code path that can be
              got wrong independently.
            </p>
          </div>
        </div>
      </header>

      {!isManager && (
        <p className="mt-6 border-l-2 border-signal bg-paper-2 px-4 py-3 text-[14px] leading-relaxed">
          <strong>Read-only.</strong> You are signed in as a student, so the
          controls below will refuse. Switch to <strong>Sports Office</strong>{" "}
          in the masthead to act as a manager — authorisation is enforced on the
          server, not by hiding these buttons.
        </p>
      )}

      <section className="pt-9">
        <SectionHead
          index="01"
          rule={false}
          title="Schedule a closure"
          note="A closure goes through the same constrained INSERT as a student booking."
        />
        <div className="mt-5">
          <OpsConsole
            facilities={facilities}
            isManager={Boolean(isManager)}
            defaultDate={addDaysToKey(todayKey(), 2)}
          />
        </div>
      </section>

      <div className="grid gap-10 pt-10 lg:grid-cols-2">
        <section>
          <SectionHead index="02" title="Scheduled closures" />

          {blocks.length === 0 ? (
            <p className="prose-news mt-4 border-b border-rule pb-4 text-[15px]">
              No maintenance windows scheduled.
            </p>
          ) : (
            <div className="mt-4 border-t border-ink">
              {blocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-start gap-3 border-b border-rule py-3"
                >
                  <SportIcon
                    sport={b.sport}
                    size={16}
                    className="mt-0.5 shrink-0 text-ink-3"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">
                      {b.facility_name}
                    </p>
                    <p className="fig mt-0.5 text-[11px] text-ink-3">
                      {istDayLabel(istDateKey(new Date(b.starts_at)))} ·{" "}
                      {istClock(new Date(b.starts_at))}–
                      {istClock(new Date(b.ends_at))}
                    </p>
                    {b.note && (
                      <p className="mt-1 text-[12px] italic text-ink-2">
                        {b.note}
                      </p>
                    )}
                  </div>
                  <ReopenButton blockId={b.id} disabled={!isManager} />
                </div>
              ))}
            </div>
          )}

          <h3 className="hed-sm mt-8 border-b border-ink pb-2 font-display uppercase">
            Queue pressure
          </h3>
          <p className="prose-news mt-3 text-[15px]">
            Slots with students waiting — where demand exceeds supply.
          </p>

          {queues.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">No active waitlists.</p>
          ) : (
            <div className="mt-3 border-t border-rule">
              {queues.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-rule py-2"
                >
                  <SportIcon
                    sport={q.sport}
                    size={15}
                    className="shrink-0 text-ink-3"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {q.facility_name}
                  </span>
                  <span className="fig text-[11px] text-ink-3">
                    {istClock(new Date(q.starts_at))}
                  </span>
                  <span className="tag text-signal">{q.waiting} waiting</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHead index="03" title="Event log" />
          <p className="prose-news mt-3 text-[15px]">
            Written inside the same transaction as the booking it describes, so
            the audit trail cannot disagree with what actually happened.
          </p>

          <div className="mt-4 max-h-[28rem] overflow-y-auto border-t border-ink">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 border-b border-rule py-1.5 text-[12px]"
              >
                <span
                  className={cn(
                    "fig w-24 shrink-0 text-[10px] uppercase",
                    e.type.includes("cancel") ? "text-signal" : "text-ink-3",
                  )}
                >
                  {e.type.replace("booking.", "").replace("waitlist.", "wl.")}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-2">
                  {e.user_name ?? "system"}
                  {e.facility_name && ` · ${e.facility_name}`}
                </span>
                <span className="fig shrink-0 text-[10px] text-ink-3">
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
