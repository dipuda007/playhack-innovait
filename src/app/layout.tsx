import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Masthead } from "@/components/Masthead";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/Reveal";
import { currentUserOrDemo } from "@/lib/session";
import { sql } from "@/db/client";

/*
 * Three faces:
 *
 *   Playfair Display  headings and the wordmark — the institutional serif
 *   Inter             everything a reader reads or clicks
 *   JetBrains Mono    times, counts, SQL — anything that must line up
 */
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-playfair",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
  themeColor: "#002147",
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
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:font-medium focus:text-white"
        >
          Skip to content
        </a>

        <Reveal />
        <Masthead user={user} roster={roster} />

        {/*
          No measure here. The hero and the statistics band run full-bleed to
          the window edge; everything inside a page opts back in with .shell.
        */}
        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
