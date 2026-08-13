/**
 * `StatementReportActionsSection` — brief pkt 8: "Sekcja raportu ma mieć
 * jawne trzy akcje: «Generuj szkic» -> «Otwórz wynik» -> «Opublikuj/Dołącz do
 * raportu»." Trzy KROKI, nie jeden przycisk-magik — każdy krok ma własny,
 * jawny status opisany TEKSTEM (a11y — status nigdy samym kolorem, brief
 * pkt 7) i jest zablokowany, dopóki poprzedni krok się nie domknie, z
 * WIDOCZNYM powodem blokady (nie tylko wyszarzony przycisk bez wyjaśnienia).
 *
 * Ten komponent jest CZYSTO PREZENTACYJNY (jak `RelatedArtifactsSection`/
 * `SourceEvidencePanel`) — nie zna endpointów. Wywołujący (caller, docelowo
 * `StatementPackWorkspaceV2`) decyduje CO robi `onGenerateDraft`/
 * `onOpenResult`/`onPublish` (np. `createFinanceArtifact({artifactType:
 * 'REPORT_EXPORT'})` → `onOpenResult` przekazuje routing dalej →
 * `transitionFinanceVersion({action:'submit_for_review', ...})`).
 *
 * Kolejność wymuszona STANEM, nie tylko UX-em: `onOpenResult` nie jest
 * wołalny, dopóki `draftStatus !== 'ready'`; `onPublish` nie jest wołalny,
 * dopóki `openStatus !== 'opened'` — Krok 3 wymaga, żeby użytkownik
 * FAKTYCZNIE otworzył wynik przynajmniej raz, nie tylko żeby szkic istniał.
 */

import React from 'react';

export type ReportDraftStageStatus = 'not_started' | 'in_progress' | 'ready' | 'failed';
export type ReportOpenStageStatus = 'blocked' | 'available' | 'opened';
export type ReportPublishStageStatus = 'blocked' | 'available' | 'in_progress' | 'published' | 'failed';

export interface StatementReportActionsSectionProps {
  draftStatus: ReportDraftStageStatus;
  draftError: string | null;
  openStatus: ReportOpenStageStatus;
  publishStatus: ReportPublishStageStatus;
  publishError: string | null;
  onGenerateDraft: () => void;
  onOpenResult: () => void;
  onPublish: () => void;
}

interface StepDescriptor {
  id: string;
  index: number;
  title: string;
  statusText: string;
  tone: 'neutral' | 'ok' | 'warning' | 'danger' | 'pending';
  disabled: boolean;
  disabledReason: string | null;
  buttonLabel: string;
  onClick: () => void;
}

const TONE_CLASSES: Record<StepDescriptor['tone'], string> = {
  neutral: 'bg-c-surface-raised text-c-text-secondary',
  ok: 'bg-c-success/10 text-c-success',
  warning: 'bg-c-warning/10 text-c-warning',
  danger: 'bg-c-danger/10 text-c-danger',
  pending: 'bg-c-surface-raised text-c-text-muted',
};

