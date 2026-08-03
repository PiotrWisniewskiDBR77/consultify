import { Calendar, ChevronRight, Copy, Sparkles } from 'lucide-react';
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
import {
  ArtifactPropertiesTable,
  type ArtifactPropertyRow,
} from '@/components/standard/ArtifactPropertiesTable';
import { EntityStatusChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

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
  /**
   * FALA 1 / „surowe identyfikatory w UI" (2026-07-27): w DETAILS wisiało
   * `Owner: d2b6a316-08c5-47cf-9bf7-4ba50311d5a2`. Linia właściciela pojawia
   * się teraz WYŁĄCZNIE gdy znamy czytelną nazwę; sam `ownerId` nigdy nie
   * trafia do treści (jest do wzięcia pod akcją „Kopiuj ID").
   */
  ownerName?: string;
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
  ownerName,
  isPolish,
  statusConfig,
  progress,
  detailsExpanded,
  onToggleDetailsExpanded,
  onCopyStats,
  onCopyId,
}) => {
  const { t } = useTranslation();
  const started = formatListDate(session.startedAt);
  const last = formatListDate(session.lastActivityAt);

  const pills: MetaPill[] = [
    {
      label: t('interview.sessionPreview.session'),
      className: 'bg-c-info/10 text-[var(--c-info)] border-c-info/20',
    },
    {
      label: `${t('interview.sessionPreview.progress')}: ${progress}%`,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
    },
    {
      label: started,
      icon: Calendar,
      className: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
    },
  ];

  /**
   * Przegląd 128 zrzutów (N-52): blok DETAILS pokazywał tu ZRZUT PÓL sklejony
   * w jeden akapit — „Answers: 0/6 Started: 30/04/2026 Last activity: …
   * Owner: …" — z licznikiem „~9 words" nad nim. Kanon wymaga w tym bloku
   * treści, a to nie jest treść, tylko WŁAŚCIWOŚCI.
   *
   * Idą więc tam, gdzie ich miejsce: w tabelę klucz–wartość. Przegląd wskazał
   * ją jako wzorzec (Tools → Reports: „czytelniejsza niż chipy etykieta:wartość"),
   * a `ArtifactPropertiesTable` jest jej kanoniczną postacią (SPEC-A §11.2).
   */
  const wlasciwosci: ArtifactPropertyRow[] = [
    {
      id: 'answers',
      label: t('interview.sessionPreview.answers'),
      value: `${session.answeredQuestions}/${session.totalQuestions}`,
      mono: true,
    },
    {
      id: 'started',
      label: t('interview.sessionPreview.started'),
      value: started,
      mono: true,
    },
    {
      id: 'last-activity',
      label: t('interview.sessionPreview.lastActivity'),
      value: last,
      mono: true,
    },
    ...(ownerName?.trim()
      ? [
          {
            id: 'owner',
            label: t('interview.sessionPreview.owner', 'Owner'),
            value: ownerName.trim(),
          },
        ]
      : []),
  ];

  const customActions: DetailsAction[] = [
    {
      id: 'toggle',
      label: detailsExpanded
        ? t('interview.sessionPreview.collapse')
        : t('interview.sessionPreview.expand'),
      onClick: onToggleDetailsExpanded,
    },
    {
      id: 'copy-stats',
      label: t('interview.sessionPreview.copyStats'),
      icon: Copy,
      onClick: onCopyStats,
    },
    {
      id: 'copy-id',
      label: t('interview.sessionPreview.copyId'),
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
          label={t(`interview.hub.sessionStatusLabel.${session.status}`, statusConfig.label.en)}
        />
      </div>
      <PreviewMetaCard pills={pills} />
      <PreviewDetailsSection
        label={t('interview.sessionPreview.propertiesLabel', isPolish ? 'Przebieg' : 'Progress')}
        customActions={customActions}
        expanded={detailsExpanded}
        onToggleExpanded={onToggleDetailsExpanded}
        // To tabela właściwości, nie proza — licznik słów nad nią nic nie znaczy.
        showWordCount={false}
      >
        <ArtifactPropertiesTable
          rows={wlasciwosci}
          propertyLabel={isPolish ? 'Właściwość' : 'Property'}
          valueLabel={isPolish ? 'Wartość' : 'Value'}
        />
      </PreviewDetailsSection>
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
  /** `title` = tooltip (miejsce na identyfikator techniczny, nigdy w `label`). */
  relations: Array<{ label: string; tone?: string; title?: string }>;
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
  const { t } = useTranslation();
  const relationItems: RelationItem[] = relations.map((r) => ({
    label: r.label,
    title: r.title,
    tone: r.tone ?? 'text-[var(--c-text-secondary)]',
  }));

  // NOTE: "Open" lives exclusively in PreviewPaneShell header (canon §7.3 anty-duplikacja).
  const contextButtons = [
    ...(canRunAi && onGenerateInsight
      ? [
          {
            label: t('interview.sessionPreview.generateInsights'),
            icon: Sparkles,
            onClick: () => onGenerateInsight('summary'),
            colorScheme: 'neutral' as const,
            shortcut: 'G',
          },
        ]
      : []),
  ];

  const actionRows: ActionRow[] = contextButtons.length > 0 ? [{ buttons: contextButtons }] : [];

  /**
   * N-51 (przegląd 128 zrzutów): „jedyna akcja w podglądzie sesji to skopiowanie
   * identyfikatora — czynność deweloperska, nie biznesowa".
   *
   * `Copy ID` nie znika (bywa potrzebne przy zgłoszeniu błędu), ale przestaje
   * zajmować miejsce akcji głównej. Ląduje pod „…", zgodnie z kanonem: w stopce
   * stoją akcje, po które użytkownik tu przyszedł, reszta chowa się w overflow.
   * Gdy sesja nie oferuje nic innego, stopka pokazuje sam trigger „…" zamiast
   * udawać, że kopiowanie identyfikatora jest tym, co chciało się zrobić.
   */
  const overflowActions = [
    {
      label: t('interview.sessionPreview.copyId'),
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
          hints={aiHints}
          onRunHint={onRunAiHint}
          disabled={!canRunAi}
          disabledTooltip={t('interview.sessionPreview.aiAvailableAfterCompletion')}
        />
      </div>

      <PreviewRelations items={relationItems} />

      <PreviewActionBar
        rows={actionRows}
        overflowActions={overflowActions}
        overflowLabel={isPolish ? 'Więcej akcji' : 'More actions'}
      />
    </div>
  );
};
