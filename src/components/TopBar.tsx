"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/", label: "Book" },
  { href: "/bookings", label: "My bookings" },
  { href: "/race", label: "Race demo" },
  { href: "/fair", label: "Fair draw" },
  { href: "/analytics", label: "Insights" },
  { href: "/ops", label: "Ops" },
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

  async function switchTo(id: string) {
    setOpen(false);
    await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-ground/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-flame">
            <Zap className="h-4 w-4 text-ground" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Play<span className="text-flame">Hack</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-raised text-ink"
                    : "text-ink-dim hover:bg-raised/60 hover:text-ink",
                )}
              >
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
              className="flex items-center gap-2 rounded-xl border border-line bg-raised/70 px-3 py-1.5 text-sm transition-colors hover:border-violet disabled:opacity-50"
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-violet text-[11px] font-bold text-ground">
                {user?.name?.[0] ?? "?"}
              </span>
              <span className="hidden max-w-[9rem] truncate sm:inline">
                {user?.name ?? "Sign in"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
            </button>

            {open && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpen(false)}
                  aria-hidden
                />
                <div
                  role="listbox"
                  className="absolute right-0 z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-line bg-surface-solid p-1.5 shadow-2xl"
                >
                  <p className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                    Switch identity
                  </p>
                  {roster.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => switchTo(r.id)}
                      role="option"
                      aria-selected={r.id === user?.id}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
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
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav — students book from phones, so this is not an afterthought. */}
      <nav className="flex gap-1 overflow-x-auto border-t border-line-soft px-3 py-2 md:hidden">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors",
                active ? "bg-raised text-ink" : "text-ink-dim",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
