"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Motion primitives.
 *
 * Two rules hold everything together:
 *
 * 1. **One curve.** [0.16, 1, 0.3, 1] — quick departure, long settle. Every
 *    transition in the product uses it, which is most of why separately built
 *    screens feel like one thing.
 * 2. **Motion is never the only carrier.** With `prefers-reduced-motion` on,
 *    each of these collapses to a plain render: nothing fades in from nothing,
 *    so no information is gated behind an animation the user turned off.
 */
const EASE = [0.16, 1, 0.3, 1] as const;

/** Entrance for a section: rises and fades once, when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0, y }}
      whileInView={still ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container for a staggered list. Children stagger 40ms apart — inside the
 * 30–50ms band where a grid reads as *arriving* rather than as lagging.
 */
export function Stagger({
  children,
  className,
  delay = 0,
  step = 0.04,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  step?: number;
}) {
  const still = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: still ? 0 : step, delayChildren: delay } },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** One item inside a `Stagger`. */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const still = useReducedMotion();
  const variants: Variants = {
    hidden: still ? {} : { opacity: 0, y: 16, scale: 0.985 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: EASE },
    },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

export { EASE };
