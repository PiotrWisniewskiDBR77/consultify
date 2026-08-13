/**
 * RN-G2 §G #25 — OKR Objective + Key Result API client (RN_G2_UI_SCOPE.md §G
 * #25 "Objectives + Key Results CRUD + check-ins").
 *
 * Same hand-written, small-surface convention as `okrApi.ts`/`roiApi.ts` —
 * exactly the endpoints this package needs, not a wrapper for the full
 * ~65-endpoint OKR surface. Objectives and Key Results are combined in ONE
 * file (unlike Sets vs. Objectives being split) because the backend itself
 * treats them as one epic (OKR-E003, `okrObjectiveCommands.ts` +
 * `okrKeyResultCommands.ts` share `assertSetEditableForUpdate`) and because
 * `listObjectivesForSet`/`getObjective` return KRs NESTED — the two DTOs are
 * never fetched independently of each other in this package.
 *
 * Server source of truth (read directly, not guessed — CLAUDE.md "Weryfikuj
 * REALNY runtime"):
 *  - `server/src/services/resultsVnext/okr/okrObjectiveTypes.ts` (`OkrObjective`, `toOkrObjective`)
 *  - `server/src/services/resultsVnext/okr/okrKeyResultTypes.ts` (`OkrKeyResult`, `toOkrKeyResult`)
 *  - `server/src/services/resultsVnext/okr/okrObjectiveRepository.ts` (`OkrObjectiveWithKeyResults`,
 *    `listObjectivesForSet`, `getObjective`, `getKeyResult` — confirms KRs are
 *    batch-loaded and nested onto each Objective, never a separate
 *    "list KRs for objective" endpoint)
 *  - `server/src/validators/resultsVnextOkr.validators.ts` L365-497 (every
 *    schema below transcribed field-for-field)
 *  - `server/src/routes/resultsVnext/okr.routes.ts` L1355-1721 (exact
 *    paths/methods)
 *
 * ── REAL, CONFIRMED GAP — no "list Key Results for an Objective" endpoint ──
 * `okr.routes.ts` has NO `GET /objectives/:objectiveId/key-results` (grepped
 * the full file — only the `POST` create route exists at that path). This is
 * NOT a client oversight: the backend design deliberately returns KRs nested
 * inside `listObjectivesForSet`/`getObjective` (`OkrObjectiveWithKeyResults`)
 * instead of a separate list route — so `getObjectiveWithKeyResults` below
 * (wrapping `GET /objectives/:objectiveId`) is genuinely how this package
 * gets a KR list for one Objective, not a workaround for a missing endpoint.
 *
 * ── LOCK RULE — shared by Objectives AND Key Results ────────────────────
 * `assertSetEditableForUpdate` (`okrObjectiveCommands.ts` L103-129, exported
 * and reused verbatim by `okrKeyResultCommands.ts` L27) gates EVERY
 * create/update/cancel command for BOTH Objectives and Key Results on the
 * OWNING Set's status being in `['draft', 'changes_requested']` — the exact
 * same two statuses as `OKR_SET_DRAFT_EDITABLE_STATUSES`
 * (`okrSetCommands.ts` L464) already used for Set-level locking in
 * `okrRegistryMappers.ts`. This client does not re-derive that rule — the UI
 * layer (`okrObjectiveMappers.ts`) reuses the Set's own lock info directly.
 */
import { API_URL, getHeaders } from '@/services/api';

// ==========================================
// Enums (mirror okrObjectiveTypes.ts / okrKeyResultTypes.ts CHECK constraints)
// ==========================================

export const OKR_OBJECTIVE_AMBITION_TYPES = ['committed', 'aspirational', 'standard'] as const;
export type OkrObjectiveAmbitionType = (typeof OKR_OBJECTIVE_AMBITION_TYPES)[number];

export const OKR_OBJECTIVE_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'active',
  'at_risk',
  'completed',
  'cancelled',
  'closed',
] as const;
export type OkrObjectiveStatus = (typeof OKR_OBJECTIVE_STATUSES)[number];

export const OKR_OBJECTIVE_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrObjectiveConfidence = (typeof OKR_OBJECTIVE_CONFIDENCE_VALUES)[number];

export const OKR_KEY_RESULT_MEASUREMENT_TYPES_MVP_SUPPORTED = ['numeric', 'percentage', 'currency', 'binary'] as const;
export type OkrKeyResultMeasurementType = (typeof OKR_KEY_RESULT_MEASUREMENT_TYPES_MVP_SUPPORTED)[number];

export const OKR_KEY_RESULT_DIRECTIONS = ['increase', 'decrease', 'reach', 'maintain_range', 'binary'] as const;
export type OkrKeyResultDirection = (typeof OKR_KEY_RESULT_DIRECTIONS)[number];

