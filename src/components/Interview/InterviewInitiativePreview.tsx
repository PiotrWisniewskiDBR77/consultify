import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Copy,
  ExternalLink,
  Lightbulb,
  Rocket,
  RotateCcw,
} from 'lucide-react';
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
import { EntityStatusChip, PriorityChip, type PriorityLevel } from '@/components/ui/primitives/chips';

// ─────────────────────────────────────────────────────────────────────────────
// InterviewInitiativePreviewBody
//
// canon §7.3: Meta bar (block 2) + Details (block 3, MUST have a local kebab)
// via the shared PreviewMetaCard/PreviewDetailsSection building blocks — same
// pattern as InterviewSessionPreviewBody/InterviewInsightPreviewBody. Before
// DEC-2026-08-25-53 this preview hand-rolled its own meta row and a Details
// block with NO kebab at all (`renderInitiativePreview` inline in
// InterviewHub.tsx) — the one violation the owner flagged.
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewInitiativePreviewBodyProps {
  initiative: {
    id: string;
    status: string;
    priority?: string;
    description?: string;
  };
  /** Resolved bilingual label for the status chip (from InterviewHub's statusMeta()). */
  statusLabel: string;
  /** Canon PriorityChip level, already mapped from the raw priority string. */
  priorityLevel?: PriorityLevel;
  /** True when the initiative was created from an Insight (source badge). */
  hasSourceInsight: boolean;
  dateStr: string;
  /** False while the draft stays in Interview pending hand-off (§7.1). */
  promoted: boolean;
  isPolish: boolean;
  detailsExpanded: boolean;
  onToggleDetailsExpanded: () => void;
  onCopyDetails: () => void;
  onCopyId: () => void;
}

export const InterviewInitiativePreviewBody: React.FC<InterviewInitiativePreviewBodyProps> = ({
  initiative,
  statusLabel,
  priorityLevel,
  hasSourceInsight,
  dateStr,
  promoted,
  detailsExpanded,
  onToggleDetailsExpanded,
  onCopyDetails,
  onCopyId,
}) => {
  const { t } = useTranslation();
  const desc = String(initiative.description || '').trim();

  const pills: MetaPill[] = [
    ...(hasSourceInsight
      ? [
          {
            label: 'Insight',
            icon: Lightbulb,
            className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
          },
        ]
      : []),
    {
      label: dateStr,
      icon: Calendar,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
    },
  ];

  const customActions: DetailsAction[] = [
    {
      id: 'toggle',
      label: detailsExpanded
        ? t('interview.initiativePreview.collapse')
        : t('interview.initiativePreview.expand'),
      icon: ChevronDown,
      onClick: onToggleDetailsExpanded,
    },
    {
      id: 'copy-details',
      label: t('interview.initiativePreview.copyDetails'),
      icon: Copy,
      onClick: onCopyDetails,
      disabled: !desc,
    },
    {
      id: 'copy-id',
      label: t('interview.initiativePreview.copyId'),
      icon: Copy,
      onClick: onCopyId,
    },
  ];

  return (
    <div className="space-y-4">
      {/* canon §4.1: status via EntityStatusChip (statusChipTone → c.*) */}
      <div className="flex flex-wrap items-center gap-2">
        <EntityStatusChip status={initiative.status} label={statusLabel} />
        {priorityLevel ? (
          <PriorityChip level={priorityLevel} label={String(initiative.priority).toLowerCase()} />
        ) : null}
      </div>
      <PreviewMetaCard pills={pills} />
      <PreviewDetailsSection
        label={t('interview.hub.details')}
        text={desc}
        expanded={detailsExpanded}
        onToggleExpanded={onToggleDetailsExpanded}
        customActions={customActions}
      />
      {!promoted ? (
        <div className="rounded-lg border-l-4 border-l-amber-500 border border-amber-300/50 bg-amber-100 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {t('interview.hub.draftStaysInInterviewUntil')}
        </div>
      ) : null}
    </div>
  );
};

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
