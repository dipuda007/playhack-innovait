/**
 * Top-down court markings, drawn per sport.
 *
 * The alternative was stock photography, and stock photography is a lie that
 * gets caught: a judge who knows the SAC courts will notice immediately that
 * the picture is not of them. Court markings are the opposite — they are the
 * same everywhere, they are unmistakably *this* sport at a glance, and they
 * cost 2 KB instead of 200.
 *
 * Everything renders in `currentColor` so a card can tint its own artwork with
 * the facility's colour, and every viewBox is 240×140 so the whole set crops
 * identically inside a card.
 */

/**
 * `fit` decides what happens when the box is a different shape to the drawing.
 *
 * "meet" keeps the whole court in frame and letterboxes — right for a card,
 * where the shape is the thing being recognised. "meet-right" does the same
 * but pins the drawing to the right edge, for a wide banner where centring it
 * would leave the court adrift in the middle of empty space. "slice" fills
 * and crops, which suits a box close to the drawing's own 12:7.
 */
type ArtProps = { className?: string; fit?: "meet" | "meet-right" | "slice" };

const FIT = {
  meet: "xMidYMid meet",
  "meet-right": "xMaxYMid meet",
  slice: "xMidYMid slice",
} as const;

const VIEW = "0 0 240 140";

function Frame({
  className,
  fit = "meet",
  children,
}: ArtProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox={VIEW}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      vectorEffect="non-scaling-stroke"
      className={className}
      aria-hidden="true"
      preserveAspectRatio={FIT[fit]}
    >
      {children}
    </svg>
  );
}

/** Badminton — doubles court, net across the middle, service courts marked. */
const BadmintonCourt = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="30" y="18" width="180" height="104" />
    <path d="M30 34h180M30 106h180" opacity="0.55" />
    <path d="M120 10v120" strokeWidth={2} />
    <path d="M92 18v104M148 18v104" opacity="0.7" />
    <path d="M46 18v104M194 18v104" opacity="0.4" />
    <path d="M30 70h92M148 70h62" opacity="0.7" />
  </Frame>
);

/** Tennis — singles and doubles lines, service boxes, centre marks. */
const TennisCourt = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="24" y="14" width="192" height="112" />
    <path d="M24 28h192M24 112h192" opacity="0.55" />
    <path d="M120 8v124" strokeWidth={2} />
    <path d="M62 28v84M178 28v84" opacity="0.7" />
    <path d="M62 70h116" opacity="0.7" />
    <path d="M24 70h6M210 70h6" opacity="0.5" />
  </Frame>
);

/** Basketball — full court: keys, free-throw circles, three-point arcs. */
const BasketballCourt = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="16" y="16" width="208" height="108" rx="2" />
    <path d="M120 16v108" strokeWidth={1.6} />
    <circle cx="120" cy="70" r="20" />
    <rect x="16" y="48" width="42" height="44" opacity="0.8" />
    <rect x="182" y="48" width="42" height="44" opacity="0.8" />
    <circle cx="58" cy="70" r="14" opacity="0.7" />
    <circle cx="182" cy="70" r="14" opacity="0.7" />
    <path d="M16 30a56 56 0 0 1 0 80" opacity="0.6" />
    <path d="M224 30a56 56 0 0 0 0 80" opacity="0.6" />
    <path d="M22 62v16M218 62v16" strokeWidth={2.4} />
  </Frame>
);

/** Football — halfway line, centre circle, penalty and goal areas. */
const FootballPitch = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="14" y="14" width="212" height="112" />
    <path d="M120 14v112" />
    <circle cx="120" cy="70" r="22" />
    <circle cx="120" cy="70" r="2.4" fill="currentColor" stroke="none" />
    <rect x="14" y="38" width="34" height="64" opacity="0.8" />
    <rect x="192" y="38" width="34" height="64" opacity="0.8" />
    <rect x="14" y="54" width="14" height="32" opacity="0.6" />
    <rect x="212" y="54" width="14" height="32" opacity="0.6" />
    <path d="M14 22a8 8 0 0 0 8-8M226 22a8 8 0 0 1-8-8M14 118a8 8 0 0 1 8 8M226 118a8 8 0 0 0-8 8" opacity="0.5" />
  </Frame>
);

