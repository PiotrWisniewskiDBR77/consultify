/**
 * Pakiet E — kreator Analizy (brief: "PEŁNY KREATOR analizy, dokładnie w tej
 * kolejności kroków: source/version → okresy → branża/cel → KPI → preflight
 * → create & compute"). Czysta logika stanu/gate'ów, testowalna bez DOM
 * (`__tests__/analysisCreatorWizard.contract.test.ts`). `AnalysisCreatorWizard.tsx`
 * konsumuje ją i renderuje kroki.
 *
 * ★ UCZCIWOŚĆ WOBEC BACKENDU (CLAUDE.md „złota zasada #1" — weryfikuj REALNY
 * runtime): czytając w całości `server/src/routes/v8/finance-v2/*.routes.ts`
 * (2026-08-12) potwierdzono, że backend dziś NIE eksponuje zapisu dla trzech
 * z pięciu kroków tego kreatora:
 *   - brak `GET /artifacts?type=STATEMENT_PACK` (nie da się wylistować
 *     kandydatów źródła — krok 1 wymaga, żeby CALLER dostarczył opcje z
 *     zewnątrz, ten plik ich nie zgaduje),
 *   - brak writer'a krawędzi lineage `STATEMENT_TO_ANALYSIS`
 *     (`finance_lineage_edges`) — wybór źródła w kroku 1 nie ma dokąd się
 *     zapisać, `POST /analysis/:id/compute` sam to potwierdza kodem błędu
 *     `NO_SOURCE_STATEMENT_PACK_EDGE` (analysis.routes.ts:108),
 *   - brak writer'a selekcji KPI (`finance_analysis_kpi_values` rows) —
 *     `kpiComputeService.ts`'s własny komentarz: "this module never inserts
 *     new selection rows, only computes into existing ones".
 * Ten plik i `AnalysisCreatorWizard.tsx` implementują KOMPLETNY, testowalny
 * przepływ kreatora po stronie klienta (stan w pamięci, gate'y, preflight,
 * rekomendacje) — gotowy do podłączenia pod prawdziwe zapisy, gdy backend je
 * doda. `buildAnalysisCreatorDraftPayload` (dół pliku) jest jawnie nazwany
 * "Draft" i jego docstring powtarza ten gap, żeby żaden przyszły caller nie
 * pomylił "kompletny kształt danych" z "istniejący endpoint zapisu".
 */

import { recommendKpisForIndustry, type AnalysisIndustryCode, type AnalysisKpiCatalogEntryLike } from './analysisKpiCatalog';

// ---------------------------------------------------------------------------
// Kroki — kolejność DOSŁOWNIE z brifu.
// ---------------------------------------------------------------------------

export const ANALYSIS_CREATOR_STEPS = [
  'source_version',
  'periods',
  'industry_goal',
  'kpi_selection',
  'preflight',
  'create_compute',
] as const;
export type AnalysisCreatorStepId = (typeof ANALYSIS_CREATOR_STEPS)[number];

export const ANALYSIS_CREATOR_STEP_LABELS_PL: Readonly<Record<AnalysisCreatorStepId, string>> = {
  source_version: 'Źródło i wersja',
  periods: 'Okresy',
  industry_goal: 'Branża i cel',
  kpi_selection: 'Wskaźniki KPI',
  preflight: 'Sprawdzenie przed utworzeniem',
  create_compute: 'Utwórz i przelicz',
};

export const ANALYSIS_CREATOR_GOALS = [
  'GENERAL_OVERVIEW',
  'INVESTOR_READINESS',
  'OPERATIONAL_EFFICIENCY',
  'BENCHMARK_COMPARISON',
] as const;
export type AnalysisCreatorGoal = (typeof ANALYSIS_CREATOR_GOALS)[number];

export const ANALYSIS_CREATOR_GOAL_LABELS_PL: Readonly<Record<AnalysisCreatorGoal, string>> = {
  GENERAL_OVERVIEW: 'Ogólny przegląd kondycji',
  INVESTOR_READINESS: 'Gotowość inwestorska',
  OPERATIONAL_EFFICIENCY: 'Efektywność operacyjna',
  BENCHMARK_COMPARISON: 'Porównanie z branżą',
};

// ---------------------------------------------------------------------------
// Opcje kroków 1/2 — dostarczane przez CALLERA (żaden endpoint listujący
// kandydatów źródła nie istnieje dziś w backendzie, patrz nagłówek pliku).
// ---------------------------------------------------------------------------

export interface AnalysisCreatorSourceOption {
  statementPackArtifactId: string;
  /** `businessVersionId` wersji STATEMENT_PACK — to jest wartość, która trafia do `sourceVersionId` stanu. */
  statementPackVersionId: string;
  versionNo: number;
  label: string;
  status: string;
  entityId: string;
  entityLabel: string;
}

export interface AnalysisCreatorPeriodOption {
  periodId: string;
  label: string;
  isForecast: boolean;
  /** Rosnąco, najstarszy=0 — kolejność CHRONOLOGICZNA, używana też przez `AnalysisKpiTable`/`groupAnalysisKpiValuesByKpi`. */
  chronologicalIndex: number;
}

