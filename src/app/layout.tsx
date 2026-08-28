import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { currentUserOrDemo } from "@/lib/session";
import { sql } from "@/db/client";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlayHack · IIT Guwahati Sports Booking",
  description:
    "Book campus sports facilities with a booking engine that cannot double-book. Built by Team InnovAIT for PlayHack, IIT Guwahati.",
};

export const viewport: Viewport = {
  themeColor: "#0d0a1f",
  width: "device-width",
  initialScale: 1,
};

/**
 * The shell must render without a database.
 *
 * Next statically generates the 404 page, which pulls in this layout, so a
 * throwing query here fails the whole build on any machine that has no
 * DATABASE_URL — a CI run, or a judge cloning the repo to read it. The chrome
 * has no business being the reason a build fails; pages that genuinely need
 * data fail on their own, where the error is actionable.
 */
async function loadShell() {
  try {
    const [user, roster] = await Promise.all([
      currentUserOrDemo(),
      sql<{ id: string; name: string; role: string }[]>`
        SELECT id, name, role FROM users ORDER BY role DESC, name LIMIT 45
      `,
    ]);
    return { user, roster };
  } catch {
    return { user: null, roster: [] as { id: string; name: string; role: string }[] };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, roster } = await loadShell();

  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      {/*
        overflow-x-clip, not hidden: full-bleed sections are laid out with
        100vw, which is a scrollbar wider than the content box. `hidden` would
        also make the sticky header stop sticking in some browsers; `clip`
        leaves position: sticky alone.
      */}
      <body className="min-h-screen overflow-x-clip">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-flame focus:px-4 focus:py-2 focus:font-medium focus:text-void"
        >
          Skip to content
        </a>
        <TopBar user={user} roster={roster} />
        <main
          id="main"
          className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6"
        >
          {children}
        </main>
        <footer className="relative mt-10 border-t border-line-soft">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-10 text-center sm:px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
              PlayHack · SDE Track · Team InnovAIT
            </p>
            <p className="max-w-2xl text-xs leading-relaxed text-ink-faint">
              One invariant, enforced by Postgres:{" "}
              <code className="font-mono text-violet-soft">
                EXCLUDE USING gist (facility_id WITH =, during WITH &amp;&amp;)
              </code>
            </p>
            <p className="text-[11px] text-ink-faint/70">
              Campus photography from Wikimedia Commons — Tihor lake by Ganesh
              Mohan T (CC BY-SA 4.0), academic complex by Satyadeep Karnati
              (public domain).
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
