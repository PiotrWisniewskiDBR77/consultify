import { Download, FileCheck, FileText, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import {
  ArtifactPropertiesTable,
  type ArtifactPropertyRow,
} from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type { NModeHeaderConfig, NModeSection } from '@/components/shared/NModeLayout/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import {
  getAssessmentReportContract,
  isOfflineError,
  MethodCoreApiError,
  type AssessmentReportAreaComment,
  type AssessmentReportChapter,
  type AssessmentReportContract,
  type AssessmentReportEvidenceState,
  type AssessmentReportSkip,
} from '@/method-core/api/methodCoreApi';
import { isAssessmentReportViewEnabled } from '@/utils/assessmentReportViewFlag';
import { isAssessmentDocxEnabled } from '@/utils/assessmentDocxFlag';
import { getHeaders } from '@/services/api/baseClient';

import { SKIP_REASON_LABELS } from '../../method-workspace/skipReasonCodes';
import { DRDMatrixReadOnly, drdOdpowiedziZOutputu } from '../drd/DRDMatrixReadOnly';

export interface AssessmentReportContractViewProps {
  readonly sessionId: string;
  readonly className?: string;
}

export function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/iu.exec(value)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      return utf8;
    }
  }
  return /filename="?([^";]+)"?/iu.exec(value)?.[1]?.trim() ?? null;
}

function fallbackDocxFilename(contract: AssessmentReportContract): string {
  const withLabel = contract as AssessmentReportContract & {
    sessionLabel?: { displayName?: string | null };
  };
  const label = withLabel.sessionLabel?.displayName ?? contract.sessionId;
  const safeLabel = label
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  const date = new Date(contract.generatedAt).toISOString().slice(0, 10).replaceAll('-', '');
  return `Raport_DRD_${safeLabel || contract.sessionId}_${date}.docx`;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'ready'; readonly contract: AssessmentReportContract };

const evidenceKey: Record<AssessmentReportEvidenceState, string> = {
  evidenced: 'evidenced',
  incomplete: 'incomplete',
  declared: 'declared',
  not_assessed: 'notAssessed',
};

function EmptySlot({ min, max }: { readonly min: number; readonly max: number }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed border-c-border bg-c-surface-raised px-4 py-3 text-sm text-c-text-muted">
      {t('assessment.reportView.emptySlot', { min, max })}
    </div>
  );
}

function NarrativeSlot({ content, min, max }: { readonly content: string | null; readonly min: number; readonly max: number }) {
  return content?.trim() ? (
    <p className="whitespace-pre-wrap text-sm leading-7 text-c-text-secondary">{content}</p>
  ) : (
    <EmptySlot min={min} max={max} />
  );
}

