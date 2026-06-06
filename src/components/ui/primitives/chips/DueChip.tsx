/**
 * DueChip — a due-date chip that is NEUTRAL by default and only turns
 * warning/danger as a risk SIGNAL (§N: "Overdue/due uses color only for
 * risk or a passed deadline").
 *
 * Risk can be passed explicitly via `risk`, or derived from a `Date`/ISO
 * string `due` value against `soonWithinMs` (default 48h):
 *   - past due            → danger
 *   - within soon window  → warning
 *   - otherwise           → neutral
 */

import { Clock } from 'lucide-react';
import React from 'react';

import { CHIP_ICON_PX, CHIP_TONE_VAR, ChipBase, ChipDot, type ChipSize } from './chipBase';

export type DueRisk = 'overdue' | 'soon' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveDueRisk(
  due: Date | string | number | null | undefined,
  soonWithinMs = 2 * DAY_MS,
  now: number = Date.now()
): DueRisk {
  if (due == null) return 'none';
  const ts = due instanceof Date ? due.getTime() : new Date(due).getTime();
  if (Number.isNaN(ts)) return 'none';
  const delta = ts - now;
  if (delta < 0) return 'overdue';
  if (delta <= soonWithinMs) return 'soon';
  return 'none';
}

export interface DueChipProps {
  /** The visible label (already-formatted date, "in 3d", "Overdue", …). */
  label: React.ReactNode;
  /** Explicit risk. If omitted, derived from `due`. */
  risk?: DueRisk;
  /** Raw due value used to derive risk when `risk` is not supplied. */
  due?: Date | string | number | null;
  /** Window (ms) before due that counts as "soon". Default 48h. */
  soonWithinMs?: number;
  size?: ChipSize;
  /** Show the leading clock icon (neutral) instead of a dot. */
  showIcon?: boolean;
  className?: string;
  title?: string;
}

export const DueChip: React.FC<DueChipProps> = ({
  label,
  risk,
  due,
  soonWithinMs,
  size = 'sm',
  showIcon = false,
  className,
  title,
}) => {
  const effectiveRisk = risk ?? deriveDueRisk(due, soonWithinMs);
  const colorVar =
    effectiveRisk === 'overdue'
      ? CHIP_TONE_VAR.danger
      : effectiveRisk === 'soon'
        ? CHIP_TONE_VAR.warning
        : undefined;

  const leading = showIcon ? (
    <Clock
      size={CHIP_ICON_PX[size]}
      className="shrink-0"
      style={colorVar ? { color: colorVar } : undefined}
      aria-hidden="true"
    />
  ) : (
    <ChipDot colorVar={colorVar} size={size} />
  );

  return (
    <ChipBase
      size={size}
      title={title}
      role={effectiveRisk === 'overdue' ? 'status' : undefined}
      className={className}
      leading={leading}
    >
      {label}
    </ChipBase>
  );
};

export default DueChip;
