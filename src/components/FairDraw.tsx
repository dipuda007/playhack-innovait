"use client";

import { useMemo, useState } from "react";
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

/**
 * The draw, set as a ballot sheet.
 *
 * The seed is printed above the entrant list and stays there after the draw,
 * because that is the entire claim: given this seed and this list of entrants,
 * anyone can recompute the winner. A result nobody can check is not a fair
 * draw, it is an assertion — so the audit trail is the page, not a footnote.
 */
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
    <div>
      <div className="border-y border-rule">
        <div className="grid gap-px bg-rule sm:grid-cols-3">
          <label className="block bg-paper p-4">
            <span className="kicker mb-2 block">Contested facility</span>
            <select
              value={facilityId}
              onChange={(e) => {
                setFacilityId(e.target.value);
                setLottery(null);
              }}
              className="field border-0 bg-transparent px-0 py-1 text-[15px] font-semibold"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block bg-paper p-4">
            <span className="kicker mb-2 block">Students entering</span>
            <span className="flex items-center gap-3">
              <span className="fig w-10 text-[15px] font-bold">{entrants}</span>
              <input
                type="range"
                min={2}
                max={150}
                value={entrants}
                onChange={(e) => setEntrants(Number(e.target.value))}
                className="w-full accent-[var(--color-signal)]"
              />
            </span>
          </label>

          <div className="flex items-stretch gap-px bg-rule">
            <button
              onClick={openWindow}
              disabled={busy !== null}
              className="btn btn-outline flex-1 border-0 bg-paper"
            >
              {busy === "enter" ? "Opening…" : "Open window"}
            </button>
            <button
              onClick={draw}
              disabled={busy !== null || !lottery || Boolean(lottery.drawnAt)}
              className="btn btn-signal flex-1 border-0"
            >
              {busy === "draw" ? "Drawing…" : "Draw"}
            </button>
          </div>
        </div>
      </div>

      {slot && (
        <p className="border-b border-rule py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
          Slot under contention: {facility?.name} · {istClock(slot.start)}–
          {istClock(slot.end)}
        </p>
      )}

      {lottery && (
        <>
          {/* The seed, printed before and after the draw. */}
          <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-2 border-signal bg-paper-2 px-4 py-3">
            <span className="kicker">Published seed</span>
            <code className="fig text-[12px] font-semibold">{lottery.seed}</code>
            <span className="text-[11px] text-ink-3">
              generated when the window opened — before anyone entered
            </span>
          </div>

          {lottery.drawnAt && lottery.winnerName && (
            <section className="animate-ink-in mt-5 rounded-xl border border-navy bg-navy px-6 py-7 text-paper sm:px-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/60">
                Drawn from {lottery.entries.length} entrants
              </p>
              <h3 className="hed-lg mt-3 font-display uppercase">
                {lottery.winnerName} takes the court
              </h3>
              <p className="fig mt-4 text-lg">
                Booking {lottery.bookingCode}
              </p>
              <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-paper/85">
                The winner&apos;s booking was inserted through the same
                exclusion constraint as every other booking. Fairness chose the
                winner; correctness still enforced the slot.
              </p>
            </section>
          )}

          <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-2">
              <h3 className="hed-sm font-display uppercase">
                Entrants ({lottery.entries.length})
              </h3>
              <p className="text-[11px] text-ink-3">
                Weight = 50 + reliability ÷ 2 — a tilt, not a ranking
              </p>
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-paper">
                  <tr className="border-b border-ink text-left">
                    <th className="kicker py-2 pr-3 font-normal">Student</th>
                    <th className="kicker py-2 pr-3 font-normal">Reliability</th>
                    <th className="kicker py-2 pr-3 text-right font-normal">Weight</th>
                    <th className="kicker py-2 pr-3 text-right font-normal">Chance</th>
                    <th className="kicker py-2 text-right font-normal">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr
                      key={e.userId}
                      className={cn(
                        "border-b border-rule",
                        e.won && "bg-ink text-paper",
                      )}
                    >
                      <td className="py-1.5 pr-3">{e.userName}</td>
                      <td className="py-1.5 pr-3">
                        <span className="flex items-center gap-2">
                          {/* A bar drawn in rules, not in colour. */}
                          <span
                            className={cn(
                              "h-2 w-16 border",
                              e.won ? "border-paper/40" : "border-rule",
                            )}
                          >
                            <span
                              className={cn(
                                "block h-full",
                                e.won ? "bg-paper" : "bg-ink",
                              )}
                              style={{ width: `${e.reliability}%` }}
                            />
                          </span>
                          <span className="fig text-[11px]">{e.reliability}</span>
                        </span>
                      </td>
                      <td className="fig py-1.5 pr-3 text-right text-[12px]">
                        {e.weight}
                      </td>
                      <td className="fig py-1.5 pr-3 text-right text-[12px]">
                        {e.chance}%
                      </td>
                      <td className="py-1.5 text-right">
                        {e.won ? (
                          <span className="fig text-[11px] font-bold">WON</span>
                        ) : lottery.drawnAt ? (
                          <span className="fig text-[11px] text-ink-3">—</span>
                        ) : (
                          <span className="fig text-[11px] text-ink-3">
                            entered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
