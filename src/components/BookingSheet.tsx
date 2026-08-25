"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  X, Check, AlertTriangle, Loader2, ListPlus, ArrowRight, Database,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { SlotView } from "@/lib/availability";
import type { Alternative } from "@/lib/outcomes";

type Phase = "confirm" | "working" | "won" | "lost" | "queued";

export function BookingSheet({
  facilityId,
  slot,
  onClose,
  onDone,
}: {
  facilityId: string;
  slot: SlotView;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [partySize, setPartySize] = useState(2);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{
    code?: string;
    message?: string;
    sqlstate?: string;
    constraint?: string;
    bookingCode?: string;
    alternatives?: Alternative[];
    waitlistable?: boolean;
    position?: number;
    replayed?: boolean;
  }>({});

  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * One idempotency key per booking *intent*, created when the sheet opens and
   * deliberately NOT regenerated on retry.
   *
   * That is the entire point: if the first submit times out and the student
   * taps again, the server sees the same key and returns the booking it
   * already made instead of making a second one. Generating a fresh key per
   * click would turn a retry into a duplicate — exactly the bug this guards.
   */
  const idempotencyKey = useMemo(
    () => `bk-${crypto.randomUUID()}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slot.startsAt, facilityId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function book() {
    setPhase("working");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        facilityId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        idempotencyKey,
        partySize,
        note: note || undefined,
      }),
    });
    const body = await res.json();

    if (res.ok && body.ok) {
      setResult({
        bookingCode: body.booking.bookingCode,
        replayed: body.replayed,
      });
      setPhase("won");
    } else {
      setResult({
        code: body.code,
        message: body.message,
        sqlstate: body.sqlstate,
        constraint: body.constraint,
        alternatives: body.alternatives ?? [],
        waitlistable: body.waitlistable,
      });
      setPhase("lost");
    }
  }

  async function joinQueue() {
    setPhase("working");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        facilityId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      }),
    });
    const body = await res.json();
    if (body.ok) {
      setResult({ position: body.position });
      setPhase("queued");
    } else {
      setResult({ code: body.code, message: body.message });
      setPhase("lost");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ground/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up w-full max-w-md rounded-t-2xl border border-line bg-surface-solid p-6 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {phase === "won" ? "Confirmed" : phase === "lost" ? "Not confirmed" : "Confirm booking"}
            </p>
            <h2 id="booking-title" className="mt-1 text-xl font-bold tabular-nums">
              {slot.range}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === "confirm" && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Players
              </label>
              <div className="mt-1.5 flex gap-1.5">
                {[1, 2, 4, 6, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPartySize(n)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm transition-colors",
                      partySize === n
                        ? "border-flame bg-flame/15 text-flame"
                        : "border-line text-ink-dim hover:border-violet",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="note"
                className="font-mono text-[10px] uppercase tracking-wider text-ink-faint"
              >
                Note (optional)
              </label>
              <input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                placeholder="Inter-hostel practice"
                className="mt-1.5 w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-violet"
              />
            </div>

            {slot.state === "taken" && (
              <p className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
                This slot is already taken. You can still submit — if the holder
                cancels in the meantime you will win it — or join the queue.
              </p>
            )}

            <button
              onClick={book}
              className="w-full rounded-xl bg-flame py-3 font-semibold text-ground transition-colors hover:bg-flame-soft"
            >
              Confirm booking
            </button>

            <p className="text-center font-mono text-[10px] text-ink-faint">
              Idempotency key {idempotencyKey.slice(0, 14)}…
            </p>
          </div>
        )}

        {phase === "working" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-7 w-7 animate-spin text-flame" />
            <p className="text-sm text-ink-dim">Asking the database…</p>
          </div>
        )}

        {phase === "won" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-go/40 bg-go/10 py-6">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-go">
                <Check className="h-6 w-6 text-ground" strokeWidth={3} />
              </span>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold tracking-wider text-go">
                  {result.bookingCode}
                </p>
                <p className="mt-1 text-xs text-ink-dim">
                  Show this code at the facility
                </p>
              </div>
            </div>

            {result.replayed && (
              <p className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-info">
                This request replayed an idempotency key that was already
                committed, so it returned your original booking rather than
                creating a second one.
              </p>
            )}

            <button
              onClick={onDone}
              className="w-full rounded-xl border border-line py-2.5 text-sm transition-colors hover:border-violet"
            >
              Done
            </button>
          </div>
        )}

        {phase === "queued" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-info/40 bg-info/10 py-6">
              <ListPlus className="h-8 w-8 text-info" />
              <p className="text-lg font-semibold">
                You are #{result.position} in the queue
              </p>
              <p className="max-w-xs text-center text-xs text-ink-dim">
                If this slot is released you get a 15-minute window to claim it
                before it passes to the next person.
              </p>
            </div>
            <button
              onClick={onDone}
              className="w-full rounded-xl border border-line py-2.5 text-sm transition-colors hover:border-violet"
            >
              Done
            </button>
          </div>
        )}

        {phase === "lost" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-stop/40 bg-stop/10 p-4">
              <p className="flex items-center gap-2 font-semibold text-stop">
                <AlertTriangle className="h-4 w-4" />
                {result.message}
              </p>
              {result.sqlstate && (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
                  <Database className="h-3 w-3" />
                  SQLSTATE {result.sqlstate}
                  {result.constraint && ` · ${result.constraint}`}
                </p>
              )}
            </div>

            {result.alternatives && result.alternatives.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Try instead
                </p>
                <div className="mt-2 space-y-1.5">
                  {result.alternatives.map((alt) => (
                    <Link
                      key={`${alt.facilityId}-${alt.startsAt}`}
                      href={`/facility/${alt.facilitySlug}?date=${alt.startsAt.slice(0, 10)}`}
                      className="flex items-center justify-between rounded-lg border border-line bg-raised/60 px-3 py-2.5 text-sm transition-colors hover:border-go"
                      onClick={onClose}
                    >
                      <span>
                        <span className="font-medium">{alt.label}</span>
                        <span className="ml-2 text-xs text-ink-faint">
                          {alt.reason}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {result.waitlistable && (
                <button
                  onClick={joinQueue}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-info py-2.5 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
                >
                  <ListPlus className="h-4 w-4" /> Join queue
                </button>
              )}
              <button
                onClick={onDone}
                className="flex-1 rounded-xl border border-line py-2.5 text-sm transition-colors hover:border-violet"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
