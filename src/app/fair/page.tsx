import { listFacilities } from "@/lib/availability";
import { FairDraw } from "@/components/FairDraw";
import { SectionHead } from "@/components/SectionHead";
import { todayKey, addDaysToKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function FairPage() {
  const facilities = await listFacilities();

  return (
    <div className="shell pb-16">
      <header className="border-b border-rule pb-8 pt-8">
        <p className="kicker kicker-signal">Innovation · Fair allocation</p>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <h2 className="hed-xl font-display uppercase">
            Winning a race is not deserving the court
          </h2>

          <div className="prose-news space-y-4 self-end">
            <p>
              The exclusion constraint guarantees that exactly one booking
              survives a stampede. It does not decide <em>who</em> should win —
              and first-come-first-served decides that badly. At six the winner
              is whoever has the best wifi, the newest phone, or a script.
            </p>
            <p>
              So peak slots are not released as a race. Requests arriving inside
              a short window become entries, and one weighted, seeded draw picks
              the winner. Fairness sits on top of correctness: the winner&apos;s
              booking still goes through the same constrained path as any other.
            </p>
          </div>
        </div>
      </header>

      {/* The rules, printed before anyone presses anything. */}
      <section className="pt-9">
        <SectionHead
          index="01"
          rule={false}
          title="How the draw works"
          note="A draw a student cannot explain to the person who lost is not fair, only opaque."
        />

        <div className="mt-5 grid gap-px bg-rule md:grid-cols-3">
          <Rule
            n="01"
            title="A window, not a starting pistol"
          >
            Every request that arrives inside the window becomes an{" "}
            <em>entry</em>. Arriving in the first millisecond buys nothing, so
            there is no advantage in a faster phone, a closer router, or a
            script left running.
          </Rule>
          <Rule n="02" title="Weight by reliability">
            Each entry carries weight <span className="fig">50 + reliability/2</span>.
            A student who turns up keeps a full ticket; a record of no-shows
            costs some of it. The floor of 50 means nobody is ever locked out.
          </Rule>
          <Rule n="03" title="Seeded, and published">
            The winner is <span className="fig">sha256(seed ‖ entries)</span>{" "}
            over the entrant list sorted by id. The seed is published with the
            result, so anyone can recompute the winner and check it.
          </Rule>
        </div>
      </section>

      <section className="pt-10">
        <SectionHead
          index="02"
          title="Run a draw"
          note="Opening a window clears the slot first, so every draw starts from the same state."
        />
        <div className="mt-5">
          <FairDraw
            facilities={facilities.filter((f) => f.isActive)}
            defaultDate={addDaysToKey(todayKey(), 2)}
          />
        </div>
      </section>

      <p className="prose-news mt-10 border-t border-rule pt-5 text-[15px]">
        <strong>Fairness never replaces correctness.</strong> The winning entry
        is written through the same constrained INSERT as an ordinary booking,
        so if a slot somehow went to two draws, the second would still be
        rejected by <span className="fig">bookings_no_overlap</span>.
      </p>
    </div>
  );
}

function Rule({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper p-5">
      <p className="fig text-[11px] text-signal">{n}</p>
      <h3 className="hed-sm mt-3 font-display uppercase">{title}</h3>
      <p className="prose-news mt-2.5 text-[15px]">{children}</p>
    </div>
  );
}
