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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUserOrDemo();
  const roster = await sql<{ id: string; name: string; role: string }[]>`
    SELECT id, name, role FROM users ORDER BY role DESC, name LIMIT 45
  `;

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