// ---------------------------------------------------------------------------
// Stan kreatora.
// ---------------------------------------------------------------------------

export interface AnalysisCreatorState {
  currentStep: AnalysisCreatorStepId;
  sourceVersionId: string | null;
  selectedPeriodIds: string[];
  industryCode: AnalysisIndustryCode | null;
  goal: AnalysisCreatorGoal | null;
  selectedKpiCodes: string[];
}

export function createInitialAnalysisCreatorState(): AnalysisCreatorState {
  return {
    currentStep: 'source_version',
    sourceVersionId: null,
    selectedPeriodIds: [],
    industryCode: null,
    goal: null,
    selectedKpiCodes: [],
  };
}

// ---------------------------------------------------------------------------
// Kompletność per krok — `industry_goal` wymaga TYLKO branży (cel jest
// doprecyzowaniem rekomendacji, nie blokadą — brief mówi "branża/cel"
// łącznie, ale tylko branża steruje `recommendKpisForIndustry`).
// `kpi_selection` KONIECZNIE wymaga ≥1 KPI — to jest DOSŁOWNA implementacja
// "★ ZAKAZ pustej analizy bez wyjścia" na poziomie kreatora (druga linia
// obrony obok `resolveAnalysisPrimaryCta`/`canSubmitAnalysisForReview` w
// `analysisWorkspace.contract.ts`, które chronią WORKSPACE już utworzonej
// analizy — ten gate chroni sam KREATOR przed dojściem do końca z 0 KPI).
// ---------------------------------------------------------------------------

