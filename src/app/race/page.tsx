import { listFacilities } from "@/lib/availability";
import { invariantCheck } from "@/lib/race";
import { RaceConsole } from "@/components/RaceConsole";
import { todayKey, addDaysToKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function RacePage() {
  const [facilities, invariant] = await Promise.all([
    listFacilities(),
    invariantCheck(),
  ]);

  return (
    <div className="space-y-6">
      <section className="rail pl-5">
        <p className="eyebrow">Core Challenge · Proof</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Concurrency is the real opponent.
        </h1>
        <p className="mt-2 max-w-3xl text-ink-dim">
          Fire many simultaneous booking requests at a single slot and watch the
          database decide. Run it in <strong className="text-stop">naive</strong>{" "}
          mode first to see the bug this product exists to prevent, then switch
          to <strong className="text-go">safe</strong> mode and run exactly the
          same traffic.
        </p>
      </section>

      <RaceConsole
        facilities={facilities.filter((f) => f.isActive)}
        defaultDate={addDaysToKey(todayKey(), 1)}
        initialInvariant={invariant}
      />
    </div>
  );
}
