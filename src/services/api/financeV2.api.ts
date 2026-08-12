/**
 * Finance v3 — typowany klient kanonicznego `/api/v8/finance-v2/*` (Pakiet C).
 *
 * 12 endpointów zbudowanych przez Pakiet B (`docs/validation/finance-v3/generated/gate-e/PKG_B_API_report.md`
 * §2.1). Endpointy domenowe (statements/analysis/baseline/prediction/valuation)
 * jeszcze NIE ISTNIEJĄ (buduje je pakiet B2 równolegle) — ten klient jest
 * napisany tak, żeby ich dołożenie było dopisaniem nowej funkcji w tym samym
 * pliku, nie przebudową (ten sam wzorzec `v8Get<T>`/`v8Post<T>` + DTO).
 *
 * Konwencja zwracana przez `v8Get`/`v8Post` (src/services/api/v8/client.ts):
 * już rozpakowują `{data: T}` i rzucają `Error` z `.status`/`.code`/`.data`
 * na błąd (`src/services/apiUtils.ts:45-96`) — patrz `describeFinanceV2Error`
 * w `./financeV2.types` do przetłumaczenia tego na komunikat PL.
 */

import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';
import { v8Get, v8Patch, v8Post, v8PostMultipart, v8Put } from './v8/client';
import type {
  AnalysisComputeResultDto,
  AnalysisKpiCatalogEntryDto,
  AnalysisKpiTier,
  AnalysisKpiValueDto,
  BaselineAssumptionDto,
  BaselineAssumptionUpsertInput,
  BaselineAssumptionUpsertResultDto,
  BaselineComputeParams,
  BaselineComputeResultDto,
  BaselineOutputDto,
  BaselineScheduleType,
  BaselineStatementType,
  FinanceApproveModelResultDto,
  FinanceArtifactDetailDto,
  FinanceArtifactType,
  FinanceBusinessVersionDetailDto,
  FinanceBusinessVersionSummaryDto,
  FinanceCapabilitiesDto,
  FinanceComputeJobDto,
  FinanceComputeSnapshotResultDto,
  FinanceCreateArtifactResultDto,
  FinanceEnqueueJobResultDto,
  FinanceExceptionOpenDto,
  FinancePredictionCalculateResultDto,
  FinancePredictionPreflightResultDto,
  FinanceRenameArtifactResultDto,
  FinanceReopenModelResultDto,
  FinanceTransitionResultDto,
  LifecycleAction,
  ReconciliationRunDetailDto,
  ReconciliationRunSummaryDto,
  RunReconciliationResultDto,
  StatementLineDto,
  StatementMapResultDto,
  StatementMapResultSummaryDto,
  StatementType,
  ValuationAdvisorFindingStoredDto,
  ValuationAdvisorGenerateResultDto,
  ValuationBridgeComponentInput,
  ValuationBridgeReadDto,
  ValuationBridgeWriteResultDto,
  ValuationCaseDetailDto,
  ValuationCaseDto,
  ValuationComputeDcfResultDto,
  ValuationCompareVariantsResultDto,
  ValuationLineageDto,
  ValuationMethodDto,
  ValuationMethodType,
  ValuationResultsDto,
  ValuationSensitivityGridRawDto,
  ValuationSensitivityWriteResultDto,
  ValuationTerminalRowRawDto,
  ValuationVariantDto,
  ValuationWaccInputsRawDto,
  ValuationWeightedRecommendationDto,
  VersionLineageDto,
  // --- AP-CLIENT ---
  CompareErrorCodeDto,
  CompareResultDto,
  FinanceCellRefInput,
  FinanceChangedCellsResultDto,
  FinanceCommentAssignmentDto,
  FinanceCommentDto,
  FinanceExcelManifestDto,
  FinanceImportApplyErrorCodeDto,
  FinanceImportApplyResultDto,
  FinanceImportParsedDto,
  FinanceImportPreviewDto,
  FinanceImportRawRow,
  FinanceLineageEdgeCreatedDto,
  FinanceLineageNavigatorDto,
  FinanceReviewChecklistItemDto,
  FinanceSavedViewDto,
  FinanceSavedViewScope,
  GridViewStateSnapshotInput,
  SavedViewFilterInput,
} from './financeV2.types';

const BASE = '/finance-v2';
const V8_BASE = '/api/v8';

/**
 * `v8Post` (src/services/api/v8/client.ts) zawsze rozpakowuje `json.data` —
 * poprawne dla WSZYSTKICH endpointów Pakietu B (koperta `{data, meta}`,
 * `_shared.ts:23-25`), ale `POST /models/:id/approve` (models.routes.ts:174-180,
 * WP-C02, sprzed Pakietu B) świadomie zwraca kształt PŁASKI
 * `{success, status, idempotentReplay?}` — BEZ klucza `data` — żeby zostać
 * bit-identyczne z zamrożoną fixturą F4. `v8Post` na tym endpointzie zwróciłby
 * `undefined` (`json.data` nie istnieje). Ten helper woła to samo co `v8Post`
 * pod spodem, ale zwraca CAŁE ciało odpowiedzi zamiast `.data`.
 */
async function v8PostRawBody<T>(
  path: string,
  body?: unknown,
  options?: { extraHeaders?: Record<string, string> }
): Promise<T> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, {
    method: 'POST',
    headers: options?.extraHeaders ? { ...getHeaders(), ...options.extraHeaders } : getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res, `V8 POST ${path}`);
}

/**
 * `v8Delete` (src/services/api/v8/client.ts) unconditionally reads `json.data` off whatever
 * `handleResponse` returns — but `handleResponse` returns `null` (not `{data}`) for a genuine
 * 204 No Content, so `v8Delete` crashes with `Cannot read properties of null (reading 'data')`
 * on any endpoint that really answers 204 (measured against a mocked 204 in this pakiet's own
 * test — `deleteFinanceSavedView` is `saved-views.routes.ts`'s `DELETE /saved-views/:id`, which
 * really does `res.status(204).send()`, no body at all). Flagged as a shared-file bug (out of
 * this pakiet's "add-only" scope — see `AP_CLIENT_report.md`), NOT fixed in `v8/client.ts`
 * itself to avoid touching code five other agents may depend on; this local helper sidesteps it
 * the same way `v8PostRawBody` above sidesteps `v8Post`'s envelope assumption.
 */
async function v8DeleteExpectNoContent(path: string): Promise<null> {
  const res = await fetchWithRetry(`${V8_BASE}${path}`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) return null;
  await handleResponse(res, `V8 DELETE ${path}`); // throws for !res.ok — never returns
  return null;
}

// ---------------------------------------------------------------------------
// Artifacts — artifacts.routes.ts
// ---------------------------------------------------------------------------

export interface CreateFinanceArtifactParams {
  artifactType: FinanceArtifactType;
  naturalKey?: string | null;
}

export async function createFinanceArtifact(
  params: CreateFinanceArtifactParams
): Promise<FinanceCreateArtifactResultDto> {
  return v8Post<FinanceCreateArtifactResultDto>(`${BASE}/artifacts`, {
    artifactType: params.artifactType,
    naturalKey: params.naturalKey ?? null,
  });
}

export async function getFinanceArtifact(artifactId: string): Promise<FinanceArtifactDetailDto> {
  return v8Get<FinanceArtifactDetailDto>(`${BASE}/artifacts/${encodeURIComponent(artifactId)}`);
}

export async function listFinanceArtifactVersions(
  artifactId: string
): Promise<FinanceBusinessVersionSummaryDto[]> {
  return v8Get<FinanceBusinessVersionSummaryDto[]>(
    `${BASE}/artifacts/${encodeURIComponent(artifactId)}/versions`
  );
}

/** WP-B02 §4.3 `allowedActionsFromCurrentStatus` — steruje paskiem akcji `FinanceWorkspaceBar` (OWN-FIN-012). */
export async function getFinanceArtifactCapabilities(artifactId: string): Promise<FinanceCapabilitiesDto> {
  return v8Get<FinanceCapabilitiesDto>(`${BASE}/artifacts/${encodeURIComponent(artifactId)}/capabilities`);
}

// --- PKG-F Baseline ---
/** artifacts.routes.ts:249-293 (D3 fix, Pakiet B2) — OWN-FIN-011 rename kontrolowany: serwer sam bramkuje `canRenameArtifact`/`validateWorkspaceName` (403 z `STATUS_IMMUTABLE`/`INSUFFICIENT_ROLE`, 400 z kodem walidacji nazwy). Używane przez `BaselineWorkspace.handleCommitRename`. */
export async function renameFinanceArtifact(artifactId: string, naturalKey: string): Promise<FinanceRenameArtifactResultDto> {
  return v8Post<FinanceRenameArtifactResultDto>(`${BASE}/artifacts/${encodeURIComponent(artifactId)}/rename`, { naturalKey });
}
// --- /PKG-F Baseline ---

