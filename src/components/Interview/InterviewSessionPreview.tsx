import { Calendar, ChevronRight, Copy, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type DetailsAction,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { EntityStatusChip } from '@/components/ui/primitives/chips';

// ─────────────────────────────────────────────────────────────────────────────
// InterviewSessionPreviewBody
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewSessionPreviewBodyProps {
  session: {
    id: string;
    name?: string;
    status: string;
    answeredQuestions: number;
    totalQuestions: number;
    startedAt?: string;
    lastActivityAt?: string;
    ownerId?: string;
  };
  isPolish: boolean;
  // canon §4.1: tone/colour come from EntityStatusChip(statusChipTone) — NOT
  // hardcoded bg/text/dot colours. We only need the bilingual label here.
  statusConfig: {
    label: { pl: string; en: string };
  };
  progress: number;
  detailsExpanded: boolean;
  onToggleDetailsExpanded: () => void;
  onCopyStats: () => void;
  onCopyId: () => void;
}

export const InterviewSessionPreviewBody: React.FC<InterviewSessionPreviewBodyProps> = ({
  session,
  isPolish,
  statusConfig,
  progress,
  detailsExpanded,
  onToggleDetailsExpanded,
  onCopyStats,
  onCopyId,
}) => {
  const { t } = useTranslation();
  const started = session.startedAt ? new Date(session.startedAt).toLocaleDateString() : '—';
  const last = session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleDateString() : '—';

  const pills: MetaPill[] = [
    {
      label: t('interview.sessionPreview.session'),
      className:
        'bg-c-info/10 text-[var(--c-info)] border-c-info/20',
    },
    {
      label: `${t('interview.sessionPreview.progress')}: ${progress}%`,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
    },
    {
      label: started,
      icon: Calendar,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
    },
  ];

  const detailsText = [
    `${t('interview.sessionPreview.answers')}: ${session.answeredQuestions}/${session.totalQuestions}`,
    `${t('interview.sessionPreview.started')}: ${started}`,
    `${t('interview.sessionPreview.lastActivity')}: ${last}`,
    session.ownerId ? `${t('interview.sessionPreview.owner')}: ${session.ownerId}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const customActions: DetailsAction[] = [
    {
      id: 'toggle',
      label: detailsExpanded ? (t('interview.sessionPreview.collapse')) : t('interview.sessionPreview.expand'),
      onClick: onToggleDetailsExpanded,
    },
    {
      id: 'copy-stats',
      label: t('interview.sessionPreview.copyStats'),
      icon: Copy,
      onClick: onCopyStats,
    },
    {
      id: 'copy-id',
      label: t('interview.sessionPreview.copyId'),
      icon: Copy,
      onClick: onCopyId,
    },
  ];

  return (
    <div className="space-y-4">
      {/* canon §4.1: status via EntityStatusChip (statusChipTone → c.*) */}
      <div className="flex items-center gap-2">
        <EntityStatusChip
          status={session.status}
          label={t(`interview.hub.sessionStatusLabel.${session.status}`, statusConfig.label.en)}
        />
      </div>
      <PreviewMetaCard pills={pills} />
      <PreviewDetailsSection
        text={detailsText}
        customActions={customActions}
        expanded={detailsExpanded}
        onToggleExpanded={onToggleDetailsExpanded}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// InterviewSessionPreviewFooter
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewSessionPreviewFooterProps {
  session: {
    id: string;
    name?: string;
    status: string;
    answeredQuestions: number;
    totalQuestions: number;
    projectId?: string;
    organizationId?: string;
  };
  isPolish: boolean;
  canRunAi: boolean;
  aiHints: string[];
  onRunAiHint: (hint: string) => void;
  relations: Array<{ label: string; tone?: string }>;
  onOpenFull: () => void;
  onGenerateInsight?: (type: string) => void;
  onCopyId: () => void;
}

export const InterviewSessionPreviewFooter: React.FC<InterviewSessionPreviewFooterProps> = ({
  session,
  isPolish,
  canRunAi,
  aiHints,
  onRunAiHint,
  relations,
  onOpenFull,
  onGenerateInsight,
  onCopyId,
}) => {
  const { t } = useTranslation();
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    tone: r.tone ?? 'text-[var(--c-text-secondary)]',
  }));

  // NOTE: "Open" lives exclusively in PreviewPaneShell header (canon §7.3 anty-duplikacja).
  const contextButtons = [
    ...(canRunAi && onGenerateInsight
      ? [
          {
            label: t('interview.sessionPreview.generateInsights'),
            icon: Sparkles,
            onClick: () => onGenerateInsight('summary'),
            colorScheme: 'neutral' as const,
            shortcut: 'G',
          },
        ]
      : []),
    {
      label: t('interview.sessionPreview.copyId'),
      icon: Copy,
      onClick: onCopyId,
      colorScheme: 'neutral' as const,
    },
  ];

  const actionRows: ActionRow[] = contextButtons.length > 0 ? [{ buttons: contextButtons }] : [];

  return (
    // canon §7.3: space-y-2.5, NO border-t dividers between footer cards
    <div className="space-y-2.5">
      <div className="rounded-token-md border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] p-2.5">
        <PreviewAIHintStrip
          hints={aiHints}
          onRunHint={onRunAiHint}
          disabled={!canRunAi}
          disabledTooltip={
            t('interview.sessionPreview.aiAvailableAfterCompletion')
          }
        />
      </div>

      <PreviewRelations items={relationItems} />

      {actionRows.length > 0 && <PreviewActionBar rows={actionRows} />}
    </div>
  );
};
