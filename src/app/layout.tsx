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
      <body className="min-h-screen">
        <TopBar user={user} roster={roster} />
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-line-soft py-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
            PlayHack · SDE Track · Team InnovAIT
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            One invariant, enforced by Postgres:{" "}
            <code className="font-mono text-violet-soft">
              EXCLUDE USING gist (facility_id WITH =, during WITH &amp;&amp;)
            </code>
          </p>
        </footer>
      </body>
    </html>
  );
}
