import { Calendar, ChevronRight, Copy, Sparkles } from 'lucide-react';
import React from 'react';

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
  const started = session.startedAt ? new Date(session.startedAt).toLocaleDateString() : '—';
  const last = session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleDateString() : '—';

  const pills: MetaPill[] = [
    {
      label: isPolish ? 'Sesja' : 'Session',
      className:
        'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border-blue-200/40 dark:border-blue-400/20',
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
      label: detailsExpanded ? (isPolish ? 'Zwiń' : 'Collapse') : isPolish ? 'Rozwiń' : 'Expand',
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
    <div className="space-y-4">
      {/* canon §4.1: status via EntityStatusChip (statusChipTone → c.*) */}
      <div className="flex items-center gap-2">
        <EntityStatusChip
          status={session.status}
          label={isPolish ? statusConfig.label.pl : statusConfig.label.en}
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
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    tone: r.tone ?? 'text-slate-600 dark:text-slate-300',
  }));

  // NOTE: "Open" lives exclusively in PreviewPaneShell header (canon §7.3 anty-duplikacja).
  const contextButtons = [
    ...(canRunAi && onGenerateInsight
      ? [
          {
            label: isPolish ? 'Generuj wnioski' : 'Generate insights',
            icon: Sparkles,
            onClick: () => onGenerateInsight('summary'),
            colorScheme: 'neutral' as const,
            shortcut: 'G',
          },
        ]
      : []),
    {
      label: isPolish ? 'Kopiuj ID' : 'Copy ID',
      icon: Copy,
      onClick: onCopyId,
      colorScheme: 'neutral' as const,
    },
  ];

  const actionRows: ActionRow[] = contextButtons.length > 0 ? [{ buttons: contextButtons }] : [];

  return (
    // canon §7.3: space-y-2.5, NO border-t dividers between footer cards
    <div className="space-y-2.5">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip
          hints={aiHints}
          onRunHint={onRunAiHint}
          disabled={!canRunAi}
          disabledTooltip={
            isPolish ? 'AI dostępne po zakończeniu sesji' : 'AI available after completion'
          }
        />
      </div>

      <PreviewRelations items={relationItems} />

      {actionRows.length > 0 && <PreviewActionBar rows={actionRows} />}
    </div>
  );
};
