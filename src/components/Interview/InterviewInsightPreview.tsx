/**
 * InterviewInsightPreview — Preview pane building blocks for Insights tab
 *
 * Extracted from InterviewHub renderPreview/renderPreviewFooter.
 * Uses shared building blocks from @/components/shared/PreviewPane.
 */

import {
  Archive,
  ChevronDown,
  Copy,
  Download,
  FileText,
  GitFork,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactActionPanel } from '@/components/shared/artifact-actions/ArtifactActionPanel';
import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
} from '@/components/shared/PreviewPane';
import { interviewActionMeta } from './interviewActionMatrix';

// ── Body ───────────────────────────────────────────────────────────────────

export interface InterviewInsightPreviewBodyProps {
  insight: {
    id: string;
    title?: string;
    promptType?: string;
    insightType?: string;
    type?: string;
    status?: string;
    confidence?: string;
    content?: string;
    description?: string;
    sourceQuote?: string;
    createdAt?: string;
    sessionId?: string;
    sourceSessionCount?: number;
    exportedToTools?: boolean;
  };
  isPolish: boolean;
  typeLabel: string;
  typeConfig: { bgColor: string; textColor: string };
  statusConfig: { label: { en: string; pl: string }; bg: string; text: string };
  sourceLabel: string;
  dateStr: string;
  detailsText: string;
  detailsExpanded: boolean;
  onToggleDetailsExpanded: () => void;
  onDetailsAction: (action: string) => void;
}

export const InterviewInsightPreviewBody: React.FC<InterviewInsightPreviewBodyProps> = ({
  insight,
  isPolish,
  typeLabel,
  typeConfig,
  statusConfig,
  sourceLabel,
  dateStr,
  detailsText,
  detailsExpanded,
  onToggleDetailsExpanded,
  onDetailsAction,
}) => {
  const { t } = useTranslation();
  const pills: MetaPill[] = [
    {
      label: t('interview.insightPreview.insight'),
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
    },
    {
      label: typeLabel,
      className: `${typeConfig.bgColor} ${typeConfig.textColor}`,
    },
    {
      label: t(`interview.insightPreview.statusLabel.${insight.status}`, statusConfig.label.en),
      className: `${statusConfig.bg} ${statusConfig.text}`,
    },
    ...(insight.confidence
      ? [
          {
            label: `${t('interview.insightPreview.confidence')}: ${insight.confidence}`,
            className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-muted)]',
          },
        ]
      : []),
    {
      label: sourceLabel,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-muted)]',
    },
    {
      label: dateStr,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-muted)]',
    },
  ];

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={pills} />
      <PreviewDetailsSection
        text={detailsText}
        expanded={detailsExpanded}
        onToggleExpanded={onToggleDetailsExpanded}
        label={t('interview.insightPreview.details')}
        customActions={[
          {
            id: 'toggle-expand',
            label: detailsExpanded
              ? t('interview.insightPreview.collapse')
              : t('interview.insightPreview.expand'),
            icon: ChevronDown,
            onClick: onToggleDetailsExpanded,
          },
          {
            id: 'copy',
            label: t('interview.insightPreview.copy'),
            icon: Copy,
            onClick: () => onDetailsAction('copy'),
          },
          {
            id: 'copy-summarize-prompt',
            label: t('interview.insightPreview.copyPromptSummarize'),
            icon: Sparkles,
            onClick: () => onDetailsAction('copy-summarize-prompt'),
          },
          {
            id: 'export-tools',
            label: insight.exportedToTools
              ? t('interview.insightPreview.inTools')
              : t('interview.insightPreview.exportToTools'),
            icon: Send,
            onClick: () => onDetailsAction('export-tools'),
            disabled: !!insight.exportedToTools,
          },
          {
            id: 'download',
            label: t('interview.insightPreview.downloadMd'),
            icon: Download,
            onClick: () => onDetailsAction('download'),
          },
        ]}
      />
    </div>
  );
};

// ── Footer ──────────────────────────────────────────────────────────────────

export interface InterviewInsightPreviewFooterProps {
  insight: {
    id?: string;
    title?: string;
    status?: string;
    content?: string;
    description?: string;
    sourceQuote?: string;
    confidence?: string;
    sourceSessionCount?: number;
    sessionId?: string;
  };
  isPolish: boolean;
  /** Show the compact "What next" create-strip below the AI hints (default true). */
  showActionPanel?: boolean;
  isArchived?: boolean;
  onFork?: () => void;
  onExportAssessment?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

export const InterviewInsightPreviewFooter: React.FC<InterviewInsightPreviewFooterProps> = ({
  insight,
  isPolish,
  showActionPanel = true,
  isArchived = false,
  onFork,
  onExportAssessment,
  onArchive,
  onRestore,
  onDelete,
}) => {
  const { t } = useTranslation();
  const aiHints = [
    t('interview.insightPreview.summarizeInsight'),
    t('interview.insightPreview.suggestActions'),
  ];
  const buttons: ActionRow['buttons'] = [
    ...(onFork
      ? [
          {
            label: interviewActionMeta('insight', 'fork', t).label,
            icon: GitFork,
            onClick: onFork,
            colorScheme: 'neutral' as const,
          },
        ]
      : []),
    ...(onExportAssessment
      ? [
          {
            label: interviewActionMeta('insight', 'export-assessment', t).label,
            icon: FileText,
            onClick: onExportAssessment,
            colorScheme: 'neutral' as const,
          },
        ]
      : []),
    ...(isArchived && onRestore
      ? [
          {
            label: interviewActionMeta('insight', 'restore', t).label,
            icon: RotateCcw,
            onClick: onRestore,
            colorScheme: 'neutral' as const,
          },
        ]
      : !isArchived && onArchive
        ? [
            {
              label: interviewActionMeta('insight', 'archive', t).label,
              icon: Archive,
              onClick: onArchive,
              colorScheme: 'neutral' as const,
            },
          ]
        : []),
    ...(onDelete
      ? [
          {
            label: interviewActionMeta('insight', 'delete', t).label,
            icon: Trash2,
            onClick: onDelete,
            colorScheme: 'red' as const,
          },
        ]
      : []),
  ];

  // Canon §7.3: footer = AI → (Relations) → "What next" (create). The primary "Open" lives in the
  // header and Export/Download in the Details ⋮ — no redundant bottom action bar. Consistent
  // minimal gap between sections (space-y-2.5), no heavy dividers between bordered cards.
  return (
    <div className="space-y-2.5 pb-1">
      {/* Ramkę bloku 4 rysuje sam `PreviewAIHintStrip` — bez opakowania. */}
      <PreviewAIHintStrip hints={aiHints} />
      {buttons.length > 0 ? <PreviewActionBar rows={[{ buttons }]} /> : null}
      {showActionPanel && (
        <ArtifactActionPanel
          variant="compact"
          isPolish={isPolish}
          source={{
            type: 'interview_insight',
            id: insight.id || '',
            title: insight.title || t('interview.insightPreview.insight'),
            status: insight.status,
            content: insight.content || insight.description || insight.sourceQuote || '',
            confidence: insight.confidence || null,
            evidenceCount: 0,
            sourceSessionCount: insight.sourceSessionCount || (insight.sessionId ? 1 : 0),
          }}
        />
      )}
    </div>
  );
};
