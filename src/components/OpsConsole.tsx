"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench, Check, AlertTriangle, Power } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FacilityView } from "@/lib/availability";
import { SportIcon } from "@/components/SportIcon";

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
    <div className="space-y-5">
      <div className="panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wrench className="h-4 w-4 text-warn" />
          Schedule a closure
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block lg:col-span-2">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Facility
            </span>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              disabled={!isManager}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet disabled:opacity-50"
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
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!isManager}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              From
            </span>
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={!isManager}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              To
            </span>
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!isManager}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet disabled:opacity-50"
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Reason (shown to students)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!isManager}
            maxLength={200}
            className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-violet disabled:opacity-50"
          />
        </label>

        <button
          onClick={createBlock}
          disabled={!isManager || busy}
          className="mt-4 flex items-center gap-2 rounded-xl bg-warn px-5 py-2.5 font-semibold text-ground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wrench className="h-4 w-4" />
          )}
          Close this window
        </button>

        {result?.ok && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-go/40 bg-go/10 p-3 text-sm text-go">
            <Check className="h-4 w-4" />
            Closure scheduled. Those slots are now unbookable.
          </p>
        )}

        {result && !result.ok && (
          <div className="mt-3 rounded-lg border border-stop/40 bg-stop/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-stop">
              <AlertTriangle className="h-4 w-4" />
              {result.message}
            </p>
            {result.sqlstate && (
              <p className="mt-1 font-mono text-[10px] text-ink-faint">
                SQLSTATE {result.sqlstate} · bookings_no_overlap
              </p>
            )}
            {result.clashes && result.clashes.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-ink-dim">
                {result.clashes.map((c, i) => (
                  <li key={i}>
                    ·{" "}
                    {c.kind === "block"
                      ? `already closed${c.note ? ` — ${c.note}` : ""} at `
                      : `${c.user_name ?? "a student"} holds `}
                    {new Date(c.starts_at).toLocaleTimeString("en-GB", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-faint">
              The same constraint that protects students from each other just
              protected them from an operator mistake.
            </p>
          </div>
        )}
      </div>

      <div className="panel p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Power className="h-4 w-4 text-violet" />
          Facility availability
        </h2>
        <p className="mt-1 text-xs text-ink-dim">
          Taking a facility offline stops new bookings. Existing reservations
          are left alone — they are somebody&apos;s plan for this evening.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f) => (
            <div
              key={f.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                f.isActive
                  ? "border-line bg-raised/40"
                  : "border-stop/40 bg-stop/10",
              )}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border"
                style={{
                  color: f.color,
                  borderColor: `${f.color}44`,
                  background: `${f.color}18`,
                }}
              >
                <SportIcon sport={f.sport} size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
              <button
                onClick={() => toggle(f.id, !f.isActive)}
                disabled={!isManager}
                className={cn(
                  "rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-40",
                  f.isActive
                    ? "bg-go/20 text-go hover:bg-go/30"
                    : "bg-stop/20 text-stop hover:bg-stop/30",
                )}
              >
                {f.isActive ? "Open" : "Closed"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
