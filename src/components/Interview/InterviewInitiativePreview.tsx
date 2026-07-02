import { ArrowRight, Copy, ExternalLink, Rocket, RotateCcw } from 'lucide-react';
import React from 'react';

import {
  type ActionRow,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';

// ─────────────────────────────────────────────────────────────────────────────
// InterviewInitiativePreviewFooter
//
// canon §7.3: preview footer order = AI → Relations → Actions.
// Initiatives have no dedicated AI backend yet, so the AI strip renders in a
// disabled state (minimal, not omitted) per the canon "render minimally" rule.
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewInitiativePreviewFooterProps {
  isPolish: boolean;
  /** 'DRAFT' | 'PENDING_REVIEW' | 'REVIEW'(moved-forward) … (raw status). */
  status: string;
  /** Whether the current user may approve/move initiatives forward. */
  canReview: boolean;
  relations: Array<{ label: string; tone?: string }>;
  onSendToReview?: () => void;
  onApproveMoveForward?: () => void;
  onBackToDraft?: () => void;
  onOpenInModule?: () => void;
  onCopyId: () => void;
}

export const InterviewInitiativePreviewFooter: React.FC<InterviewInitiativePreviewFooterProps> = ({
  isPolish,
  status,
  canReview,
  relations,
  onSendToReview,
  onApproveMoveForward,
  onBackToDraft,
  onOpenInModule,
  onCopyId,
}) => {
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    tone: r.tone ?? 'text-slate-600 dark:text-slate-300',
  }));

  const normalized = String(status || '').toUpperCase();
  const isDraft = normalized === 'DRAFT';
  const isPending = normalized === 'PENDING_REVIEW';

  // NOTE: "Open" lives exclusively in PreviewPaneShell header (canon §7.3 anty-duplikacja).
  const contextButtons = [
    ...(isDraft && onSendToReview
      ? [
          {
            label: isPolish ? 'Wyślij do przeglądu' : 'Send to review',
            icon: ArrowRight,
            onClick: onSendToReview,
            colorScheme: 'neutral' as const,
          },
        ]
      : []),
    ...(isPending && canReview && onApproveMoveForward
      ? [
          {
            label: isPolish ? 'Zatwierdź i przekaż dalej' : 'Approve and move forward',
            icon: Rocket,
            onClick: onApproveMoveForward,
            colorScheme: 'primary' as const,
          },
        ]
      : []),
    ...(isPending && onBackToDraft
      ? [
          {
            label: isPolish ? 'Wróć do szkicu' : 'Back to draft',
            icon: RotateCcw,
            onClick: onBackToDraft,
            colorScheme: 'neutral' as const,
          },
        ]
      : []),
    ...(onOpenInModule
      ? [
          {
            // M13 flow redesign: the DOCUMENT is the working surface — for a
            // DRAFT this is the primary move (staging stays a source view).
            label: isPolish ? 'Otwórz dokument inicjatywy' : 'Open initiative document',
            icon: ExternalLink,
            onClick: onOpenInModule,
            colorScheme: isDraft ? ('primary' as const) : ('neutral' as const),
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
          hints={
            isPolish
              ? ['Podsumuj', 'Ryzyka', 'Następne kroki']
              : ['Summarize', 'Risks', 'Next steps']
          }
          onRunHint={() => {}}
          disabled
          disabledTooltip={
            isPolish ? 'AI dla inicjatyw — wkrótce' : 'AI for initiatives — coming soon'
          }
        />
      </div>

      <PreviewRelations items={relationItems} />

      {actionRows.length > 0 && <PreviewActionBar rows={actionRows} />}
    </div>
  );
};

export default InterviewInitiativePreviewFooter;
