"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { FacilityView } from "@/lib/availability";
import { istClock } from "@/lib/time";

type Attempt = {
  attemptNo: number;
  userName: string;
  outcome: string;
  sqlstate: string | null;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  bookingCode: string | null;
};

type RaceResult = {
  runId: string;
  mode: "safe" | "naive";
  facilityName: string;
  startsAt: string;
  requested: number;
  confirmed: number;
  rejected: number;
  rowsInDb: number;
  doubleBooked: boolean;
  wallClockMs: number;
  attempts: Attempt[];
  outcomeCounts: Record<string, number>;
  invariant: Invariant;
};

type Invariant = {
  overlaps: number;
  confirmedRows: number;
  facilities: number;
  naiveOverlaps: number;
  naiveRows: number;
  holds: boolean;
};

/**
 * The race console, set as a results desk.
 *
 * The verdict is the largest thing on the page by a wide margin, reversed out
 * of solid ink, because it is the finding — the way a paper sets the result of
 * the match above the report of it. Everything below is evidence: the counts,
 * the whole-table sweep, and a per-request timeline set as a ruled table with
 * solid bars rather than as a chart.
 */
export function RaceConsole({
  facilities,
  defaultDate,
  initialInvariant,
}: {
  facilities: FacilityView[];
  defaultDate: string;
  initialInvariant: RaceResult["invariant"];
}) {
  // Prefer a court whose grid lands on whole hours and whose peak slots the
  // seed leaves open, so the demo opens on a sensible default.
  const [facilityId, setFacilityId] = useState(
    facilities.find((f) => f.slug === "badminton-sac-1")?.id ??
      facilities[0]?.id ??
      "",
  );
  const [count, setCount] = useState(50);
  const [mode, setMode] = useState<"safe" | "naive">("naive");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [invariant, setInvariant] = useState(initialInvariant);

  const facility = facilities.find((f) => f.id === facilityId);

  /**
   * Slot options derived from the chosen facility's own grid.
   *
   * These cannot be a fixed list of round hours. The athletics track opens at
   * 05:30, so its grid runs 05:30 / 06:30 / 07:30 — offering "19:00" there
   * produces a slot that is not on any boundary, and the booking engine
   * correctly rejects all of it as MISALIGNED_SLOT. The picker has to be
   * generated from `opensAt` and `slotMinutes` rather than assumed.
   */
  const slotOptions = useMemo(() => {
    if (!facility) return [];
    const [oh, om] = facility.opensAt.split(":").map(Number);
    const [ch, cm] = facility.closesAt.split(":").map(Number);
    const out: { value: string; label: string }[] = [];

    for (
      let m = oh * 60 + om;
      m + facility.slotMinutes <= ch * 60 + cm;
      m += facility.slotMinutes
    ) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const end = m + facility.slotMinutes;
      const eh = String(Math.floor(end / 60)).padStart(2, "0");
      const em = String(end % 60).padStart(2, "0");
      out.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}–${eh}:${em}` });
    }
    return out;
  }, [facility]);

  // Default to an evening slot — the 6 p.m. stampede the brief describes.
  const [hour, setHour] = useState<string | null>(null);
  const effectiveHour =
    hour && slotOptions.some((o) => o.value === hour)
      ? hour
      : (slotOptions.find((o) => o.value >= "18:00") ?? slotOptions.at(-1))
          ?.value ?? "18:00";

  const slot = useMemo(() => {
    if (!facility) return null;
    const start = new Date(`${defaultDate}T${effectiveHour}:00+05:30`);
    const end = new Date(start.getTime() + facility.slotMinutes * 60_000);
    return { start, end };
  }, [facility, defaultDate, effectiveHour]);

  async function fire() {
    if (!slot || !facility) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/race", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          facilityId,
          startsAt: slot.start.toISOString(),
          endsAt: slot.end.toISOString(),
          count,
          mode,
        }),
      });
      const body = await res.json();
      setResult(body);
      setInvariant(body.invariant);
    } finally {
      setRunning(false);
    }
  }

  async function reset() {
    await fetch("/api/race/reset", { method: "POST" });
    setResult(null);
  }

  return (
    <div>
      {/* ── The entry form ───────────────────────────────────────────── */}
      <div className="border-y border-rule">
        <div className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Facility">
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="field border-0 bg-transparent px-0 py-1 text-[15px] font-semibold"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Slot · tomorrow, IST">
            <select
              value={effectiveHour}
              onChange={(e) => setHour(e.target.value)}
              className="field fig border-0 bg-transparent px-0 py-1 text-[15px] font-semibold"
            >
              {slotOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Concurrent requests">
            <div className="flex items-center gap-3">
              <span className="fig w-10 text-[15px] font-bold">{count}</span>
              <input
                type="range"
                min={2}
                max={200}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-[var(--color-signal)]"
              />
            </div>
          </Field>

          <Field label="Implementation">
            <div className="flex gap-px bg-rule">
              <ModeButton active={mode === "naive"} onClick={() => setMode("naive")}>
                Naive
              </ModeButton>
              <ModeButton active={mode === "safe"} onClick={() => setMode("safe")}>
                Safe
              </ModeButton>
            </div>
          </Field>
        </div>
      </div>

      <div className="grid gap-6 border-b border-rule py-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <p className="prose-news max-w-[74ch] text-[15px]">
          {mode === "naive" ? (
            <>
              <strong>Naive.</strong> Checks whether the slot is free, then
              inserts if it looked free. No constraint, no lock. Every line is
              individually reasonable — it is wrong only because another request
              commits in the gap between the question and the answer.
            </>
          ) : (
            <>
              <strong>Safe.</strong> No availability check at all. It attempts
              the insert and lets{" "}
              <span className="fig">bookings_no_overlap</span> decide. Deciding
              and doing are the same operation, so there is no gap to lose.
            </>
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={fire}
            disabled={running || !facility}
            className={cn("btn", mode === "naive" ? "btn-signal" : "btn-solid")}
          >
            {running ? "Racing…" : `Fire ${count} requests`}
          </button>
          <button
            onClick={reset}
            disabled={running}
            className="btn btn-outline"
          >
            Reset demo data
          </button>
        </div>
      </div>

      {/* ── The finding ──────────────────────────────────────────────── */}
      {result &&
        (() => {
          /*
           * Three outcomes, not two. A run where nothing was confirmed is not
           * a success — it means every request was refused before it ever
           * reached the constraint (a slot off the facility's grid, a closed
           * facility, an exhausted quota). Reporting that as "exactly one
           * booking survives" would be a straightforwardly false claim, and
           * the most damaging kind: one that flatters us.
           */
          const verdict = result.doubleBooked
            ? "corrupt"
            : result.rowsInDb === 1
              ? "correct"
              : "nothing";

          const dominant = Object.entries(result.outcomeCounts)
            .filter(([code]) => code !== "CONFIRMED")
            .sort((a, b) => b[1] - a[1])[0]?.[0];

          return (
            <section
              className={cn(
                "animate-ink-in mt-6 border-2",
                verdict === "corrupt"
                  ? "border-signal bg-signal text-paper"
                  : verdict === "correct"
                    ? "border-ink bg-ink text-paper"
                    : "border-ink bg-paper",
              )}
            >
              <div className="px-6 py-7 sm:px-8 sm:py-9">
                <p
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.3em]",
                    verdict === "nothing" ? "text-ink-3" : "text-paper/60",
                  )}
                >
                  {result.requested} simultaneous requests ·{" "}
                  {result.facilityName} · {istClock(new Date(result.startsAt))}{" "}
                  · {result.wallClockMs} ms
                </p>

                <h3 className="hed-lg mt-4 font-display uppercase">
                  {verdict === "corrupt"
                    ? `${result.rowsInDb} bookings. One court.`
                    : verdict === "correct"
                      ? "Exactly one survives."
                      : "Nothing reached the constraint."}
                </h3>

                <p
                  className={cn(
                    "mt-4 max-w-[62ch] text-[17px] leading-relaxed",
                    verdict === "nothing" ? "text-ink-2" : "text-paper/85",
                  )}
                >
                  {verdict === "corrupt" ? (
                    <>
                      {result.rowsInDb} students each believe they hold this
                      court at this hour. Nothing errored; every request
                      succeeded. Switch to <strong>Safe</strong> and fire the
                      identical burst.
                    </>
                  ) : verdict === "correct" ? (
                    <>
                      {result.rejected} requests were refused by Postgres before
                      they could become rows, each with a typed outcome the
                      student can act on. The winner was decided by the write
                      itself.
                    </>
                  ) : (
                    <>
                      Every request was refused as{" "}
                      <span className="fig">{dominant}</span> before it reached
                      the constraint, so this run says nothing about
                      concurrency. Pick a slot that is open on this
                      facility&apos;s grid and run it again.
                    </>
                  )}
                </p>
              </div>

              <dl
                className={cn(
                  "grid grid-cols-2 border-t sm:grid-cols-4",
                  verdict === "nothing" ? "border-rule" : "border-paper/25",
                )}
              >
                <Score label="Requests" value={result.requested} muted={verdict === "nothing"} />
                <Score label="Confirmed" value={result.confirmed} muted={verdict === "nothing"} />
                <Score label="Rejected" value={result.rejected} muted={verdict === "nothing"} />
                <Score
                  label="Rows in database"
                  value={result.rowsInDb}
                  note="read back from Postgres"
                  muted={verdict === "nothing"}
                />
              </dl>
            </section>
          );
        })()}

      {/* ── Whole-table sweep ────────────────────────────────────────── */}
      <section className="mt-8">
        <h3 className="hed-sm border-b border-ink pb-2 font-display uppercase">
          Whole-table sweep
        </h3>
        <p className="prose-news mt-3 max-w-[76ch] text-[15px]">
          Every confirmed row checked against every other row on the same court
          — not a sample, and not limited to the slot just tested.
        </p>

        <div className="mt-4 grid gap-px bg-rule sm:grid-cols-2">
          <InvariantPanel
            title="bookings"
            subtitle="protected by bookings_no_overlap"
            overlaps={invariant.overlaps}
            rows={invariant.confirmedRows}
          />
          <InvariantPanel
            title="naive_bookings"
            subtitle="no constraint — the control group"
            overlaps={invariant.naiveOverlaps}
            rows={invariant.naiveRows}
            empty={invariant.naiveRows === 0}
          />
        </div>
      </section>

      {result && <Waterfall result={result} />}
    </div>
  );
}

function InvariantPanel({
  title,
  subtitle,
  overlaps,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  overlaps: number;
  rows: number;
  empty?: boolean;
}) {
  const holds = overlaps === 0;
  return (
    <div
      className={cn(
        "p-5",
        empty ? "bg-paper-2" : holds ? "bg-paper" : "bg-signal text-paper",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <code className="fig text-sm font-bold">{title}</code>
        <span
          className={cn(
            "tag",
            empty ? "text-ink-3" : holds ? "text-ink" : "border-paper text-paper",
          )}
        >
          {empty ? "No runs yet" : holds ? "Holds" : "Violated"}
        </span>
      </div>
      <p
        className={cn(
          "mt-1 text-[11px]",
          empty || holds ? "text-ink-3" : "text-paper/75",
        )}
      >
        {subtitle}
      </p>

      <p className="fig mt-5 flex items-baseline gap-3">
        <span className="text-[2.5rem] font-bold leading-none">{overlaps}</span>
        <span
          className={cn(
            "text-[11px] uppercase tracking-[0.1em]",
            empty || holds ? "text-ink-3" : "text-paper/75",
          )}
        >
          overlapping pairs
          <br />
          across {rows.toLocaleString()} rows
        </span>
      </p>
    </div>
  );
}

function Waterfall({ result }: { result: RaceResult }) {
  const t0 = Math.min(...result.attempts.map((a) => a.startedAt));
  const span = Math.max(1, result.wallClockMs);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ink pb-2">
        <h3 className="hed-sm font-display uppercase">Per-request timeline</h3>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(result.outcomeCounts).map(([code, n]) => (
            <span
              key={code}
              className={cn(
                "tag",
                code === "CONFIRMED"
                  ? "border-ink bg-ink text-paper"
                  : "text-ink-3",
              )}
            >
              {code} × {n}
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-paper">
            <tr className="border-b border-ink text-left">
              <th className="kicker py-2 pr-3 font-normal">#</th>
              <th className="kicker py-2 pr-3 font-normal">Student</th>
              <th className="kicker py-2 pr-3 font-normal">Outcome</th>
              <th className="kicker py-2 pr-3 font-normal">SQLSTATE</th>
              <th className="kicker w-[45%] py-2 pr-3 font-normal">Timeline</th>
              <th className="kicker py-2 text-right font-normal">ms</th>
            </tr>
          </thead>
          <tbody>
            {result.attempts.map((a) => {
              const won = a.outcome === "CONFIRMED";
              const errored = a.outcome === "ERROR";
              const left = ((a.startedAt - t0) / span) * 100;
              const width = Math.max(1.5, (a.durationMs / span) * 100);

              return (
                <tr
                  key={a.attemptNo}
                  className={cn("border-b border-rule", won && "bg-paper-2")}
                >
                  <td className="fig py-1.5 pr-3 text-[11px] text-ink-3">
                    {a.attemptNo}
                  </td>
                  <td className="max-w-[9rem] truncate py-1.5 pr-3 text-[12px]">
                    {a.userName}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={cn(
                        "fig text-[11px] font-semibold",
                        won
                          ? "text-ink"
                          : errored
                            ? "text-signal"
                            : "text-ink-3",
                      )}
                    >
                      {won ? "▸ " : ""}
                      {a.outcome}
                    </span>
                  </td>
                  <td className="fig py-1.5 pr-3 text-[11px] text-ink-3">
                    {a.sqlstate ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {/* Solid blocks on a hairline baseline — a Gantt strip. */}
                    <div className="relative h-2.5 w-full min-w-[8rem] border-b border-rule">
                      <div
                        className={cn(
                          "absolute top-0 h-2",
                          won ? "bg-ink" : errored ? "bg-signal" : "bg-ink-3",
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                  </td>
                  <td className="fig py-1.5 text-right text-[11px] text-ink-2">
                    {a.durationMs}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block bg-paper p-4">
      <span className="kicker mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors",
        active ? "bg-ink text-paper" : "bg-paper hover:bg-paper-2",
      )}
    >
      {children}
    </button>
  );
}

function Score({
  label,
  value,
  note,
  muted,
}: {
  label: string;
  value: number;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-r px-5 py-4 last:border-r-0",
        muted ? "border-rule" : "border-paper/25",
      )}
    >
      <dt
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.16em]",
          muted ? "text-ink-3" : "text-paper/60",
        )}
      >
        {label}
      </dt>
      <dd className="fig mt-1.5 text-[2rem] font-bold leading-none">{value}</dd>
      {note && (
        <p
          className={cn(
            "mt-1 text-[10px]",
            muted ? "text-ink-3" : "text-paper/60",
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
