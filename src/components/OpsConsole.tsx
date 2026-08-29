"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { FacilityView } from "@/lib/availability";
import { SportIcon } from "@/components/SportIcon";

/**
 * The ops console, set as a duty desk.
 *
 * Closing a court is paperwork with consequences, so the form looks like a
 * docket and the refusal looks like a stamped rejection — including the
 * SQLSTATE, because the point being made is that the same constraint which
 * stops two students colliding also stopped the manager.
 */
export function OpsConsole({
  facilities,
  isManager,
  defaultDate,
}: {
  facilities: FacilityView[];
  isManager: boolean;
  defaultDate: string;
}) {
  const router = useRouter();
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState("12:00");
  const [to, setTo] = useState("14:00");
  const [note, setNote] = useState("Court resurfacing");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok?: boolean;
    code?: string;
    message?: string;
    sqlstate?: string;
    clashes?: {
      user_name: string | null;
      kind?: string;
      note?: string | null;
      starts_at: string;
    }[];
  } | null>(null);

  async function createBlock() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "block",
        facilityId,
        startsAt: new Date(`${date}T${from}:00+05:30`).toISOString(),
        endsAt: new Date(`${date}T${to}:00+05:30`).toISOString(),
        note,
      }),
    });
    setResult(await res.json());
    setBusy(false);
    router.refresh();
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch("/api/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle", facilityId: id, isActive }),
    });
    router.refresh();
  }

  return (
    <div>
      {/* ── Closure docket ───────────────────────────────────────────── */}
      <div className="border-y border-rule">
        <div className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Cell label="Facility">
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              disabled={!isManager}
              className="field border-0 bg-transparent px-0 py-1 text-[15px] font-semibold disabled:opacity-50"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Cell>

          <Cell label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!isManager}
              className="field fig border-0 bg-transparent px-0 py-1 text-[15px] font-semibold disabled:opacity-50"
            />
          </Cell>

          <Cell label="From">
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={!isManager}
              className="field fig border-0 bg-transparent px-0 py-1 text-[15px] font-semibold disabled:opacity-50"
            />
          </Cell>

          <Cell label="To">
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!isManager}
              className="field fig border-0 bg-transparent px-0 py-1 text-[15px] font-semibold disabled:opacity-50"
            />
          </Cell>
        </div>

        <div className="grid gap-px border-t border-rule bg-rule lg:grid-cols-[1fr_auto]">
          <Cell label="Reason (shown to students)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!isManager}
              maxLength={200}
              className="field border-0 bg-transparent px-0 py-1 text-[15px] disabled:opacity-50"
            />
          </Cell>
          <div className="flex items-stretch bg-paper p-4">
            <button
              onClick={createBlock}
              disabled={!isManager || busy}
              className="btn btn-solid w-full lg:w-auto"
            >
              {busy ? "Filing…" : "Close this window"}
            </button>
          </div>
        </div>
      </div>

      {result?.ok && (
        <p className="animate-ink-in mt-4 rounded-r-md border-l-2 border-gold bg-paper-2 px-4 py-3 text-[14px]">
          <strong>Closure filed.</strong> Those slots are now unbookable and
          appear as closed on the student grid.
        </p>
      )}

      {result && !result.ok && (
        <div className="animate-ink-in mt-4 border-2 border-signal">
          <p className="bg-signal px-4 py-2.5 font-display text-[15px] uppercase text-paper">
            Refused — {result.message}
          </p>
          <div className="px-4 py-3">
            {result.sqlstate && (
              <p className="fig text-[11px] text-ink-3">
                SQLSTATE {result.sqlstate} · bookings_no_overlap
              </p>
            )}
            {result.clashes && result.clashes.length > 0 && (
              <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
                {result.clashes.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="fig text-ink-3">
                      {new Date(c.starts_at).toLocaleTimeString("en-GB", {
                        timeZone: "Asia/Kolkata",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {c.kind === "block"
                      ? `already closed${c.note ? ` — ${c.note}` : ""}`
                      : `${c.user_name ?? "a student"} holds this slot`}
                  </li>
                ))}
              </ul>
            )}
            <p className="prose-news mt-3 text-[14px]">
              The same constraint that protects students from each other just
              protected them from an operator mistake.
            </p>
          </div>
        </div>
      )}

      {/* ── Facility roll ────────────────────────────────────────────── */}
      <section className="mt-9">
        <h3 className="hed-sm border-b border-ink pb-2 font-display uppercase">
          Facility availability
        </h3>
        <p className="prose-news mt-3 max-w-[76ch] text-[15px]">
          Taking a facility offline stops new bookings. Existing reservations
          are left alone — they are somebody&apos;s plan for this evening.
        </p>

        <div className="mt-4 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f) => (
            <div
              key={f.id}
              className={cn(
                "flex items-center gap-3 p-3",
                f.isActive ? "bg-paper" : "hatch bg-paper",
              )}
            >
              <SportIcon
                sport={f.sport}
                size={16}
                className="shrink-0 text-ink-3"
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {f.name}
              </span>
              <button
                onClick={() => toggle(f.id, !f.isActive)}
                disabled={!isManager}
                className={cn(
                  "tag transition-colors disabled:opacity-40",
                  f.isActive
                    ? "border-ink text-ink hover:bg-ink hover:text-paper"
                    : "border-signal bg-signal text-paper",
                )}
              >
                {f.isActive ? "Open" : "Closed"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cell({
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
