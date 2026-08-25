import { listFacilities } from "@/lib/availability";
import { FairDraw } from "@/components/FairDraw";
import { todayKey, addDaysToKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function FairPage() {
  const facilities = await listFacilities();

  return (
    <div className="space-y-6">
      <section className="rail pl-5">
        <p className="eyebrow">Innovation · Fair allocation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Winning a race is not the same as deserving the court.
        </h1>
        <p className="mt-3 max-w-3xl text-ink-dim">
          The exclusion constraint guarantees that exactly one booking survives
          a stampede. It does not decide <em>who</em> should win — and
          first-come-first-serve decides that badly. At 6 p.m. the winner is
          whoever has the best wifi, the newest phone, or a script.
        </p>
        <p className="mt-2 max-w-3xl text-ink-dim">
          So peak slots are not released as a race. Requests arriving inside a
          short window become entries, and one weighted, seeded draw picks the
          winner. Fairness sits on top of correctness — the winner&apos;s booking
          is still inserted through the same constrained path as any other.
        </p>
      </section>

      <FairDraw
        facilities={facilities.filter((f) => f.isActive)}
        defaultDate={addDaysToKey(todayKey(), 2)}
      />
    </div>
  );
}
