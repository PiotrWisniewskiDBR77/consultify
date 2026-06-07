/**
 * InterviewInsightPreview — Preview pane building blocks for Insights tab
 *
 * Extracted from InterviewHub renderPreview/renderPreviewFooter.
 * Uses shared building blocks from @/components/shared/PreviewPane.
 */

import { ChevronDown, ChevronRight, Copy, Send, Sparkles } from 'lucide-react';
import React from 'react';

import { ArtifactActionPanel } from '@/components/shared/artifact-actions/ArtifactActionPanel';
import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
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
      className: 'bg-slate-200/60 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200',
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
            className: 'bg-slate-200/40 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300',
          },
        ]
      : []),
    {
      label: sourceLabel,
      className: 'bg-slate-200/40 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300',
    },
    {
      label: dateStr,
      className: 'bg-slate-200/40 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300',
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
        ]}
      />
    </div>
  );
};

// ── Footer ──────────────────────────────────────────────────────────────────

export interface InterviewInsightPreviewFooterProps {
  insight: {
    id?: string;
    exportedToTools?: boolean;
    exportedToAssessment?: boolean;
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
  onOpenFull: () => void;
  onExportToTools?: () => void;
  onCopyLink?: () => void;
  /** Show the compact "What next" create-strip above the AI hints (default true). */
  showActionPanel?: boolean;
}

export const InterviewInsightPreviewFooter: React.FC<InterviewInsightPreviewFooterProps> = ({
  insight,
  isPolish,
  onOpenFull,
  onExportToTools,
  onCopyLink,
  showActionPanel = true,
}) => {
  const buttons: ActionRow['buttons'] = [
    {
      label: isPolish ? 'Otwórz' : 'Open',
      icon: ChevronRight,
      onClick: onOpenFull,
      colorScheme: 'primary',
      shortcut: 'O',
    },
  ];

  if (onExportToTools) {
    buttons.push({
      label: insight?.exportedToTools
        ? isPolish
          ? 'W Tools'
          : 'In Tools'
        : isPolish
          ? 'Eksport: Tools'
          : 'Export: Tools',
      icon: Send,
      onClick: onExportToTools,
      colorScheme: 'neutral',
      disabled: !!insight?.exportedToTools,
    });
  }

  if (onCopyLink) {
    buttons.push({
      label: isPolish ? 'Kopiuj link' : 'Copy link',
      icon: Copy,
      onClick: onCopyLink,
      colorScheme: 'neutral',
    });
  }

  const aiHints = isPolish
    ? ['Podsumuj wniosek', 'Zasugeruj działania']
    : ['Summarize insight', 'Suggest actions'];

  return (
    <div className="space-y-0">
      {/* Canon §7.3 footer order: AI → (Relations) → What next (create) → Actions. */}
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip hints={aiHints} />
      </div>
      {showActionPanel && (
        <>
          <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
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
        </>
      )}
      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
      <PreviewActionBar
        rows={[
          {
            buttons,
          },
        ]}
      />
    </div>
  );
};
