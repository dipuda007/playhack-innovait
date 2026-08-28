import Image from "next/image";
import Link from "next/link";

/**
 * The lead.
 *
 * Broadsheet front pages put the headline in a wide left column, the picture
 * beside it, and the numbers that support the story in a ruled box under the
 * fold line. Nothing floats and nothing overlaps the photograph: the picture
 * is a picture, the type is type, and a rule separates them.
 *
 * The photograph is the real campus — Tihor lake, from Wikimedia Commons
 * under CC BY-SA 4.0 — printed as halftone, which is to say greyscale and
 * contrasty. Colour in the photo would be the loudest thing on a page whose
 * only accent is vermilion, and it would compete with the one word that is
 * allowed to be red.
 */
export function LeadStory({
  headline,
  standfirst,
  dateLabel,
  open,
  remaining,
  facilities,
}: {
  headline: string;
  standfirst: string;
  dateLabel: string;
  open: number;
  remaining: number;
  facilities: number;
}) {
  return (
    <section className="border-b-2 border-ink pb-8 pt-8">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        {/* Column one — the story */}
        <div className="flex flex-col">
          <p className="kicker kicker-signal">Today · {dateLabel}</p>

          <h2 className="hed-xl mt-4 font-display uppercase">{headline}</h2>

          <div className="mt-5 h-px w-24 bg-ink" />

          <p className="standfirst mt-5 max-w-[46ch]">{standfirst}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#index" className="btn btn-solid">
              See the grid
            </a>
            <Link href="/race" className="btn btn-outline">
              Watch 200 students race one slot
            </Link>
          </div>

          {/* The supporting numbers, ruled like a results table. */}
          <dl className="mt-auto grid grid-cols-3 border-t border-rule pt-5">
            <Figure value={open} label={`open now of ${remaining}`} accent />
            <Figure value={facilities} label="facilities listed" />
            <Figure value={0} label="overlapping bookings, ever" />
          </dl>
        </div>

        {/* Column two — the picture */}
        <figure className="flex flex-col">
          <div className="relative aspect-[4/3] w-full border border-ink lg:aspect-auto lg:flex-1">
            <Image
              src="/campus/tihor-lake.jpg"
              alt="Tihor lake on the IIT Guwahati campus at dusk, with the Brahmaputra hills behind"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="halftone object-cover object-[50%_45%]"
            />
          </div>
          <figcaption className="mt-2 flex items-start justify-between gap-4 text-[11px] leading-tight text-ink-3">
            <span className="max-w-[42ch]">
              <strong className="font-semibold text-ink-2">Tihor lake.</strong>{" "}
              Eleven courts, one pool and a track sit within ten minutes&apos;
              walk of the hostels — and all of them fill at six.
            </span>
            <span className="shrink-0 font-mono uppercase tracking-wider">
              Ganesh Mohan T · CC BY-SA
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Figure({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="border-r border-rule pr-3 last:border-r-0">
      <dd
        className={`fig text-[clamp(1.75rem,3.4vw,2.75rem)] font-bold leading-none ${
          accent ? "text-signal" : "text-ink"
        }`}
      >
        {String(value).padStart(2, "0")}
      </dd>
      <dt className="mt-1.5 max-w-[16ch] text-[11px] leading-tight text-ink-3">
        {label}
      </dt>
    </div>
  );
}
