"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Activity, BarChart3, CalendarCheck, ChevronDown, Dices, LayoutGrid,
  Wrench, Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE } from "@/components/Motion";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/", label: "Book", icon: LayoutGrid },
  { href: "/bookings", label: "My bookings", icon: CalendarCheck },
  { href: "/race", label: "Race demo", icon: Activity },
  { href: "/fair", label: "Fair draw", icon: Dices },
  { href: "/analytics", label: "Insights", icon: BarChart3 },
  { href: "/ops", label: "Ops", icon: Wrench },
];

export function TopBar({
  user,
  roster,
}: {
  user: SessionUser | null;
  roster: { id: string; name: string; role: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const still = useReducedMotion();

  async function switchTo(id: string) {
    setOpen(false);
    await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    startTransition(() => router.refresh());
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft/80 bg-ground/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-b from-flame-soft to-flame shadow-[0_6px_18px_-8px_var(--color-flame)] transition-transform duration-300 group-hover:scale-105">
            <Zap className="h-4 w-4 text-void" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Play<span className="text-flame">Hack</span>
          </span>
        </Link>

        {/*
          The active pill is one shared element that slides between items
          (layoutId), rather than a class that blinks on and off. It is the
          difference between navigation that moves and navigation that cuts.
        */}
        <nav className="ml-3 hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm transition-colors duration-200",
                  active ? "text-ink" : "text-ink-dim hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-lg border border-line bg-raised/80"
                    transition={
                      still
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 380, damping: 32 }
                    }
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/*
            An identity switcher, not a login screen. Racing two students
            against one slot is the point of the demo, and a judge should be
            able to do it in two clicks rather than in two browser profiles.
          */}
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              disabled={pending}
              className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-2.5 py-1.5 text-sm transition-all duration-200 hover:border-violet/60 hover:bg-violet/10 disabled:opacity-50"
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-b from-violet-soft to-violet-deep text-[11px] font-bold text-void">
                {user?.name?.[0] ?? "?"}
              </span>
              <span className="hidden max-w-[9rem] truncate sm:inline">
                {user?.name ?? "Sign in"}
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-ink-faint transition-transform duration-300",
                  open && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {open && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpen(false)}
                    aria-hidden
                  />
                  <motion.div
                    role="listbox"
                    initial={still ? false : { opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={still ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="absolute right-0 z-50 mt-2 max-h-[70vh] w-64 origin-top-right overflow-y-auto rounded-xl border border-line bg-surface-solid/95 p-1.5 shadow-2xl backdrop-blur-xl"
                  >
                    <p className="metric-label px-2 py-1.5">Switch identity</p>
                    {roster.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => switchTo(r.id)}
                        role="option"
                        aria-selected={r.id === user?.id}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150",
                          r.id === user?.id
                            ? "bg-violet/20 text-ink"
                            : "text-ink-dim hover:bg-raised",
                        )}
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-line text-[10px] font-bold">
                          {r.name[0]}
                        </span>
                        <span className="truncate">{r.name}</span>
                        {r.role !== "student" && (
                          <span className="ml-auto shrink-0 rounded bg-flame/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-flame">
                            {r.role}
                          </span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile nav — students book from phones, so this is not an afterthought. */}
      <nav className="flex gap-1 overflow-x-auto border-t border-line-soft/70 px-3 py-2 md:hidden">
        {NAV.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors duration-200",
                active
                  ? "border border-line bg-raised text-ink"
                  : "border border-transparent text-ink-dim",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
