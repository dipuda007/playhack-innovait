"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Clock, MapPin, Users } from "lucide-react";
import { CourtArt } from "@/components/CourtArt";
import { SportIcon } from "@/components/SportIcon";
import { EASE } from "@/components/Motion";
import { cn } from "@/lib/cn";

export type CardFacility = {
  slug: string;
  name: string;
  sport: string;
  location: string;
  capacity: number;
  color: string;
};

export type CardSummary = {
  free: number;
  remaining: number;
  nextFreeLabel: string | null;
};

/**
 * A facility, as a card.
 *
 * The artwork is the court itself, drawn in the facility's own colour: a
 * badminton card carries badminton lines, so the grid is scannable by shape
 * before a single label is read. On hover it drifts and brightens — enough to
 * say "this is a door", not enough to distract from the number, which is the
 * only thing on the card a student is actually scanning for.
 */
export function FacilityCard({
  facility,
  summary,
  dateKey,
}: {
  facility: CardFacility;
  summary: CardSummary;
  dateKey: string;
}) {
  const still = useReducedMotion();
  const { free, remaining, nextFreeLabel } = summary;

  const dayOver = remaining === 0;
  const pct = remaining ? Math.round((free / remaining) * 100) : 0;
  const busy = !dayOver && pct <= 25;
  const full = !dayOver && free === 0;

  const state = dayOver
    ? { label: "Closed for today", tone: "text-ink-faint", bar: "bg-line" }
    : full
      ? { label: "Fully booked", tone: "text-stop", bar: "bg-stop/60" }
      : busy
        ? { label: nextFreeLabel ? `Next free ${nextFreeLabel}` : "Almost gone", tone: "text-warn", bar: "bg-warn" }
        : { label: nextFreeLabel ? `Next free ${nextFreeLabel}` : "Open", tone: "text-go", bar: "bg-go" };

  return (
    <Link
      href={`/facility/${facility.slug}?date=${dateKey}`}
      className="panel panel-hover group relative block overflow-hidden p-5"
    >
      {/*
        Court artwork. Anchored to the right half and masked to nothing before
        it reaches the text — the drawing has to be legible as a court, which
        means it cannot be shrunk to a texture, and it cannot be allowed to
        run under the one number the card exists to show.
      */}
      <motion.div
        className="pointer-events-none absolute inset-y-0 right-0 w-[76%] opacity-25 transition-opacity duration-500 [mask-image:linear-gradient(90deg,transparent,black_38%,black_88%,transparent)] group-hover:opacity-45"
        style={{ color: facility.color }}
        initial={false}
        whileHover={still ? undefined : { x: -8, scale: 1.05 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <CourtArt sport={facility.sport} className="h-full w-full" />
      </motion.div>

      {/* Colour wash from the facility's own hue, top-left. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14] transition-opacity duration-500 group-hover:opacity-25"
        style={{
          background: `radial-gradient(20rem 12rem at 0% 0%, ${facility.color}, transparent 70%)`,
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors duration-300"
              style={{
                color: facility.color,
                borderColor: `${facility.color}44`,
                background: `${facility.color}18`,
              }}
            >
              <SportIcon sport={facility.sport} size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold tracking-tight">
                {facility.name}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{facility.location}</span>
              </p>
            </div>
          </div>

          <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-0.5 text-ink-faint opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:text-flame group-hover:opacity-100" />
        </div>

        <div className="mt-6 flex items-end justify-between gap-3">
          <div>
            {dayOver ? (
              <p className="text-sm text-ink-faint">No slots left today</p>
            ) : (
              <p className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "display text-4xl tabular-nums",
                    full ? "text-stop" : busy ? "text-warn" : "text-go",
                  )}
                >
                  {free}
                </span>
                <span className="text-sm text-ink-faint">
                  of {remaining} open
                </span>
              </p>
            )}
          </div>
          <span className="metric-label shrink-0 pb-1">{facility.sport}</span>
        </div>

        {/* Occupancy bar. Width animates from zero on first paint. */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/70">
          <motion.div
            className={cn("h-full rounded-full", state.bar)}
            initial={still ? false : { width: 0 }}
            whileInView={{ width: `${dayOver ? 100 : pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
            style={still ? { width: `${dayOver ? 100 : pct}%` } : undefined}
          />
        </div>

        <div className="mt-3.5 flex items-center justify-between text-xs">
          <span className={cn("flex items-center gap-1.5", state.tone)}>
            <Clock className="h-3.5 w-3.5" />
            {state.label}
          </span>
          <span className="flex items-center gap-1.5 text-ink-faint">
            <Users className="h-3.5 w-3.5" />
            {facility.capacity}
          </span>
        </div>
      </div>
    </Link>
  );
}
