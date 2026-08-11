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
  AnalysisComputeResultDto,
  AnalysisKpiCatalogEntryDto,
  AnalysisKpiTier,
  AnalysisKpiValueDto,
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
// Analysis (KPI) — analysis.routes.ts (Pakiet B2, ten pakiet — Pakiet E — jest
// pierwszym frontendowym konsumentem, `grep -rn "analysis/kpi-catalog" src/`
// dawał 0 trafień przed tym plikiem).
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
  getAnalysisKpiCatalog,
  computeAnalysisKpis,
  getAnalysisKpiValues,
};