export const OKR_KEY_RESULT_STATUSES = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'not_achieved',
  'cancelled',
] as const;
export type OkrKeyResultStatus = (typeof OKR_KEY_RESULT_STATUSES)[number];

export const OKR_KEY_RESULT_SOURCE_TYPES = ['manual', 'import', 'connector', 'mcp', 'calculated'] as const;
export type OkrKeyResultSourceType = (typeof OKR_KEY_RESULT_SOURCE_TYPES)[number];

export const OKR_KEY_RESULT_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrKeyResultConfidence = (typeof OKR_KEY_RESULT_CONFIDENCE_VALUES)[number];

// ==========================================
// DTOs — camelCase 1:1 with `toOkrObjective`/`toOkrKeyResult`
// ==========================================

export interface OkrObjectiveDto {
  objectiveId: string;
  setId: string;
  organizationId: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  rationale: string | null;
  ambitionType: OkrObjectiveAmbitionType;
  status: OkrObjectiveStatus;
  /** `NUMERIC NULL` on the wire (node-pg returns numeric as string — see
   * MEMORY `co10-money-numeric-2026-08-10`). Always parse via
   * `parseOkrObjectiveProgress` in `okrObjectiveMappers.ts`. */
  progress: string | null;
  progressCalcPolicyVersionId: string | null;
  /**
   * UNLIKE the Set's `overallProgress` (OQ-UI-C — no reason ever reaches the
   * wire there), the Objective genuinely persists AND returns the engine's
   * `reason` string (`okrObjectiveTypes.ts` L49-50, `okrObjectiveCommands.ts`
   * L326/L610 write `progress_calc_reason` on every update). When `progress`
   * is `null` AND this string starts with `'not_calculable:'`
   * (`okrProgressEngine.ts` L15-18, L253-254 — the literal prefix
   * convention), the 3-way honest-missing domain IS reachable here. When
   * `progress` is `null` but the reason is `'rollup_model_none: ...'` or
   * `'rollup_model_manual_owner_sets_directly: ...'`
   * (`okrProgressEngine.ts` L233-244), that is a DELIBERATE policy choice,
   * not a structurally-undefined calculation — `parseOkrObjectiveProgress`
   * treats that case as plain `null` ("—"), never as `'not_calculable'`,
   * because labelling a deliberate "don't roll up" policy as "broken" would
   * itself be a fabricated distinction the reason string does not support.
   */
  progressCalcReason: string | null;
  confidence: OkrObjectiveConfidence | null;
  confidenceNumericValue: string | null;
  confidenceCalcPolicyVersionId: string | null;
  /** Same reason-string mechanism as `progressCalcReason`, for the
   * confidence rollup (`okrProgressEngine.ts` L300-396). */
  confidenceCalcReason: string | null;
  sortOrder: number;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  approvedAt: string | null;
}

export interface OkrKeyResultDto {
  keyResultId: string;
  objectiveId: string;
  setId: string;
  organizationId: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  measurementType: OkrKeyResultMeasurementType;
  unit: string | null;
  currency: string | null;
  baselineValue: string | null;
  targetValue: string | null;
  startValue: string | null;
  currentValue: string | null;
  direction: OkrKeyResultDirection;
  rangeMin: string | null;
  rangeMax: string | null;
  progress: string | null;
  progressCalcPolicyVersionId: string;
  /** Same `not_calculable:`-prefix mechanism as the Objective's own
   * `progressCalcReason` (`okrKeyResultTypes.ts` L74-76,
   * `okrKeyResultCommands.ts` L458 writes it on every update, and
   * `calculateKeyResultProgress` — `okrProgressEngine.ts` L67-200 — is
   * ALWAYS the direct source for a KR, unlike the Objective's rollup, so
   * every `null` progress here that has a reason at all is
   * `not_calculable:`-prefixed; there is no KR-level "deliberate no-rollup
   * policy" branch the way there is at the Objective level). */
  progressCalcReason: string | null;
  outOfRangeDistance: string | null;
  confidence: OkrKeyResultConfidence | null;
  confidenceNumericValue: string | null;
  status: OkrKeyResultStatus;
  sourceType: OkrKeyResultSourceType;
  sourceReference: string | null;
  weight: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface OkrObjectiveWithKeyResultsDto extends OkrObjectiveDto {
  keyResults: OkrKeyResultDto[];
}

// ==========================================
// Fetch plumbing — identical shape to `okrApi.ts`'s `OkrApiError`/`getJson`,
// plus `roiApi.ts`'s `mutateJson` (this package is the first OKR client that
// needs POST/PATCH, so both helpers are reproduced here rather than
// factored out — matches this program's stated convention of NOT sharing
// helpers across domain-file boundaries within results-vnext).
// ==========================================

export class OkrObjectiveApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrObjectiveApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getHeaders() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new OkrObjectiveApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — fall through with generic message
    }
    throw new OkrObjectiveApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

