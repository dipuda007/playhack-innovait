import Link from "next/link";
import { Crest } from "@/components/Crest";

const SECTIONS = [
  { href: "/", label: "Book a court" },
  { href: "/bookings", label: "My bookings" },
  { href: "/race", label: "Race simulator" },
  { href: "/fair", label: "Fair draw" },
  { href: "/analytics", label: "Insights" },
  { href: "/ops", label: "Operations" },
];

const REPO = "https://github.com/dipuda007/playhack-innovait";

/**
 * The colophon.
 *
 * Every link here goes somewhere. A footer full of dead "Privacy Policy /
 * Terms & Conditions / Careers" hrefs is the single loudest tell that a page
 * was generated rather than built, so this carries only what the project
 * actually has: its sections, its source, the constraint the whole thing
 * rests on, and the licences on the photographs.
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t-4 border-burgundy bg-navy text-white">
      <div className="shell grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <Crest className="h-10 w-10" />
            <span className="font-display text-xl font-bold">PlayHack</span>
          </div>
          <p className="mt-4 max-w-[36ch] text-[13px] leading-relaxed text-white/70">
            Sports facility booking for the IIT Guwahati campus. Built for the
            PlayHack SDE track by Team InnovAIT.
          </p>
          <p className="mt-4 text-[12px] text-white/45">
            An independent student project. Not an official service of the
            institute.
          </p>
        </div>

        <nav className="lg:col-span-1">
          <h3 className="font-display text-lg font-bold">Sections</h3>
          <div className="gold-rule mt-2.5" />
          <ul className="mt-4 space-y-2.5">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="text-[13px] text-white/75 transition-colors duration-200 hover:text-gold"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-1">
          <h3 className="font-display text-lg font-bold">The guarantee</h3>
          <div className="gold-rule mt-2.5" />
          <p className="mt-4 text-[13px] leading-relaxed text-white/70">
            Two students cannot hold the same court at the same time. Not
            because the code checks, but because the database refuses:
          </p>
          <code className="mt-3 block overflow-x-auto whitespace-pre rounded-md bg-black/25 p-3 font-mono text-[11px] leading-relaxed text-gold">
{`EXCLUDE USING gist (
  facility_id WITH =,
  during      WITH &&
) WHERE (status = 'confirmed')`}
          </code>
        </div>

        <div className="lg:col-span-1">
          <h3 className="font-display text-lg font-bold">Credits</h3>
          <div className="gold-rule mt-2.5" />
          <p className="mt-4 text-[12px] leading-relaxed text-white/60">
            Campus photography via Wikimedia Commons. The lake, by Ganesh Mohan
            T, under CC BY-SA 4.0. The academic complex, by Satyadeep Karnati,
            public domain.
          </p>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/80 transition-colors duration-200 hover:text-gold"
          >
            Source on GitHub
            <span aria-hidden>↗</span>
          </a>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="shell py-5 text-center text-[11px] uppercase tracking-[0.14em] text-white/45">
          PlayHack · SDE Track · Team InnovAIT · IIT Guwahati
        </p>
      </div>
    </footer>
  );
}