export function StatementReportActionsSection(props: StatementReportActionsSectionProps): React.ReactElement {
  const { draftStatus, draftError, openStatus, publishStatus, publishError, onGenerateDraft, onOpenResult, onPublish } =
    props;

  const steps: StepDescriptor[] = [
    {
      id: 'draft',
      index: 1,
      title: 'Generuj szkic',
      statusText: draftStatusText(draftStatus, draftError),
      tone: draftStatusTone(draftStatus),
      disabled: draftStatus === 'in_progress',
      disabledReason: draftStatus === 'in_progress' ? 'Generowanie w toku…' : null,
      buttonLabel: draftStatus === 'ready' || draftStatus === 'failed' ? 'Generuj ponownie' : 'Generuj szkic',
      onClick: onGenerateDraft,
    },
    {
      id: 'open',
      index: 2,
      title: 'Otwórz wynik',
      statusText: openStatusText(openStatus, draftStatus),
      tone: openStatusTone(openStatus),
      disabled: draftStatus !== 'ready',
      disabledReason: draftStatus !== 'ready' ? 'Najpierw wygeneruj szkic (krok 1).' : null,
      buttonLabel: 'Otwórz wynik',
      onClick: onOpenResult,
    },
    {
      id: 'publish',
      index: 3,
      title: 'Opublikuj / Dołącz do raportu',
      statusText: publishStatusText(publishStatus, openStatus, publishError),
      tone: publishStatusTone(publishStatus),
      disabled: openStatus !== 'opened' || publishStatus === 'in_progress' || publishStatus === 'published',
      disabledReason:
        openStatus !== 'opened'
          ? 'Najpierw otwórz wynik (krok 2).'
          : publishStatus === 'in_progress'
            ? 'Publikacja w toku…'
            : publishStatus === 'published'
              ? 'Już opublikowano.'
              : null,
      buttonLabel: publishStatus === 'failed' ? 'Spróbuj opublikować ponownie' : 'Opublikuj / Dołącz do raportu',
      onClick: onPublish,
    },
  ];

  return (
    <div className="divide-y divide-c-border-subtle" data-testid="statement-report-actions-section">
      {steps.map((step) => (
        <div key={step.id} className="flex flex-col gap-1.5 px-3 py-2.5" data-testid={`statement-report-step-${step.id}`}>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-c-surface-raised text-[10px] font-bold text-c-text-secondary">
              {step.index}
            </span>
            <span className="text-xs font-semibold text-c-text">{step.title}</span>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLASSES[step.tone]}`}
              data-testid={`statement-report-step-status-${step.id}`}
            >
              {step.statusText}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-7">
            <button
              type="button"
              disabled={step.disabled}
              onClick={step.onClick}
              data-testid={`statement-report-step-button-${step.id}`}
              className="inline-flex min-h-[1.75rem] items-center rounded-lg border border-c-border-subtle px-2.5 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              {step.buttonLabel}
            </button>
            {step.disabledReason && (
              <span className="text-[10px] text-c-text-muted" data-testid={`statement-report-step-reason-${step.id}`}>
                {step.disabledReason}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function draftStatusText(status: ReportDraftStageStatus, error: string | null): string {
  switch (status) {
    case 'not_started':
      return 'Nie rozpoczęto';
    case 'in_progress':
      return 'Generowanie…';
    case 'ready':
      return 'Szkic gotowy';
    case 'failed':
      return error ? `Błąd: ${error}` : 'Błąd generowania';
  }
}

function draftStatusTone(status: ReportDraftStageStatus): StepDescriptor['tone'] {
  switch (status) {
    case 'not_started':
      return 'neutral';
    case 'in_progress':
      return 'pending';
    case 'ready':
      return 'ok';
    case 'failed':
      return 'danger';
  }
}

function openStatusText(status: ReportOpenStageStatus, draftStatus: ReportDraftStageStatus): string {
  if (status === 'opened') return 'Otwarty';
  if (status === 'available') return 'Gotowy do otwarcia';
  return draftStatus === 'ready' ? 'Zablokowany' : 'Czeka na szkic';
}

function openStatusTone(status: ReportOpenStageStatus): StepDescriptor['tone'] {
  switch (status) {
    case 'opened':
      return 'ok';
    case 'available':
      return 'neutral';
    case 'blocked':
      return 'pending';
  }
}

function publishStatusText(
  status: ReportPublishStageStatus,
  openStatus: ReportOpenStageStatus,
  error: string | null
): string {
  switch (status) {
    case 'blocked':
      return openStatus === 'opened' ? 'Gotowy do publikacji' : 'Czeka na otwarcie wyniku';
    case 'available':
      return 'Gotowy do publikacji';
    case 'in_progress':
      return 'Publikowanie…';
    case 'published':
      return 'Opublikowano';
    case 'failed':
      return error ? `Błąd: ${error}` : 'Błąd publikacji';
  }
}

function publishStatusTone(status: ReportPublishStageStatus): StepDescriptor['tone'] {
  switch (status) {
    case 'blocked':
      return 'pending';
    case 'available':
      return 'neutral';
    case 'in_progress':
      return 'pending';
    case 'published':
      return 'ok';
    case 'failed':
      return 'danger';
  }
}

export default StatementReportActionsSection;
