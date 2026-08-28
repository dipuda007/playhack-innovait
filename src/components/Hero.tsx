"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ShieldCheck, Zap } from "lucide-react";
import { EASE } from "@/components/Motion";

/**
 * The hero.
 *
 * The photograph is the real campus — Tihor lake with the Brahmaputra hills
 * behind it, from Wikimedia Commons under CC BY-SA 4.0, credited in the
 * corner and in `public/campus/CREDITS.md`. A student should recognise where
 * they are before they read a word, which no illustration was going to do.
 *
 * The image is graded rather than used raw: darkened, pulled toward the indigo
 * ground, and dissolved into the page at the bottom, so it reads as the *room*
 * the interface is lit in rather than as a picture pasted behind it. Four
 * stacked layers do it, in this order — multiply to knock it back, a hue wash
 * for the grade, one warm kicker on the empty side, then a diagonal reading
 * scrim that is dark under the words and clear over the water.
 */
export function Hero({
  greeting,
  headline,
  sub,
  freeNow,
  facilities,
  dayLabel,
}: {
  greeting: string;
  headline: string;
  sub: string;
  freeNow: number;
  facilities: number;
  dayLabel: string;
}) {
  const still = useReducedMotion();

  return (
    <section className="bleed relative isolate -mt-6 overflow-hidden">
      <div className="relative h-[clamp(24rem,54vh,31rem)] w-full">
        <motion.div
          className="absolute inset-0"
          initial={still ? false : { scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        >
          <Image
            src="/campus/tihor-lake.jpg"
            alt="Tihor lake on the IIT Guwahati campus at dusk, with the Brahmaputra hills behind"
            fill
            priority
            sizes="100vw"
            /* Dusk light is flat by nature; a little contrast makes the
               hills read as hills rather than as a grey band. */
            className="object-cover object-[50%_42%] contrast-[1.18] saturate-[0.9] brightness-[1.06]"
          />
        </motion.div>

        {/* 1 — knock the photo back and cool it toward the indigo ground. */}
        <div className="absolute inset-0 bg-void/25 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_20%_15%,rgba(76,29,149,0.55),transparent_70%)] mix-blend-color" />
        {/* 2 — one warm kicker on the far side, so it is not a flat wash. */}
        <div className="absolute inset-0 bg-[radial-gradient(45%_45%_at_92%_72%,rgba(249,115,22,0.16),transparent_65%)] mix-blend-screen" />
        {/* 3 — reading scrim: dark where the words are, clear where they aren't. */}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,4,14,0.88)_0%,rgba(5,4,14,0.6)_32%,rgba(5,4,14,0.08)_62%,transparent_88%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,14,0.4)_0%,transparent_26%,rgba(10,8,24,0.62)_80%,var(--color-ground)_100%)]" />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
            <motion.p
              className="eyebrow drop-shadow-[0_1px_8px_rgba(5,4,14,0.9)]"
              initial={still ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
            >
              {greeting}
            </motion.p>

            <motion.h1
              className="display text-lit mt-3 max-w-[18ch] text-[clamp(2.4rem,6vw,4.25rem)]"
              initial={still ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: EASE, delay: 0.22 }}
            >
              {headline}
            </motion.h1>

            <motion.p
              className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-dim sm:text-base"
              initial={still ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
            >
              {sub}
            </motion.p>

            <motion.div
              className="mt-7 flex flex-wrap items-center gap-2.5"
              initial={still ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.38 }}
            >
              <a href="#courts" className="btn-primary px-5 py-2.5 text-sm">
                <ArrowDown className="h-4 w-4" />
                {freeNow > 0
                  ? `${freeNow} open ${freeNow === 1 ? "slot" : "slots"} · ${dayLabel}`
                  : `Browse ${facilities} facilities`}
              </a>
              <Link href="/race" className="btn-ghost px-5 py-2.5 text-sm">
                <Zap className="h-4 w-4 text-flame" />
                Watch 200 students race one slot
              </Link>
            </motion.div>
          </div>
        </div>

        {/*
          Attribution sits on the image, per CC BY-SA. Small, but present
          without a click — the licence is not satisfied by a buried file.
        */}
        <p className="absolute bottom-2 right-3 font-mono text-[9px] tracking-wide text-ink-faint/80 mix-blend-plus-lighter">
          Tihor lake, IIT Guwahati · Ganesh Mohan T · CC BY-SA 4.0
        </p>
      </div>

      {/* The invariant, stated once, where it cannot be missed. */}
      <motion.div
        className="mx-auto mt-5 flex w-full max-w-7xl items-start gap-2.5 px-4 sm:px-6"
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
      >
        <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-go" />
        <p className="max-w-[76ch] text-xs leading-relaxed text-ink-faint">
          Every confirmation on this page is enforced by one Postgres exclusion
          constraint. Two students cannot hold the same court at the same time,
          under any load.
        </p>
      </motion.div>
    </section>
  );
}
