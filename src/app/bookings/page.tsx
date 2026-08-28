import Link from "next/link";
import { CalendarX, MapPin, Ticket, ListPlus, Clock, Gauge } from "lucide-react";
import { myBookings, myWaitlist } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import { istClock, istDayLabel, istDateKey } from "@/lib/time";
import { CancelButton } from "@/components/CancelButton";
import { ClaimButton } from "@/components/ClaimButton";
import { cn } from "@/lib/cn";
import { SportIcon } from "@/components/SportIcon";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const user = await currentUser();
  if (!user) {
    return <p className="text-ink-dim">Sign in to see your bookings.</p>;
  }

  const [bookings, queue] = await Promise.all([
    myBookings(user.id),
    myWaitlist(user.id),
  ]);

  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.starts_at).getTime() > now,
  );
  const history = bookings.filter((b) => !upcoming.includes(b));

  const noShows = history.filter((b) => b.status === "no_show").length;

  return (
    <div className="space-y-8">
      <section className="rail pl-5">
        <p className="eyebrow">Your account</p>
        <h1 className="display mt-3 text-[clamp(1.8rem,4vw,2.5rem)]">{user.name}</h1>
        <p className="mt-1 text-sm text-ink-dim">
          {user.rollNumber} · {user.hostel}
        </p>
      </section>

      {/* Standing — the numbers that actually affect what a student can book. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Ticket className="h-4 w-4" />}
          label="Booked this week"
          value={`${upcoming.length} / ${user.weeklyQuota}`}
          hint="rolling 7 days"
        />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Reliability"
          value={String(user.reliabilityScore)}
          hint={
            noShows
              ? `${noShows} no-show${noShows > 1 ? "s" : ""} on record`
              : "no no-shows"
          }
          tone={
            user.reliabilityScore >= 85
              ? "go"
              : user.reliabilityScore >= 60
                ? "warn"
                : "stop"
          }
        />
        <StatCard
          icon={<ListPlus className="h-4 w-4" />}
          label="On waitlists"
          value={String(queue.length)}
          hint="queued slots"
        />
      </div>

      {/* Waitlist offers first — they expire, so they are the urgent item. */}
      {queue.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Waitlist</h2>
          <div className="space-y-2">
            {queue.map((w) => {
              const offered = w.state === "offered";
              return (
                <div
                  key={w.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border p-4",
                    offered
                      ? "border-flame/50 bg-flame/10"
                      : "border-line bg-raised/40",
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-info/30 bg-info/10 text-info">
                    <SportIcon sport={w.sport_name} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{w.facility_name}</p>
                    <p className="text-xs text-ink-dim">
                      {istDayLabel(istDateKey(new Date(w.starts_at)))} ·{" "}
                      {istClock(new Date(w.starts_at))}–
                      {istClock(new Date(w.ends_at))}
                    </p>
                  </div>
                  {offered ? (
                    <ClaimButton
                      waitlistId={w.id}
                      expiresAt={w.claim_expires_at}
                    />
                  ) : (
                    <span className="rounded-full bg-raised px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                      #{w.position} in queue
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-10 text-center">
            <CalendarX className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-3 text-sm text-ink-dim">Nothing booked yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-xl bg-flame px-5 py-2 text-sm font-semibold text-ground"
            >
              Find a court
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-raised/40 p-4"
                style={{ borderLeftColor: b.color, borderLeftWidth: 3 }}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
                  style={{
                    color: b.color,
                    borderColor: `${b.color}44`,
                    background: `${b.color}18`,
                  }}
                >
                  <SportIcon sport={b.sport} size={20} />
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/facility/${b.facility_slug}`}
                    className="font-semibold hover:text-flame"
                  >
                    {b.facility_name}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-dim">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {istDayLabel(istDateKey(new Date(b.starts_at)))} ·{" "}
                      {istClock(new Date(b.starts_at))}–
                      {istClock(new Date(b.ends_at))}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {b.location}
                    </span>
                  </p>
                  {b.note && (
                    <p className="mt-1 text-xs italic text-ink-faint">
                      “{b.note}”
                    </p>
                  )}
                </div>

                <span className="rounded-lg bg-ground px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-go">
                  {b.booking_code}
                </span>

                <CancelButton bookingId={b.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">History</h2>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-raised/60">
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-2 font-normal">Facility</th>
                  <th className="px-4 py-2 font-normal">When</th>
                  <th className="px-4 py-2 font-normal">Code</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((b) => (
                  <tr key={b.id} className="border-t border-line-soft">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5">
                        <SportIcon sport={b.sport} size={14} className="shrink-0 text-ink-faint" />
                        {b.facility_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-dim">
                      {istDayLabel(istDateKey(new Date(b.starts_at)))} ·{" "}
                      {istClock(new Date(b.starts_at))}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-ink-faint">
                      {b.booking_code}
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-go/15 text-go",
    no_show: "bg-stop/15 text-stop",
    cancelled: "bg-raised text-ink-faint",
    confirmed: "bg-violet/20 text-violet-soft",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        map[status] ?? "bg-raised text-ink-faint",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
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
      <p className="text-[11px] text-ink-faint">{hint}</p>
    </div>
  );
}
