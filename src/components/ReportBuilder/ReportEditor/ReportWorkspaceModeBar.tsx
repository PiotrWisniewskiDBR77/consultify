import { Eye, MessageSquareText, PenLine } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ReportBuilderWorkspaceMode } from './reportBuilderWorkspaceMode';

interface ReportWorkspaceModeBarProps {
  mode: ReportBuilderWorkspaceMode;
  onChange: (mode: ReportBuilderWorkspaceMode) => void;
}

const L = {
  ariaLabel: { en: 'Report workspace mode', pl: 'Tryb pracy raportu' },
  write: { en: 'Write', pl: 'Pisanie' },
  review: { en: 'Review', pl: 'Recenzja' },
  publish: { en: 'Publish', pl: 'Publikacja' },
} as const;

const pick = (pair: { en: string; pl: string }, language?: string) =>
  language?.toLowerCase().startsWith('pl') ? pair.pl : pair.en;

export const ReportWorkspaceModeBar: React.FC<ReportWorkspaceModeBarProps> = ({
  mode,
  onChange,
}) => {
  const { i18n } = useTranslation();
  const items = [
    { id: 'write' as const, icon: PenLine, label: pick(L.write, i18n.language) },
    {
      id: 'review' as const,
      icon: MessageSquareText,
      label: pick(L.review, i18n.language),
    },
    { id: 'publish' as const, icon: Eye, label: pick(L.publish, i18n.language) },
  ];

  return (
    <nav
      aria-label={pick(L.ariaLabel, i18n.language)}
      className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-c-border-subtle bg-c-surface p-0.5"
      data-testid="report-builder-mode-bar"
    >
      {items.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={mode === id ? 'page' : undefined}
          data-testid={`report-builder-mode-${id}`}
          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
            mode === id
              ? 'bg-c-surface-raised text-c-text shadow-sm'
              : 'text-c-text-muted hover:bg-state-hover hover:text-c-text-secondary'
          }`}
        >
          <Icon size={13} aria-hidden="true" className="shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );
};
