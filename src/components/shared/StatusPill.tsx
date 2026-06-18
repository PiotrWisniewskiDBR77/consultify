/**
 * StatusPill — THE single source of truth (SSOT) for status pills across Consultify.
 *
 * The platform historically grew ~4 divergent status-pill color systems
 * (FilterableTable's inline StatusBadge, InsightViewer's STATUS_CONFIG,
 * constants/statusColors.ts, and various ad-hoc badges in Sessions / Assigned).
 * This component collapses all of them into ONE consistent rounded-full pill
 * with exactly 5 semantic tones. New code and migrations should use this and
 * nothing else.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TONE MAPPING (status string → tone)
 * ─────────────────────────────────────────────────────────────────────────
 *   blue    (informational): in_progress, draft, open, generating, planning, new
 *   amber   (waiting):        submitted, pending, pending_review, in_review, review
 *   emerald (success):        approved, completed, done, published, promoted,
 *                             executing, tracking
 *   rose    (attention):      sent_back, rejected, failed, blocked, cancelled, overdue
 *   slate   (neutral):        archived, trashed, unknown, and ANY unrecognized status
 *
 * Input is normalized (lowercase + trim) before mapping, and spaces / hyphens
 * are collapsed to underscores so "In Progress", "in-progress", and
 * "in_progress" all resolve to the same tone.
 *
 * Dark-mode aware: every tone ships a light and dark variant using the platform
 * "ghost background + colored text + faint border" convention, e.g.
 * `bg-emerald-500/10 text-emerald-300 border-emerald-500/20` in dark.
 *
 * @example
 *   <StatusPill status="in_progress" />            // blue, "In progress"
 *   <StatusPill status="SENT_BACK" />              // rose,  "Sent back"
 *   <StatusPill status="approved" size="md" />     // emerald, larger
 *   <StatusPill status="draft" label="Brouillon" withDot={false} />
 *   statusTone('rejected')                         // => 'rose'
 */

import React from 'react';

export type StatusTone = 'blue' | 'amber' | 'emerald' | 'rose' | 'slate';

// ─────────────────────────────────────────────────────────────────────────
// TONE MAPPING
// ─────────────────────────────────────────────────────────────────────────

/** Explicit status → tone assignments. Keys are normalized (see `normalize`). */
const TONE_BY_STATUS: Record<string, StatusTone> = {
  // blue — informational
  in_progress: 'blue',
  draft: 'blue',
  open: 'blue',
  generating: 'blue',
  planning: 'blue',
  new: 'blue',

  // amber — waiting
  submitted: 'amber',
  pending: 'amber',
  pending_review: 'amber',
  in_review: 'amber',
  review: 'amber',

  // emerald — success
  approved: 'emerald',
  completed: 'emerald',
  done: 'emerald',
  published: 'emerald',
  promoted: 'emerald',
  executing: 'emerald',
  tracking: 'emerald',

  // rose — attention
  sent_back: 'rose',
  rejected: 'rose',
  failed: 'rose',
  blocked: 'rose',
  cancelled: 'rose',
  overdue: 'rose',

  // slate — neutral
  archived: 'slate',
  trashed: 'slate',
  unknown: 'slate',
};

/** Per-tone Tailwind classes (light + dark variants), platform palette. */
const TONE_CLASSES: Record<StatusTone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  amber:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  emerald:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  rose: 'bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-500/10 dark:text-danger-300 dark:border-danger-500/20',
  slate:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20',
};

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Normalize a raw status: lowercase, trim, collapse spaces/hyphens to `_`. */
function normalize(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Map any status string to one of the 5 semantic tones.
 * Unrecognized statuses fall back to `slate` (neutral).
 */
export function statusTone(status: string): StatusTone {
  return TONE_BY_STATUS[normalize(status)] ?? 'slate';
}

/** Humanize a status: underscores → spaces, capitalize first letter only. */
function humanize(status: string): string {
  const spaced = normalize(status).replace(/_/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────

export interface StatusPillProps {
  /** Raw status string (any casing/spacing); mapped to a semantic tone. */
  status: string;
  /** Override the displayed text. Defaults to the humanized status. */
  label?: string;
  /** Pill size. Default `sm`. */
  size?: 'sm' | 'md';
  /** Show the small leading dot. Default `true`. */
  withDot?: boolean;
  /** Extra classes appended to the pill root. */
  className?: string;
}

/**
 * Canonical status pill. See file header for the full tone mapping and rationale.
 */
export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  size = 'sm',
  withDot = true,
  className = '',
}) => {
  const tone = statusTone(status);
  const text = label ?? humanize(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      {withDot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {text}
    </span>
  );
};

export default StatusPill;
