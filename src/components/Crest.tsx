/* eslint-disable @next/next/no-img-element */

/**
 * The IIT Guwahati emblem.
 *
 * The mark itself is the institute's registered emblem, taken from IIT
 * Guwahati's own published material. It is **copyrighted and non-free** — it
 * is not covered by this repository's MIT licence, and it is reproduced here
 * to identify the campus this project serves, not to imply that the institute
 * endorses or operates the service. See NOTICE and public/brand/CREDITS.md.
 *
 * It sits on a white disc rather than directly on the charcoal bar because
 * the emblem is drawn largely in near-black (#231f20), which disappears
 * against a dark ground. The disc is how the institute's own material sets
 * it on dark grounds.
 *
 * A plain <img> rather than next/image: the source is a static SVG, so there
 * is nothing for the optimiser to resize, and routing it through /_next/image
 * would need `dangerouslyAllowSVG`, which relaxes a setting that exists for
 * good reason.
 */
export function Crest({
  className = "h-10 w-10",
  title = "Indian Institute of Technology Guwahati",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-white ${className}`}
    >
      <img
        src="/brand/iitg-logo.svg"
        alt={title}
        width={40}
        height={40}
        className="h-[82%] w-[82%] object-contain"
      />
    </span>
  );
}
