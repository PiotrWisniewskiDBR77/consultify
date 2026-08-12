/**
 * Pakiet E — Kreator Analizy. Renderuje `analysisCreatorWizard.contract.ts`
 * (kolejność kroków DOSŁOWNIE z brifu: source/version → okresy → branża/cel →
 * KPI → preflight → create & compute) — ten plik trzyma WYŁĄCZNIE stan UI
 * (`useState`), cała logika gate'ów/rekomendacji/preflightu jest w kontrakcie
 * i przetestowana tam bez DOM.
 *
 * ★ UCZCIWOŚĆ WOBEC BACKENDU — patrz nagłówek `analysisCreatorWizard.contract.ts`:
 * kroki 1/2 (`sourceOptions`/`periodOptions`) i selekcja KPI (krok 4) NIE MAJĄ
 * dziś writer'a w backendzie. Ten komponent i tak implementuje je W PEŁNI po
 * stronie klienta (żeby przepływ był kompletny i gotowy pod przyszły zapis),
 * ale krok 6 ("Utwórz i przelicz") może realnie wykonać TYLKO to, co backend
 * faktycznie ma: utworzyć artefakt (`createFinanceArtifact`) i spróbować
 * przeliczenia (`computeAnalysisKpis`) — jeśli backend odpowie
 * `NO_SOURCE_STATEMENT_PACK_EDGE` (bo źródło z kroku 1 nie miało dokąd się
 * zapisać), UI pokazuje TEN honest komunikat (`describeFinanceV2Error`), nie
 * udaje sukcesu.
 *
 * UI za flagą `financeAnalysisWorkspaceV1`, domyślnie OFF (CLAUDE.md #7) —
 * ten plik i tak samo w sobie nic nie montuje, flaga jest sprawdzana przez
 * callera (`AnalysisWorkspace.tsx`).
 */
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { BusinessVersionStatusValues, businessVersionStatusLabel, type AnalysisKpiCatalogEntryDto, type BusinessVersionStatus } from '../../../services/api/financeV2.types';
import {
  ANALYSIS_CREATOR_GOALS,
  ANALYSIS_CREATOR_GOAL_LABELS_PL,
  ANALYSIS_CREATOR_STEPS,
  ANALYSIS_CREATOR_STEP_LABELS_PL,
  applyIndustryRecommendations,
  buildAnalysisCreatorDraftPayload,
  canNavigateToStep,
  createInitialAnalysisCreatorState,
  isStepComplete,
  nextStep,
  previousStep,
  runAnalysisPreflightCheck,
  toggleKpiSelected,
  togglePeriodSelected,
  type AnalysisCreatorDraftPayload,
  type AnalysisCreatorGoal,
  type AnalysisCreatorPeriodOption,
  type AnalysisCreatorSourceOption,
  type AnalysisCreatorState,
  type AnalysisCreatorStepId,
} from './analysisCreatorWizard.contract';
import { ANALYSIS_INDUSTRY_PRESETS, industryLabelForCode, validateCustomFormula, type AnalysisIndustryCode } from './analysisKpiCatalog';

export interface AnalysisCreatorWizardProps {
  /** Kandydaci źródła — dostarczeni przez callera (dziś: mock/dev-render; produkcyjnie: brak endpointu listującego, patrz nagłówek pliku). */
  sourceOptions: AnalysisCreatorSourceOption[];
  /** Okresy DOSTĘPNE dla źródła wybranego w kroku 1 — caller filtruje po zmianie źródła. */
  periodOptions: AnalysisCreatorPeriodOption[];
  catalog: AnalysisKpiCatalogEntryDto[];
  /** Kody linii kanonicznej dostępne w źródle DLA WYBRANYCH okresów — do preflightu (krok 5). */
  availableLineCodesForPreflight: string[];
  onClose: () => void;
  onComplete: (payload: AnalysisCreatorDraftPayload) => void;
  submitting?: boolean;
  submitErrorMessage?: string | null;
}

