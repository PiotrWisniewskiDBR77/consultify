/**
 * InterviewInsightPreview — Preview pane building blocks for Insights tab
 *
 * Extracted from InterviewHub renderPreview/renderPreviewFooter.
 * Uses shared building blocks from @/components/shared/PreviewPane.
 */

import { ChevronDown, Copy, Download, Send, Sparkles } from 'lucide-react';
import React from 'react';

import { ArtifactActionPanel } from '@/components/shared/artifact-actions/ArtifactActionPanel';
import {
  type MetaPill,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
} from '@/components/shared/PreviewPane';

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
  const pills: MetaPill[] = [
    {
      label: isPolish ? 'Wniosek' : 'Insight',
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
    },
    {
      label: typeLabel,
      className: `${typeConfig.bgColor} ${typeConfig.textColor}`,
    },
    {
      label: isPolish ? statusConfig.label.pl : statusConfig.label.en,
      className: `${statusConfig.bg} ${statusConfig.text}`,
    },
    ...(insight.confidence
      ? [
          {
            label: `${isPolish ? 'Pewność' : 'Confidence'}: ${insight.confidence}`,
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
        label={isPolish ? 'Szczegóły' : 'Details'}
        customActions={[
          {
            id: 'toggle-expand',
            label: detailsExpanded
              ? isPolish
                ? 'Zwiń'
                : 'Collapse'
              : isPolish
                ? 'Rozwiń'
                : 'Expand',
            icon: ChevronDown,
            onClick: onToggleDetailsExpanded,
          },
          {
            id: 'copy',
            label: isPolish ? 'Kopiuj' : 'Copy',
            icon: Copy,
            onClick: () => onDetailsAction('copy'),
          },
          {
            id: 'copy-summarize-prompt',
            label: isPolish ? 'Kopiuj prompt: podsumuj' : 'Copy prompt: summarize',
            icon: Sparkles,
            onClick: () => onDetailsAction('copy-summarize-prompt'),
          },
          {
            id: 'export-tools',
            label: insight.exportedToTools
              ? isPolish
                ? 'W Tools'
                : 'In Tools'
              : isPolish
                ? 'Eksport do Tools'
                : 'Export to Tools',
            icon: Send,
            onClick: () => onDetailsAction('export-tools'),
            disabled: !!insight.exportedToTools,
          },
          {
            id: 'download',
            label: isPolish ? 'Pobierz (.md)' : 'Download (.md)',
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
}

export const InterviewInsightPreviewFooter: React.FC<InterviewInsightPreviewFooterProps> = ({
  insight,
  isPolish,
  showActionPanel = true,
}) => {
  const aiHints = isPolish
    ? ['Podsumuj wniosek', 'Zasugeruj działania']
    : ['Summarize insight', 'Suggest actions'];

  // Canon §7.3: footer = AI → (Relations) → "What next" (create). The primary "Open" lives in the
  // header and Export/Download in the Details ⋮ — no redundant bottom action bar. Consistent
  // minimal gap between sections (space-y-2.5), no heavy dividers between bordered cards.
  return (
    <div className="space-y-2.5 pb-1">
      <div className="rounded-token-md border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] p-2.5">
        <PreviewAIHintStrip hints={aiHints} />
      </div>
      {showActionPanel && (
        <ArtifactActionPanel
          variant="compact"
          isPolish={isPolish}
          source={{
            type: 'interview_insight',
            id: insight.id || '',
            title: insight.title || (isPolish ? 'Insight' : 'Insight'),
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
