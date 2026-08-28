/**
 * Sport glyphs.
 *
 * Lucide has no badminton, cricket, squash or table-tennis icon, and the
 * near-misses are worse than useless — a target standing in for cricket tells
 * a student nothing. Emoji were the previous answer and are the wrong one:
 * they render differently on every OS, ignore the palette, and cannot take a
 * stroke weight, so a grid of them never looks like one design.
 *
 * These are drawn on the same 24×24 grid as Lucide with the same 1.75 stroke
 * and round caps, so they sit beside `MapPin` and `Clock` without a seam.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Shuttlecock: cork nose, feather skirt. */
const Badminton = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7.8 16.2a3.1 3.1 0 1 0 4.4-4.4" />
    <path d="M12.2 11.8 19 5" />
    <path d="M13.6 10.4 15 4.6l4.4-.9-.9 4.4-5.8 1.4" />
    <path d="M10.6 13.4 6.2 12l-1.6 4 4-1.6" />
    <path d="M4.6 19.4 7.8 16.2" />
  </Glyph>
);

/** Tennis ball: the two seams, not a generic circle. */
const Tennis = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M4.2 9.2c3.6.5 6.2 3.2 6.6 6.9" />
    <path d="M19.8 14.8c-3.6-.5-6.2-3.2-6.6-6.9" />
  </Glyph>
);

/** Basketball: circle with the four-panel seam. */
const Basketball = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 3.6v16.8" />
    <path d="M3.6 12h16.8" />
    <path d="M6.1 6.1c3 3 3 8.8 0 11.8" />
    <path d="M17.9 6.1c-3 3-3 8.8 0 11.8" />
  </Glyph>
);

/** Football: circle with the centre pentagon. */
const Football = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="m12 7.6 3.6 2.6-1.4 4.3h-4.4L8.4 10.2 12 7.6Z" />
    <path d="M12 3.6v4M15.6 10.2l3.9-1.3M14.2 14.5l2.4 3.2M9.8 14.5l-2.4 3.2M8.4 10.2 4.5 8.9" />
  </Glyph>
);

/** Cricket: stumps and bails, the least ambiguous silhouette in the sport. */
const Cricket = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M8 8.5v11M12 8.5v11M16 8.5v11" />
    <path d="M6.6 7.2h4.8M12.6 7.2h4.8" />
    <circle cx="18.6" cy="4.6" r="1.9" />
  </Glyph>
);

/** Volleyball: circle with the three-panel curve. */
const Volleyball = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 3.6c-3 4.3-3 12.5 0 16.8" />
    <path d="M4.3 9.1c4.8 1.4 10.4 5.4 12.8 9.6" />
    <path d="M19.7 9.1c-4.8 1.4-10.4 5.4-12.8 9.6" />
  </Glyph>
);

/** Squash: racket with a strung face and the small ball. */
const Squash = (p: IconProps) => (
  <Glyph {...p}>
    <ellipse cx="9.6" cy="8.6" rx="5" ry="6" transform="rotate(-32 9.6 8.6)" />
    <path d="M6.4 13.6 3.4 20.4" />
    <path d="M7 5.8 12.6 11M6 9.4l5.2 4.6" />
    <circle cx="18.4" cy="16.6" r="2.2" />
  </Glyph>
);

/** Table tennis: paddle and ball. */
const TableTennis = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M14.6 4.2a5.6 5.6 0 0 0-7.9 7.9l4.4 4.4a1.6 1.6 0 0 0 2.3 0l3.6-3.6a5.6 5.6 0 0 0-2.4-8.7Z" />
    <path d="m10.2 16.4-3.9 3.9" />
    <circle cx="19.4" cy="18.4" r="1.9" />
  </Glyph>
);

/** Swimming: swimmer's head and arm over lane water. */
const Swimming = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="15.4" cy="6.4" r="2" />
    <path d="M3.4 11.6 8 9.2l4.2 3.2 3.6-1.6" />
    <path d="M2.6 16.2c1.6 0 1.6 1.4 3.2 1.4s1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4" />
    <path d="M2.6 20.2c1.6 0 1.6 1.4 3.2 1.4" opacity="0.55" />
  </Glyph>
);

/** Fitness: dumbbell. */
const Fitness = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 9v6M7 7v10M17 7v10M20 9v6" />
    <path d="M7 12h10" />
  </Glyph>
);

/** Athletics: the track itself — two bends, lane inside. */
const Athletics = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="2.4" y="6.6" width="19.2" height="10.8" rx="5.4" />
    <rect x="5.8" y="9.6" width="12.4" height="4.8" rx="2.4" />
    <path d="M12 6.6v2.9M12 14.4v3" />
  </Glyph>
);

const MAP = {
  badminton: Badminton,
  tennis: Tennis,
  basketball: Basketball,
  football: Football,
  cricket: Cricket,
  volleyball: Volleyball,
  squash: Squash,
  "table tennis": TableTennis,
  swimming: Swimming,
  fitness: Fitness,
  athletics: Athletics,
} as const;

export type SportKey = keyof typeof MAP;

export function sportKey(sport: string): SportKey | null {
  const k = sport.trim().toLowerCase();
  return k in MAP ? (k as SportKey) : null;
}

/**
 * `sport` is the free-text column from `facilities`, so an unknown value has
 * to render as *something* — a neutral ring rather than a gap in the grid.
 */
export function SportIcon({
  sport,
  size = 24,
  className,
}: {
  sport: string;
  size?: number;
  className?: string;
}) {
  const key = sportKey(sport);
  if (!key) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        className={className}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8.4" />
      </svg>
    );
  }
  const Component = MAP[key];
  return <Component size={size} className={className} />;
}
