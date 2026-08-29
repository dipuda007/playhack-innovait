import { listFacilities } from "@/lib/availability";
import { invariantCheck } from "@/lib/race";
import { RaceConsole } from "@/components/RaceConsole";
import { SectionHead } from "@/components/SectionHead";
import { todayKey, addDaysToKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function RacePage() {
  const [facilities, invariant] = await Promise.all([
    listFacilities(),
    invariantCheck(),
  ]);

  return (
    <div className="shell pb-16">
      <header className="border-b border-rule pb-8 pt-8">
        <p className="kicker kicker-signal">Core challenge · Proof</p>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          <h2 className="hed-xl font-display uppercase text-ink">
            Concurrency is the real opponent
          </h2>

          <div className="prose-news space-y-4 self-end">
            <p>
              Fire many simultaneous booking requests at a single slot and watch
              the database decide. Run it in <strong>naive</strong> mode first
              to see the bug this product exists to prevent, then switch to{" "}
              <strong>safe</strong> and fire exactly the same traffic.
            </p>
            <p>
              Nothing is simulated. Both modes write to a real Postgres table
              through a real HTTP endpoint; the only difference is whether the
              table carries the exclusion constraint.
            </p>
          </div>
        </div>
      </header>

      <section className="pt-9">
        <SectionHead
          index="01"
          rule={false}
          title="Set up the burst"
          note="Both modes use distinct students and a fresh slot, so no run is contaminated by the last."
        />
        <div className="mt-5">
          <RaceConsole
            facilities={facilities.filter((f) => f.isActive)}
            defaultDate={addDaysToKey(todayKey(), 1)}
            initialInvariant={invariant}
          />
        </div>
      </section>
    </div>
  );
}
