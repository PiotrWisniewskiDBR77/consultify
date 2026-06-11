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
      className="group inline-flex max-w-full items-center gap-2.5 rounded-xl border border-primary-100 dark:border-primary-800/30 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 text-left transition-colors hover:border-primary-200 dark:hover:border-primary-700/50 hover:bg-primary-100/70 dark:hover:bg-primary-900/30"
      title={pl ? 'Otwórz w panelu roboczym' : 'Open in the work panel'}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-navy-800 text-primary-500 shadow-sm">
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-primary-700 dark:text-primary-300 max-w-[220px]">
          {title}
        </span>
        <span className="block text-[10px] text-primary-500/80 dark:text-primary-400/80">
          {kindLabel}
        </span>
      </span>
      <span className="ml-1 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
        {pl ? 'Otwórz' : 'Open'}
        <ExternalLink size={11} />
      </span>
    </button>
  );
};

export default ArtifactChip;
