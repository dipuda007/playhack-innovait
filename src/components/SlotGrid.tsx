"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Wrench, Clock, ListPlus, X, Loader2 } from "lucide-react";
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
      <div className="mb-3 flex items-center gap-4 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "bg-go animate-pulse-ring" : "bg-ink-faint",
            )}
          />
          {live ? "Live" : "Polling"}
        </span>
        <Legend swatch="border-go/50 bg-go/10" label="Open" />
        <Legend swatch="border-violet/50 bg-violet/20" label="Yours" />
        <Legend swatch="border-line bg-raised" label="Taken" />
        <Legend swatch="border-warn/40 bg-warn/10" label="Closed" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((slot) => {
          const isFlashing = flashing.has(slot.startsAt);
          const clickable =
            signedIn && (slot.state === "free" || slot.state === "taken");

          return (
            <button
              key={slot.startsAt}
              disabled={!clickable}
              onClick={() => setSelected(slot)}
              className={cn(
                "relative rounded-xl border p-3 text-left transition-all",
                isFlashing && "animate-flash-green",
                slot.state === "free" &&
                  "border-go/50 bg-go/10 hover:border-go hover:bg-go/20",
                slot.state === "mine" && "border-violet/60 bg-violet/20",
                slot.state === "taken" &&
                  "border-line bg-raised/60 hover:border-violet/60",
                slot.state === "blocked" &&
                  "cursor-not-allowed border-warn/40 bg-warn/10",
                slot.state === "past" &&
                  "cursor-not-allowed border-line-soft bg-transparent opacity-35",
                slot.state === "waitlisted" &&
                  "border-info/50 bg-info/10",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {slot.label}
                </span>
                <SlotIcon state={slot.state} />
              </div>

              <p className="mt-1 truncate text-[11px] text-ink-faint">
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
                <span className="absolute -right-px -top-px rounded-bl-lg rounded-tr-xl bg-flame px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-ground">
                  Peak
                </span>
              )}
            </button>
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
      <span className={cn("h-2.5 w-2.5 rounded border", swatch)} />
      {label}
    </span>
  );
}

function SlotIcon({ state }: { state: SlotView["state"] }) {
  const cls = "h-3.5 w-3.5";
  switch (state) {
    case "free":
      return <span className={cn(cls, "block rounded-full bg-go/60")} />;
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
