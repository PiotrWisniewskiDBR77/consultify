/**
 * NotebookReminderChip — #21 reminder badge for a note.
 *
 * Reads `capture_metadata.reminder` (via getNotebookReminderSummary) and renders
 * an amber bell chip "Przypomnienie: <data>". Semantics = warning/attention, so
 * it uses the c-warning token (NEVER crimson/`primary`, which is reserved for
 * critical/destructive). Background fill via color-mix so the alpha survives the
 * Tailwind JIT (bg-c-warning/10 does not emit a rule — see alphaToken finding).
 *
 * Fail-open: renders nothing when there is no reminder — identical to the other
 * notebook metadata badges.
 */

import { Bell } from 'lucide-react';
import React from 'react';

import {
  getNotebookReminderSummary,
  type NotebookReminderMetadata,
} from './notebookReminderSummary';

type Size = 'sm' | 'md';

interface NotebookReminderChipProps {
  captureMetadata: { reminder?: NotebookReminderMetadata | null } | null | undefined;
  isPolish: boolean;
  size?: Size;
  className?: string;
}

const WARNING_FILL = 'color-mix(in srgb, var(--c-warning) 12%, transparent)';

export const NotebookReminderChip: React.FC<NotebookReminderChipProps> = ({
  captureMetadata,
  isPolish,
  size = 'md',
  className = '',
}) => {
  const summary = getNotebookReminderSummary(captureMetadata, isPolish);
  if (!summary) return null;

  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-c-warning font-medium text-c-warning ${
        isSm ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px] gap-1.5'
      } ${className}`.trim()}
      style={{ background: WARNING_FILL }}
      title={summary.title}
    >
      <Bell size={isSm ? 11 : 13} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{summary.label}</span>
    </span>
  );
};

export default NotebookReminderChip;
