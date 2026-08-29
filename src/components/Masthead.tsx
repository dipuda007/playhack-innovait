"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Crest } from "@/components/Crest";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/session";

const NAV = [
  { href: "/", label: "Book" },
  { href: "/bookings", label: "My bookings" },
  { href: "/race", label: "Race" },
  { href: "/fair", label: "Fair draw" },
  { href: "/analytics", label: "Insights" },
  { href: "/ops", label: "Ops" },
];

/**
 * The header.
 *
 * Two bands, the way an institution presents itself: a thin utility strip
 * naming the body that runs the service, and under it the charcoal bar that
 * carries the seal, the sections, and who you are reading as. Only the charcoal
 * bar sticks — the utility strip has said its piece by the time you scroll.
 *
 * The bar gains a shadow once the page has moved. That is the only cue that
 * distinguishes "pinned over content" from "sitting at the top", and without
 * it a sticky header on a white page looks like a rendering bug.
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
  const [menu, setMenu] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clock, setClock] = useState<string>("");
  const switcher = useRef<HTMLDivElement>(null);

  /*
   * The IST clock renders only after mount: the server and the reader will
   * not agree on the minute, and a hydration mismatch in the header is a
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

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Both overlays close on Escape, and the mobile menu closes on navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMenu(false);
    setOpen(false);
  }, [pathname]);

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
    <header className="sticky top-0 z-50">
      {/* Utility strip. Who runs this, and what time it is where the courts are. */}
      <div className="hidden bg-[#171512] text-white/70 md:block">
        <div className="shell flex items-center justify-between py-1.5">
          <p className="text-[11px] tracking-[0.1em]">
            Indian Institute of Technology Guwahati
            <span className="mx-2 text-white/25">|</span>
            Students&apos; Sports Board
          </p>
          <p className="fig text-[11px] tracking-[0.08em]">
            {clock ? `${clock} IST` : " "}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "bg-ink text-white transition-shadow duration-300",
          stuck && "shadow-[0_10px_30px_-12px_rgb(0_0_0/0.55)]",
        )}
      >
        <div className="shell flex items-center justify-between gap-4 py-3">
          {/* Seal and wordmark */}
          <Link href="/" className="group flex items-center gap-3">
            <Crest className="h-10 w-10 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
            <span className="leading-none">
              <span className="block font-display text-xl font-bold tracking-[0.02em]">
                PLAYHACK
              </span>
              <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:block">
                Campus facility booking
              </span>
            </span>
          </Link>

          {/* Sections */}
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("navlink", active && "navlink-active")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/*
              An identity switcher, not a login screen. Racing two students
              against one slot is the point of the demo, and a judge should be
              able to do it in two clicks rather than in two browser profiles.
            */}
            <div
              ref={switcher}
              className="relative hidden items-center gap-3 border-l border-white/15 pl-5 sm:flex"
            >
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12 font-display text-sm font-bold"
              >
                {(user?.name ?? "G").charAt(0)}
              </span>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/50">
                  Reading as
                </p>
                <p className="text-sm font-semibold leading-tight">
                  {user?.name ?? "Guest"}
                </p>
                <button
                  onClick={() => setOpen((v) => !v)}
                  disabled={pending}
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  className="mt-1 rounded-sm bg-rust px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white transition-colors duration-200 hover:bg-rust-2 disabled:opacity-50"
                >
                  Switch reader
                </button>
              </div>

              {open && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="listbox"
                    className="animate-ink-in absolute right-0 top-full z-50 mt-3 max-h-[70vh] w-72 overflow-y-auto rounded-lg border border-rule bg-paper text-ink shadow-[var(--shadow-panel)]"
                  >
                    <p className="kicker sticky top-0 border-b border-rule bg-paper px-3 py-2.5">
                      {roster.length} readers on file
                    </p>
                    {roster.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => switchTo(r.id)}
                        role="option"
                        aria-selected={r.id === user?.id}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-rule px-3 py-2.5 text-left text-sm transition-colors duration-150 last:border-b-0",
                          r.id === user?.id
                            ? "bg-ink text-white"
                            : "hover:bg-paper-2",
                        )}
                      >
                        <span className="truncate">{r.name}</span>
                        {r.role !== "student" && (
                          <span
                            className={cn(
                              "tag ml-auto shrink-0",
                              r.id === user?.id
                                ? "border-white/25 bg-white/15 text-white"
                                : "text-signal",
                            )}
                          >
                            {r.role}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-controls="mobile-nav"
              className="grid h-10 w-10 place-items-center rounded-md transition-colors duration-200 hover:bg-white/10 lg:hidden"
            >
              <span className="sr-only">
                {menu ? "Close menu" : "Open menu"}
              </span>
              <span aria-hidden className="relative block h-4 w-5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "absolute left-0 block h-0.5 w-full rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      i === 0 && (menu ? "top-1/2 rotate-45" : "top-0"),
                      i === 1 &&
                        (menu ? "top-1/2 opacity-0" : "top-1/2 -translate-y-1/2"),
                      i === 2 && (menu ? "top-1/2 -rotate-45" : "top-full -translate-y-full"),
                    )}
                  />
                ))}
              </span>
            </button>
          </div>
        </div>

        {/*
          The mobile drawer animates on grid-template-rows rather than on
          height, so it does not need a measured pixel value and cannot get
          the height wrong when the roster is long.
        */}
        <div
          id="mobile-nav"
          className={cn(
            "grid overflow-hidden transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden",
            menu ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0">
            <nav className="shell flex flex-col gap-1 border-t border-white/10 py-3">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] transition-colors duration-200",
                      active
                        ? "bg-rust text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <p className="mt-3 border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.16em] text-white/50">
                Reading as {user?.name ?? "Guest"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {roster.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => switchTo(r.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] transition-colors duration-200",
                      r.id === user?.id
                        ? "bg-white text-ink"
                        : "bg-white/10 text-white/80 hover:bg-white/20",
                    )}
                  >
                    {r.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
