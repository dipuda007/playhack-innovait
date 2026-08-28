import { KeyRound, Scale, ShieldCheck, Timer } from "lucide-react";
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
        <h1 className="display mt-3 text-[clamp(1.9rem,4.4vw,2.9rem)]">
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

      {/*
        Shown before anyone presses anything. A draw that a student cannot
        explain to the person who lost is not fair, it is just opaque — so the
        rules are on the page whether or not a draw has been run.
      */}
      <section className="grid gap-4 md:grid-cols-3">
        <Step
          n="01"
          title="A window, not a starting pistol"
          icon={<Timer className="h-4 w-4" />}
        >
          Every request that arrives inside the window becomes an{" "}
          <em>entry</em>. Arriving in the first millisecond buys nothing, so
          there is no advantage in a faster phone, a closer router, or a script.
        </Step>
        <Step
          n="02"
          title="Weight by reliability"
          icon={<Scale className="h-4 w-4" />}
        >
          Each entry carries weight{" "}
          <code className="font-mono text-violet-soft">50 + reliability/2</code>
          . A student who turns up keeps a full ticket; a record of no-shows
          costs some of it. The floor of 50 means nobody is ever locked out.
        </Step>
        <Step
          n="03"
          title="Seeded, and published"
          icon={<KeyRound className="h-4 w-4" />}
        >
          The winner is <code className="font-mono text-violet-soft">sha256(seed ‖ entries)</code>{" "}
          over the entrant list sorted by id. The seed is published with the
          result, so anyone can recompute the same winner and check it — the
          draw is verifiable, not merely asserted.
        </Step>
      </section>

      <p className="flex items-start gap-2.5 rounded-xl border border-line-soft bg-white/[0.02] p-4 text-xs leading-relaxed text-ink-dim">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-go" />
        <span>
          Fairness never replaces correctness. The winning entry is written
          through the same constrained INSERT as an ordinary booking, so if a
          slot somehow went to two draws, the second one would still be
          rejected by <code className="font-mono text-violet-soft">bookings_no_overlap</code>.
        </span>
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  icon,
  children,
}: {
  n: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet/40 bg-violet/15 text-violet-soft">
          {icon}
        </span>
        <span className="metric-label">{n}</span>
      </div>
      <h3 className="mt-3.5 font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">{children}</p>
    </div>
  );
}
