/**
 * ProgressCell — the canonical table/list progress primitive (c.* tokens).
 *
 * A compact linear bar + percent label, sized for a table cell. Used by both
 * the table and the cards/grid view so progress renders identically everywhere
 * (TABLE_AND_PREVIEW_CANON.md §4.3). Fill uses the `info` tone while in
 * progress (NEVER danger/crimson — progress is not an alarm, see §4.0) and
 * flips to `success` at 100%; the track is a neutral hairline.
 */

import React from 'react';

import { cn } from '@/utils/cn';

export interface ProgressCellProps {
  /** Completion value 0–100 (clamped). */
  value: number;
  /** Show the trailing `%` label. Default `true`. */
  showLabel?: boolean;
  /** Bar height. `sm` = h-1 (table), `md` = h-1.5. Default `sm`. */
  size?: 'sm' | 'md';
  className?: string;
  /**
   * Accessible name for the `role="progressbar"` div — a caller-supplied name
   * (e.g. "Postęp sesji") gives screen-reader users context the bare percent
   * doesn't. Falls back to a generic "Postęp: N%" so the bar always has SOME
   * name (axe: aria-progressbar-name, zmierzone na interview-sessions-status —
   * the bar had none at all).
   */
  ariaLabel?: string;
}

/**
 * Canonical progress cell. Color is a completion SIGNAL: accent while in
 * progress, success at 100%.
 */
export const ProgressCell: React.FC<ProgressCellProps> = ({
  value,
  showLabel = true,
  size = 'sm',
  className,
  ariaLabel,
}) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const complete = pct >= 100;

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <div
        className={cn(
          'relative flex-1 overflow-hidden rounded-full bg-c-border-subtle',
          size === 'sm' ? 'h-1' : 'h-1.5'
        )}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? `Postęp: ${pct}%`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            complete ? 'bg-c-success' : 'bg-c-info'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="shrink-0 tabular-nums text-[11px] text-c-text-muted">{pct}%</span>
      )}
    </div>
  );
};

export default ProgressCell;
