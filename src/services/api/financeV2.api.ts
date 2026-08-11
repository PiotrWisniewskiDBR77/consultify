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
import { v8Get, v8Post } from './v8/client';
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
  ReconciliationRunDetailDto,
  ReconciliationRunSummaryDto,
  RunReconciliationResultDto,
  StatementLineDto,
  StatementMapResultDto,
  StatementMapResultSummaryDto,
  StatementType,
  VersionLineageDto,
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
  listStatementLines,
  mapStatementLines,
  runStatementReconciliation,
  listStatementReconciliationRuns,
  getStatementReconciliationRun,
  getFinanceVersionLineage,
};
