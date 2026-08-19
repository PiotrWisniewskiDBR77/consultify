import { Check, ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
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
  const { t } = useTranslation();
  const pills: MetaPill[] = [
    {
      label: statusLabel,
      className: statusColor,
      dot: 'bg-current',
    },
    {
      label: `${t('interview.assignmentPreview.progress')}: ${progress}%`,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
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
            className="mt-2 text-xs text-[var(--c-text-secondary)] truncate"
            title={assignment.assignee?.name || assignment.assignee?.email}
          >
            {t('interview.assignmentPreview.assignee')}:{' '}
            {assignment.assignee?.name || assignment.assignee?.email}
          </div>
        ) : null}
        {Array.isArray(assignment.teamMembers) && assignment.teamMembers.length > 0 ? (
          <div className="mt-2 text-xs text-[var(--c-text-secondary)]">
            <span className="font-medium">
              {isPolish ? 'Zespół' : 'Team'} ({assignment.teamMembers.length}):
            </span>{' '}
            {assignment.teamMembers
              .map((m: any) =>
                m?.role === 'lead'
                  ? `${m?.name || m?.email} (lead)`
                  : m?.name || m?.email
              )
              .filter(Boolean)
              .join(', ')}
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
  /** `title` = tooltip (miejsce na identyfikator techniczny, nigdy w `label`). */
  relations: Array<{ label: string; tone: string; title?: string }>;
  onStartAssignment?: () => void;
  onContinueAssignment?: () => void;
  onFixAssignment?: () => void;
  /**
   * Akcje recenzenta dla przydziału oddanego do oceny (`submitted`).
   *
   * Przegląd 128 zrzutów zapisał ten ekran jako „BRAK CAŁEJ STOPKI AKCJI", ale
   * przyczyna była inna niż „nie zbudowano stopki": stopka renderowała przyciski
   * WYŁĄCZNIE dla `assigned` / `in_progress` / `sent_back`. Rekord na zrzucie
   * miał status `Approved`, więc lista przycisków wychodziła pusta i znikał
   * cały blok. Stany, w których przydział czeka NA MNIE jako oceniającego,
   * nie miały czym się odezwać.
   */
  onApproveAssignment?: () => void;
  onSendBackAssignment?: () => void;
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
  onApproveAssignment,
  onSendBackAssignment,
  onOpenFull,
}) => {
  const { t } = useTranslation();
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    title: r.title,
    tone: r.tone,
  }));

  const hasSession = Boolean(assignment.sessionId || assignment.session?.id);
  const buttons: ActionRow['buttons'] = [];

  if (assignment.status === 'assigned' && onStartAssignment) {
    buttons.push({
      label: t('interview.assignmentPreview.start'),
      icon: Sparkles,
      onClick: onStartAssignment,
      colorScheme: 'primary',
      flex: true,
      shortcut: 'S',
    });
  } else if (assignment.status === 'in_progress' && hasSession && onContinueAssignment) {
    buttons.push({
      label: t('interview.assignmentPreview.continue'),
      icon: ChevronRight,
      onClick: onContinueAssignment,
      colorScheme: 'primary',
      flex: true,
      shortcut: 'C',
    });
  } else if (assignment.status === 'sent_back' && hasSession && onFixAssignment) {
    buttons.push({
      label: t('interview.assignmentPreview.fixResubmit'),
      icon: RotateCcw,
      onClick: onFixAssignment,
      colorScheme: 'amber',
      flex: true,
      shortcut: 'F',
    });
  }

  // Oddane do oceny — decyzja należy do oglądającego. Wzorzec 1:1 z podglądu
  // Decisions (przegląd 128 zrzutów wskazał go jako najlepszy w produkcie):
  // para akcji jako TINTY, nigdy jako plamy koloru.
  if (assignment.status === 'submitted') {
    if (onApproveAssignment) {
      buttons.push({
        label: t('interview.assignmentPreview.approve', isPolish ? 'Zatwierdź' : 'Approve'),
        icon: Check,
        onClick: onApproveAssignment,
        colorScheme: 'emerald',
        flex: true,
        shortcut: 'A',
      });
    }
    if (onSendBackAssignment) {
      buttons.push({
        label: t(
          'interview.assignmentPreview.sendBack',
          isPolish ? 'Odeślij do poprawy' : 'Send back'
        ),
        icon: RotateCcw,
        onClick: onSendBackAssignment,
        colorScheme: 'amber',
        flex: true,
        shortcut: 'R',
      });
    }
  }

  // NOTE: "Open" button lives exclusively in the PreviewPaneShell header (canon §7.3 anty-duplikacja).
  // Do NOT add an extra Open button here.

  const rows: ActionRow[] = buttons.length > 0 ? [{ buttons }] : [];

  /**
   * Stan końcowy nie ma akcji przejścia — i to jest w porządku. Czego brakowało,
   * to POWIEDZENIA tego wprost: podgląd zatwierdzonego przydziału był po prostu
   * urwany, bez śladu, że to koniec drogi, a nie brakująca funkcja.
   *
   * Baner stanu to wzorzec z Interview → Initiatives („Draft — stays in Interview
   * until it is moved forward"), który przegląd wskazał jako element do
   * skopiowania: tłumaczy stan I jego konsekwencję.
   */
  const banerStanu =
    assignment.status === 'approved'
      ? isPolish
        ? 'Zatwierdzone — przydział jest zamknięty i nie wymaga już działania.'
        : 'Approved — this assignment is closed and needs nothing further.'
      : null;

  return (
    // canon §7.3: space-y-2.5, NO border-t dividers between footer cards
    <div className="space-y-2.5">
      <div className="rounded-token-md border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] p-2.5">
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
      </div>

      <PreviewRelations
        items={relationItems}
        emptyLabel={t('interview.assignmentPreview.noLinkedDocuments')}
      />

      {banerStanu ? (
        <div className="rounded-token-md border-l-2 border-emerald-400/70 bg-emerald-50/60 dark:bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
          {banerStanu}
        </div>
      ) : null}

      {rows.length > 0 && <PreviewActionBar rows={rows} />}
    </div>
  );
};
