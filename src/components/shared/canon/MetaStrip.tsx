/**
 * MetaField + MetaStrip — one canon convention for metadata rows
 * (ARTIFACT_ANATOMY_STANDARD §9.2 ⑪ property field, §2 right panel).
 *
 * The problem this solves: every module invented its own metadata bar (Insight
 * header, Decision header, record properties) with different label casing,
 * sizes and alignment. MetaField pins ONE shape:
 *   - label: uppercase 11px tracked, `c-text-muted`
 *   - value: `c-text` (or a chip / dropdown slot at the SAME height)
 *
 * MetaStrip lays fields out in a horizontal, wrapping row with hairline
 * separators — the standard "owner · status · updated" strip above an artifact
 * body. Vertical variant stacks label-over-value (right-panel property list).
 *
 * @example
 *   <MetaStrip>
 *     <MetaField label="Owner" value="Anna K." />
 *     <MetaField label="Status"><QuietChip status="approved" /></MetaField>
 *     <MetaField label="Updated" value="2h ago" tone="muted" />
 *   </MetaStrip>
 */

import React from 'react';

export type MetaFieldVariant = 'text' | 'chip' | 'dropdown';

export interface MetaFieldProps {
  /** Field label — rendered uppercase 11px tracked, `c-text-muted`. */
  label: string;
  /** Text value (used when no `children`). */
  value?: React.ReactNode;
  /**
   * Slot content (chip / dropdown / custom). When present, overrides `value`.
   * Kept at the same row height as text values for alignment.
   */
  children?: React.ReactNode;
  /**
   * Value styling hint. `text` = c-text; `muted` = c-text-muted (timestamps).
   * `chip`/`dropdown` are layout hints for interactive slots.
   */
  variant?: MetaFieldVariant | 'muted';
  /** Extra classes on the field root. */
  className?: string;
}

const VALUE_TONE: Record<string, string> = {
  text: 'text-c-text',
  muted: 'text-c-text-muted',
  chip: 'text-c-text',
  dropdown: 'text-c-text',
};

/**
 * A single label + value metadata pair. The label convention is fixed; the
 * value can be text (`value`) or an arbitrary slot (`children`).
 */
export const MetaField: React.FC<MetaFieldProps> = ({
  label,
  value,
  children,
  variant = 'text',
  className = '',
}) => {
  const valueTone = VALUE_TONE[variant] ?? VALUE_TONE.text;
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className}`.trim()}>
      <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-c-text-muted">
        {label}
      </span>
      <div className={`flex min-h-[20px] items-center text-[13px] leading-tight ${valueTone}`}>
        {children ?? value}
      </div>
    </div>
  );
};

export type MetaStripOrientation = 'horizontal' | 'vertical';

export interface MetaStripProps {
  /** MetaField children. */
  children: React.ReactNode;
  /**
   * `horizontal` (default) = wrapping strip with hairline separators between
   * fields. `vertical` = stacked property list (right panel).
   */
  orientation?: MetaStripOrientation;
  /** Extra classes on the strip root. */
  className?: string;
}

/**
 * Groups MetaFields into the canon metadata strip. Horizontal inserts a hairline
 * `c-border-subtle` divider between fields; vertical stacks them.
 */
export const MetaStrip: React.FC<MetaStripProps> = ({
  children,
  orientation = 'horizontal',
  className = '',
}) => {
  const items = React.Children.toArray(children).filter(Boolean);

  if (orientation === 'vertical') {
    return (
      <div className={`flex flex-col gap-3 ${className}`.trim()}>{items}</div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`.trim()}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span
              aria-hidden="true"
              className="h-6 w-px shrink-0 bg-c-border-subtle"
            />
          )}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MetaStrip;