// ---------------------------------------------------------------------------
// Versions — versions.routes.ts
// ---------------------------------------------------------------------------

export async function getFinanceBusinessVersion(
  businessVersionId: string
): Promise<FinanceBusinessVersionDetailDto> {
  return v8Get<FinanceBusinessVersionDetailDto>(`${BASE}/versions/${encodeURIComponent(businessVersionId)}`);
}

/** `approve`/`reopen` NIE przechodzą tędy — patrz `approveFinanceModel`/`reopenFinanceModel` niżej (models.routes.ts, T8/T12). */
export type RoutableTransitionAction = Exclude<LifecycleAction, 'approve' | 'reopen'>;

export interface TransitionFinanceVersionParams {
  businessVersionId: string;
  action: RoutableTransitionAction;
  expectedVersion: number;
  reason?: string;
}

export async function transitionFinanceVersion(
  params: TransitionFinanceVersionParams
): Promise<FinanceTransitionResultDto> {
  return v8Post<FinanceTransitionResultDto>(
    `${BASE}/versions/${encodeURIComponent(params.businessVersionId)}/transitions`,
    {
      action: params.action,
      expectedVersion: params.expectedVersion,
      ...(params.reason !== undefined ? { reason: params.reason } : {}),
    }
  );
}

/** T8a — zamrożenie snapshotu przed approve. */
export async function createFinanceComputeSnapshot(
  businessVersionId: string
): Promise<FinanceComputeSnapshotResultDto> {
  return v8Post<FinanceComputeSnapshotResultDto>(
    `${BASE}/versions/${encodeURIComponent(businessVersionId)}/compute-snapshot`
  );
}

// ---------------------------------------------------------------------------
// Compute jobs — compute.routes.ts
// ---------------------------------------------------------------------------

export interface EnqueueFinanceComputeJobParams {
  jobType: string;
  inputArtifactId: string;
  inputRevisionHash: string;
  engineManifestId: string;
  /** Wymagane przez serwer (`IDEMPOTENCY_KEY_REQUIRED` na 400) — generuj per intencja użytkownika, nie per klik. */
  idempotencyKey: string;
  requestId?: string | null;
  maxAttempts?: number;
}

export async function enqueueFinanceComputeJob(
  params: EnqueueFinanceComputeJobParams
): Promise<FinanceEnqueueJobResultDto> {
  return v8Post<FinanceEnqueueJobResultDto>(
    `${BASE}/compute/jobs`,
    {
      jobType: params.jobType,
      inputArtifactId: params.inputArtifactId,
      inputRevisionHash: params.inputRevisionHash,
      engineManifestId: params.engineManifestId,
      requestId: params.requestId ?? null,
      ...(params.maxAttempts !== undefined ? { maxAttempts: params.maxAttempts } : {}),
    },
    { extraHeaders: { 'Idempotency-Key': params.idempotencyKey } }
  );
}

export async function getFinanceComputeJob(jobId: string): Promise<FinanceComputeJobDto> {
  return v8Get<FinanceComputeJobDto>(`${BASE}/compute/jobs/${encodeURIComponent(jobId)}`);
}

export async function cancelFinanceComputeJob(
  jobId: string,
  reason?: string
): Promise<FinanceComputeJobDto> {
  return v8Post<FinanceComputeJobDto>(`${BASE}/compute/jobs/${encodeURIComponent(jobId)}/cancel`, {
    reason: reason ?? 'Cancelled via UI',
  });
}

/**
 * Odpytywanie do zakończenia joba (queued/running → succeeded/failed/cancelled).
 * `GET /compute/jobs/:id` nie zwraca wyniku obliczenia (D2 w PKG_B_API_report —
 * `compute_job_outputs` nie ma czytnika w serwisie) — po `succeeded` trzeba
 * dociągnąć wynik osobnym wywołaniem (np. `getFinanceBusinessVersion`), gdy
 * ten endpoint powstanie.
 */