function SkipSummary({
  skips,
  skipped,
  maxLevel,
}: {
  readonly skips: readonly AssessmentReportSkip[];
  readonly skipped: boolean;
  readonly maxLevel: number;
}) {
  const { t } = useTranslation();
  if (skips.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 text-xs text-c-text-secondary">
      <p className="font-semibold text-c-text">
        {skipped
          ? t('assessment.reportView.skips.whole', { count: skips.length })
          : t('assessment.reportView.skips.partial', { count: skips.length, total: maxLevel })}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {skips.map((skip) => (
          <li key={`${skip.questionId}:${skip.skipCode}`}>
            {t('assessment.reportView.skips.question', {
              question: skip.questionId,
              reason: SKIP_REASON_LABELS[skip.skipCode],
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ★ MACIERZ RAPORTU = MACIERZ WŁAŚCICIELA (2026-09-05, PIĄTE zgłoszenie tej
// samej sprawy). Do dziś ten ekran rysował WŁASNĄ tabelę „Obszar / Poziom
// obecny / Poziom docelowy / Luka / Stan dowodów" (aria-label „Axis matrix
// table"). To jest dokładnie ten kształt, który właściciel odrzucił
// (`docs/program/grafika/DZIENNIK_GRAFIKA.md` Z-10) — pięć liczb w wierszu,
// zero drogi rozwoju obszaru po drabinie poziomów, a przy nieocenionej sesji
// pięć kolumn „(nie oceniono)".
//
// Prezentacja (`presentation/slides.tsx`, 7e262a2b9c) i dokument raportu
// (`AssessmentReportDocument.tsx`, 81b1d9669f) dostały to naprawione 01.09 —
// ten ekran został pominięty. Teraz rysuje TĘ SAMĄ siatkę: `DRDMatrixGrid`
// przez wspólne opakowanie `DRDMatrixReadOnly`, czyli macierz z ekranu
// „Macierz oceny DRD — obszary x poziomy" (ocena B od właściciela 01.09):
// wiersze = poziomy (najwyższy u góry), kolumny = obszary, treść komórek
// z kanonu (`docs/program/grafika/MACIERZ_TRESC_KOMOREK.md`), wypełnienie
// kumulatywne, chipy `AS n` / `TO n` w dolnym pasku „Area".
//
// ★ EKSPORT, NIE KOPIA — kopii tej macierzy jest w repo już kilka (Z-12:
// „kopii jest w tym repo więcej niż oryginałów") i to one są powodem
// kolejnych pudeł. Szósta kopia byłaby powtórzeniem tego samego błędu.
//
// ★ CO ZE ZNIKNIĘTYMI KOLUMNAMI. Nic nie ubywa z EKRANU: „poziom obecny"
// i „docelowy" niosą chipy `AS`/`TO` w pasku obszarów (luka = ich różnica),
// a „stan dowodów" per obszar jest w sekcji „Komentarz per obszar" niżej
// (`AreaComment` → `assessment.reportView.evidence.*`). Pominięcia zostają
// pełnowymiarowym blokiem POD siatką — tak jak dotąd (FIX P1-3 day-27:
// w komórce tabeli rozpychały ją poza kolumnę rozdziału).
function Matrix({ chapter }: { readonly chapter: AssessmentReportChapter }) {
  const { t } = useTranslation();
  const areasWithSkips = chapter.matrix.areas.filter((area) => area.skips.length > 0);
  const value = React.useMemo(
    () =>
      drdOdpowiedziZOutputu(
        chapter.matrix.areas.map((area) => area.unitId),
        Object.fromEntries(chapter.matrix.areas.map((area) => [area.unitId, area.currentLevel])),
        Object.fromEntries(chapter.matrix.areas.map((area) => [area.unitId, area.targetLevel]))
      ),
    [chapter]
  );
  return (
    <div className="space-y-3">
      <div
        data-testid="assessment-report-drd-matrix"
        role="group"
        aria-label={t('assessment.reportView.matrix.gridLabel')}
      >
        <DRDMatrixReadOnly axisNumber={chapter.axisId} value={value} columnMinPx={120} />
      </div>
      {areasWithSkips.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-c-text-muted">
            {t('assessment.reportView.matrix.skips')}
          </h4>
          {areasWithSkips.map((area) => (
            <div key={area.unitId}>
              <p className="mb-1 text-xs font-medium text-c-text">
                {area.unitId} · {area.unitNamePL ?? area.unitName}
              </p>
              <SkipSummary skips={area.skips} skipped={area.skipped} maxLevel={chapter.maxLevel} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AreaComment({
  comment,
  chapter,
}: {
  readonly comment: AssessmentReportAreaComment;
  readonly chapter: AssessmentReportChapter;
}) {
  const { t } = useTranslation();
  const area = chapter.matrix.areas.find((candidate) => candidate.unitId === comment.unitId);
  return (
    <article className="rounded-xl border border-c-border-subtle bg-c-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-c-text">
          {comment.unitId} · {area?.unitNamePL ?? area?.unitName ?? comment.unitId}
        </h4>
        <span className="text-xs text-c-text-muted">
          {t('assessment.reportView.wordLimit', { min: comment.minWords, max: comment.maxWords })}
        </span>
      </div>
      <p className="mt-1 text-xs text-c-text-secondary">
        {t(`assessment.reportView.evidence.${evidenceKey[comment.uncertainty]}`)}
      </p>
      <div className="mt-4">
        <NarrativeSlot content={comment.content} min={comment.minWords} max={comment.maxWords} />
      </div>
      <SkipSummary skips={comment.skips} skipped={comment.skipped} maxLevel={chapter.maxLevel} />
      {comment.answerRefs.length + comment.evidenceRefs.length + comment.sourceLocators.length >
      0 ? (
        <details className="mt-3 text-xs text-c-text-secondary">
          <summary className="cursor-pointer font-medium text-c-text">
            {t('assessment.reportView.traceability.title')}
          </summary>
          <p className="mt-2">
            {t('assessment.reportView.traceability.counts', {
              answers: comment.answerRefs.length,
              evidence: comment.evidenceRefs.length,
              sources: comment.sourceLocators.length,
            })}
          </p>
        </details>
      ) : null}
    </article>
  );
}

function Chapter({ chapter }: { readonly chapter: AssessmentReportChapter }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-8 bg-c-surface p-8" data-axis-id={chapter.axisId}>
      <section className="mx-auto w-full max-w-[760px]">
        <h3 className="mb-3 text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.introduction')}
        </h3>
        <NarrativeSlot content={chapter.introduction.content} min={chapter.introduction.minWords} max={chapter.introduction.maxWords} />
      </section>
      {/* ★ MACIERZ DOSTAJE CAŁĄ DOSTĘPNĄ SZEROKOŚĆ (poprawka 2026-09-05).
          Rozdział jest kolumną czytelniczą 760 px, bo tam szerokość szkodzi
          czytaniu akapitu. Macierz akapitem nie jest — 05.08 dostała własną
          kolumnę 1180 px i to NIE POMOGŁO: 1180 px było sufitem, a nie
          podłogą, a faktyczny kadr wynosił 503 px (zmierzone na żywo 05.09,
          `evidence/odbior-zywo-20260905/05-ocena/drd-macierz-w-raporcie.png`)
          — z dziewięciu obszarów właściciel widział trzy. Sufit znika:
          macierz bierze pełną szerokość dokumentu i wychodzi poza jego
          wewnętrzny margines (`-mx-8 px-4`), a siatka sama dobiera szerokość
          kolumn do kadru (`minimumKolumnyMacierzy`). Przewijanie w bok
          zostaje wyłącznie zabezpieczeniem dla naprawdę wąskiego okna. */}
      <section className="-mx-8 w-auto space-y-3 px-4">
        <h3 className="text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.matrix')}
        </h3>
        <Matrix chapter={chapter} />
        <NarrativeSlot content={chapter.matrix.caption.content} min={chapter.matrix.caption.minWords} max={chapter.matrix.caption.maxWords} />
      </section>
      <section className="mx-auto w-full max-w-[760px] space-y-4">
        <h3 className="text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.comments')}
        </h3>
        {chapter.areaComments.map((comment) => (
          <AreaComment key={comment.unitId} comment={comment} chapter={chapter} />
        ))}
      </section>
      <section className="mx-auto w-full max-w-[760px] space-y-3">
        <h3 className="text-lg font-semibold text-c-text">
          {t('assessment.reportView.sections.conclusion')}
        </h3>
        <NarrativeSlot content={chapter.conclusion.content} min={chapter.conclusion.minWords} max={chapter.conclusion.maxWords} />
        <dl className="grid gap-3 sm:grid-cols-2">
          {(['direction', 'priority', 'horizon', 'successCondition'] as const).map((field) => (
            <div key={field} className="rounded-lg border border-c-border-subtle p-3">
              <dt className="text-xs font-semibold text-c-text-muted">
                {t(`assessment.reportView.decision.${field}`)}
              </dt>
              <dd className="mt-1 text-sm text-c-text">
                {chapter.conclusion.decisionLine[field] || t('assessment.reportView.toComplete')}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export const AssessmentReportContractView: React.FC<AssessmentReportContractViewProps> = ({
  sessionId,
  className,
}) => {
  const { t, i18n } = useTranslation();
  const enabled = isAssessmentReportViewEnabled();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [activeSection, setActiveSection] = useState('axis-1');
  const [downloadState, setDownloadState] = useState<
    { kind: 'idle' | 'loading' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getAssessmentReportContract(sessionId).then(
      (contract) => !cancelled && setState({ kind: 'ready', contract }),
      (error) => !cancelled && setState({ kind: 'error', error })
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, reload, sessionId]);

  const retry = useCallback(() => setReload((value) => value + 1), []);
  const contract = state.kind === 'ready' ? state.contract : null;
  const sections: NModeSection[] = useMemo(
    () =>
      (contract?.chapters ?? []).map((chapter) => ({
        id: `axis-${chapter.axisId}`,
        icon: FileText,
        /**
         * ★ SZYNA MUSI ROZRÓŻNIAĆ ROZDZIAŁY (odbiór na żywo 2026-09-05).
         * Zmierzone: szyna rozdziałów ma ~140 px, a etykieta z pełnej nazwy osi
         * („Procesy Cyfrowe", „Cyberbezpieczeństwo") była ucinana do „Pr…",
         * „Cy…", „Za…" — siedem rozdziałów wyglądało identycznie. Etykieta
         * = numer osi (jak na obrazie zatwierdzonym), pełna nazwa w dymku.
         */
        label: { pl: `Oś ${chapter.axisId}`, en: `Axis ${chapter.axisId}` },
        title: { pl: chapter.axisNamePL ?? chapter.axisName, en: chapter.axisName },
        alwaysShow: true,
        component: <Chapter chapter={chapter} />,
      })),
    [contract]
  );

  if (!enabled) return null;
  if (state.kind === 'loading')
    return <LoadingState template="panel" label={t('assessment.reportView.loading')} />;
  if (state.kind === 'error') {
    const error = state.error;
    const key = isOfflineError(error)
      ? 'offline'
      : error instanceof MethodCoreApiError && error.status === 404
        ? 'notFound'
        : error instanceof MethodCoreApiError && error.status === 401
          ? 'noOrganization'
          : error instanceof MethodCoreApiError && error.message.includes('version')
            ? 'version'
            : 'generic';
    return <ErrorState title={t(`assessment.reportView.errors.${key}`)} onRetry={retry} />;
  }
  if (sections.length === 0) {
    return <EmptyState variant="new" icon={FileCheck} title={t('assessment.reportView.empty')} />;
  }
  if (!contract) return null;

  const downloadDocx = async () => {
    setDownloadState({ kind: 'loading' });
    try {
      const headers = getHeaders();
      delete headers['Content-Type'];
      const response = await fetch(
        `/api/method/sessions/${encodeURIComponent(sessionId)}/assessment-report.docx`,
        { headers }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { code?: string; error?: string };
        throw new Error(body.code ?? body.error ?? `HTTP_${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        filenameFromContentDisposition(response.headers.get('Content-Disposition')) ??
        fallbackDocxFilename(contract);
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
      setDownloadState({ kind: 'idle' });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      setDownloadState({ kind: 'error', message: `Nie udało się pobrać DOCX — kod: ${code}` });
    }
  };

  const propertyRows: ArtifactPropertyRow[] = [
    [
      'revision',
      contract.revision === 0
        ? t('assessment.reportView.noFrozenOutput')
        : String(contract.revision),
    ],
    ['outputId', contract.outputId ?? t('assessment.reportView.noFrozenOutput')],
    [
      'generatedAt',
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(contract.generatedAt)
      ),
    ],
    ['methodVersion', contract.methodVersion],
    ['contractVersion', contract.contractVersion],
    ['sessionId', contract.sessionId],
  ].map(([id, value]) => ({
    id,
    label: t(`assessment.reportView.properties.${id}`),
    value,
    mono: true,
  }));
  const panelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('assessment.reportView.panel.actions'),
      defaultOpen: true,
      children: (
        <div className="space-y-2">
          {isAssessmentDocxEnabled() ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void downloadDocx()}
                disabled={downloadState.kind === 'loading'}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-xs font-semibold text-c-text transition-colors hover:bg-c-surface-raised disabled:cursor-wait disabled:opacity-60"
              >
                {downloadState.kind === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {downloadState.kind === 'loading' ? 'Pobieranie DOCX…' : 'Pobierz DOCX'}
              </button>
              {downloadState.kind === 'error' ? (
                <p role="alert" className="text-xs text-c-danger">
                  {downloadState.message}
                </p>
              ) : null}
            </div>
          ) : null}
          {/* `opacity-60` na kontenerze mnożył się z już-przyciemnionym c-text-muted
              (kalibrowanym na pełną nieprzezroczystość) — 2.29:1 zamiast 4,5:1
              (axe: color-contrast, zmierzone na assessment-report-contract, x3
              wiersze "planowane"). c-text-muted samo w sobie jest już wystarczająco
              wyciszone wizualnie bez dodatkowego opacity. */}
          {(['generate', 'pdf', 'all'] as const).map((kind) => (
            <div
              key={kind}
              className="flex items-center justify-between rounded-lg border border-c-border-subtle px-3 py-2"
            >
              <span className="text-xs text-c-text-muted">
                {kind === 'generate'
                  ? t('assessment.reportView.generate')
                  : t(`assessment.reportView.export.${kind}`)}
              </span>
              <span className="text-[10px] font-medium text-c-text-muted">
                {t('assessment.reportView.planned')}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('assessment.reportView.panel.properties'),
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          rows={propertyRows}
          propertyLabel={t('assessment.reportView.property')}
          valueLabel={t('assessment.reportView.value')}
        />
      ),
    },
  ];
  const header: NModeHeaderConfig = {
    title: t('assessment.reportView.title'),
    onTitleChange: () => {},
    titleReadOnly: true,
    artifactType: 'report',
    artifactId: contract.outputId ?? contract.sessionId,
    onSave: () => {},
    onClose: () => {},
    // Read-only document — there is nothing to save, so the "Zapisano" /
    // "Zapisywanie…" indicator would be misleading here.
    hideSaveState: true,
    statusLabel:
      contract.revision === 0
        ? t('assessment.reportView.draft')
        : t('assessment.reportView.revision', { revision: contract.revision }),
    statusTone: contract.revision === 0 ? 'draft' : 'neutral',
    // P2-1: no header primaryAction — "Generuj" moved into the right-panel
    // Akcje section (grayed out, next to the export rows) so it no longer
    // reads as an active CTA. See the panelSections 'actions' children above.
  };
  return (
    <div
      className={`flex h-full min-h-0 flex-col ${className ?? ''}`}
      data-testid="assessment-report-contract-view"
    >
      {/* P2-2 (day-27 acceptance fix-up): the middle crumb used to be the
          raw `contract.sessionId` ("session-…") — meaningless to a reader
          and inconsistent with every other breadcrumb in the app, which
          shows a human label, never a raw id. The report contract has no
          session NAME field to show instead (that's a server-side addition,
          out of this fix's scope — see the day-27 report's "FIX-y po
          odbiorze 27.08" section), so the crumb is shortened to
          Ocena / Raport rather than papering over the id with a fake name. */}
      <ArtifactBreadcrumb
        items={[
          { label: t('assessment.reportView.assessment') },
          { label: t('assessment.reportView.report') },
        ]}
      />
      <div
        className="min-h-0 flex-1"
        data-testid="assessment-report-layout"
        style={{ '--ntype-left-panel-width': '6.5rem' } as React.CSSProperties}
      >
        <NModeShell
          header={header}
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          presentationMode="n"
          onPresentationModeChange={() => {}}
          showModeSwitcher={false}
          rightPanel={
            <ArtifactRightPanel
              sections={panelSections}
              ariaLabel={t('assessment.reportView.panelLabel')}
              className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
            />
          }
        />
      </div>
    </div>
  );
};

export default AssessmentReportContractView;
