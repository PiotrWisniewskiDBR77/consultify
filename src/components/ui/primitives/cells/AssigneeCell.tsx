/**
 * AssigneeCell — the canonical table/list assignee primitive (c.* tokens).
 *
 * Replaces the bespoke, divergent assignee renderings across the app
 * (avatar-chip in some tables, plain text in others, ugly "? Unknown"
 * fallback). One neutral avatar (initial) + truncated name, with a graceful
 * unassigned state (TABLE_AND_PREVIEW_CANON.md §3.3 / Interview audit §2.7).
 *
 * The avatar is intentionally NEUTRAL (no per-name rainbow) — in a list,
 * color is reserved for signals, not identity decoration.
 */

import React from 'react';

import { cn } from '@/utils/cn';

function initial(name?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '';
  return n.charAt(0).toUpperCase();
}

export interface AssigneeCellProps {
  /** Display name; when empty the cell renders the unassigned state. */
  name?: string | null;
  /** Optional avatar image URL. */
  avatarUrl?: string | null;
  /** Hide the avatar, show name only. */
  hideAvatar?: boolean;
  /** Label for the unassigned state. Default "Unassigned". */
  unassignedLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Canonical assignee cell: neutral avatar + truncated name, graceful empty.
 * @example <AssigneeCell name="Anna Zielińska" />
 * @example <AssigneeCell name={null} />   // muted "Unassigned", no avatar
 */
export const AssigneeCell: React.FC<AssigneeCellProps> = ({
  name,
  avatarUrl,
  hideAvatar = false,
  unassignedLabel = 'Unassigned',
  size = 'sm',
  className,
}) => {
  const has = !!(name && name.trim());
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]';

  if (!has) {
    return (
      <span
        className={cn('inline-flex items-center text-[13px] italic text-c-text-muted', className)}
      >
        {unassignedLabel}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0 max-w-full', className)}>
      {!hideAvatar &&
        (avatarUrl ? (
          <img src={avatarUrl} alt="" className={cn('shrink-0 rounded-full object-cover', dim)} />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'shrink-0 inline-flex items-center justify-center rounded-full font-medium',
              'border border-c-border bg-c-surface-raised text-c-text-secondary',
              dim
            )}
          >
            {initial(name)}
          </span>
        ))}
      <span className="min-w-0 truncate text-[13px] text-c-text">{name}</span>
    </span>
  );
};

export default AssigneeCell;
