/**
 * HonestValueCell — the ONE primitive for rendering the results-vnext
 * honest-missing 3-way domain (`decimal | null | 'not_calculable'`) anywhere
 * in a RN-G2 screen: table cell, preview meta pill, or properties table.
 *
 * This is a hard, explicitly-designed program invariant, not a nice-to-have
 * (see RN_G2_UI_SCOPE.md §D, EXECUTION_LEDGER.md L132, ROI_E001_DESIGN.md L31
 * AC-03, OKR_E006_DESIGN.md L16 IO-5): a degenerate/undefined calculation must
 * NEVER render as a fabricated `0`, and `null` ("no data was ever entered")
 * must NEVER be visually conflated with `'not_calculable'` ("data exists but
 * the formula is structurally undefined") — both would silently reintroduce
 * the fabricated-zero risk the backend was built to prevent.
 *
 *  - `null`            → "—" (TRIADA §A4/§C6 convention for an empty cell)
 *  - `'not_calculable'` → a visibly distinct muted "n/a" chip with a tooltip
 *                         reason (never the same glyph as "—")
 *  - a real value       → `format(value)`, tabular-nums, right-aligned when
 *                         `align="right"` (TRIADA §A4: "Liczby wyrównane do
 *                         prawej")
 */

import React from 'react';

import type { HonestValue } from './types';

export interface HonestValueCellProps<T> {
  value: HonestValue<T>;
  /** Formats a REAL (non-null, non-'not_calculable') value for display. */
  format?: (value: T) => React.ReactNode;
  /** Tooltip shown on the "n/a" chip explaining WHY it's not calculable. */
  notCalculableReason?: string;
  /** Right-align + tabular-nums (use for numeric columns). */
  align?: 'left' | 'right';
  className?: string;
}

export function HonestValueCell<T>({
  value,
  format,
  notCalculableReason,
  align = 'left',
  className = '',
}: HonestValueCellProps<T>): React.ReactElement {
  const alignCls = align === 'right' ? 'text-right tabular-nums' : 'text-left';

  if (value === null) {
    return (
      <span
        className={`text-c-text-muted ${alignCls} ${className}`.trim()}
        data-testid="honest-value-empty"
      >
        —
      </span>
    );
  }

  if (value === 'not_calculable') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${alignCls} ${className}`.trim()}
        data-testid="honest-value-not-calculable"
      >
        <span
          className="inline-flex h-5 items-center rounded-full border border-c-border-subtle bg-c-surface-raised px-1.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted"
          title={notCalculableReason ?? 'Not calculable — the formula is structurally undefined'}
        >
          n/a
        </span>
      </span>
    );
  }

  const rendered = format ? format(value) : (value as unknown as React.ReactNode);
  return (
    <span className={`${alignCls} ${className}`.trim()} data-testid="honest-value-present">
      {rendered}
    </span>
  );
}

export default HonestValueCell;
