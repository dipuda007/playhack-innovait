import Image from "next/image";
import Link from "next/link";

/**
 * The hero.
 *
 * A full-bleed photograph of the campus, a charcoal scrim weighted to the left,
 * and the address sitting on a white card over it. This is the arrangement
 * every institution uses on its front page, and it works for one reason: the
 * photograph establishes *where* before a word is read, and the card gives
 * the type an opaque surface so nothing has to fight the image for contrast.
 *
 * The card is opaque white, not frosted. Glass over a dusk photograph fails
 * exactly where the picture is busiest, and this picture has a treeline.
 *
 * Under it, the day in three figures — set as one standing line on paper
 * rather than as three equal tiles, which is the arrangement that reads as
 * generated. It answers "is anything free right now" without scrolling.
 */
export function Hero({
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
    <section>
      <div className="relative isolate min-h-[30rem] overflow-hidden bg-ink lg:min-h-[34rem]">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/campus/tihor-lake.jpg"
            alt="The lake on the IIT Guwahati campus at dusk, with the academic blocks and the Brahmaputra hills behind it"
            fill
            priority
            sizes="100vw"
            className="halftone animate-ken-burns object-cover object-[50%_58%]"
          />
          <div className="absolute inset-0 scrim-ink" />
        </div>

        <div className="shell flex min-h-[30rem] items-center py-14 lg:min-h-[34rem]">
          <div className="animate-rise w-full max-w-[36rem] rounded-sm bg-paper p-6 shadow-[var(--shadow-panel)] sm:p-10">
            <p className="kicker kicker-signal">Today · {dateLabel}</p>

            <h1 className="hed-xl mt-4 uppercase text-ink">{headline}</h1>

            <div className="animate-rule-draw mt-6 h-px w-full bg-rule" />

            <p className="standfirst mt-6">{standfirst}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#grid" className="btn btn-solid">
                See the grid
              </a>
              <Link href="/race" className="btn btn-signal">
                Watch 200 students race one slot
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/*
        The day, as a standing line rather than as three equal columns.

        Three evenly-spaced stat tiles is the most recognisable generated-page
        arrangement there is. The same facts set as one sentence, with the
        figure larger than its label and a brass hairline between clauses,
        read as something a person laid out.
      */}
      <div className="border-y border-rule bg-paper-2">
        <div className="shell flex flex-wrap items-baseline gap-x-7 gap-y-3 py-4">
          <p className="flex items-baseline gap-2">
            <span className="fig text-xl font-bold leading-none text-ink">
              {open}
            </span>
            <span className="text-[12px] uppercase tracking-[0.1em] text-ink-2">
              of {remaining} slots open now
            </span>
          </p>

          <span aria-hidden className="h-4 w-px bg-brass" />

          <p className="flex items-baseline gap-2">
            <span className="fig text-xl font-bold leading-none text-ink">
              {facilities}
            </span>
            <span className="text-[12px] uppercase tracking-[0.1em] text-ink-2">
              facilities listed
            </span>
          </p>

          <span aria-hidden className="h-4 w-px bg-brass" />

          <p className="flex items-baseline gap-2">
            <span className="fig text-xl font-bold leading-none text-signal">
              0
            </span>
            <span className="text-[12px] uppercase tracking-[0.1em] text-ink-2">
              overlapping bookings, ever
            </span>
          </p>

        </div>
      </div>

      {/* Picture credit, kept out of the photograph and off the stat line. */}
      <p className="shell py-2 text-[11px] text-ink-3">
        Above: the lake at IIT Guwahati. Photograph by Ganesh Mohan T, CC BY-SA
        4.0, via Wikimedia Commons.
      </p>
    </section>
  );
}
