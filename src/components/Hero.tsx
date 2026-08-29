import Image from "next/image";
import Link from "next/link";

/**
 * The hero.
 *
 * A full-bleed photograph of the campus, a navy scrim weighted to the left,
 * and the address sitting on a white card over it. This is the arrangement
 * every institution uses on its front page, and it works for one reason: the
 * photograph establishes *where* before a word is read, and the card gives
 * the type an opaque surface so nothing has to fight the image for contrast.
 *
 * The card is opaque white, not frosted. Glass over a dusk photograph fails
 * exactly where the picture is busiest, and this picture has a treeline.
 *
 * Under it, the day in three figures on a navy band — the same band the
 * reference design uses to bridge the hero and the content, and a useful
 * place to answer "is anything free right now" without scrolling.
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
  const takenShare = remaining > 0 ? (remaining - open) / remaining : 1;

  return (
    <section>
      <div className="relative isolate min-h-[30rem] overflow-hidden bg-navy lg:min-h-[34rem]">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/campus/tihor-lake.jpg"
            alt="The lake on the IIT Guwahati campus at dusk, with the academic blocks and the Brahmaputra hills behind it"
            fill
            priority
            sizes="100vw"
            className="halftone animate-ken-burns object-cover object-[50%_58%]"
          />
          <div className="absolute inset-0 scrim-navy" />
        </div>

        <div className="shell flex min-h-[30rem] items-center py-14 lg:min-h-[34rem]">
          <div className="animate-rise w-full max-w-[36rem] rounded-xl bg-paper p-6 shadow-[var(--shadow-panel)] sm:p-10">
            <p className="kicker kicker-signal">Today · {dateLabel}</p>

            <h1 className="hed-xl mt-4 uppercase text-burgundy">{headline}</h1>

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

      {/* The day, in three numbers. */}
      <div className="border-b border-navy-2 bg-navy text-white">
        <div className="shell grid gap-6 py-5 md:grid-cols-3 md:items-center">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em]">
              Open now: <span className="fig">{open}</span> of{" "}
              <span className="fig">{remaining}</span>
            </p>
            {/*
              The bar fills with what is *gone*, not with what is left. A
              student reads a full bar as "too late", which is the correct
              alarm; a bar that empties as the day fills reads backwards.
            */}
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20"
              role="img"
              aria-label={`${remaining - open} of ${remaining} remaining slots already taken`}
            >
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${Math.round(takenShare * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-[12px] font-bold uppercase tracking-[0.12em] md:text-center">
            Facilities listed: <span className="fig">{facilities}</span>
          </p>

          <p className="text-[12px] font-bold uppercase tracking-[0.12em] md:text-right">
            Overlapping bookings: <span className="fig text-gold">0</span>
          </p>
        </div>
      </div>

      {/* Picture credit, kept out of the photograph and off the navy band. */}
      <p className="shell py-2 text-[11px] text-ink-3">
        Above: the lake at IIT Guwahati. Photograph by Ganesh Mohan T, CC BY-SA
        4.0, via Wikimedia Commons.
      </p>
    </section>
  );
}