export async function pollFinanceComputeJobUntilSettled(
  jobId: string,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<FinanceComputeJobDto> {
  const intervalMs = opts.intervalMs ?? 1500;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const job = await getFinanceComputeJob(jobId);
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }
    if (Date.now() > deadline) {
      const err = new Error('Compute job polling exceeded local timeout') as Error & { code?: string };
      err.code = 'CLIENT_POLL_TIMEOUT';
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// Models — models.routes.ts (approve/reopen, T8/T12, WP-C02 — sprzed pakietu B)
// ---------------------------------------------------------------------------

export interface ApproveFinanceModelParams {
  modelArtifactId: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export async function approveFinanceModel(
  params: ApproveFinanceModelParams
): Promise<FinanceApproveModelResultDto> {
  // v8PostRawBody, NIE v8Post — patrz komentarz przy definicji helpera:
  // ten endpoint zwraca płaskie {success,status}, bez koperty {data}.
  return v8PostRawBody<FinanceApproveModelResultDto>(
    `${BASE}/models/${encodeURIComponent(params.modelArtifactId)}/approve`,
    { ...(params.expectedVersion !== undefined ? { expectedVersion: params.expectedVersion } : {}) },
    params.idempotencyKey ? { extraHeaders: { 'Idempotency-Key': params.idempotencyKey } } : undefined
  );
}

export interface ReopenFinanceModelParams {
  modelArtifactId: string;
  reason: string;
  idempotencyKey: string;
  expectedVersion?: number;
}

export async function reopenFinanceModel(
  params: ReopenFinanceModelParams
): Promise<FinanceReopenModelResultDto> {
  return v8Post<FinanceReopenModelResultDto>(
    `${BASE}/models/${encodeURIComponent(params.modelArtifactId)}/reopen`,
    {
      reason: params.reason,
      ...(params.expectedVersion !== undefined ? { expectedVersion: params.expectedVersion } : {}),
    },
    { extraHeaders: { 'Idempotency-Key': params.idempotencyKey } }
  );
}

// ---------------------------------------------------------------------------
// Statements domain — statements.routes.ts (Pakiet B2, Pakiet D konsument)
// ---------------------------------------------------------------------------

export interface ListStatementLinesParams {
  statementType?: StatementType;
  entityId?: string;
  periodId?: string;
}

export async function listStatementLines(
  businessVersionId: string,
  params: ListStatementLinesParams = {}
): Promise<StatementLineDto[]> {
  const qs = new URLSearchParams();
  if (params.statementType) qs.set('statementType', params.statementType);
  if (params.entityId) qs.set('entityId', params.entityId);
  if (params.periodId) qs.set('periodId', params.periodId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return v8Get<StatementLineDto[]>(
    `${BASE}/statements/${encodeURIComponent(businessVersionId)}/lines${suffix}`
  );
}

export interface MapStatementLinesRequestParams {
  businessVersionId: string;
  unit: string;
  presentationCurrency: string;
  accumulationBasis?: string;
  rawLines: unknown[];
  rules: unknown[];
}

/**
 * Krok 1/2 przepływu mapowania (statements.routes.ts:56-98). Wymaga
 * `rawLines`/`rules` — surowych danych źródłowych i reguł mapowania, których
 * TEN workspace (widok już-zmapowanego packa) nie posiada; to jest zadanie
 * potoku ingestii (`FinancialStatementMappingEditor`/legacy pipeline).
 * Funkcja klienta jest tu dla kompletności kontraktu (mirror API B2), ale
 * `StatementPackWorkspaceV2` jej NIE wywołuje — patrz PKG_D_STATEMENTS_report.md
 * §„Co niepokryte" dla uzasadnienia.
 */
export async function mapStatementLines(
  params: MapStatementLinesRequestParams
): Promise<StatementMapResultSummaryDto> {
  return v8Post<StatementMapResultSummaryDto>(
    `${BASE}/statements/${encodeURIComponent(params.businessVersionId)}/map`,
    {
      unit: params.unit,
      presentationCurrency: params.presentationCurrency,
      accumulationBasis: params.accumulationBasis,
      rawLines: params.rawLines,
      rules: params.rules,
    }
  );
}

export interface RunStatementReconciliationParams {
  businessVersionId: string;
  sourceSystem: string;
  mappingResults: StatementMapResultDto[];
  materialityThresholdPct?: number;
  attemptReadinessTransition?: boolean;
  expectedVersion?: number;
  runPeriodJumpCheck?: boolean;
}

/**
 * Krok 2/2 — patrz uwaga przy `mapStatementLines`: wymaga `mappingResults` z kroku 1.
 * `expectedVersion` idzie w BODY (`_shared.ts:readExpectedVersion` czyta
 * `req.body.expectedVersion` PRZED nagłówkiem `x-model-version` — zmierzone,
 * nie zgadywane), tylko gdy `attemptReadinessTransition=true` (serwer zwraca
 * 400 `EXPECTED_VERSION_REQUIRED`, jeśli brak).
 */
export async function runStatementReconciliation(
  params: RunStatementReconciliationParams
): Promise<RunReconciliationResultDto> {
  return v8Post<RunReconciliationResultDto>(
    `${BASE}/statements/${encodeURIComponent(params.businessVersionId)}/reconcile`,
    {
      sourceSystem: params.sourceSystem,
      mappingResults: params.mappingResults,
      materialityThresholdPct: params.materialityThresholdPct,
      attemptReadinessTransition: params.attemptReadinessTransition ?? false,
      ...(params.attemptReadinessTransition && params.expectedVersion !== undefined
        ? { expectedVersion: params.expectedVersion }
        : {}),
      runPeriodJumpCheck: params.runPeriodJumpCheck,
    }
  );
}

/** Rekoncyliacja jest realnym, przetestowanym (real Postgres, B2) ledgerem — sam odczyt, newest-first. */
export async function listStatementReconciliationRuns(
  businessVersionId: string
): Promise<ReconciliationRunSummaryDto[]> {
  return v8Get<ReconciliationRunSummaryDto[]>(
    `${BASE}/statements/${encodeURIComponent(businessVersionId)}/reconciliation-runs`
  );
}

export async function getStatementReconciliationRun(
  reconciliationRunId: string
): Promise<ReconciliationRunDetailDto> {
  return v8Get<ReconciliationRunDetailDto>(
    `${BASE}/statements/reconciliation-runs/${encodeURIComponent(reconciliationRunId)}`
  );
}

// ---------------------------------------------------------------------------
// Cross-cutting — crosscutting.routes.ts (lineage, OWN-FIN-007/022)
// ---------------------------------------------------------------------------

/**
 * OWN-FIN-007/022: relacje WYŁĄCZNIE po `businessVersionId` (immutable) —
 * `ancestors`/`descendants` niosą typ artefaktu docelowego/źródłowego, nigdy
 * nazwę. Nazwa do wyświetlenia (jeśli w ogóle potrzebna) musi być dociągnięta
 * osobno (np. `getFinanceArtifact`) i jest tylko etykietą UI, nie kluczem relacji.
 */
export async function getFinanceVersionLineage(
  businessVersionId: string,
  maxDepth?: number
): Promise<VersionLineageDto> {
  const suffix = typeof maxDepth === 'number' ? `?maxDepth=${maxDepth}` : '';
  return v8Get<VersionLineageDto>(
    `${BASE}/versions/${encodeURIComponent(businessVersionId)}/lineage${suffix}`
  );
}

// --- PKG-F Baseline ---
// Pakiet F — Baseline (`server/src/routes/v8/finance-v2/baseline.routes.ts`,
// pakiet B2). Cztery endpointy: odczyt/zapis wsadowy założeń, compute,
// odczyt wyliczeń.
// ---------------------------------------------------------------------------

const BASELINE_BASE = `${BASE}/baseline`;

export interface ListBaselineAssumptionsParams {
  scheduleType?: BaselineScheduleType;
  entityId?: string;
}

export async function listBaselineAssumptions(
  businessVersionId: string,
  params: ListBaselineAssumptionsParams = {}
): Promise<BaselineAssumptionDto[]> {
  const qs = new URLSearchParams();
  if (params.scheduleType) qs.set('scheduleType', params.scheduleType);
  if (params.entityId) qs.set('entityId', params.entityId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return v8Get<BaselineAssumptionDto[]>(
    `${BASELINE_BASE}/${encodeURIComponent(businessVersionId)}/assumptions${suffix}`
  );
}

/** Zapis wsadowy — UPSERT (ON CONFLICT po kluczu komórki, baseline.routes.ts:101-155). Bezpieczne do ponowienia z tym samym zestawem — nie duplikuje wierszy. */
export async function upsertBaselineAssumptions(
  businessVersionId: string,
  assumptions: BaselineAssumptionUpsertInput[]
): Promise<BaselineAssumptionUpsertResultDto> {
  return v8Post<BaselineAssumptionUpsertResultDto>(
    `${BASELINE_BASE}/${encodeURIComponent(businessVersionId)}/assumptions`,
    { assumptions }
  );
}

/**
 * Uwaga (OWN-FIN-018, „Compute kończy się timeoutem bez wyniku"): `v8Post`
 * dziedziczy `fetchWithRetry`'ego twardy 20s timeout
 * (`src/services/api/baseClient.ts`). Ten klient NIE łapie timeoutu tutaj —
 * `describeFinanceV2Error` (financeV2.types.ts) już przeformułowuje surowy
 * `„Request timed out"` na komunikat PL, ale sam FAKT „czy compute się mimo
 * to zakończył po stronie serwera" musi rozstrzygnąć CALLER (odczytem
 * `listBaselineOutputs`/`getFinanceBusinessVersion` po timeoucie) — ten
 * moduł tylko woła endpoint, nie ukrywa niepewności. Patrz `useBaselineCompute`
 * (`src/components/Finance/baseline/useBaselineCompute.ts`) po realizację tej
 * ścieżki odzysku.
 */
export async function computeBaseline(params: BaselineComputeParams): Promise<BaselineComputeResultDto> {
  return v8Post<BaselineComputeResultDto>(`${BASELINE_BASE}/${encodeURIComponent(params.businessVersionId)}/compute`, {
    entityId: params.entityId,
    forecastPeriodIds: params.forecastPeriodIds,
    openingBalanceSheetPeriodId: params.openingBalanceSheetPeriodId,
    ...(params.engineManifestId ? { engineManifestId: params.engineManifestId } : {}),
  });
}

export interface ListBaselineOutputsParams {
  statementType?: BaselineStatementType;
  entityId?: string;
  periodId?: string;
}

export async function listBaselineOutputs(
  businessVersionId: string,
  params: ListBaselineOutputsParams = {}
): Promise<BaselineOutputDto[]> {
  const qs = new URLSearchParams();
  if (params.statementType) qs.set('statementType', params.statementType);
  if (params.entityId) qs.set('entityId', params.entityId);
  if (params.periodId) qs.set('periodId', params.periodId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return v8Get<BaselineOutputDto[]>(`${BASELINE_BASE}/${encodeURIComponent(businessVersionId)}/outputs${suffix}`);
}
// --- /PKG-F Baseline ---

// --- PKG-E Analysis ---
// Analysis (KPI) — analysis.routes.ts (Pakiet B2, ten pakiet — Pakiet E — jest
// pierwszym frontendowym konsumentem, `grep -rn "analysis/kpi-catalog" src/`
// dawał 0 trafień przed tym plikiem).
//
// UWAGA (scalenie fan-in wave 1): Pakiet E niezależnie zdefiniował TAKŻE
// `renameFinanceArtifact`/`RenameFinanceArtifactResultDto` (ten sam gap,
// ten sam endpoint `POST /artifacts/:id/rename`, ten sam kształt żądania i
// odpowiedzi jak Pakietu F). Ponieważ obie implementacje są funkcjonalnie
// identyczne (różni je wyłącznie nazwa lokalnego aliasu typu wyniku), scalenie
// zachowuje TYLKO wersję Pakietu F (wyżej, `FinanceRenameArtifactResultDto`
// w `financeV2.types.ts`) i pomija duplikat z Pakietu E — patrz
// FANIN_WAVE1_report.md §konflikty semantyczne.
// ---------------------------------------------------------------------------

export interface GetAnalysisKpiCatalogParams {
  tier?: AnalysisKpiTier;
  includeAllStatuses?: boolean;
}

export async function getAnalysisKpiCatalog(
  params: GetAnalysisKpiCatalogParams = {}
): Promise<AnalysisKpiCatalogEntryDto[]> {
  const query = new URLSearchParams();
  if (params.tier) query.set('tier', params.tier);
  if (params.includeAllStatuses) query.set('includeAllStatuses', 'true');
  const qs = query.toString();
  return v8Get<AnalysisKpiCatalogEntryDto[]>(`${BASE}/analysis/kpi-catalog${qs ? `?${qs}` : ''}`);
}

export interface ComputeAnalysisKpisApiParams {
  businessVersionId: string;
  attemptReadinessTransition?: boolean;
  /** Wymagane przez serwer TYLKO gdy `attemptReadinessTransition=true` (analysis.routes.ts:89-93). */
  expectedVersion?: number;
}

export async function computeAnalysisKpis(
  params: ComputeAnalysisKpisApiParams
): Promise<AnalysisComputeResultDto> {
  return v8Post<AnalysisComputeResultDto>(
    `${BASE}/analysis/${encodeURIComponent(params.businessVersionId)}/compute`,
    {
      attemptReadinessTransition: params.attemptReadinessTransition === true,
      ...(params.expectedVersion !== undefined ? { expectedVersion: params.expectedVersion } : {}),
    }
  );
}

export async function getAnalysisKpiValues(businessVersionId: string): Promise<AnalysisKpiValueDto[]> {
  return v8Get<AnalysisKpiValueDto[]>(`${BASE}/analysis/${encodeURIComponent(businessVersionId)}/kpi-values`);
}
// --- /PKG-E Analysis ---

// ---------------------------------------------------------------------------
// --- PKG-H Valuation --- valuation.routes.ts (Pakiet B3, UNVERIFIED_WIP @ 9604652e27)
//
// Typed client for the 21 `/finance-v2/valuation/*` endpoints. Shapes ported in
// `./financeV2.types` (§ PKG-H Valuation) — several read endpoints return raw snake_case DB rows
// (documented there, not silently re-mapped here: this client is a thin wrapper, same
// "router-only, no domain logic" discipline the server side documents for itself).
// ---------------------------------------------------------------------------

// --- 1. Cases + Variants ---

export async function createValuationCase(params: { name: string; description?: string | null }): Promise<ValuationCaseDto> {
  return v8Post<ValuationCaseDto>(`${BASE}/valuation/cases`, { name: params.name, description: params.description ?? null });
}

export async function listValuationCases(): Promise<ValuationCaseDto[]> {
  return v8Get<ValuationCaseDto[]>(`${BASE}/valuation/cases`);
}

export async function getValuationCase(caseId: string): Promise<ValuationCaseDetailDto> {
  return v8Get<ValuationCaseDetailDto>(`${BASE}/valuation/cases/${encodeURIComponent(caseId)}`);
}

export interface CreateValuationVariantParams {
  caseId: string;
  /** Must already exist — create via `createFinanceArtifact({artifactType:'VALUATION_CASE'})` first. */
  businessVersionId: string;
  name: string;
  description?: string | null;
}

export async function createValuationVariant(params: CreateValuationVariantParams): Promise<ValuationVariantDto> {
  return v8Post<ValuationVariantDto>(`${BASE}/valuation/cases/${encodeURIComponent(params.caseId)}/variants`, {
    businessVersionId: params.businessVersionId,
    name: params.name,
    description: params.description ?? null,
  });
}

export async function getValuationVariant(businessVersionId: string): Promise<ValuationVariantDto> {
  return v8Get<ValuationVariantDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}`);
}

export async function renameValuationVariant(
  businessVersionId: string,
  params: { name?: string; description?: string | null }
): Promise<ValuationVariantDto> {
  return v8Patch<ValuationVariantDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}`, params);
}

export interface CompareValuationVariantsParams {
  caseId: string;
  variantIdA: string;
  variantIdB: string;
  /** Default false (pure read). `true` also writes the comparison findings against variant A, pre-approval (DEC-FIN-006). */
  persist?: boolean;
}

export async function compareValuationVariants(params: CompareValuationVariantsParams): Promise<ValuationCompareVariantsResultDto> {
  return v8Post<ValuationCompareVariantsResultDto>(`${BASE}/valuation/cases/${encodeURIComponent(params.caseId)}/compare-variants`, {
    variantIdA: params.variantIdA,
    variantIdB: params.variantIdB,
    persist: params.persist === true,
  });
}

// --- 2. Methods + weighted recommendation basket ---

export async function listValuationMethods(
  businessVersionId: string
): Promise<{ methods: ValuationMethodDto[]; weightedRecommendation: ValuationWeightedRecommendationDto }> {
  return v8Get(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/methods`);
}

export async function createValuationMethod(
  businessVersionId: string,
  params: { methodType: ValuationMethodType; applicabilityPolicyRef?: string | null }
): Promise<ValuationMethodDto> {
  return v8Post<ValuationMethodDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/methods`, params);
}

export interface ValuationBasketUpdate {
  methodId: string;
  isInRecommendationBasket: boolean;
  /** Required (> 0) when `isInRecommendationBasket` is true; must be `null`/omitted otherwise — server rejects a mismatch with 400 before the DB CHECK would (DEC-FIN-005). */
  weightPct: number | null;
}

/** Atomic batch — the basket's weight sum (100%) is validated ONCE across every update in this call, not per-PATCH (DEFERRABLE trigger at COMMIT). Sends ONE request for the whole rebalance, never N one-method calls. */
export async function setValuationMethodBasketWeights(
  businessVersionId: string,
  updates: ValuationBasketUpdate[]
): Promise<{ methods: ValuationMethodDto[]; weightedRecommendation: ValuationWeightedRecommendationDto }> {
  return v8Post(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/methods/basket`, { updates });
}

// --- 3. WACC inputs ---

export async function getValuationWaccInputs(businessVersionId: string): Promise<ValuationWaccInputsRawDto> {
  return v8Get<ValuationWaccInputsRawDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/wacc-inputs`);
}

export interface UpsertValuationWaccInputsParams {
  currency: string;
  nominalOrReal: 'NOMINAL' | 'REAL';
  preOrPostTax: 'PRE_TAX' | 'POST_TAX';
  riskFreeRatePct?: number | null;
  equityRiskPremiumPct?: number | null;
  betaPeerSetRef?: string | null;
  betaUnlevered?: number | null;
  targetCapitalStructureDebtPct?: number | null;
  targetCapitalStructureEquityPct?: number | null;
  currentCapitalStructureDebtPct?: number | null;
  currentCapitalStructureEquityPct?: number | null;
  costOfDebtPretaxPct?: number | null;
  creditSpreadPct?: number | null;
  cashTaxRatePct?: number | null;
}

/** Server response is the raw upserted row (same shape as GET) despite this being a write — see inconsistency note in financeV2.types.ts. */
export async function upsertValuationWaccInputs(
  businessVersionId: string,
  params: UpsertValuationWaccInputsParams
): Promise<ValuationWaccInputsRawDto> {
  return v8Put<ValuationWaccInputsRawDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/wacc-inputs`, params);
}

// --- 4. Compute (DCF/FCFF) + full Results ---

export interface RunValuationDcfComputeParams {
  businessVersionId: string;
  entityId: string;
  projectionYears: { fiscalYear: number; periodIds: string[] }[];
  terminalGPct: number;
  engineManifestId?: string;
  requestId?: string | null;
  openingWorkingCapital?: number | null;
}

export async function runValuationDcfCompute(params: RunValuationDcfComputeParams): Promise<ValuationComputeDcfResultDto> {
  return v8Post<ValuationComputeDcfResultDto>(`${BASE}/valuation/variants/${encodeURIComponent(params.businessVersionId)}/compute/dcf`, {
    entityId: params.entityId,
    projectionYears: params.projectionYears,
    terminal: { gPct: params.terminalGPct },
    engineManifestId: params.engineManifestId,
    requestId: params.requestId ?? null,
    openingWorkingCapital: params.openingWorkingCapital ?? null,
  });
}

/** The "Results" step's single call — EV, Equity, weighted range, per-method breakdown, WACC, terminal, bridge, sensitivity grids, method-agreement warnings. */
export async function getValuationResults(businessVersionId: string): Promise<ValuationResultsDto> {
  return v8Get<ValuationResultsDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/results`);
}

// --- 5. EV -> Equity bridge ---

export async function getValuationBridge(businessVersionId: string): Promise<ValuationBridgeReadDto> {
  return v8Get<ValuationBridgeReadDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/bridge`);
}

export interface WriteValuationBridgeParams {
  businessVersionId: string;
  asOfDate: string;
  enterpriseValueDecimal: number;
  components: ValuationBridgeComponentInput[];
}

export async function writeValuationBridge(params: WriteValuationBridgeParams): Promise<ValuationBridgeWriteResultDto> {
  return v8Put<ValuationBridgeWriteResultDto>(`${BASE}/valuation/variants/${encodeURIComponent(params.businessVersionId)}/bridge`, {
    asOfDate: params.asOfDate,
    enterpriseValueDecimal: params.enterpriseValueDecimal,
    components: params.components,
  });
}

// --- 6. Terminal value (read) + Sensitivity 5x5 ---

export async function listValuationTerminalRows(methodId: string): Promise<ValuationTerminalRowRawDto[]> {
  return v8Get<ValuationTerminalRowRawDto[]>(`${BASE}/valuation/methods/${encodeURIComponent(methodId)}/terminal`);
}

export interface BuildValuationSensitivityGridParams {
  methodId: string;
  gridLabel: string;
  rowAxisVariable: string;
  columnAxisVariable: string;
  /** Exactly 5 ascending values — server rejects any other length with 400 (DEC-FIN-005 / OWN-FIN-002). */
  waccAxis: [number, number, number, number, number];
  /** Exactly 5 ascending values. */
  terminalGAxis: [number, number, number, number, number];
  years: { fiscalYear: number; fcff: number }[];
  fcffTerminalYear: number;
  baseWaccPct: number;
  baseGPct: number;
}

export async function buildValuationSensitivityGrid(params: BuildValuationSensitivityGridParams): Promise<ValuationSensitivityWriteResultDto> {
  return v8Post<ValuationSensitivityWriteResultDto>(`${BASE}/valuation/methods/${encodeURIComponent(params.methodId)}/sensitivity`, {
    gridLabel: params.gridLabel,
    rowAxisVariable: params.rowAxisVariable,
    columnAxisVariable: params.columnAxisVariable,
    axes: { wacc: params.waccAxis, terminalG: params.terminalGAxis },
    years: params.years,
    fcffTerminalYear: params.fcffTerminalYear,
    baseWaccPct: params.baseWaccPct,
    baseGPct: params.baseGPct,
  });
}

export async function getValuationSensitivityGrid(methodId: string, gridLabel: string): Promise<ValuationSensitivityGridRawDto> {
  return v8Get<ValuationSensitivityGridRawDto>(
    `${BASE}/valuation/methods/${encodeURIComponent(methodId)}/sensitivity/${encodeURIComponent(gridLabel)}`
  );
}

// --- 7. Advisor (pre-approval only, DEC-FIN-006) ---

export async function generateValuationAdvisorOutput(
  businessVersionId: string,
  opts: { persist?: boolean } = {}
): Promise<ValuationAdvisorGenerateResultDto> {
  return v8Post<ValuationAdvisorGenerateResultDto>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/advisor/generate`, {
    persist: opts.persist !== false,
  });
}

export async function listValuationAdvisorOutputs(businessVersionId: string): Promise<ValuationAdvisorFindingStoredDto[]> {
  return v8Get<ValuationAdvisorFindingStoredDto[]>(`${BASE}/valuation/variants/${encodeURIComponent(businessVersionId)}/advisor`);
}

// --- Cross-cutting, needed by the "Source" step (crosscutting.routes.ts, not Valuation-owned) ---
//
// UWAGA (scalenie fan-in wave 1): Pakiet H niezależnie zdefiniował TAKŻE
// `getFinanceVersionLineage(businessVersionId, maxDepth)` zwracające
// `ValuationLineageDto` — ten sam endpoint `GET /versions/:id/lineage`, które
// Pakiet D już dodał w sekcji „Cross-cutting" wyżej (zwraca `VersionLineageDto`).
// Porównanie pole-po-polu: `VersionLineageDto`/`LineageEdgeDto` (D) i
// `ValuationLineageDto`/`ValuationLineageEdgeDto` (H) mają IDENTYCZNE nazwy i
// typy pól (`ValuationLineageEdgeType` to zwykły alias `string`, tak samo jak
// D's `edgeType: string`) — różni je wyłącznie nazwa aliasu typu. Scalenie
// zachowuje TYLKO implementację Pakietu D (wyżej) i pomija duplikat funkcji z
// Pakietu H; typy `ValuationLineageDto`/`ValuationLineageEdgeDto` zostają
// (SourceStep.tsx importuje je po nazwie), strukturalnie kompatybilne z tym,
// co zwraca D's `getFinanceVersionLineage` — patrz FANIN_WAVE1_report.md
// §konflikty semantyczne.

// --- /PKG-H Valuation ---

export const FinanceV2Api = {
  createFinanceArtifact,
  getFinanceArtifact,
  listFinanceArtifactVersions,
  getFinanceArtifactCapabilities,
  renameFinanceArtifact,
  getFinanceBusinessVersion,
  transitionFinanceVersion,
  createFinanceComputeSnapshot,
  enqueueFinanceComputeJob,
  getFinanceComputeJob,
  cancelFinanceComputeJob,
  pollFinanceComputeJobUntilSettled,
  approveFinanceModel,
  reopenFinanceModel,
  listStatementLines,
  mapStatementLines,
  runStatementReconciliation,
  listStatementReconciliationRuns,
  getStatementReconciliationRun,
  getFinanceVersionLineage,
  // --- PKG-F Baseline ---
  listBaselineAssumptions,
  upsertBaselineAssumptions,
  computeBaseline,
  listBaselineOutputs,
  // --- /PKG-F Baseline ---
  // --- PKG-G Prediction --- (deklaracje funkcji są HOISTED — bezpieczne odwołanie mimo że
  // ich definicja jest niżej w tym pliku; brak potrzeby placeholdera/reassignu).
  runFinancePredictionPreflight,
  runFinancePredictionCalculate,
  listFinanceExceptionsOpen,
  // --- PKG-E Analysis --- (renameFinanceArtifact już wyżej — wspólna z Pakietem F, patrz uwaga przy definicji).
  getAnalysisKpiCatalog,
  computeAnalysisKpis,
  getAnalysisKpiValues,
  // --- PKG-H Valuation --- (getFinanceVersionLineage już wyżej — wspólna z Pakietem D, patrz uwaga przy definicji).
  createValuationCase,
  listValuationCases,
  getValuationCase,
  createValuationVariant,
  getValuationVariant,
  renameValuationVariant,
  compareValuationVariants,
  listValuationMethods,
  createValuationMethod,
  setValuationMethodBasketWeights,
  getValuationWaccInputs,
  upsertValuationWaccInputs,
  runValuationDcfCompute,
  getValuationResults,
  getValuationBridge,
  writeValuationBridge,
  listValuationTerminalRows,
  buildValuationSensitivityGrid,
  getValuationSensitivityGrid,
  generateValuationAdvisorOutput,
  listValuationAdvisorOutputs,
};

// ---------------------------------------------------------------------------
// --- PKG-G Prediction ---
//
// Dwa endpointy Prediction realnie zamontowane przez Pakiet B2
// (`server/src/routes/v8/finance-v2/prediction.routes.ts`) — DEC-FIN-004, DWA OSOBNE wywołania,
// nigdy nie łączyć w jedno. `GET /exceptions/open` jest generycznym, już istniejącym endpointem
// (`crosscutting.routes.ts`) — dopisany tu jako klient, bo widok Modele/Wyniki tego pakietu go
// potrzebuje (rejestr wyjątków, DEC-FIN-009), a jeszcze nie miał klienta w tym pliku.
//
// ★ LUKA (zaraportowana w PKG_G_PREDICTION_report.md): backend NIE MA jeszcze HTTP CRUD do zapisu
// `finance_prediction_scenarios`/`_driver_overrides`/`_initiatives`/`_impact_chain`/`_financing` —
// scenario builder (tryby A/B/C) działa dziś na lokalnym draft state
// (`src/components/Finance/Prediction/predictionScenarioModel.ts`), nie na tym kliencie. Ten klient
// pokrywa WYŁĄCZNIE to, co jest realnie zamontowane po stronie serwera.
// ---------------------------------------------------------------------------

export interface RunFinancePredictionPreflightParams {
  businessVersionId: string;
  openingBalanceSheetPeriodId?: string;
  entityId?: string;
}

export async function runFinancePredictionPreflight(
  params: RunFinancePredictionPreflightParams
): Promise<FinancePredictionPreflightResultDto> {
  return v8Post<FinancePredictionPreflightResultDto>(`${BASE}/prediction/${encodeURIComponent(params.businessVersionId)}/preflight`, {
    ...(params.openingBalanceSheetPeriodId !== undefined ? { openingBalanceSheetPeriodId: params.openingBalanceSheetPeriodId } : {}),
    ...(params.entityId !== undefined ? { entityId: params.entityId } : {}),
  });
}

export interface RunFinancePredictionCalculateParams {
  businessVersionId: string;
  entityId: string;
  forecastPeriodIds: readonly string[];
  openingBalanceSheetPeriodId: string;
  engineManifestId?: string;
}

export async function runFinancePredictionCalculate(
  params: RunFinancePredictionCalculateParams
): Promise<FinancePredictionCalculateResultDto> {
  return v8Post<FinancePredictionCalculateResultDto>(`${BASE}/prediction/${encodeURIComponent(params.businessVersionId)}/calculate`, {
    entityId: params.entityId,
    forecastPeriodIds: params.forecastPeriodIds,
    openingBalanceSheetPeriodId: params.openingBalanceSheetPeriodId,
    ...(params.engineManifestId !== undefined ? { engineManifestId: params.engineManifestId } : {}),
  });
}

/** `crosscutting.routes.ts` `GET /exceptions/open` — rejestr wyjątków (DEC-FIN-009) dla widoku Modele/Wyniki. */
export async function listFinanceExceptionsOpen(artifactId?: string): Promise<FinanceExceptionOpenDto[]> {
  const qs = artifactId ? `?artifactId=${encodeURIComponent(artifactId)}` : '';
  return v8Get<FinanceExceptionOpenDto[]>(`${BASE}/exceptions/open${qs}`);
}

// =============================================================================================
// --- AP-CLIENT (Gate J) ---
//
// Pięć zdolności z realnymi, przetestowanymi trasami HTTP i ZERO klienta frontendowego
// (`docs/validation/finance-v3/generated/gate-e/PKG_AP_LAYER_INVENTORY_2026-08-12.md`):
// Compare (6), Comments/review (17), Saved views (6), Export/Import (4), Lineage navigator (2) —
// 35 endpointów łącznie. Reużywa `v8Get`/`v8Post`/`v8Patch`/`v8Delete`/`v8PostMultipart`
// (src/services/api/v8/client.ts) — TA SAMA koperta `{data}` konwencja jak reszta tego pliku,
// zweryfikowana czytaniem KAŻDEJ trasy (nie zgadywana) przed napisaniem funkcji poniżej.
// Nowe, nazwane eksporty WYŁĄCZNIE w tych pięciu blokach — istniejące 51 eksportów i obiekt
// `FinanceV2Api` powyżej NIE są dotykane (fan-in bezpieczeństwo).
// =============================================================================================

// --- AP-CLIENT Compare ---
// compare.routes.ts — 6 endpointów, jeden POST per oś porównania. Każdy zwraca `{data: CompareResultDto}`
// (koperta standardowa, `v8Post` ją rozpakowuje) albo rzuca błąd z `.status`/`.data.code` (400/403/404,
// patrz `httpStatusForCompareError` w routerze — `CompareErrorCodeDto` tu jest portem tej samej listy).
// ---------------------------------------------------------------------------

const COMPARE_BASE = `${BASE}/compare`;

export interface CompareFinancePeriodsParams {
  artifactRef: { artifactType: FinanceArtifactType; artifactId: string; businessVersionId: string };
  periodIdA: string;
  periodIdB: string;
  entityId?: string;
  canonicalLineIds?: string[];
  kpiCatalogIds?: string[];
  consolidationScope?: string;
  accumulationBasis?: string;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelA?: string;
  labelB?: string;
}

/** `POST /compare/periods` — ta sama wersja/artefakt, dwa okresy (oś "okres/okres"). */
export async function compareFinancePeriods(params: CompareFinancePeriodsParams): Promise<CompareResultDto> {
  return v8Post<CompareResultDto>(`${COMPARE_BASE}/periods`, {
    artifactRef: params.artifactRef,
    periodIdA: params.periodIdA,
    periodIdB: params.periodIdB,
    entityId: params.entityId,
    canonicalLineIds: params.canonicalLineIds,
    kpiCatalogIds: params.kpiCatalogIds,
    consolidationScope: params.consolidationScope,
    accumulationBasis: params.accumulationBasis,
    materialityThresholdPct: params.materialityThresholdPct,
    onlyMaterial: params.onlyMaterial,
    labelA: params.labelA,
    labelB: params.labelB,
  });
}

export interface CompareFinanceVersionsParams {
  artifactType: FinanceArtifactType;
  artifactId: string;
  businessVersionIdA: string;
  businessVersionIdB: string;
  entityCode?: string;
  canonicalLineIds?: string[];
  kpiCatalogIds?: string[];
  consolidationScope?: string;
  accumulationBasis?: string;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelA?: string;
  labelB?: string;
}

/** `POST /compare/versions` — dwa `business_version_id` TEGO SAMEGO artefaktu (oś "wersja/wersja"). */
export async function compareFinanceVersions(params: CompareFinanceVersionsParams): Promise<CompareResultDto> {
  return v8Post<CompareResultDto>(`${COMPARE_BASE}/versions`, {
    artifactType: params.artifactType,
    artifactId: params.artifactId,
    businessVersionIdA: params.businessVersionIdA,
    businessVersionIdB: params.businessVersionIdB,
    entityCode: params.entityCode,
    canonicalLineIds: params.canonicalLineIds,
    kpiCatalogIds: params.kpiCatalogIds,
    consolidationScope: params.consolidationScope,
    accumulationBasis: params.accumulationBasis,
    materialityThresholdPct: params.materialityThresholdPct,
    onlyMaterial: params.onlyMaterial,
    labelA: params.labelA,
    labelB: params.labelB,
  });
}

export interface CompareFinanceEntitiesParams {
  artifactRef: { artifactType: FinanceArtifactType; artifactId: string; businessVersionId: string };
  periodId: string;
  entityIdA: string;
  entityIdB: string;
  canonicalLineIds?: string[];
  consolidationScope?: string;
  accumulationBasis?: string;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelA?: string;
  labelB?: string;
}

/** `POST /compare/entities` — ten sam okres, dwa podmioty w obrębie Statement Pack. */
export async function compareFinanceEntities(params: CompareFinanceEntitiesParams): Promise<CompareResultDto> {
  return v8Post<CompareResultDto>(`${COMPARE_BASE}/entities`, {
    artifactRef: params.artifactRef,
    periodId: params.periodId,
    entityIdA: params.entityIdA,
    entityIdB: params.entityIdB,
    canonicalLineIds: params.canonicalLineIds,
    consolidationScope: params.consolidationScope,
    accumulationBasis: params.accumulationBasis,
    materialityThresholdPct: params.materialityThresholdPct,
    onlyMaterial: params.onlyMaterial,
    labelA: params.labelA,
    labelB: params.labelB,
  });
}

export interface CompareFinanceScenariosParams {
  businessVersionIdBase: string;
  businessVersionIdOther: string;
  entityCode?: string;
  canonicalLineIds?: string[];
  consolidationScope?: string;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelBase?: string;
  labelOther?: string;
}

/** `POST /compare/scenarios` — Base vs Upside/Downside (oś "scenariusz/baseline"). */
export async function compareFinanceScenarios(params: CompareFinanceScenariosParams): Promise<CompareResultDto> {
  return v8Post<CompareResultDto>(`${COMPARE_BASE}/scenarios`, {
    businessVersionIdBase: params.businessVersionIdBase,
    businessVersionIdOther: params.businessVersionIdOther,
    entityCode: params.entityCode,
    canonicalLineIds: params.canonicalLineIds,
    consolidationScope: params.consolidationScope,
    materialityThresholdPct: params.materialityThresholdPct,
    onlyMaterial: params.onlyMaterial,
    labelBase: params.labelBase,
    labelOther: params.labelOther,
  });
}

export interface CompareFinanceValuationMethodsParams {
  businessVersionId: string;
  methodTypeA: string;
  methodTypeB: string;
  materialityThresholdPct?: number;
  labelA?: string;
  labelB?: string;
}

/** `POST /compare/valuation-methods` — DCF vs comps (oś "metoda/metoda"), ta sama wersja. */
export async function compareFinanceValuationMethods(params: CompareFinanceValuationMethodsParams): Promise<CompareResultDto> {
  return v8Post<CompareResultDto>(`${COMPARE_BASE}/valuation-methods`, {
    businessVersionId: params.businessVersionId,
    methodTypeA: params.methodTypeA,
    methodTypeB: params.methodTypeB,
    materialityThresholdPct: params.materialityThresholdPct,
    labelA: params.labelA,
    labelB: params.labelB,
  });
}

export interface CompareFinanceActualVsForecastParams {
  actualArtifactRef: { artifactType: FinanceArtifactType; artifactId: string; businessVersionId: string };
  forecastArtifactRef: { artifactType: FinanceArtifactType; artifactId: string; businessVersionId: string };
  entityCode: string;
  periodIds: string[];
  accumulationBasis: string;
  canonicalLineIds?: string[];
  consolidationScope?: string;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
}

/** `POST /compare/actual-vs-forecast` — Statement Pack (actual) vs Baseline/Scenario (forecast), oś "actual/forecast". */
export async function compareFinanceActualVsForecast(params: CompareFinanceActualVsForecastParams): Promise<CompareResultDto> {
  return v8Post<CompareResultDto>(`${COMPARE_BASE}/actual-vs-forecast`, {
    actualArtifactRef: params.actualArtifactRef,
    forecastArtifactRef: params.forecastArtifactRef,
    entityCode: params.entityCode,
    periodIds: params.periodIds,
    accumulationBasis: params.accumulationBasis,
    canonicalLineIds: params.canonicalLineIds,
    consolidationScope: params.consolidationScope,
    materialityThresholdPct: params.materialityThresholdPct,
    onlyMaterial: params.onlyMaterial,
  });
}
// --- /AP-CLIENT Compare ---

// --- AP-CLIENT Comments ---
// comments.routes.ts — 10 endpointów komentarzy + 7 endpointów review-checklist = 17. DTO w
// financeV2.types.ts §AP-CLIENT Comments jest portem `toCommentDto`/`toCommentAssignmentDto`/
// `toChecklistItemDto` (te trzy mappery już usuwają `organization_id`) — czytane wprost z routera.
// ---------------------------------------------------------------------------

export interface CreateFinanceCommentParams {
  artifactId: string;
  businessVersionId: string;
  anchor?: FinanceCellRefInput | null;
  body: string;
  mentions?: string[];
  isBlocking?: boolean;
}

export async function createFinanceComment(params: CreateFinanceCommentParams): Promise<FinanceCommentDto> {
  return v8Post<FinanceCommentDto>(`${BASE}/comments`, {
    artifactId: params.artifactId,
    businessVersionId: params.businessVersionId,
    anchor: params.anchor ?? null,
    body: params.body,
    mentions: params.mentions,
    isBlocking: params.isBlocking,
  });
}

export async function resolveFinanceComment(commentId: string): Promise<FinanceCommentDto> {
  return v8Post<FinanceCommentDto>(`${BASE}/comments/${encodeURIComponent(commentId)}/resolve`);
}

export async function reopenFinanceComment(commentId: string): Promise<FinanceCommentDto> {
  return v8Post<FinanceCommentDto>(`${BASE}/comments/${encodeURIComponent(commentId)}/reopen`);
}

export async function assignFinanceComment(
  commentId: string,
  params: { assigneeId: string; dueDate?: string }
): Promise<FinanceCommentAssignmentDto> {
  return v8Post<FinanceCommentAssignmentDto>(`${BASE}/comments/${encodeURIComponent(commentId)}/assign`, {
    assigneeId: params.assigneeId,
    dueDate: params.dueDate,
  });
}

export async function getFinanceCommentAssignment(commentId: string): Promise<FinanceCommentAssignmentDto | null> {
  return v8Get<FinanceCommentAssignmentDto | null>(`${BASE}/comments/${encodeURIComponent(commentId)}/assignment`);
}

export async function getFinanceComment(commentId: string): Promise<FinanceCommentDto> {
  return v8Get<FinanceCommentDto>(`${BASE}/comments/${encodeURIComponent(commentId)}`);
}

export interface ListFinanceCommentsParams {
  /** Dokładnie jedno z dwóch — serwer odrzuca (400) i brak, i oba naraz. */
  artifactId?: string;
  businessVersionId?: string;
  unresolvedOnly?: boolean;
  blockingOnly?: boolean;
}

export async function listFinanceComments(params: ListFinanceCommentsParams): Promise<FinanceCommentDto[]> {
  const qs = new URLSearchParams();
  if (params.artifactId) qs.set('artifactId', params.artifactId);
  if (params.businessVersionId) qs.set('businessVersionId', params.businessVersionId);
  if (params.unresolvedOnly) qs.set('unresolvedOnly', 'true');
  if (params.blockingOnly) qs.set('blockingOnly', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return v8Get<FinanceCommentDto[]>(`${BASE}/comments${suffix}`);
}

export async function searchFinanceCommentsByCell(
  businessVersionId: string,
  cellRef: FinanceCellRefInput
): Promise<FinanceCommentDto[]> {
  return v8Post<FinanceCommentDto[]>(`${BASE}/comments/search-by-cell`, { businessVersionId, cellRef });
}

/** `GET /comments/mentions/me` — TYLKO wzmianki wywołującego (serwer nie przyjmuje `userId` w query). */
export async function listFinanceCommentMentionsForMe(): Promise<FinanceCommentDto[]> {
  return v8Get<FinanceCommentDto[]>(`${BASE}/comments/mentions/me`);
}

export async function hasUnresolvedBlockingFinanceComments(
  businessVersionId: string
): Promise<{ hasUnresolvedBlockingComments: boolean }> {
  return v8Get<{ hasUnresolvedBlockingComments: boolean }>(
    `${BASE}/versions/${encodeURIComponent(businessVersionId)}/has-unresolved-blocking-comments`
  );
}

export interface AddFinanceReviewChecklistItemParams {
  businessVersionId: string;
  item: string;
  required?: boolean;
}

export async function addFinanceReviewChecklistItem(
  params: AddFinanceReviewChecklistItemParams
): Promise<FinanceReviewChecklistItemDto> {
  return v8Post<FinanceReviewChecklistItemDto>(`${BASE}/review-checklist`, {
    businessVersionId: params.businessVersionId,
    item: params.item,
    required: params.required,
  });
}

export async function checkFinanceReviewChecklistItem(itemId: string): Promise<FinanceReviewChecklistItemDto> {
  return v8Post<FinanceReviewChecklistItemDto>(`${BASE}/review-checklist/${encodeURIComponent(itemId)}/check`);
}

export async function uncheckFinanceReviewChecklistItem(itemId: string): Promise<FinanceReviewChecklistItemDto> {
  return v8Post<FinanceReviewChecklistItemDto>(`${BASE}/review-checklist/${encodeURIComponent(itemId)}/uncheck`);
}

export async function setFinanceReviewChecklistItemRequired(
  itemId: string,
  required: boolean
): Promise<FinanceReviewChecklistItemDto> {
  return v8Post<FinanceReviewChecklistItemDto>(`${BASE}/review-checklist/${encodeURIComponent(itemId)}/required`, { required });
}

export async function listFinanceReviewChecklist(businessVersionId: string): Promise<FinanceReviewChecklistItemDto[]> {
  return v8Get<FinanceReviewChecklistItemDto[]>(`${BASE}/review-checklist/${encodeURIComponent(businessVersionId)}`);
}

export async function allFinanceReviewChecklistRequiredChecked(
  businessVersionId: string
): Promise<{ allRequiredChecked: boolean }> {
  return v8Get<{ allRequiredChecked: boolean }>(
    `${BASE}/review-checklist/${encodeURIComponent(businessVersionId)}/all-required-checked`
  );
}

/** Maker-checker: wiersze zmienione od ostatniej APPROVED wersji (AP-06's "changed-only reviewer entry"). */
export async function getFinanceReviewChecklistChangedCells(
  businessVersionId: string,
  previousApprovedBusinessVersionId?: string
): Promise<FinanceChangedCellsResultDto> {
  const qs = previousApprovedBusinessVersionId
    ? `?previousApprovedBusinessVersionId=${encodeURIComponent(previousApprovedBusinessVersionId)}`
    : '';
  return v8Get<FinanceChangedCellsResultDto>(
    `${BASE}/review-checklist/${encodeURIComponent(businessVersionId)}/changed-cells${qs}`
  );
}
// --- /AP-CLIENT Comments ---

// --- AP-CLIENT SavedViews ---
// saved-views.routes.ts — 6 endpointów. Widoczność (PERSONAL/TEAM), kolejność/przypięcie/ukrycie
// kolumn żyją w `gridViewState` (port `GridViewStateSnapshotInput`), filtry w osobnej tablicy
// `filters` (port `SavedViewFilterInput`) — serwer bramkuje WSZYSTKIE reguły widoczności/edycji
// wewnątrz `savedViewService.ts`, klient ich nie powiela.
// ---------------------------------------------------------------------------

const SAVED_VIEWS_BASE = `${BASE}/saved-views`;

export interface CreateFinanceSavedViewParams {
  artifactId: string;
  scope: FinanceSavedViewScope;
  name: string;
  gridViewState: GridViewStateSnapshotInput;
  filters?: SavedViewFilterInput[];
}

export async function createFinanceSavedView(params: CreateFinanceSavedViewParams): Promise<FinanceSavedViewDto> {
  return v8Post<FinanceSavedViewDto>(SAVED_VIEWS_BASE, {
    artifactId: params.artifactId,
    scope: params.scope,
    name: params.name,
    gridViewState: params.gridViewState,
    filters: params.filters,
  });
}

/** `GET /saved-views?artifactId=` — widoki TEAM na artefakcie + własne PERSONAL wywołującego. */
export async function listFinanceSavedViews(artifactId: string): Promise<FinanceSavedViewDto[]> {
  return v8Get<FinanceSavedViewDto[]>(`${SAVED_VIEWS_BASE}?artifactId=${encodeURIComponent(artifactId)}`);
}

export async function getFinanceSharedSavedView(shareToken: string): Promise<FinanceSavedViewDto> {
  return v8Get<FinanceSavedViewDto>(`${SAVED_VIEWS_BASE}/shared/${encodeURIComponent(shareToken)}`);
}

export async function getFinanceSavedView(viewId: string): Promise<FinanceSavedViewDto> {
  return v8Get<FinanceSavedViewDto>(`${SAVED_VIEWS_BASE}/${encodeURIComponent(viewId)}`);
}

export interface UpdateFinanceSavedViewParams {
  name?: string;
  gridViewState?: GridViewStateSnapshotInput;
  filters?: SavedViewFilterInput[];
}

/** Owner-only niezależnie od `scope` (egzekwowane przez serwer). */
export async function updateFinanceSavedView(
  viewId: string,
  params: UpdateFinanceSavedViewParams
): Promise<FinanceSavedViewDto> {
  return v8Patch<FinanceSavedViewDto>(`${SAVED_VIEWS_BASE}/${encodeURIComponent(viewId)}`, params);
}

/** Owner-only niezależnie od `scope`. 204 bez treści — patrz `v8DeleteExpectNoContent` (obejście defektu `v8Delete`). */
export async function deleteFinanceSavedView(viewId: string): Promise<null> {
  return v8DeleteExpectNoContent(`${SAVED_VIEWS_BASE}/${encodeURIComponent(viewId)}`);
}
// --- /AP-CLIENT SavedViews ---

// --- AP-CLIENT ExportImport ---
// export-import.routes.ts — 4 endpointy: `.xlsx` eksport (binarny + manifest w nagłówku) i
// trzystopniowy import (parse multipart → preview read-only → apply transakcyjny). Import jest
// WSZYSTKO-ALBO-NIC — `applyFinanceImport` nigdy nie zwraca częściowego sukcesu (serwer sam
// egzekwuje to jednym `Operation.batch`; klient tego nie symuluje ponownie).
// ---------------------------------------------------------------------------

export interface FinanceStatementPackExportResult {
  blob: Blob;
  manifest: FinanceExcelManifestDto;
  filename: string;
}

/**
 * `GET /export/statement-pack/:artifactId/:businessVersionId` — jedyny endpoint w tym pakiecie,
 * który NIE zwraca JSON `{data}}` (binarny `.xlsx`) — woła `fetchWithRetry` bezpośrednio, jak
 * `v8PostRawBody` powyżej, ale dla GET+blob. Manifest (wersja/jednostka/źródło) podróżuje w
 * nagłówku `X-Finance-Export-Manifest` (export-import.routes.ts:78), NIE w treści.
 */
export async function exportFinanceStatementPackXlsx(
  artifactId: string,
  businessVersionId: string
): Promise<FinanceStatementPackExportResult> {
  const path = `${BASE}/export/statement-pack/${encodeURIComponent(artifactId)}/${encodeURIComponent(businessVersionId)}`;
  const res = await fetchWithRetry(`${V8_BASE}${path}`, { method: 'GET', headers: getHeaders() });
  if (!res.ok) {
    // Ścieżka błędu zwraca zwykły JSON {error,code} — reużywamy `handleResponse`, żeby dostać
    // ten sam kształt rzuconego błędu (`.status`/`.data.code`) jak reszta tego klienta.
    await handleResponse(res, `V8 GET ${path}`);
    throw new Error('Nieoczekiwany stan: handleResponse powinien rzucić dla !res.ok');
  }
  const manifestHeader = res.headers.get('X-Finance-Export-Manifest');
  if (!manifestHeader) {
    throw new Error('Odpowiedź eksportu nie zawiera nagłówka X-Finance-Export-Manifest');
  }
  const manifest = JSON.parse(manifestHeader) as FinanceExcelManifestDto;
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  const blob = await res.blob();
  return {
    blob,
    manifest,
    filename: filenameMatch?.[1] ?? `${manifest.artifactId}-v${manifest.businessVersionNo}.xlsx`,
  };
}

/** `POST /import/parse` — multipart `.xlsx` upload (pole `file`). Tylko `.xlsx` — `.csv` świadomie poza zakresem tego routera (patrz nagłówek `export-import.routes.ts`). */
export async function parseFinanceImportXlsx(file: Blob, filename: string): Promise<FinanceImportParsedDto> {
  const formData = new FormData();
  formData.append('file', file, filename);
  return v8PostMultipart<FinanceImportParsedDto>(`${BASE}/import/parse`, formData);
}

export interface PreviewFinanceImportParams {
  artifactId: string;
  businessVersionId: string;
  manifest: FinanceExcelManifestDto;
  rows: FinanceImportRawRow[];
}

/** `POST /import/preview` — read-only PODGLĄD RÓŻNIC przed zastosowaniem (nic nie zapisuje). */
export async function previewFinanceImport(params: PreviewFinanceImportParams): Promise<FinanceImportPreviewDto> {
  return v8Post<FinanceImportPreviewDto>(`${BASE}/import/preview`, {
    artifactId: params.artifactId,
    businessVersionId: params.businessVersionId,
    manifest: params.manifest,
    rows: params.rows,
  });
}

export interface ApplyFinanceImportReopenInput {
  reason: string;
  expectedVersion: number;
  versionKind?: 'ORIGINAL' | 'RESTATED';
  restatementReason?: string;
  restatementClass?: string;
}

export interface ApplyFinanceImportParams {
  artifactId: string;
  businessVersionId: string;
  /** CAS pin — musi zgadzać się z bieżącą `working_revision_id`, inaczej 409 `WORKING_REVISION_CONFLICT`. */
  expectedWorkingRevisionId: string;
  manifest: FinanceExcelManifestDto;
  rows: FinanceImportRawRow[];
  /** Wymagane — generuj per intencja użytkownika (jeden import = jeden klucz), nie per retry. */
  batchIdempotencyKey: string;
  /** Dostarczane TYLKO gdy caller już potwierdził (po `STATE_PRECONDITION_FAILED`/`reopenRequired` z preview), że cel jest APPROVED i wywołanie ma go najpierw ponownie otworzyć. */
  reopen?: ApplyFinanceImportReopenInput;
}

/** `POST /import/apply` — JEDEN transakcyjny `Operation.batch`, wszystko-albo-nic (400/409/422 zamiast częściowego zastosowania). */
export async function applyFinanceImport(params: ApplyFinanceImportParams): Promise<FinanceImportApplyResultDto> {
  return v8Post<FinanceImportApplyResultDto>(
    `${BASE}/import/apply`,
    {
      artifactId: params.artifactId,
      businessVersionId: params.businessVersionId,
      expectedWorkingRevisionId: params.expectedWorkingRevisionId,
      manifest: params.manifest,
      rows: params.rows,
      batchIdempotencyKey: params.batchIdempotencyKey,
      ...(params.reopen ? { reopen: params.reopen } : {}),
    },
    { extraHeaders: { 'Idempotency-Key': params.batchIdempotencyKey } }
  );
}
// --- /AP-CLIENT ExportImport ---

// --- AP-CLIENT LineageNavigator ---
// lineage-navigator.routes.ts — 2 endpointy. `getFinanceLineageNavigator` zamyka OWN-FIN-007/022
// (kompaktowy breadcrumb + panel "Powiązane" z licznikami i `+ Nowy`); `createFinanceLineageEdge`
// jest połową zapisu tego samego grafu (bez niej DAG Statement→Analysis→Baseline→Prediction→
// Valuation nie dało się zbudować przez API w ogóle — patrz nagłówek routera).
// ---------------------------------------------------------------------------

export interface GetFinanceLineageNavigatorParams {
  maxDepth?: number;
  maxTrailNodes?: number;
  terminalVisibility?: 'show' | 'dim' | 'hide';
}

export async function getFinanceLineageNavigator(
  businessVersionId: string,
  params: GetFinanceLineageNavigatorParams = {}
): Promise<FinanceLineageNavigatorDto> {
  const qs = new URLSearchParams();
  if (params.maxDepth !== undefined) qs.set('maxDepth', String(params.maxDepth));
  if (params.maxTrailNodes !== undefined) qs.set('maxTrailNodes', String(params.maxTrailNodes));
  if (params.terminalVisibility) qs.set('terminalVisibility', params.terminalVisibility);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return v8Get<FinanceLineageNavigatorDto>(
    `${BASE}/versions/${encodeURIComponent(businessVersionId)}/lineage-navigator${suffix}`
  );
}

export interface CreateFinanceLineageEdgeParams {
  sourceVersionId: string;
  sourceArtifactType: FinanceArtifactType;
  targetVersionId: string;
  targetArtifactType: FinanceArtifactType;
  edgeType: string;
  transformationKind: string;
  assumptionSnapshotHash?: string;
  assumptionSnapshotId?: string;
  computeRunId?: string;
}

/** `POST /versions/lineage-edges` — jedna, append-only krawędź lineage (rank/cykl/hash walidowane serwerowo). */
export async function createFinanceLineageEdge(params: CreateFinanceLineageEdgeParams): Promise<FinanceLineageEdgeCreatedDto> {
  return v8Post<FinanceLineageEdgeCreatedDto>(`${BASE}/versions/lineage-edges`, params);
}
// --- /AP-CLIENT LineageNavigator ---

export type { CompareErrorCodeDto, FinanceImportApplyErrorCodeDto };