async function mutateJson<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new OkrObjectiveApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = await res.json();
  } catch {
    // non-JSON body — fall through with a generic message/empty details
  }
  if (!res.ok) {
    const { error, code, ...details } = parsed as { error?: string; code?: string; [k: string]: unknown };
    throw new OkrObjectiveApiError(
      (typeof error === 'string' && error) || `Request failed (${res.status})`,
      res.status,
      typeof code === 'string' ? code : undefined,
      Object.keys(details).length > 0 ? details : undefined
    );
  }
  return parsed as T;
}

/** One fresh v4 UUID per user-initiated write attempt — same convention as
 * `roiApi.ts`'s `newRoiIdempotencyKey`. */
export function newOkrIdempotencyKey(): string {
  return crypto.randomUUID();
}

// ==========================================
// GET /api/vnext/results/okr/sets/:setId/objectives — listObjectivesForSet
// (`okr.routes.ts` L1407-1421)
// ==========================================

export async function listObjectivesForSet(setId: string): Promise<OkrObjectiveWithKeyResultsDto[]> {
  const { objectives } = await getJson<{ objectives: OkrObjectiveWithKeyResultsDto[] }>(
    `/vnext/results/okr/sets/${encodeURIComponent(setId)}/objectives`
  );
  return objectives;
}

// ==========================================
// GET /api/vnext/results/okr/objectives/:objectiveId — getObjective
// (`okr.routes.ts` L1427-1445) — used both for the deep-link/preview-refresh
// case AND as the ONLY source of a KR list for one Objective (see file
// header — no separate KR-list endpoint exists).
// ==========================================

export async function getObjectiveWithKeyResults(objectiveId: string): Promise<OkrObjectiveWithKeyResultsDto | null> {
  try {
    const { objective } = await getJson<{ objective: OkrObjectiveWithKeyResultsDto }>(
      `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}`
    );
    return objective;
  } catch (err) {
    if (err instanceof OkrObjectiveApiError && err.status === 404) return null;
    throw err;
  }
}

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/objectives — createObjective
// (`okr.routes.ts` L1359-1398, body = `CreateOkrObjectiveSchema`,
// `resultsVnextOkr.validators.ts` L377-385)
// ==========================================

export interface CreateOkrObjectiveInput {
  ownerUserId: string;
  title: string;
  description?: string | null;
  rationale?: string | null;
  ambitionType?: OkrObjectiveAmbitionType;
  reason?: string | null;
  idempotencyKey: string;
}

export interface CreateOkrObjectiveResponse {
  outcome: 'applied' | 'duplicate';
  objective: OkrObjectiveDto;
}

export async function createObjective(setId: string, input: CreateOkrObjectiveInput): Promise<CreateOkrObjectiveResponse> {
  return mutateJson<CreateOkrObjectiveResponse>(
    'POST',
    `/vnext/results/okr/sets/${encodeURIComponent(setId)}/objectives`,
    input
  );
}

// ==========================================
// PATCH /api/vnext/results/okr/objectives/:objectiveId — updateObjective
// (`okr.routes.ts` L1451-1493, body = `UpdateOkrObjectiveSchema`,
// `resultsVnextOkr.validators.ts` L391-404)
//
// `confidence`/`confidenceNumericValue` are DELIBERATELY OMITTED from this
// input type — `okrObjectiveCommands.ts` L580-594 rejects them with
// `CONFIDENCE_NOT_OWNER_EDITABLE` (409) unless the Cycle's PINNED
// `objective_confidence_model` is `'owner_selected'`, a policy this small
// client has no endpoint to read ahead of time. Rather than build a form
// field that fails for most Programs by default, the edit form leaves
// confidence read-only (engine-computed, shown via `HonestValueCell`) — see
// `OkrObjectiveFormModal.tsx` header for the full reasoning. Flagged as an
// open question, not silently narrowed.
// ==========================================

export interface UpdateOkrObjectiveInput {
  expectedVersion: number;
  title?: string;
  description?: string | null;
  rationale?: string | null;
  ambitionType?: OkrObjectiveAmbitionType;
  ownerUserId?: string;
  reason?: string | null;
  idempotencyKey: string;
}

export interface UpdateOkrObjectiveResponse {
  outcome: 'applied' | 'duplicate';
  objective: OkrObjectiveDto;
}

