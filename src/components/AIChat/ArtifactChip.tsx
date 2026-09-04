/**
 * ArtifactChip — B2 (artifact lifecycle, Claude-Artifacts style)
 *
 * Compact card rendered in the chat transcript for messages that produced a
 * deliverable artifact (deck / doc generated in chat). Clicking it (re)opens
 * the canvas split-view with that artifact mounted and active.
 *
 * Reload-safe: rendered from persisted message `metadata.deliverable`
 * (server-side) — see MessageRenderer wiring.
 *
 * Visual language follows ArtifactBadge (primary palette chip), scaled up to
 * a small card with an explicit "Otwórz / Open" affordance.
 */

import { ExternalLink, FileText, Presentation, Table } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactChipProps {
  kind: 'deck' | 'doc' | 'sheet';
  title: string;
  onOpen: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const ArtifactChip: React.FC<ArtifactChipProps> = ({ kind, title, onOpen }) => {
  const { i18n } = useTranslation();
  const pl = (i18n.language || 'en').split('-')[0] === 'pl';
  const Icon = kind === 'deck' ? Presentation : kind === 'sheet' ? Table : FileText;
  const kindLabel =
    kind === 'deck'
      ? pl
        ? 'Prezentacja'
        : 'Presentation'
      : kind === 'sheet'
        ? pl
          ? 'Arkusz'
          : 'Sheet'
        : pl
          ? 'Dokument'
          : 'Document';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group inline-flex max-w-full items-center gap-2.5 rounded-xl border border-c-border dark:border-c-border bg-c-surface-raised dark:bg-c-surface-raised px-3 py-2 text-left transition-colors hover:border-c-border-strong dark:hover:border-c-border-strong hover:bg-c-surface-hover dark:hover:bg-c-surface-hover"
      title={pl ? 'Otwórz w panelu roboczym' : 'Open in the work panel'}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-navy-800 text-c-text-secondary shadow-sm">
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-c-text-secondary dark:text-c-text-secondary max-w-[220px]">
          {title}
        </span>
        <span className="block text-[10px] text-c-text-secondary dark:text-c-text-secondary">
          {kindLabel}
        </span>
      </span>
      <span className="ml-1 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-c-text-secondary group-hover:text-c-text dark:group-hover:text-c-text transition-colors">
        {pl ? 'Otwórz' : 'Open'}
        <ExternalLink size={11} />
      </span>
    </button>
  );
};

export default ArtifactChip;
