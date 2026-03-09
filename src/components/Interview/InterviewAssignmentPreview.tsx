import { ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import React from 'react';

import {
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type ActionRow,
  type MetaPill,
  type RelationItem,
} from '@/components/shared/PreviewPane';

export interface InterviewAssignmentPreviewBodyProps {
  assignment: any;
  isPolish: boolean;
  statusLabel: string;
  statusColor: string;
  progress: number;
  daysToDue: { label: string; colorClass: string } | null;
  detailsText: string;
  detailsMenuOpen: boolean;
  onToggleDetailsMenu: () => void;
  onDetailsAction: (action: 'expand' | 'summarize' | 'copy') => void;
}

export const InterviewAssignmentPreviewBody: React.FC<InterviewAssignmentPreviewBodyProps> = ({
  assignment,
  isPolish,
  statusLabel,
  statusColor,
  progress,
  daysToDue,
  detailsText,
  onDetailsAction,
}) => {
  const pills: MetaPill[] = [
    {
      label: statusLabel,
      className: statusColor,
      dot: 'bg-current',
    },
    {
      label: `${isPolish ? 'Postęp' : 'Progress'}: ${progress}%`,
      className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    },
    ...(daysToDue
      ? [
          {
            label: daysToDue.label,
            className: daysToDue.colorClass,
          } as MetaPill,
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={pills}>
        {assignment.assignee?.name || assignment.assignee?.email ? (
          <div
            className="mt-2 text-xs text-slate-600 dark:text-slate-300 truncate"
            title={assignment.assignee?.name || assignment.assignee?.email}
          >
            {isPolish ? 'Przydzielony do' : 'Assignee'}:{' '}
            {assignment.assignee?.name || assignment.assignee?.email}
          </div>
        ) : null}
      </PreviewMetaCard>

      <PreviewDetailsSection
        text={detailsText}
        onExpand={() => onDetailsAction('expand')}
        onSummarize={() => onDetailsAction('summarize')}
        onCopy={() => onDetailsAction('copy')}
      />
    </div>
  );
};

export interface InterviewAssignmentPreviewFooterProps {
  assignment: any;
  isPolish: boolean;
  aiHints: string[];
  aiText: string | null;
  aiError: string | null;
  aiLoading?: boolean;
  aiMenuOpen: boolean;
  onToggleAiMenu: () => void;
  onRunAiHint: (hint: string) => void;
  onRegenerateAi?: () => void;
  onCopyAi?: () => void;
  onClearAi?: () => void;
  relations: Array<{ label: string; tone: string }>;
  onStartAssignment?: () => void;
  onContinueAssignment?: () => void;
  onFixAssignment?: () => void;
  onOpenFull: () => void;
}

export const InterviewAssignmentPreviewFooter: React.FC<InterviewAssignmentPreviewFooterProps> = ({
  assignment,
  isPolish,
  aiHints,
  aiText,
  aiError,
  aiLoading,
  onRunAiHint,
  onRegenerateAi,
  onCopyAi,
  onClearAi,
  relations,
  onStartAssignment,
  onContinueAssignment,
  onFixAssignment,
  onOpenFull,
}) => {
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    tone: r.tone,
  }));

  const hasSession = Boolean(assignment.sessionId || assignment.session?.id);
  const buttons: ActionRow['buttons'] = [];

  if (assignment.status === 'assigned' && onStartAssignment) {
    buttons.push({
      label: isPolish ? 'Rozpocznij' : 'Start',
      icon: Sparkles,
      onClick: onStartAssignment,
      colorScheme: 'blue',
      flex: true,
    });
  } else if (assignment.status === 'in_progress' && hasSession && onContinueAssignment) {
    buttons.push({
      label: isPolish ? 'Kontynuuj' : 'Continue',
      icon: ChevronRight,
      onClick: onContinueAssignment,
      colorScheme: 'purple',
      flex: true,
    });
  } else if (assignment.status === 'sent_back' && hasSession && onFixAssignment) {
    buttons.push({
      label: isPolish ? 'Popraw' : 'Fix & resubmit',
      icon: RotateCcw,
      onClick: onFixAssignment,
      colorScheme: 'amber',
      flex: true,
    });
  }

  buttons.push({
    label: isPolish ? 'Otwórz' : 'Open',
    icon: ChevronRight,
    onClick: onOpenFull,
    colorScheme: 'neutral',
    flex: true,
  });

  const rows: ActionRow[] = [{ buttons }];

  return (
    <div className="space-y-0">
      <PreviewAIHintStrip
        hints={aiHints}
        loading={aiLoading}
        result={aiText}
        error={aiError}
        onRunHint={onRunAiHint}
        onRegenerate={onRegenerateAi}
        onCopy={onCopyAi}
        onClear={onClearAi}
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewRelations
        items={relationItems}
        emptyLabel={isPolish ? 'Brak powiązań' : 'No linked documents'}
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewActionBar rows={rows} />
    </div>
  );
};
