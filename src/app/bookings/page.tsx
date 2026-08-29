import Link from "next/link";
import { myBookings, myWaitlist } from "@/lib/availability";
import { currentUser } from "@/lib/session";
import { istClock, istDayLabel, istDateKey } from "@/lib/time";
import { CancelButton } from "@/components/CancelButton";
import { ClaimButton } from "@/components/ClaimButton";
import { SectionHead } from "@/components/SectionHead";
import { SportIcon } from "@/components/SportIcon";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const user = await currentUser();
  if (!user) {
    return <p className="prose-news pt-10">Sign in to see your bookings.</p>;
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
    <div className="shell pb-16">
      {/* The reader's own page: name at masthead scale, standing under it. */}
      <header className="border-b border-rule pb-7 pt-8">
        <p className="kicker kicker-signal">Your account</p>
        <h2 className="hed-lg mt-3 font-display uppercase">{user.name}</h2>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
          {user.rollNumber} · {user.hostel} hostel
        </p>

        <dl className="mt-7 grid grid-cols-2 border-t border-rule sm:grid-cols-4">
          <Standing
            label="Booked this week"
            value={`${upcoming.length}/${user.weeklyQuota}`}
            note="rolling 7 days"
          />
          <Standing
            label="Reliability"
            value={String(user.reliabilityScore)}
            note={noShows ? `${noShows} no-show${noShows > 1 ? "s" : ""}` : "no no-shows"}
            accent={user.reliabilityScore < 60}
          />
          <Standing
            label="On waitlists"
            value={String(queue.length)}
            note="queued slots"
          />
          <Standing
            label="Lifetime"
            value={String(bookings.length)}
            note="bookings on record"
          />
        </dl>
      </header>

      {/* Offers expire, so they lead the page whenever there are any. */}
      {queue.length > 0 && (
        <section className="pt-10">
          <SectionHead
            index="01"
            rule={false}
            title="Waitlist"
            note="An offer holds for 15 minutes, then passes to the next student in line."
          />
          <div className="mt-5 border-t border-ink">
            {queue.map((w) => {
              const offered = w.state === "offered";
              return (
                <div
                  key={w.id}
                  className={cn(
                    "flex flex-wrap items-center gap-4 border-b border-rule px-1 py-3.5",
                    offered && "bg-paper-2",
                  )}
                >
                  <SportIcon
                    sport={w.sport_name}
                    size={18}
                    className="shrink-0 text-ink-3"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="hed-sm font-display uppercase">
                      {w.facility_name}
                    </p>
                    <p className="fig mt-1 text-[11px] text-ink-3">
                      {istDayLabel(istDateKey(new Date(w.starts_at)))} ·{" "}
                      {istClock(new Date(w.starts_at))}–
                      {istClock(new Date(w.ends_at))}
                    </p>
                  </div>
                  {offered ? (
                    <ClaimButton waitlistId={w.id} expiresAt={w.claim_expires_at} />
                  ) : (
                    <span className="tag text-ink-3">
                      #{w.position} in queue
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="pt-10">
        <SectionHead
          index={queue.length > 0 ? "02" : "01"}
          rule={queue.length > 0}
          title="Upcoming"
          note="Cancelling releases the slot and offers it to the next student in the same transaction."
        />

        {upcoming.length === 0 ? (
          <div className="mt-5 border border-dashed border-rule-2 px-6 py-14 text-center">
            <p className="hed-md font-display uppercase text-ink-3">
              Nothing booked
            </p>
            <p className="prose-news mx-auto mt-3 max-w-[38ch] text-[15px]">
              Twelve facilities are listed and most of them have space before
              five in the afternoon.
            </p>
            <Link href="/" className="btn btn-solid mt-6">
              Find a court
            </Link>
          </div>
        ) : (
          <div className="mt-5 border-t border-ink">
            {upcoming.map((b) => (
              <article
                key={b.id}
                /* A stable hook for the smoke test, so it targets THIS row
                   rather than inferring one from the shape of the DOM. */
                data-booking-code={b.booking_code}
                className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-rule px-1 py-4"
              >
                <SportIcon
                  sport={b.sport}
                  size={20}
                  className="shrink-0 text-ink-3"
                />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/facility/${b.facility_slug}`}
                    className="hed-sm font-display uppercase underline-offset-4 hover:text-signal hover:underline"
                  >
                    {b.facility_name}
                  </Link>
                  <p className="fig mt-1 text-[11px] uppercase tracking-wide text-ink-3">
                    {istDayLabel(istDateKey(new Date(b.starts_at)))} ·{" "}
                    {istClock(new Date(b.starts_at))}–
                    {istClock(new Date(b.ends_at))} · {b.location}
                  </p>
                  {b.note && (
                    <p className="prose-news mt-1 text-[14px] italic">
                      “{b.note}”
                    </p>
                  )}
                </div>

                <span className="fig border border-rule px-2.5 py-1 text-sm font-bold">
                  {b.booking_code}
                </span>

                <CancelButton bookingId={b.id} />
              </article>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="pt-10">
          <SectionHead
            index={queue.length > 0 ? "03" : "02"}
            title="History"
            note="Every booking ever written for this account, newest first."
          />

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-y border-ink text-left">
                  <Th>Facility</Th>
                  <Th>When</Th>
                  <Th>Code</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((b) => (
                  <tr key={b.id} className="border-b border-rule">
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2">
                        <SportIcon
                          sport={b.sport}
                          size={14}
                          className="shrink-0 text-ink-3"
                        />
                        {b.facility_name}
                      </span>
                    </td>
                    <td className="fig py-2.5 pr-4 text-[12px] text-ink-2">
                      {istDayLabel(istDateKey(new Date(b.starts_at)))} ·{" "}
                      {istClock(new Date(b.starts_at))}
                    </td>
                    <td className="fig py-2.5 pr-4 text-[12px] text-ink-3">
                      {b.booking_code}
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusTag status={b.status} />
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

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={cn(
        "kicker py-2 font-normal",
        align === "right" ? "text-right" : "pr-4",
      )}
    >
      {children}
    </th>
  );
}

function StatusTag({ status }: { status: string }) {
  const signal = status === "no_show";
  const solid = status === "completed" || status === "confirmed";
  return (
    <span
      className={cn(
        "tag",
        signal && "border-signal text-signal",
        solid && "border-ink bg-ink text-paper",
        !signal && !solid && "text-ink-3",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function Standing({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="border-r border-rule py-4 pr-4 last:border-r-0">
      <dt className="kicker">{label}</dt>
      <dd
        className={cn(
          "fig mt-2 text-[1.75rem] font-bold leading-none",
          accent ? "text-signal" : "text-ink",
        )}
      >
        {value}
      </dd>
      <p className="mt-1.5 text-[11px] text-ink-3">{note}</p>
    </div>
  );
}