const STEP_INDEX_BY_ID = new Map(ANALYSIS_CREATOR_STEPS.map((s, i) => [s, i] as const));

/** `AnalysisCreatorSourceOption.status` arrives as a loose `string` (contract file, not the shared enum) — label the known lifecycle statuses, fall back to the raw value only for something truly unrecognized. */
function sourceStatusLabel(status: string): string {
  return (BusinessVersionStatusValues as readonly string[]).includes(status)
    ? businessVersionStatusLabel(status as BusinessVersionStatus)
    : status;
}

export function AnalysisCreatorWizard(props: AnalysisCreatorWizardProps): React.ReactElement {
  const { sourceOptions, periodOptions, catalog, availableLineCodesForPreflight, onClose, onComplete, submitting, submitErrorMessage } = props;
  const [state, setState] = useState<AnalysisCreatorState>(createInitialAnalysisCreatorState);
  const [kpiSearch, setKpiSearch] = useState('');
  const [customFormulaDraft, setCustomFormulaDraft] = useState('');

  const catalogEntryLike = useMemo(
    () => catalog.map((c) => ({ kpiCode: c.kpiCode, tier: c.tier, industryCode: c.industryCode, status: c.status })),
    [catalog]
  );

  const preflight = useMemo(
    () =>
      runAnalysisPreflightCheck({
        selectedKpiCodes: state.selectedKpiCodes,
        catalog: catalog.map((c) => ({ kpiCode: c.kpiCode, kpiName: c.kpiName, requiredCanonicalLineCodes: c.requiredCanonicalLineCodes })),
        availableLineCodes: availableLineCodesForPreflight,
      }),
    [state.selectedKpiCodes, catalog, availableLineCodesForPreflight]
  );

  const draftPayload = buildAnalysisCreatorDraftPayload(state);
  const currentIndex = STEP_INDEX_BY_ID.get(state.currentStep) ?? 0;

  function goToStep(step: AnalysisCreatorStepId): void {
    if (!canNavigateToStep(step, state)) return;
    setState((s) => ({ ...s, currentStep: step }));
  }

  function handleNext(): void {
    const target = nextStep(state);
    if (target) setState((s) => ({ ...s, currentStep: target }));
  }

  function handleBack(): void {
    const target = previousStep(state);
    if (target) setState((s) => ({ ...s, currentStep: target }));
  }

  function handleSelectIndustry(industryCode: AnalysisIndustryCode): void {
    setState((s) => applyIndustryRecommendations({ ...s, industryCode }, catalogEntryLike));
  }

  function handleSelectGoal(goal: AnalysisCreatorGoal): void {
    setState((s) => ({ ...s, goal: s.goal === goal ? null : goal }));
  }

  const customFormulaValidation =
    customFormulaDraft.trim().length > 0 ? validateCustomFormula(customFormulaDraft, availableLineCodesForPreflight) : null;

  // ★ NAPRAWA a11y (Pakiet I): `role="dialog"` był deklaratywny bez żadnej
  // faktycznej semantyki — brak pułapki fokusa (Tab uciekał pod tło), brak
  // Escape, brak przywrócenia fokusa na przycisk-wyzwalacz ("Konfiguruj KPI"
  // w `AnalysisKpiTable`, który NIE odmontowuje się pod kreatorem, więc
  // domyślne przechwycenie `document.activeElement` w `useDialogA11y`
  // wystarcza bez dodatkowego fallbacku).
  const dialogContainerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef: dialogContainerRef });

  return (
    <div
      ref={dialogContainerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Kreator analizy"
      data-testid="analysis-creator-wizard"
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="flex h-full max-h-[42rem] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface shadow-xl">
        {/* Nagłówek + wskaźnik kroków */}
        <header className="flex items-center justify-between gap-3 border-b border-c-border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-c-text">Kreator analizy</h2>
            <p className="text-xs text-c-text-muted">
              Krok {currentIndex + 1} z {ANALYSIS_CREATOR_STEPS.length} — {ANALYSIS_CREATOR_STEP_LABELS_PL[state.currentStep]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij kreator"
            data-testid="analysis-creator-close"
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-c-text-muted hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <ol className="flex items-center gap-1 border-b border-c-border-subtle px-5 py-2 text-xs" aria-label="Kroki kreatora">
          {ANALYSIS_CREATOR_STEPS.map((step, idx) => {
            const reachable = canNavigateToStep(step, state);
            const complete = isStepComplete(step, state) && idx < currentIndex;
            const active = step === state.currentStep;
            return (
              <li key={step} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => goToStep(step)}
                  data-testid={`analysis-creator-step-${step}`}
                  aria-current={active ? 'step' : undefined}
                  className={`min-h-8 rounded-md px-2 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    active
                      ? 'bg-state-selected text-c-text'
                      : reachable
                        ? 'text-c-text-secondary hover:bg-c-surface-raised'
                        : 'cursor-not-allowed text-c-text-muted/50'
                  }`}
                >
                  {complete ? <Check className="mr-1 inline h-3 w-3 text-c-success" /> : null}
                  {idx + 1}. {ANALYSIS_CREATOR_STEP_LABELS_PL[step]}
                </button>
                {idx < ANALYSIS_CREATOR_STEPS.length - 1 ? <ChevronRight className="h-3 w-3 text-c-text-muted" /> : null}
              </li>
            );
          })}
        </ol>

        {/* Treść kroku */}
        <div className="flex-1 overflow-y-auto p-5">
          {state.currentStep === 'source_version' && (
            <div className="space-y-2" data-testid="analysis-creator-body-source_version">
              <p className="text-xs text-c-text-muted mb-3">Wybierz pakiet sprawozdań (Statement Pack Version), z którego analiza pobierze dane źródłowe.</p>
              {sourceOptions.length === 0 ? (
                <p className="text-sm text-c-text-muted">Brak dostępnych źródeł — potrzebny jest zatwierdzony pakiet sprawozdań.</p>
              ) : (
                sourceOptions.map((opt) => {
                  const selected = state.sourceVersionId === opt.statementPackVersionId;
                  return (
                    <button
                      key={opt.statementPackVersionId}
                      type="button"
                      data-testid={`analysis-creator-source-${opt.statementPackVersionId}`}
                      onClick={() => setState((s) => ({ ...s, sourceVersionId: opt.statementPackVersionId }))}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                        selected ? 'border-c-border-strong bg-state-selected' : 'border-c-border-subtle hover:bg-c-surface-raised'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-medium text-c-text">{opt.label}</span>
                        <span className="block text-xs text-c-text-muted">
                          {opt.entityLabel} · v{opt.versionNo} · {sourceStatusLabel(opt.status)}
                        </span>
                      </span>
                      {selected ? <Check className="h-4 w-4 text-c-text" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {state.currentStep === 'periods' && (
            <div className="space-y-2" data-testid="analysis-creator-body-periods">
              <p className="text-xs text-c-text-muted mb-3">Wybierz okresy do analizy (historyczne i prognozowane).</p>
              {periodOptions
                .slice()
                .sort((a, b) => a.chronologicalIndex - b.chronologicalIndex)
                .map((opt) => {
                  const selected = state.selectedPeriodIds.includes(opt.periodId);
                  return (
                    <label
                      key={opt.periodId}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-c-border-subtle px-3 py-2 hover:bg-c-surface-raised"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setState((s) => togglePeriodSelected(s, periodOptions, opt.periodId))}
                        className="h-4 w-4 rounded border-c-border-subtle text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
                      />
                      <span className="text-sm text-c-text">{opt.label}</span>
                      {opt.isForecast ? <span className="text-xs italic text-c-text-muted">prognoza</span> : null}
                    </label>
                  );
                })}
            </div>
          )}

          {state.currentStep === 'industry_goal' && (
            <div className="space-y-5" data-testid="analysis-creator-body-industry_goal">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-c-text-muted">Branża</p>
                <div className="flex flex-wrap gap-2">
                  {ANALYSIS_INDUSTRY_PRESETS.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      data-testid={`analysis-creator-industry-${preset.code}`}
                      onClick={() => handleSelectIndustry(preset.code)}
                      className={`rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                        state.industryCode === preset.code
                          ? 'border-c-border-strong bg-state-selected text-c-text'
                          : 'border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised'
                      }`}
                    >
                      {preset.labelPl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-c-text-muted">Cel analizy (opcjonalny — doprecyzowuje rekomendacje)</p>
                <div className="flex flex-wrap gap-2">
                  {ANALYSIS_CREATOR_GOALS.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => handleSelectGoal(goal)}
                      className={`rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                        state.goal === goal
                          ? 'border-c-border-strong bg-state-selected text-c-text'
                          : 'border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised'
                      }`}
                    >
                      {ANALYSIS_CREATOR_GOAL_LABELS_PL[goal]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {state.currentStep === 'kpi_selection' && (
            <div data-testid="analysis-creator-body-kpi_selection">
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-c-border-subtle px-2.5 py-1.5">
                <Search className="h-4 w-4 text-c-text-muted" />
                <input
                  value={kpiSearch}
                  onChange={(e) => setKpiSearch(e.target.value)}
                  placeholder="Szukaj wskaźnika…"
                  className="w-full bg-transparent text-sm text-c-text placeholder:text-c-text-muted focus:outline-none"
                  data-testid="analysis-creator-kpi-search"
                />
              </div>
              <p className="mb-2 text-xs text-c-text-muted">
                Wybrano: <span className="font-medium text-c-text">{state.selectedKpiCodes.length}</span> wskaźnik(ów).
                {state.selectedKpiCodes.length === 0 ? <span className="ml-1 text-c-danger">Wybierz przynajmniej jeden.</span> : null}
              </p>
              <div className="space-y-1">
                {catalog
                  .filter((c) => c.kpiName.toLowerCase().includes(kpiSearch.toLowerCase()) || c.kpiCode.toLowerCase().includes(kpiSearch.toLowerCase()))
                  .map((c) => {
                    const selected = state.selectedKpiCodes.includes(c.kpiCode);
                    return (
                      <label
                        key={c.kpiCode}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-c-border-subtle px-3 py-2 hover:bg-c-surface-raised"
                        data-testid={`analysis-creator-kpi-row-${c.kpiCode}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setState((s) => toggleKpiSelected(s, c.kpiCode))}
                          className="mt-0.5 h-4 w-4 rounded border-c-border-subtle text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-c-text">{c.kpiName}</span>
                          <span className="block text-xs text-c-text-muted">
                            {c.category ?? 'Bez kategorii'} · {c.tier === 'UNIVERSAL' ? 'uniwersalny' : c.tier === 'INDUSTRY' ? 'branżowy' : 'własny organizacji'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-c-border-subtle p-3">
                <p className="mb-1 text-xs font-medium text-c-text">Własna formuła (piaskownica)</p>
                <p className="mb-2 text-xs text-c-text-muted">
                  Walidacja działa na żywo, bez `eval`. Zapisanie jako nowy wskaźnik katalogu wymaga endpointu backendowego, którego dziś nie ma —
                  ta sekcja tylko sprawdza poprawność formuły.
                </p>
                <input
                  value={customFormulaDraft}
                  onChange={(e) => setCustomFormulaDraft(e.target.value)}
                  placeholder="np. (REVENUE - COGS) / REVENUE"
                  className="w-full rounded-md border border-c-border-subtle bg-c-surface px-2.5 py-1.5 font-mono text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  data-testid="analysis-creator-custom-formula-input"
                />
                {customFormulaValidation ? (
                  <p
                    className={`mt-1.5 text-xs ${customFormulaValidation.ok ? 'text-c-success' : 'text-c-danger'}`}
                    data-testid="analysis-creator-custom-formula-result"
                  >
                    {customFormulaValidation.ok
                      ? `Formuła poprawna. Składniki: ${customFormulaValidation.referencedLineCodes.join(', ') || '—'}.`
                      : customFormulaValidation.messagePl}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {state.currentStep === 'preflight' && (
            <div className="space-y-3" data-testid="analysis-creator-body-preflight">
              {preflight.ok ? (
                <div className="flex items-start gap-2 rounded-lg border border-c-success/30 bg-c-success/10 p-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-c-success" />
                  <p className="text-sm text-c-text">
                    Wszystkie wymagane składniki są dostępne dla {preflight.checkedKpiCount} wybranych wskaźników w wybranych okresach.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-c-warning/30 bg-c-warning/10 p-3" data-testid="analysis-creator-preflight-issues">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-c-warning" />
                    <p className="text-sm text-c-text">
                      {preflight.issues.length} z {preflight.checkedKpiCount} wybranych wskaźników ma brakujące składniki źródłowe w wybranych okresach.
                      Te wskaźniki dadzą wynik „—” (brak danych), nie liczbę — możesz mimo to kontynuować.
                    </p>
                  </div>
                  <ul className="ml-6 list-disc space-y-1 text-xs text-c-text-secondary">
                    {preflight.issues.map((issue) => (
                      <li key={issue.kpiCode}>
                        <span className="font-medium text-c-text">{issue.kpiName}</span> — brakuje: {issue.missingLineCodes.join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-lg border border-c-border-subtle p-3 text-xs text-c-text-secondary">
                <p className="mb-1 font-medium text-c-text">Podsumowanie</p>
                <p>Okresy: {state.selectedPeriodIds.length}</p>
                <p>
                  Branża: {state.industryCode ? industryLabelForCode(state.industryCode) : '—'}
                  {state.goal ? ` · Cel: ${ANALYSIS_CREATOR_GOAL_LABELS_PL[state.goal]}` : ''}
                </p>
                <p>Wskaźniki: {state.selectedKpiCodes.length}</p>
              </div>
            </div>
          )}

          {state.currentStep === 'create_compute' && (
            <div className="space-y-3" data-testid="analysis-creator-body-create_compute">
              <p className="text-sm text-c-text">Gotowe do utworzenia. Kliknij „Utwórz i przelicz”, aby założyć analizę i uruchomić pierwsze przeliczenie.</p>
              {draftPayload ? (
                <pre className="overflow-x-auto rounded-lg bg-c-surface-raised p-3 text-xs text-c-text-secondary" data-testid="analysis-creator-payload-preview">
                  {JSON.stringify(draftPayload, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-c-danger">Kreator jest niekompletny — wróć i uzupełnij brakujące kroki.</p>
              )}
              {submitErrorMessage ? (
                <div className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 p-3" data-testid="analysis-creator-submit-error">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-c-danger" />
                  <p className="text-sm text-c-text">{submitErrorMessage}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Stopka nawigacji */}
        <footer className="flex items-center justify-between border-t border-c-border-subtle px-5 py-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <ChevronLeft className="h-4 w-4" /> Wstecz
          </button>
          {state.currentStep === 'create_compute' ? (
            <button
              type="button"
              disabled={!draftPayload || submitting}
              onClick={() => draftPayload && onComplete(draftPayload)}
              data-testid="analysis-creator-submit"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-c-text px-4 text-sm font-medium text-c-surface hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <Plus className="h-4 w-4" /> {submitting ? 'Tworzenie…' : 'Utwórz i przelicz'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!isStepComplete(state.currentStep, state)}
              onClick={handleNext}
              data-testid="analysis-creator-next"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-c-text px-4 text-sm font-medium text-c-surface hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              Dalej <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default AnalysisCreatorWizard;
