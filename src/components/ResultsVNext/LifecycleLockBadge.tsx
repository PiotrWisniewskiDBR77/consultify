/**
 * LifecycleLockBadge — visual marker for "locked / lifecycle-gated" state
 * (RN_G2_UI_SCOPE.md §D). Each results-vnext domain has a real, code-enforced
 * status machine (KPI Deviation Case: 9 states, ROI Case: 13 states, OKR
 * Program/Cycle: draft/active/suspended/retired etc.) — this is a small,
 * reusable pill (icon + reason tooltip) for surfacing "this record can't be
 * mutated right now" in a preview meta card or table cell, alongside the
 * status chip.
 *
 * The KEBAB half of "locked" (row-menu actions disabled with a reason) needs
 * NO new primitive — `StandardTable`'s `rowMenu` contract already supports
 * `disabled` + `note` per action (TRIADA §C3: "a disabled item stays visible
 * with a reason — never hidden — when disabled by product rule"). Use
 * `lockedRowMenuAction` below for that half so both call sites stay
 * consistent.
 */

import { Lock } from 'lucide-react';
import React from 'react';

import type { StandardRowMenuAction } from '@/components/standard';

export interface LifecycleLockBadgeProps {
  /** Short label, e.g. "Locked", "Approved — read-only", "Closed". */
  label: string;
  /** WHY it's locked — shown as a tooltip, never omitted (TRIADA §C3). */
  reason: string;
  className?: string;
}

export const LifecycleLockBadge: React.FC<LifecycleLockBadgeProps> = ({
  label,
  reason,
  className = '',
}) => (
  <span
    className={`inline-flex h-6 items-center gap-1 rounded-full border border-c-border-subtle bg-c-surface-raised px-2 text-[11px] font-medium text-c-text-muted ${className}`.trim()}
    title={reason}
    data-testid="lifecycle-lock-badge"
  >
    <Lock size={11} aria-hidden />
    {label}
  </span>
);

/**
 * Builds a disabled `StandardRowMenuAction` with a business-lock reason —
 * shared helper so every RN-G2 domain declares "locked" kebab entries the
 * same way (visible, disabled, with a `note`), instead of three bespoke
 * disabled-action literals per domain.
 */
export function lockedRowMenuAction(
  base: Omit<StandardRowMenuAction, 'disabled' | 'onClick'>,
  reason: string
): StandardRowMenuAction {
  return {
    ...base,
    disabled: true,
    note: reason,
  };
}

export default LifecycleLockBadge;
