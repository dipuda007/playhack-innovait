"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { SlotView } from "@/lib/availability";
import type { Alternative } from "@/lib/outcomes";

type Phase = "confirm" | "working" | "won" | "lost" | "queued";

/**
 * The booking dialog, set as a docket.
 *
 * Confirming a court is a small piece of paperwork, so it looks like one: a
 * ruled slip with a heavy border, a fact table, and a stamped code at the
 * end. No radius, no shadow, no blur — the scrim is flat ink at 80%, which
 * separates foreground from background more decisively than a blur does and
 * costs nothing to composite.
 *
 * Each phase replaces the body of the same slip rather than opening a new
 * one, so the slot and its time stay on screen throughout.
 */
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

  const heading =
    phase === "won"
      ? "Confirmed"
      : phase === "lost"
        ? "Not confirmed"
        : phase === "queued"
          ? "Queued"
          : "Booking docket";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-0 sm:items-center sm:p-6"
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
        /*
          The dialog is focused on open so screen readers land inside it, but
          it is not itself an interactive control — the focus ring belongs on
          the buttons within, not around the whole slip.
        */
        className="animate-ink-in w-full max-w-lg overflow-hidden rounded-t-xl border border-rule bg-paper shadow-[var(--shadow-panel)] focus:outline-none sm:rounded-xl"
      >
        {/* Docket head */}
        <div className="flex items-start justify-between gap-4 border-b border-navy-2 bg-navy px-5 py-4 text-paper">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60">
              {heading}
            </p>
            <h2 id="booking-title" className="fig mt-1 text-2xl font-bold">
              {slot.range}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-lg leading-none text-paper/70 transition-colors hover:text-paper"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {phase === "confirm" && (
            <div className="space-y-5">
              <div>
                <p className="kicker">Players</p>
                <div className="mt-2 flex gap-px bg-rule">
                  {[1, 2, 4, 6, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPartySize(n)}
                      className={cn(
                        "fig flex-1 py-2.5 text-sm font-bold transition-colors",
                        partySize === n
                          ? "bg-ink text-paper"
                          : "bg-paper hover:bg-paper-2",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="note" className="kicker">
                  Note (optional)
                </label>
                <input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={280}
                  placeholder="Inter-hostel practice"
                  className="field mt-2"
                />
              </div>

              {slot.state === "taken" && (
                <p className="border-l-2 border-signal bg-paper-2 p-3 text-[13px] leading-snug text-ink-2">
                  This slot is already taken. You can still submit — if the
                  holder cancels in the meantime you win it — or join the queue.
                </p>
              )}

              <button onClick={book} className="btn btn-signal w-full">
                Confirm booking
              </button>

              <p className="border-t border-rule pt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                Idempotency key {idempotencyKey.slice(0, 14)}…
              </p>
            </div>
          )}

          {phase === "working" && (
            <div className="flex flex-col items-center gap-3 py-14">
              <span className="animate-blink fig text-sm uppercase tracking-[0.3em] text-signal">
                Asking the database
              </span>
              <span className="h-px w-40 origin-left animate-rule-draw bg-ink" />
            </div>
          )}

          {phase === "won" && (
            <div className="space-y-5">
              {/* The stamp. A booking code is a receipt, so it is set like one. */}
              <div className="rounded-lg border border-rule bg-paper-2 px-5 py-7 text-center">
                <p className="kicker">Booking code</p>
                <p className="fig mt-2 text-[2.6rem] font-bold leading-none tracking-tight">
                  {result.bookingCode}
                </p>
                <p className="mt-3 text-[12px] uppercase tracking-[0.12em] text-ink-3">
                  Show this at the facility
                </p>
              </div>

              {result.replayed && (
                <p className="rounded-r-md border-l-2 border-gold bg-paper-2 p-3 text-[13px] leading-snug text-ink-2">
                  This request replayed an idempotency key that was already
                  committed, so it returned your original booking rather than
                  creating a second one.
                </p>
              )}

              <button onClick={onDone} className="btn btn-outline w-full">
                Done
              </button>
            </div>
          )}

          {phase === "queued" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-rule bg-paper-2 px-5 py-7 text-center">
                <p className="kicker">Queue position</p>
                <p className="fig mt-2 text-[2.6rem] font-bold leading-none">
                  #{result.position}
                </p>
                <p className="mx-auto mt-3 max-w-[34ch] text-[12px] leading-snug text-ink-3">
                  If this slot is released you get a 15-minute window to claim
                  it before it passes to the next person.
                </p>
              </div>
              <button onClick={onDone} className="btn btn-outline w-full">
                Done
              </button>
            </div>
          )}

          {phase === "lost" && (
            <div className="space-y-5">
              <div className="border-l-2 border-signal bg-paper-2 p-4">
                <p className="hed-sm font-display uppercase text-signal">
                  {result.message}
                </p>
                {result.sqlstate && (
                  <p className="fig mt-2 text-[11px] text-ink-3">
                    SQLSTATE {result.sqlstate}
                    {result.constraint && ` · ${result.constraint}`}
                  </p>
                )}
              </div>

              {result.alternatives && result.alternatives.length > 0 && (
                <div>
                  <p className="kicker">Try instead</p>
                  <div className="mt-2 border-t border-rule">
                    {result.alternatives.map((alt) => (
                      <Link
                        key={`${alt.facilityId}-${alt.startsAt}`}
                        href={`/facility/${alt.facilitySlug}?date=${alt.startsAt.slice(0, 10)}`}
                        className="flex items-center justify-between gap-3 border-b border-rule px-1 py-2.5 text-sm transition-colors hover:bg-paper-2"
                        onClick={onClose}
                      >
                        <span className="min-w-0">
                          <span className="font-semibold">{alt.label}</span>
                          <span className="ml-2 text-[12px] text-ink-3">
                            {alt.reason}
                          </span>
                        </span>
                        <span className="shrink-0 text-ink-3">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {result.waitlistable && (
                  <button onClick={joinQueue} className="btn btn-solid flex-1">
                    Join queue
                  </button>
                )}
                <button onClick={onDone} className="btn btn-outline flex-1">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
