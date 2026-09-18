import { Eye, MessageSquareText, PenLine } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ReportBuilderWorkspaceMode } from './reportBuilderWorkspaceMode';

interface ReportWorkspaceModeBarProps {
  mode: ReportBuilderWorkspaceMode;
  onChange: (mode: ReportBuilderWorkspaceMode) => void;
}

export const ReportWorkspaceModeBar: React.FC<ReportWorkspaceModeBarProps> = ({
  mode,
  onChange,
}) => {
  const { t } = useTranslation();
  const items = [
    { id: 'write' as const, icon: PenLine, label: t('reportBuilder.nav.write', 'Write') },
    {
      id: 'review' as const,
      icon: MessageSquareText,
      label: t('reportBuilder.nav.review', 'Review'),
    },
    { id: 'publish' as const, icon: Eye, label: t('reportBuilder.nav.publish', 'Publish') },
  ];

  return (
    <nav
      aria-label={t('reportBuilder.nav.ariaLabel', 'Report workspace mode')}
      className="flex h-10 items-end gap-6 border-b border-c-border-subtle px-6"
      data-testid="report-builder-mode-bar"
    >
      {items.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={mode === id ? 'page' : undefined}
          data-testid={`report-builder-mode-${id}`}
          className={`flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
            mode === id
              ? 'border-c-border-strong text-c-text'
              : 'border-transparent text-c-text-secondary hover:text-c-text'
          }`}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
};
