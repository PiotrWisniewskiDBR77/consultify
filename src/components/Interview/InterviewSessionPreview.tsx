import { Calendar, ChevronRight, Copy, Sparkles } from 'lucide-react';
import React from 'react';

import {
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type ActionRow,
  type DetailsAction,
  type MetaPill,
  type RelationItem,
} from '@/components/shared/PreviewPane';

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
  statusConfig: {
    bgColor: string;
    dotColor: string;
    textColor: string;
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
  const started = session.startedAt
    ? new Date(session.startedAt).toLocaleDateString()
    : '—';
  const last = session.lastActivityAt
    ? new Date(session.lastActivityAt).toLocaleDateString()
    : '—';

  const pills: MetaPill[] = [
    {
      label: isPolish ? 'Sesja' : 'Session',
      className:
        'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-300/30 dark:border-purple-500/20',
    },
    {
      label: isPolish ? statusConfig.label.pl : statusConfig.label.en,
      className: `${statusConfig.bgColor} ${statusConfig.textColor}`,
      dot: statusConfig.dotColor,
    },
    {
      label: `${isPolish ? 'Postęp' : 'Progress'}: ${progress}%`,
      className: 'bg-slate-500/10 text-slate-700 dark:text-slate-200',
    },
    {
      label: started,
      icon: Calendar,
      className: 'bg-slate-500/10 text-slate-700 dark:text-slate-200',
    },
  ];

  const detailsText = [
    `${isPolish ? 'Odpowiedzi' : 'Answers'}: ${session.answeredQuestions}/${session.totalQuestions}`,
    `${isPolish ? 'Start' : 'Started'}: ${started}`,
    `${isPolish ? 'Aktywność' : 'Last activity'}: ${last}`,
    session.ownerId ? `${isPolish ? 'Owner' : 'Owner'}: ${session.ownerId}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const customActions: DetailsAction[] = [
    {
      id: 'toggle',
      label: detailsExpanded
        ? isPolish
          ? 'Zwiń'
          : 'Collapse'
        : isPolish
          ? 'Rozwiń'
          : 'Expand',
      onClick: onToggleDetailsExpanded,
    },
    {
      id: 'copy-stats',
      label: isPolish ? 'Kopiuj metryki' : 'Copy stats',
      icon: Copy,
      onClick: onCopyStats,
    },
    {
      id: 'copy-id',
      label: isPolish ? 'Kopiuj ID' : 'Copy ID',
      icon: Copy,
      onClick: onCopyId,
    },
  ];

  return (
    <div className="space-y-4 text-sm">
      <PreviewMetaCard pills={pills} />
      <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
        <PreviewDetailsSection
          text={detailsText}
          customActions={customActions}
          expanded={detailsExpanded}
          onToggleExpanded={onToggleDetailsExpanded}
        />
      </div>
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
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    tone: r.tone ?? 'text-slate-600 dark:text-slate-300',
  }));

  const actionRows: ActionRow[] = [
    {
      buttons: [
        {
          label: isPolish ? 'Otwórz' : 'Open',
          icon: ChevronRight,
          onClick: onOpenFull,
          colorScheme: 'primary',
        },
        ...(canRunAi && onGenerateInsight
          ? [
              {
                label: isPolish ? 'Generuj wnioski' : 'Generate insights',
                icon: Sparkles,
                onClick: () => onGenerateInsight('summary'),
                colorScheme: 'neutral' as const,
              },
            ]
          : []),
        {
          label: isPolish ? 'Kopiuj ID' : 'Copy ID',
          icon: Copy,
          onClick: onCopyId,
          colorScheme: 'neutral',
        },
      ],
    },
  ];

  return (
    <div className="space-y-0">
      <PreviewAIHintStrip
        hints={aiHints}
        onRunHint={onRunAiHint}
        disabled={!canRunAi}
        disabledTooltip={
          isPolish ? 'AI dostępne po zakończeniu sesji' : 'AI available after completion'
        }
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewRelations items={relationItems} />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
