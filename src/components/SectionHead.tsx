/**
 * A section head.
 *
 * Heavy rule, number, name, and a one-line note in the right column — the
 * standing furniture a paper uses to tell you which section you are in. It is
 * the only heading pattern in the product, used identically on every page, so
 * a reader learns it once.
 */
export function SectionHead({
  index,
  title,
  note,
  action,
  rule = true,
}: {
  index: string;
  title: string;
  note?: string;
  action?: React.ReactNode;
  /**
   * The heavy rule above the heading. Turn it off where the page header
   * already drew one — two heavy rules a few pixels apart is a printing
   * mistake, not a stronger break.
   */
  rule?: boolean;
}) {
  return (
    <div className={rule ? "border-t-2 border-ink pt-3" : ""}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className="hed-md flex items-baseline gap-3 font-display uppercase">
          <span className="fig text-[0.8rem] font-normal text-signal">
            {index}
          </span>
          {title}
        </h2>

        {note && (
          <p className="max-w-[52ch] flex-1 text-right text-[12px] leading-snug text-ink-3">
            {note}
          </p>
        )}

        {action}
      </div>
    </div>
  );
}
