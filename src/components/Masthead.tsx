"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/", label: "Book", index: "01" },
  { href: "/bookings", label: "My bookings", index: "02" },
  { href: "/race", label: "Race", index: "03" },
  { href: "/fair", label: "Fair draw", index: "04" },
  { href: "/analytics", label: "Insights", index: "05" },
  { href: "/ops", label: "Ops", index: "06" },
];

/**
 * The masthead.
 *
 * A newspaper puts its name once, at full size, with the date and edition
 * lines beside it, and rules the whole thing off from the page below. That is
 * a stronger orientation cue than a sticky bar of links, and it costs nothing
 * to scroll past — so the title block does not stick, and only the navigation
 * strip does.
 */
export function Masthead({
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
  const [clock, setClock] = useState<string>("");

  /*
   * The edition line, in IST.
   *
   * Rendered only after mount: the server and the reader's machine will not
   * agree on the minute, and a hydration mismatch on the masthead is a
   * spectacular way to fail. Empty until it is certain.
   */
  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
    <header>
      {/* Edition line */}
      <div className="border-b border-rule">
        <div className="mx-auto flex max-w-[86rem] items-center justify-between gap-4 px-5 py-2 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            IIT Guwahati · Sports Board × Tech Board
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            <span className="hidden sm:inline">{today} · </span>
            {clock ? `${clock} IST` : "—"}
          </p>
        </div>
      </div>

      {/* Title block */}
      <div className="mx-auto max-w-[86rem] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 py-6 sm:py-8">
          <Link href="/" className="group block">
            <h1 className="font-display text-[clamp(2.5rem,7vw,5.25rem)] leading-[0.82] tracking-[-0.045em]">
              PLAY<span className="text-signal">HACK</span>
            </h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-3">
              Campus facility booking
            </p>
          </Link>

          <div className="flex items-end gap-6 pb-1">
            <dl className="hidden text-right sm:block">
              <dt className="kicker">Reading as</dt>
              <dd className="mt-1 font-display text-lg leading-none">
                {user?.name ?? "Guest"}
              </dd>
            </dl>

            {/*
              An identity switcher, not a login screen. Racing two students
              against one slot is the point of the demo, and a judge should be
              able to do it in two clicks rather than in two browser profiles.
            */}
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                disabled={pending}
                className="btn btn-outline px-3 py-2 text-[11px]"
                aria-haspopup="listbox"
                aria-expanded={open}
              >
                Switch reader
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
                    className="animate-ink-in absolute right-0 z-50 mt-1 max-h-[70vh] w-72 overflow-y-auto border border-ink bg-paper"
                  >
                    <p className="kicker border-b border-rule px-3 py-2">
                      {roster.length} readers on file
                    </p>
                    {roster.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => switchTo(r.id)}
                        role="option"
                        aria-selected={r.id === user?.id}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-rule px-3 py-2 text-left text-sm transition-colors last:border-b-0",
                          r.id === user?.id
                            ? "bg-ink text-paper"
                            : "hover:bg-paper-2",
                        )}
                      >
                        <span className="truncate">{r.name}</span>
                        {r.role !== "student" && (
                          <span className="tag ml-auto shrink-0 text-signal">
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
      </div>

      {/*
        Navigation as a ruled strip of numbered sections, the way a paper
        indexes itself. Sticky, because it is the only part worth keeping on
        screen once the reader is scrolling.
      */}
      <nav className="sticky top-0 z-30 border-y-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-[86rem] items-stretch overflow-x-auto px-5 sm:px-8">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex shrink-0 items-baseline gap-2 border-r border-rule px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors first:pl-0 last:border-r-0",
                  active
                    ? "bg-ink text-paper first:pl-4"
                    : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[9px] tracking-normal",
                    active ? "text-paper/60" : "text-ink-3",
                  )}
                >
                  {item.index}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
