/**
 * EntityStatusChip — the table/list-facing convenience over <StatusChip>.
 *
 * Tables hold RAW status strings (`"in_progress"`, `"SENT_BACK"`, `"Approved"`),
 * but <StatusChip> takes a semantic `tone`. This component is the canonical
 * BRIDGE: it normalizes a raw status → ChipTone via `statusChipTone()` and
 * humanizes the label, so callers can write `<EntityStatusChip status={raw} />`
 * and get a fully on-brand (c.* / HBS) status pill.
 *
 * This replaces the legacy `shared/StatusPill` + `constants/statusColors`
 * pairing across the app (see TABLE_AND_PREVIEW_CANON.md §4.1). Color is a
 * SIGNAL carried by the dot; the shell stays neutral.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { type ChipSize } from './chipBase';
import { StatusChip, type StatusTone } from './StatusChip';

/**
 * Canonical raw-status → semantic chip-tone mapping.
 * Keys are normalized: lowercase, spaces/hyphens collapsed to `_`.
 * Mirrors TABLE_AND_PREVIEW_CANON.md §4.1.
 */
const TONE_BY_STATUS: Record<string, StatusTone> = {
  // info — in-flight / informational
  in_progress: 'info',
  draft: 'info',
  open: 'info',
  generating: 'info',
  generated: 'info',
  planning: 'info',
  new: 'info',
  scheduled: 'info',
  executing: 'info',
  promoted: 'info',
  proposed: 'info',

  // warning — waiting on someone
  submitted: 'warning',
  pending: 'warning',
  pending_review: 'warning',
  pending_approval: 'warning',
  awaiting_approval: 'warning',
  in_review: 'warning',
  review: 'warning',
  escalated: 'warning',
  on_hold: 'warning',
  paused: 'warning',

  // success — closed positively
  approved: 'success',
  accepted: 'success',
  completed: 'success',
  done: 'success',
  published: 'success',
  ready: 'success',
  active: 'success',
  utilized: 'success',
  tracking: 'success',

  // danger — needs attention
  sent_back: 'danger',
  rejected: 'danger',
  failed: 'danger',
  blocked: 'danger',
  cancelled: 'danger',
  overdue: 'danger',

  // neutral — terminal-inert or unassigned (explicit, not accidental fallback)
  archived: 'neutral',
  deprecated: 'neutral',
  trashed: 'neutral',
  final: 'neutral',
  inactive: 'neutral',
  assigned: 'neutral',
  not_started: 'neutral',
  todo: 'neutral',
  unknown: 'neutral',
};

/** Normalize a raw status: lowercase, trim, collapse spaces/hyphens to `_`. */
function normalize(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Map any raw status string to one of the 5 semantic chip tones.
 * Unrecognized statuses fall back to `neutral`.
 */
export function statusChipTone(status: string | null | undefined): StatusTone {
  if (!status) return 'neutral';
  return TONE_BY_STATUS[normalize(status)] ?? 'neutral';
}

/** Humanize a status: underscores → spaces, capitalize first letter only. */
function humanize(status: string): string {
  const spaced = normalize(status).replace(/_/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * i18n key prefix for translated status labels (TAB-003).
 * A dedicated `statusChip.*` namespace (not the pre-existing `status.*` used
 * by InitiativeDetailModal, which holds gendered Polish forms agreeing with
 * "Inicjatywa" — reusing it here would risk grammatically wrong labels once
 * shared across other entity types). See public/locales/{en,pl}/translation.json.
 */
const STATUS_I18N_PREFIX = 'statusChip';

export interface EntityStatusChipProps {
  /** Raw status string (any casing/spacing); mapped to a semantic tone. */
  status: string | null | undefined;
  /** Override the displayed text. Defaults to the humanized status. */
  label?: React.ReactNode;
  size?: ChipSize;
  /** Hide the leading dot (text-only status). */
  hideDot?: boolean;
  className?: string;
  title?: string;
}

/**
 * Canonical status pill for tables/lists. Takes a raw status string.
 * @example <EntityStatusChip status="in_progress" />   // info dot, "In progress"
 * @example <EntityStatusChip status="SENT_BACK" />      // danger dot, "Sent back"
 */
export const EntityStatusChip: React.FC<EntityStatusChipProps> = ({
  status,
  label,
  size = 'sm',
  hideDot = false,
  className,
  title,
}) => {
  const { t } = useTranslation();
  const normalized = status ? normalize(status) : '';
  // Translated label when a dictionary entry exists for this normalized
  // status; falls back to the mechanical humanization (never a raw i18n
  // key) so unrecognized/new statuses still render something readable.
  const i18nKey = `${STATUS_I18N_PREFIX}.${normalized}`;
  const translated = normalized ? t(i18nKey, { defaultValue: '' }) : '';
  const resolvedLabel = label ?? (translated || humanize(status ?? ''));
  return (
    <StatusChip
      tone={statusChipTone(status)}
      label={resolvedLabel}
      size={size}
      hideDot={hideDot}
      className={className}
      title={title}
    />
  );
};

export default EntityStatusChip;
