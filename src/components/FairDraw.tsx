"use client";

import { useMemo, useState } from "react";
import { Dices, Loader2, Trophy, ShieldCheck, Hash } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FacilityView } from "@/lib/availability";
import { istClock } from "@/lib/time";

type Entry = {
  userId: string;
  userName: string;
  reliability: number;
  weight: number;
  chance: number;
  won: boolean;
};

type Lottery = {
  id: string;
  facilityName: string;
  startsAt: string;
  seed: string;
  drawnAt: string | null;
  winnerName: string | null;
  bookingCode: string | null;
  entries: Entry[];
};

export function FairDraw({
  facilities,
  defaultDate,
}: {
  facilities: FacilityView[];
  defaultDate: string;
}) {
  const [facilityId, setFacilityId] = useState(
    facilities.find((f) => f.slug === "tennis-court-a")?.id ??
      facilities[0]?.id ??
      "",
  );
  const [entrants, setEntrants] = useState(40);
  const [busy, setBusy] = useState<"enter" | "draw" | null>(null);
  const [lottery, setLottery] = useState<Lottery | null>(null);

  const facility = facilities.find((f) => f.id === facilityId);

  const slot = useMemo(() => {
    if (!facility) return null;
    // 6 p.m. where the grid allows it — the scenario the brief describes.
    const [oh, om] = facility.opensAt.split(":").map(Number);
    const openMin = oh * 60 + om;
    const target = 18 * 60;
    const aligned =
      openMin + Math.round((target - openMin) / facility.slotMinutes) *
        facility.slotMinutes;
    const hh = String(Math.floor(aligned / 60)).padStart(2, "0");
    const mm = String(aligned % 60).padStart(2, "0");
    const start = new Date(`${defaultDate}T${hh}:${mm}:00+05:30`);
    return { start, end: new Date(start.getTime() + facility.slotMinutes * 60_000) };
  }, [facility, defaultDate]);

  async function openWindow() {
    if (!slot) return;
    setBusy("enter");
    setLottery(null);
    const res = await fetch("/api/lottery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "simulate",
        facilityId,
        startsAt: slot.start.toISOString(),
        endsAt: slot.end.toISOString(),
        entrants,
      }),
    });
    const body = await res.json();
    setLottery(body.lottery);
    setBusy(null);
  }

  async function draw() {
    if (!lottery) return;
    setBusy("draw");
    const res = await fetch("/api/lottery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "draw", lotteryId: lottery.id }),
    });
    const body = await res.json();
    setLottery(body.lottery);
    setBusy(null);
  }

  const sorted = lottery
    ? [...lottery.entries].sort((a, b) =>
        a.won === b.won ? b.chance - a.chance : a.won ? -1 : 1,
      )
    : [];

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Contested facility
            </span>
            <select
              value={facilityId}
              onChange={(e) => {
                setFacilityId(e.target.value);
                setLottery(null);
              }}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Students entering · {entrants}
            </span>
            <input
              type="range"
              min={2}
              max={150}
              value={entrants}
              onChange={(e) => setEntrants(Number(e.target.value))}
              className="w-full accent-[var(--color-flame)]"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              onClick={openWindow}
              disabled={busy !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-semibold text-ground disabled:opacity-50"
            >
              {busy === "enter" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Open window
            </button>
            <button
              onClick={draw}
              disabled={busy !== null || !lottery || Boolean(lottery.drawnAt)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-flame px-4 py-2.5 text-sm font-semibold text-ground disabled:opacity-40"
            >
              {busy === "draw" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Dices className="h-4 w-4" />
              )}
              Draw
            </button>
          </div>
        </div>

        {slot && (
          <p className="mt-3 text-xs text-ink-faint">
            Slot under contention: {facility?.name} ·{" "}
            {istClock(slot.start)}–{istClock(slot.end)}
          </p>
        )}
      </div>

      {lottery && (
        <>
          {/* The seed, shown before and after — that is what makes it auditable. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-raised/40 p-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Hash className="h-4 w-4 text-violet" />
              Published seed
            </span>
            <code className="font-mono text-xs text-violet-soft">
              {lottery.seed}
            </code>
            <span className="text-xs text-ink-faint">
              generated when the window opened — before anyone entered
            </span>
          </div>

          {lottery.drawnAt && lottery.winnerName && (
            <div className="animate-slide-up rounded-2xl border border-go/50 bg-go/10 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Trophy className="h-7 w-7 shrink-0 text-go" />
                <div>
                  <h2 className="text-xl font-bold text-go">
                    {lottery.winnerName} takes the court
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-dim">
                    Drawn from {lottery.entries.length} entrants · booking{" "}
                    <code className="font-mono text-go">
                      {lottery.bookingCode}
                    </code>
                  </p>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs text-ink-dim">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-go" />
                <span>
                  The winner&apos;s booking was inserted through the same
                  exclusion constraint as every other booking. Fairness chose
                  the winner; correctness still enforced the slot.
                </span>
              </p>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h3 className="font-semibold">
                Entrants{" "}
                <span className="text-ink-faint">({lottery.entries.length})</span>
              </h3>
              <p className="text-xs text-ink-faint">
                Weight = 50 + reliability ÷ 2 — a tilt, not a ranking
              </p>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-solid">
                  <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-2 font-normal">Student</th>
                    <th className="px-2 py-2 font-normal">Reliability</th>
                    <th className="px-2 py-2 font-normal">Weight</th>
                    <th className="px-2 py-2 font-normal">Chance</th>
                    <th className="px-4 py-2 text-right font-normal">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr
                      key={e.userId}
                      className={cn(
                        "border-t border-line-soft",
                        e.won && "bg-go/10",
                      )}
                    >
                      <td className="px-4 py-1.5">{e.userName}</td>
                      <td className="px-2 py-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
                            <span
                              className="block h-full rounded-full bg-chart-2"
                              style={{ width: `${e.reliability}%` }}
                            />
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                            {e.reliability}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs tabular-nums text-ink-dim">
                        {e.weight}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs tabular-nums text-ink-dim">
                        {e.chance}%
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        {e.won ? (
                          <span className="rounded bg-go/25 px-1.5 py-0.5 font-mono text-[10px] text-go">
                            WON
                          </span>
                        ) : lottery.drawnAt ? (
                          <span className="font-mono text-[10px] text-ink-faint">
                            —
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-violet-soft">
                            entered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