export function isStepComplete(step: AnalysisCreatorStepId, state: AnalysisCreatorState): boolean {
  switch (step) {
    case 'source_version':
      return state.sourceVersionId !== null;
    case 'periods':
      return state.selectedPeriodIds.length > 0;
    case 'industry_goal':
      return state.industryCode !== null;
    case 'kpi_selection':
      return state.selectedKpiCodes.length > 0;
    case 'preflight':
      return true; // krok informacyjny — jego WŁASNA kompletność (danych) liczy `runAnalysisPreflightCheck`, nie ten gate nawigacji.
    case 'create_compute':
      return true;
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

/**
 * Kreator LINIOWY: krok `target` jest osiągalny tylko gdy WSZYSTKIE kroki go
 * poprzedzające są kompletne — dowód, że nie da się "przeskoczyć" np. od razu
 * do wyboru KPI bez wybranego źródła.
 */
export function canNavigateToStep(target: AnalysisCreatorStepId, state: AnalysisCreatorState): boolean {
  const targetIndex = ANALYSIS_CREATOR_STEPS.indexOf(target);
  for (let i = 0; i < targetIndex; i += 1) {
    if (!isStepComplete(ANALYSIS_CREATOR_STEPS[i], state)) return false;
  }
  return true;
}

/** `null` ⇒ nie ma dokąd iść (koniec) LUB krok bieżący niekompletny (gate — "Dalej" musi być disabled, nie cicho nic nie robić). */
export function nextStep(state: AnalysisCreatorState): AnalysisCreatorStepId | null {
  const idx = ANALYSIS_CREATOR_STEPS.indexOf(state.currentStep);
  if (idx === -1 || idx === ANALYSIS_CREATOR_STEPS.length - 1) return null;
  if (!isStepComplete(state.currentStep, state)) return null;
  return ANALYSIS_CREATOR_STEPS[idx + 1];
}

export function previousStep(state: AnalysisCreatorState): AnalysisCreatorStepId | null {
  const idx = ANALYSIS_CREATOR_STEPS.indexOf(state.currentStep);
  if (idx <= 0) return null;
  return ANALYSIS_CREATOR_STEPS[idx - 1];
}

// ---------------------------------------------------------------------------
// Krok 2 — okresy: add/remove z auto-sortem CHRONOLOGICZNYM (nie kolejnością
// kliknięć) — `AnalysisKpiTable`/`groupAnalysisKpiValuesByKpi` zakładają, że
// kolumny okresów przychodzą najstarszy→najnowszy.
// ---------------------------------------------------------------------------

export function togglePeriodSelected(
  state: AnalysisCreatorState,
  periodOptions: readonly AnalysisCreatorPeriodOption[],
  periodId: string
): AnalysisCreatorState {
  const has = state.selectedPeriodIds.includes(periodId);
  const nextIds = has ? state.selectedPeriodIds.filter((id) => id !== periodId) : [...state.selectedPeriodIds, periodId];
  const chronoIndexByPeriodId = new Map(periodOptions.map((p) => [p.periodId, p.chronologicalIndex] as const));
  nextIds.sort((a, b) => (chronoIndexByPeriodId.get(a) ?? 0) - (chronoIndexByPeriodId.get(b) ?? 0));
  return { ...state, selectedPeriodIds: nextIds };
}

// ---------------------------------------------------------------------------
// Krok 4 — katalog KPI: add/remove (piaskownica selekcji) + rekomendacja
// branżowa ADDYTYWNA (nigdy nie kasuje ręcznego wyboru użytkownika, tylko
// uzupełnia braki — inaczej zmiana branży w kroku 3 cofnęłaby pracę
// użytkownika w kroku 4, gdyby wrócił i zmienił zdanie).
// ---------------------------------------------------------------------------

export function toggleKpiSelected(state: AnalysisCreatorState, kpiCode: string): AnalysisCreatorState {
  const has = state.selectedKpiCodes.includes(kpiCode);
  return {
    ...state,
    selectedKpiCodes: has ? state.selectedKpiCodes.filter((c) => c !== kpiCode) : [...state.selectedKpiCodes, kpiCode],
  };
}

export function applyIndustryRecommendations(
  state: AnalysisCreatorState,
  catalog: readonly AnalysisKpiCatalogEntryLike[]
): AnalysisCreatorState {
  if (!state.industryCode) return state;
  const recommended = recommendKpisForIndustry(catalog, state.industryCode);
  const merged = [...new Set([...state.selectedKpiCodes, ...recommended])];
  return { ...state, selectedKpiCodes: merged };
}

// ---------------------------------------------------------------------------
// Krok 5 — preflight: dla każdego wybranego KPI sprawdza, czy wszystkie jego
// wymagane kody linii kanonicznej (`AnalysisKpiCatalogEntryDto.requiredCanonicalLineCodes`)
// są DOSTĘPNE w źródle dla WYBRANYCH okresów. `availableLineCodes` pochodzi od
// callera (w produkcji: `GET /statements/:sourceVersionId/lines`, realny
// istniejący endpoint pkg B2, filtrowany po `periodId` — patrz
// statements.routes.ts:168) — ten plik samej sieci nie dotyka (czysta logika).
// ---------------------------------------------------------------------------

export interface AnalysisPreflightKpiIssue {
  kpiCode: string;
  kpiName: string;
  missingLineCodes: string[];
}

export interface AnalysisPreflightResult {
  ok: boolean;
  issues: AnalysisPreflightKpiIssue[];
  checkedKpiCount: number;
}

export function runAnalysisPreflightCheck(params: {
  selectedKpiCodes: readonly string[];
  catalog: readonly { kpiCode: string; kpiName: string; requiredCanonicalLineCodes: string[] | null }[];
  availableLineCodes: readonly string[];
}): AnalysisPreflightResult {
  const available = new Set(params.availableLineCodes);
  const byCode = new Map(params.catalog.map((c) => [c.kpiCode, c] as const));
  // Deterministyczna kolejność issues — sortuj `selectedKpiCodes` PRZED iteracją,
  // nie ufaj kolejności, w jakiej caller je zbudował (ta sama zasada co
  // `groupAnalysisKpiValuesByKpi`).
  const sortedCodes = [...params.selectedKpiCodes].sort((a, b) => a.localeCompare(b));
  const issues: AnalysisPreflightKpiIssue[] = [];
  for (const kpiCode of sortedCodes) {
    const entry = byCode.get(kpiCode);
    const required = entry?.requiredCanonicalLineCodes ?? [];
    const missing = required.filter((code) => !available.has(code));
    if (missing.length > 0) {
      issues.push({ kpiCode, kpiName: entry?.kpiName ?? kpiCode, missingLineCodes: missing });
    }
  }
  return { ok: issues.length === 0, issues, checkedKpiCount: params.selectedKpiCodes.length };
}

// ---------------------------------------------------------------------------
// Krok 6 — payload. `null` ⇒ jeszcze niekompletny (UI: przycisk "Utwórz i
// przelicz" disabled, NIGDY aktywny-ale-cicho-nic-nierobiący).
// ---------------------------------------------------------------------------

export interface AnalysisCreatorDraftPayload {
  sourceStatementPackVersionId: string;
  selectedPeriodIds: string[];
  industryCode: AnalysisIndustryCode;
  goal: AnalysisCreatorGoal | null;
  selectedKpiCodes: string[];
}

/**
 * Zwraca kompletny kształt wyboru użytkownika — NIE jest to kontrakt
 * HTTP-body żadnego istniejącego endpointu (patrz nagłówek pliku: backend
 * dziś nie ma writer'a dla źródła/okresów/selekcji KPI). Caller
 * (`AnalysisCreatorWizard.tsx`) używa go do: (a) podsumowania w kroku
 * preflight, (b) trzymania w pamięci do czasu, aż backend doda właściwy
 * endpoint zapisu.
 */
export function buildAnalysisCreatorDraftPayload(state: AnalysisCreatorState): AnalysisCreatorDraftPayload | null {
  if (!state.sourceVersionId) return null;
  if (state.selectedPeriodIds.length === 0) return null;
  if (!state.industryCode) return null;
  if (state.selectedKpiCodes.length === 0) return null;
  return {
    sourceStatementPackVersionId: state.sourceVersionId,
    selectedPeriodIds: [...state.selectedPeriodIds],
    industryCode: state.industryCode,
    goal: state.goal,
    selectedKpiCodes: [...state.selectedKpiCodes],
  };
}
