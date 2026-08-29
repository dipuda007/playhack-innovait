/**
 * A section head.
 *
 * Number, title in the display serif, a brass rule under it, and whatever the
 * section is filtered or controlled by sitting on the same baseline at the
 * right. It is the only heading pattern in the product and it is used
 * identically on every page, so a reader learns it once and then knows where
 * the controls for any section will be.
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
   * The rule above the heading. Turn it off where the band above already
   * closed with one.
   */
  rule?: boolean;
}) {
  return (
    <div className={rule ? "border-t border-rule pt-8" : ""}>
      <div className="flex flex-col gap-4 border-b border-rule pb-4 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h2 className="hed-lg flex items-baseline gap-3 uppercase text-ink">
            <span className="fig text-[0.8rem] font-normal text-ink-3">
              {index}
            </span>
            {title}
          </h2>
          <div className="brass-rule mt-3" />
        </div>

        {note && !action && (
          <p className="max-w-[52ch] text-[13px] leading-snug text-ink-3 md:text-right">
            {note}
          </p>
        )}

        {action}
      </div>

      {note && action && (
        <p className="mt-3 max-w-[68ch] text-[13px] leading-snug text-ink-3">
          {note}
        </p>
      )}
    </div>
  );
}