/** Cricket — boundary, thirty-yard circle, the strip in the middle. */
const CricketGround = (p: ArtProps) => (
  <Frame {...p}>
    <ellipse cx="120" cy="70" rx="108" ry="56" />
    <ellipse cx="120" cy="70" rx="66" ry="34" opacity="0.6" strokeDasharray="5 5" />
    <rect x="106" y="42" width="28" height="56" opacity="0.9" />
    <path d="M110 50h20M110 90h20" opacity="0.8" />
    <path d="M120 42v-6M120 98v6" opacity="0.5" />
  </Frame>
);

/** Volleyball — net down the middle, attack lines either side. */
const VolleyballCourt = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="34" y="20" width="172" height="100" />
    <path d="M120 8v124" strokeWidth={2} />
    <path d="M91 20v100M149 20v100" opacity="0.7" />
    <path d="M120 8h0" />
    <path d="M108 4h24M108 136h24" opacity="0.5" />
  </Frame>
);

/** Squash — front wall at the left, short line, service boxes. */
const SquashCourt = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="26" y="18" width="188" height="104" />
    <path d="M26 12v116" strokeWidth={2.6} />
    <path d="M132 18v104" opacity="0.8" />
    <path d="M132 70h82" opacity="0.8" />
    <rect x="132" y="18" width="34" height="34" opacity="0.65" />
    <rect x="132" y="88" width="34" height="34" opacity="0.65" />
    <path d="M26 40h10M26 100h10" opacity="0.5" />
  </Frame>
);

/** Table tennis — table, net, centre line for doubles. */
const TableTennisTable = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="30" y="26" width="180" height="88" rx="2" />
    <path d="M120 16v108" strokeWidth={2} />
    <path d="M30 70h180" opacity="0.6" />
    <path d="M120 16h-6M120 124h-6" opacity="0" />
    <path d="M46 114v12M194 114v12" opacity="0.45" />
  </Frame>
);

/** Swimming — lanes with the T marks at each end. */
const SwimmingPool = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="18" y="18" width="204" height="104" rx="3" />
    <path d="M18 38h204M18 58h204M18 78h204M18 98h204" opacity="0.55" />
    <path d="M40 18v104M200 18v104" opacity="0.4" />
    <path d="M30 28v8M30 48v8M30 68v8M30 88v8M30 108v8" opacity="0.5" />
    <path d="M210 28v8M210 48v8M210 68v8M210 88v8M210 108v8" opacity="0.5" />
  </Frame>
);

/** Athletics — the oval, lane lines, and the field inside it. */
const AthleticsTrack = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="12" y="16" width="216" height="108" rx="54" />
    <rect x="24" y="28" width="192" height="84" rx="42" opacity="0.75" />
    <rect x="36" y="40" width="168" height="60" rx="30" opacity="0.55" />
    <rect x="70" y="52" width="100" height="36" rx="4" opacity="0.45" />
    <path d="M120 16v12M120 112v12" opacity="0.6" />
  </Frame>
);

/** Gym — a floor plan, since a weights room has no court markings. */
const GymFloor = (p: ArtProps) => (
  <Frame {...p}>
    <rect x="16" y="16" width="208" height="108" rx="3" />
    <rect x="30" y="30" width="52" height="30" rx="3" opacity="0.75" />
    <rect x="30" y="72" width="52" height="30" rx="3" opacity="0.75" />
    <rect x="96" y="30" width="48" height="72" rx="3" opacity="0.6" />
    <path d="M104 46h32M104 58h32M104 70h32M104 82h32" opacity="0.5" />
    <circle cx="182" cy="52" r="16" opacity="0.7" />
    <circle cx="182" cy="52" r="6" opacity="0.5" />
    <rect x="158" y="82" width="48" height="20" rx="10" opacity="0.7" />
    <path d="M166 92h32" opacity="0.6" />
  </Frame>
);

const MAP: Record<string, (p: ArtProps) => React.JSX.Element> = {
  badminton: BadmintonCourt,
  tennis: TennisCourt,
  basketball: BasketballCourt,
  football: FootballPitch,
  cricket: CricketGround,
  volleyball: VolleyballCourt,
  squash: SquashCourt,
  "table tennis": TableTennisTable,
  swimming: SwimmingPool,
  athletics: AthleticsTrack,
  fitness: GymFloor,
};

export function CourtArt({
  sport,
  className,
  fit,
}: {
  sport: string;
  className?: string;
  fit?: "meet" | "meet-right" | "slice";
}) {
  const Art = MAP[sport.trim().toLowerCase()];
  if (!Art) return null;
  return <Art className={className} fit={fit} />;
}

export function hasCourtArt(sport: string) {
  return sport.trim().toLowerCase() in MAP;
}
