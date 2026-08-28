"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock, Wrench, Clock, ListPlus } from "lucide-react";
import { EASE } from "@/components/Motion";
import { cn } from "@/lib/cn";
import type { SlotView } from "@/lib/availability";
import { BookingSheet } from "@/components/BookingSheet";

export function SlotGrid({
  facilityId,
  facilitySlug,
  dateKey,
  initialSlots,
  signedIn,
}: {
  facilityId: string;
  facilitySlug: string;
  dateKey: string;
  initialSlots: SlotView[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState(initialSlots);
  const [selected, setSelected] = useState<SlotView | null>(null);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const previous = useRef(initialSlots);
  const still = useReducedMotion();

  // Server-rendered slots win whenever the route re-renders.
  useEffect(() => {
    setSlots(initialSlots);
    previous.current = initialSlots;
  }, [initialSlots]);

  /**
   * Re-fetch the authoritative day view.
   *
   * Note what this does NOT do: patch local state from an event payload. The
   * stream only ever says "something changed here"; the truth is re-read from
   * the database. A dropped or duplicated event therefore cannot leave this
   * grid disagreeing with what is actually booked.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/availability?facility=${facilitySlug}&date=${dateKey}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const day = await res.json();

      const changed = new Set<string>();
      for (const slot of day.slots as SlotView[]) {
        const before = previous.current.find((s) => s.startsAt === slot.startsAt);
        if (before && before.state !== slot.state) changed.add(slot.startsAt);
      }

      previous.current = day.slots;
      setSlots(day.slots);

      if (changed.size) {
        setFlashing(changed);
        setTimeout(() => setFlashing(new Set()), 1800);
      }
    } catch {
      /* transient; the poll will pick it up */
    }
  }, [facilitySlug, dateKey]);

  // Live updates over SSE, with polling as the fallback that always runs at a
  // slower cadence — so the grid stays fresh even where SSE is blocked.
  useEffect(() => {
    let source: EventSource | null = null;
    try {
      source = new EventSource("/api/stream");
      source.addEventListener("ready", () => setLive(true));
      source.addEventListener("change", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.facilityId === facilityId || data.facilityId === "*") refresh();
      });
      source.onerror = () => setLive(false);
    } catch {
      setLive(false);
    }

    const poll = setInterval(refresh, 15_000);
    return () => {
      source?.close();
      clearInterval(poll);
    };
  }, [facilityId, refresh]);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "animate-pulse-ring bg-go" : "bg-ink-faint",
            )}
          />
          {live ? "Live" : "Polling"}
        </span>
        <Legend swatch="border-go/50 bg-go/15" label="Open" />
        <Legend swatch="border-violet/60 bg-violet/25" label="Yours" />
        <Legend swatch="border-line bg-raised" label="Taken" />
        <Legend swatch="border-warn/40 bg-warn/10" label="Closed" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((slot, i) => {
          const isFlashing = flashing.has(slot.startsAt);
          const clickable =
            signedIn && (slot.state === "free" || slot.state === "taken");

          return (
            <motion.button
              key={slot.startsAt}
              disabled={!clickable}
              onClick={() => setSelected(slot)}
              /*
               * Entrance staggers across the grid so the day reads left to
               * right, the way it is actually lived. Capped at 16 steps: past
               * that the last cell arrives late enough to feel broken rather
               * than choreographed.
               */
              initial={still ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: EASE,
                delay: still ? 0 : Math.min(i, 16) * 0.025,
              }}
              whileTap={clickable && !still ? { scale: 0.97 } : undefined}
              className={cn(
                "relative min-h-[4.75rem] rounded-xl border p-3 text-left transition-all duration-300",
                isFlashing && "animate-flash-green",
                clickable && "cursor-pointer",
                slot.state === "free" &&
                  "border-go/45 bg-go/10 hover:-translate-y-0.5 hover:border-go hover:bg-go/20 hover:shadow-[0_10px_28px_-16px_var(--color-go)]",
                slot.state === "mine" &&
                  "border-violet/60 bg-violet/25 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]",
                slot.state === "taken" &&
                  "border-line bg-raised/50 hover:-translate-y-0.5 hover:border-violet/60",
                slot.state === "blocked" &&
                  "cursor-not-allowed border-warn/40 bg-warn/10",
                slot.state === "past" &&
                  "cursor-not-allowed border-line-soft bg-transparent opacity-30",
                slot.state === "waitlisted" && "border-info/50 bg-info/10",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {slot.label}
                </span>
                <SlotIcon state={slot.state} />
              </div>

              <p className="mt-1.5 truncate text-[11px] text-ink-faint">
                {slot.state === "free" && (slot.peak ? "Peak · open" : "Open")}
                {slot.state === "mine" && `Yours · ${slot.bookingCode}`}
                {slot.state === "taken" && (slot.holder ?? "Booked")}
                {slot.state === "blocked" && (slot.blockNote ?? "Closed")}
                {slot.state === "past" && "Gone"}
                {slot.state === "waitlisted" &&
                  `Queued · #${slot.myQueuePosition}`}
              </p>

              {slot.waitlistCount > 0 && slot.state === "taken" && (
                <span className="absolute right-2 top-8 rounded bg-info/20 px-1.5 py-0.5 font-mono text-[9px] text-info">
                  {slot.waitlistCount} waiting
                </span>
              )}

              {slot.peak && slot.state === "free" && (
                <span className="absolute -right-px -top-px rounded-bl-lg rounded-tr-xl bg-gradient-to-b from-flame-soft to-flame px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-void">
                  Peak
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {selected && (
        <BookingSheet
          facilityId={facilityId}
          slot={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            refresh();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="hidden items-center gap-1.5 sm:flex">
      <span className={cn("h-2.5 w-2.5 rounded-[3px] border", swatch)} />
      {label}
    </span>
  );
}

function SlotIcon({ state }: { state: SlotView["state"] }) {
  const cls = "h-3.5 w-3.5";
  switch (state) {
    case "free":
      return (
        <span className={cn(cls, "grid place-items-center")}>
          <span className="h-2 w-2 rounded-full bg-go shadow-[0_0_8px_1px_var(--color-go)]" />
        </span>
      );
    case "mine":
      return <Check className={cn(cls, "text-violet-soft")} />;
    case "taken":
      return <Lock className={cn(cls, "text-ink-faint")} />;
    case "blocked":
      return <Wrench className={cn(cls, "text-warn")} />;
    case "past":
      return <Clock className={cn(cls, "text-ink-faint")} />;
    case "waitlisted":
      return <ListPlus className={cn(cls, "text-info")} />;
  }
}