export async function updateObjective(objectiveId: string, input: UpdateOkrObjectiveInput): Promise<UpdateOkrObjectiveResponse> {
  return mutateJson<UpdateOkrObjectiveResponse>(
    'PATCH',
    `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}`,
    input
  );
}

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/cancel — cancelObjective
// (`okr.routes.ts` L1502-1537, body = `OkrObjectiveTransitionSchema`)
// ==========================================

export interface OkrTransitionInput {
  expectedVersion: number;
  reason?: string | null;
  idempotencyKey: string;
}

export interface CancelOkrObjectiveResponse {
  outcome: 'applied' | 'duplicate';
  objective: OkrObjectiveDto;
}

export async function cancelObjective(objectiveId: string, input: OkrTransitionInput): Promise<CancelOkrObjectiveResponse> {
  return mutateJson<CancelOkrObjectiveResponse>(
    'POST',
    `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}/cancel`,
    input
  );
}

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/key-results — createKeyResult
// (`okr.routes.ts` L1543-1595, body = `CreateOkrKeyResultSchema`,
// `resultsVnextOkr.validators.ts` L422-454 — including its two `.refine()`
// cross-field rules, replicated in `OkrKeyResultFormModal.tsx`, never
// silently dropped)
// ==========================================

export interface CreateOkrKeyResultInput {
  ownerUserId: string;
  title: string;
  description?: string | null;
  measurementType: OkrKeyResultMeasurementType;
  unit?: string | null;
  currency?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  startValue?: number | null;
  currentValue?: number | null;
  direction: OkrKeyResultDirection;
  rangeMin?: number | null;
  rangeMax?: number | null;
  confidence?: OkrKeyResultConfidence | null;
  confidenceNumericValue?: number | null;
  sourceType?: OkrKeyResultSourceType;
  sourceReference?: string | null;
  weight?: number | null;
  reason?: string | null;
  idempotencyKey: string;
}

export interface CreateOkrKeyResultResponse {
  outcome: 'applied' | 'duplicate';
  keyResult: OkrKeyResultDto;
}

export async function createKeyResult(objectiveId: string, input: CreateOkrKeyResultInput): Promise<CreateOkrKeyResultResponse> {
  return mutateJson<CreateOkrKeyResultResponse>(
    'POST',
    `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}/key-results`,
    input
  );
}

// ==========================================
// PATCH /api/vnext/results/okr/key-results/:keyResultId — updateKeyResult
// (`okr.routes.ts` L1625-1679, body = `UpdateOkrKeyResultSchema`,
// `resultsVnextOkr.validators.ts` L460-486)
// ==========================================

export interface UpdateOkrKeyResultInput {
  expectedVersion: number;
  title?: string;
  description?: string | null;
  ownerUserId?: string;
  measurementType?: OkrKeyResultMeasurementType;
  unit?: string | null;
  currency?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  startValue?: number | null;
  currentValue?: number | null;
  direction?: OkrKeyResultDirection;
  rangeMin?: number | null;
  rangeMax?: number | null;
  confidence?: OkrKeyResultConfidence | null;
  confidenceNumericValue?: number | null;
  /** `'cancelled'` deliberately excluded — server rejects it here (§-IO item
   * 9), that transition is `cancelKeyResult`'s own guarded path. */
  status?: Exclude<OkrKeyResultStatus, 'cancelled'>;
  sourceType?: OkrKeyResultSourceType;
  sourceReference?: string | null;
  weight?: number | null;
  reason?: string | null;
  idempotencyKey: string;
}

export interface UpdateOkrKeyResultResponse {
  outcome: 'applied' | 'duplicate';
  keyResult: OkrKeyResultDto;
}

export async function updateKeyResult(keyResultId: string, input: UpdateOkrKeyResultInput): Promise<UpdateOkrKeyResultResponse> {
  return mutateJson<UpdateOkrKeyResultResponse>(
    'PATCH',
    `/vnext/results/okr/key-results/${encodeURIComponent(keyResultId)}`,
    input
  );
}

// ==========================================
// POST /api/vnext/results/okr/key-results/:keyResultId/cancel — cancelKeyResult
// (`okr.routes.ts` L1686-1721, body = `OkrKeyResultTransitionSchema`)
// ==========================================

export interface CancelOkrKeyResultResponse {
  outcome: 'applied' | 'duplicate';
  keyResult: OkrKeyResultDto;
}

export async function cancelKeyResult(keyResultId: string, input: OkrTransitionInput): Promise<CancelOkrKeyResultResponse> {
  return mutateJson<CancelOkrKeyResultResponse>(
    'POST',
    `/vnext/results/okr/key-results/${encodeURIComponent(keyResultId)}/cancel`,
    input
  );
}
