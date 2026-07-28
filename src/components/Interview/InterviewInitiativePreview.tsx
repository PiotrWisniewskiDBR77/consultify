import { ArrowRight, Copy, ExternalLink, Rocket, RotateCcw } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    tone: r.tone ?? 'text-[var(--c-text-secondary)]',
  }));

  const normalized = String(status || '').toUpperCase();
  const isDraft = normalized === 'DRAFT';
  const isPending = normalized === 'PENDING_REVIEW';

  // NOTE: "Open" lives exclusively in PreviewPaneShell header (canon §7.3 anty-duplikacja).
  const contextButtons = [
    ...(isDraft && onSendToReview
      ? [
          {
            label: t('interview.initiativePreview.sendToReview'),
            icon: ArrowRight,
            onClick: onSendToReview,
            colorScheme: 'neutral' as const,
          },
        ]
      : []),
    ...(isPending && canReview && onApproveMoveForward
      ? [
          {
            label: t('interview.initiativePreview.approveAndMoveForward'),
            icon: Rocket,
            onClick: onApproveMoveForward,
            colorScheme: 'primary' as const,
          },
        ]
      : []),
    ...(isPending && onBackToDraft
      ? [
          {
            label: t('interview.initiativePreview.backToDraft'),
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
            label: t('interview.initiativePreview.openInitiativeDocument'),
            icon: ExternalLink,
            onClick: onOpenInModule,
            colorScheme: isDraft ? ('primary' as const) : ('neutral' as const),
          },
        ]
      : []),
  ];

  const actionRows: ActionRow[] = contextButtons.length > 0 ? [{ buttons: contextButtons }] : [];

  /**
   * N-81 (przegląd 128 zrzutów): `Copy ID` stało w stopce OBOK akcji
   * biznesowych — „akcja deweloperska obok biznesowych", ten sam błąd co
   * w Interview → Sessions, gdzie było w dodatku JEDYNĄ akcją.
   *
   * Nie znika (bywa potrzebne przy zgłaszaniu błędu), ale przestaje zajmować
   * miejsce obok „Wyślij do przeglądu" i „Otwórz dokument inicjatywy". Ląduje
   * pod „…", zgodnie z kanonem gęstości: w stopce stoi to, po co użytkownik
   * tu przyszedł.
   */
  const overflowActions = [
    {
      label: t('interview.initiativePreview.copyId'),
      icon: Copy,
      onClick: onCopyId,
      colorScheme: 'neutral' as const,
    },
  ];

  return (
    // canon §7.3: space-y-2.5, NO border-t dividers between footer cards
    <div className="space-y-2.5">
      <div className="rounded-token-md border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] p-2.5">
        <PreviewAIHintStrip
          hints={[
            t('interview.initiativePreview.summarize'),
            t('interview.initiativePreview.risks'),
            t('interview.initiativePreview.nextSteps'),
          ]}
          onRunHint={() => {}}
          disabled
          disabledTooltip={t('interview.initiativePreview.aiForInitiativesComingSoon')}
        />
      </div>

      <PreviewRelations items={relationItems} />

      <PreviewActionBar rows={actionRows} overflowActions={overflowActions} />
    </div>
  );
};

export default InterviewInitiativePreviewFooter;
