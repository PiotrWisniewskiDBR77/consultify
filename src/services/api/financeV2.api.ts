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
import { v8Get, v8Patch, v8Post, v8Put } from './v8/client';
import type {
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
  FinanceReopenModelResultDto,
  FinanceTransitionResultDto,
  LifecycleAction,
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

export async function getFinanceVersionLineage(businessVersionId: string, maxDepth?: number): Promise<ValuationLineageDto> {
  const qs = typeof maxDepth === 'number' ? `?maxDepth=${encodeURIComponent(String(maxDepth))}` : '';
  return v8Get<ValuationLineageDto>(`${BASE}/versions/${encodeURIComponent(businessVersionId)}/lineage${qs}`);
}

// --- /PKG-H Valuation ---

export const FinanceV2Api = {
  createFinanceArtifact,
  getFinanceArtifact,
  listFinanceArtifactVersions,
  getFinanceArtifactCapabilities,
  getFinanceBusinessVersion,
  transitionFinanceVersion,
  createFinanceComputeSnapshot,
  enqueueFinanceComputeJob,
  getFinanceComputeJob,
  cancelFinanceComputeJob,
  pollFinanceComputeJobUntilSettled,
  approveFinanceModel,
  reopenFinanceModel,
  // --- PKG-H Valuation ---
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
  getFinanceVersionLineage,
};
