"use client";

import { useMemo, useState } from "react";
import {
  Play, RotateCcw, ShieldCheck, ShieldAlert, Loader2, Database,
  TriangleAlert, Check,
} from "lucide-react";
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
    <div className="space-y-5">
      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="panel p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Facility">
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Slot (tomorrow, IST)">
            <select
              value={effectiveHour}
              onChange={(e) => setHour(e.target.value)}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet"
            >
              {slotOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Concurrent requests · ${count}`}>
            <input
              type="range"
              min={2}
              max={200}
              step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-[var(--color-flame)]"
            />
          </Field>

          <Field label="Implementation">
            <div className="flex gap-1.5">
              <ModeButton
                active={mode === "naive"}
                onClick={() => setMode("naive")}
                tone="stop"
              >
                Naive
              </ModeButton>
              <ModeButton
                active={mode === "safe"}
                onClick={() => setMode("safe")}
                tone="go"
              >
                Safe
              </ModeButton>
            </div>
          </Field>
        </div>

        <p className="mt-4 rounded-lg border border-line-soft bg-raised/50 p-3 text-xs text-ink-dim">
          {mode === "naive" ? (
            <>
              <strong className="text-stop">Naive:</strong> checks whether the
              slot is free, then inserts if it looked free. No constraint, no
              lock. Every line is individually reasonable — it is wrong only
              because another request commits in the gap.
            </>
          ) : (
            <>
              <strong className="text-go">Safe:</strong> no availability check
              at all. It attempts the insert and lets{" "}
              <code className="font-mono text-violet-soft">
                bookings_no_overlap
              </code>{" "}
              decide. Deciding and doing are the same operation, so there is no
              gap to lose.
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={fire}
            disabled={running || !facility}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-ground transition-colors disabled:opacity-50",
              mode === "naive"
                ? "bg-stop hover:bg-stop/85"
                : "bg-go hover:bg-go/85",
            )}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? "Racing…" : `Fire ${count} requests`}
          </button>

          <button
            onClick={reset}
            disabled={running}
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm transition-colors hover:border-violet disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
          </button>
        </div>
      </div>

      {/* ── Verdict ──────────────────────────────────────────────────── */}
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
        <div
          className={cn(
            "animate-slide-up rounded-2xl border p-5",
            verdict === "corrupt"
              ? "border-stop/50 bg-stop/10"
              : verdict === "correct"
                ? "border-go/50 bg-go/10"
                : "border-warn/50 bg-warn/10",
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            {verdict === "corrupt" ? (
              <ShieldAlert className="h-7 w-7 shrink-0 text-stop" />
            ) : verdict === "correct" ? (
              <ShieldCheck className="h-7 w-7 shrink-0 text-go" />
            ) : (
              <TriangleAlert className="h-7 w-7 shrink-0 text-warn" />
            )}
            <div>
              <h2
                className={cn(
                  "text-xl font-bold",
                  verdict === "corrupt"
                    ? "text-stop"
                    : verdict === "correct"
                      ? "text-go"
                      : "text-warn",
                )}
              >
                {verdict === "corrupt"
                  ? `${result.rowsInDb} bookings for one slot — data corrupted`
                  : verdict === "correct"
                    ? "Exactly one booking survives"
                    : `No booking created — every request rejected as ${dominant}`}
              </h2>
              <p className="mt-0.5 text-sm text-ink-dim">
                {result.requested} simultaneous requests ·{" "}
                {result.facilityName} · {istClock(new Date(result.startsAt))} ·
                finished in {result.wallClockMs} ms
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Requests fired" value={result.requested} />
            <Stat
              label="Confirmed"
              value={result.confirmed}
              tone={verdict === "correct" ? "go" : verdict === "corrupt" ? "stop" : undefined}
            />
            <Stat label="Rejected" value={result.rejected} />
            <Stat
              label="Rows in database"
              value={result.rowsInDb}
              tone={verdict === "correct" ? "go" : verdict === "corrupt" ? "stop" : undefined}
              hint="read back from Postgres"
            />
          </div>

          {verdict === "corrupt" && (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-stop/40 bg-stop/10 p-3 text-sm text-stop">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {result.rowsInDb} students each believe they have this court.
                Switch to <strong>Safe</strong> and fire the identical burst.
              </span>
            </p>
          )}

          {verdict === "nothing" && (
            <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
              Nothing reached the constraint, so this run says nothing about
              concurrency. Pick a slot that is open on this facility's grid and
              run it again.
            </p>
          )}
        </div>
          );
        })()}

      {/* ── Whole-table invariant, side by side ──────────────────────── */}
      <div className="panel p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Database className="h-4 w-4 text-violet" />
          Whole-table sweep
        </h3>
        <p className="mt-1 text-xs text-ink-dim">
          Every confirmed row checked against every other row on the same court
          — not a sample, and not limited to the slot just tested.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InvariantCard
            title="bookings"
            subtitle="protected by bookings_no_overlap"
            overlaps={invariant.overlaps}
            rows={invariant.confirmedRows}
          />
          <InvariantCard
            title="naive_bookings"
            subtitle="no constraint — the control group"
            overlaps={invariant.naiveOverlaps}
            rows={invariant.naiveRows}
            empty={invariant.naiveRows === 0}
          />
        </div>
      </div>

      {/* ── Waterfall ────────────────────────────────────────────────── */}
      {result && <Waterfall result={result} />}
    </div>
  );
}

function InvariantCard({
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
        "rounded-xl border p-4",
        empty
          ? "border-line bg-ground/40"
          : holds
            ? "border-go/40 bg-go/10"
            : "border-stop/50 bg-stop/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <code className="font-mono text-sm font-semibold">{title}</code>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
            empty
              ? "bg-line text-ink-faint"
              : holds
                ? "bg-go/20 text-go"
                : "bg-stop/20 text-stop",
          )}
        >
          {!empty && holds && <Check className="h-3 w-3" />}
          {empty ? "No runs yet" : holds ? "Holds" : "Violated"}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-ink-faint">{subtitle}</p>
      <p className="mt-3 font-mono text-xs text-ink-dim">
        overlapping pairs ={" "}
        <strong
          className={cn(
            "text-base",
            empty ? "text-ink-faint" : holds ? "text-go" : "text-stop",
          )}
        >
          {overlaps}
        </strong>
        <span className="ml-2 text-ink-faint">
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
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="font-semibold">Per-request timeline</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(result.outcomeCounts).map(([code, n]) => (
            <span
              key={code}
              className={cn(
                "rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                code === "CONFIRMED"
                  ? "bg-go/20 text-go"
                  : code === "ERROR"
                    ? "bg-warn/20 text-warn"
                    : "bg-raised text-ink-dim",
              )}
            >
              {code} × {n}
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-solid">
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="px-4 py-2 font-normal">#</th>
              <th className="px-2 py-2 font-normal">Student</th>
              <th className="px-2 py-2 font-normal">Outcome</th>
              <th className="px-2 py-2 font-normal">SQLSTATE</th>
              <th className="px-2 py-2 font-normal">Timeline</th>
              <th className="px-4 py-2 text-right font-normal">ms</th>
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
                  className={cn(
                    "border-t border-line-soft",
                    won && "bg-go/10",
                    errored && "bg-warn/5",
                  )}
                >
                  <td className="px-4 py-1.5 font-mono text-xs text-ink-faint">
                    {a.attemptNo}
                  </td>
                  <td className="max-w-[9rem] truncate px-2 py-1.5 text-xs">
                    {a.userName}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px]",
                        won
                          ? "bg-go/25 text-go"
                          : errored
                            ? "bg-warn/20 text-warn"
                            : "bg-raised text-ink-faint",
                      )}
                    >
                      {a.outcome}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-ink-faint">
                    {a.sqlstate ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative h-2 w-full min-w-[6rem] overflow-hidden rounded-full bg-line/50">
                      <div
                        className={cn(
                          "absolute h-full rounded-full",
                          won ? "bg-go" : errored ? "bg-warn" : "bg-violet/60",
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-xs tabular-nums text-ink-dim">
                    {a.durationMs}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "go" | "stop";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
        active && tone === "stop" && "border-stop bg-stop/20 text-stop",
        active && tone === "go" && "border-go bg-go/20 text-go",
        !active && "border-line text-ink-dim hover:border-violet",
      )}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: "go" | "stop";
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-ground/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "go" && "text-go",
          tone === "stop" && "text-stop",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-ink-faint">{hint}</p>}
    </div>
  );
}
