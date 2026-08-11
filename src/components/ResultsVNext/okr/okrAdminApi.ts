/**
 * RN-G3 lane `okr` (2026-08-11) — Program + Cycle admin API client.
 *
 * Task brief: "Program i Cykl to OSOBNE zarządzane powierzchnie... Zbuduj je
 * jako własne powierzchnie administracyjne" — this file backs
 * `OkrProgramsPage.tsx`/`OkrCyclesPage.tsx`, the two top-level admin routes,
 * NOT tabs of a Set workspace (design §8.3: "Program Settings and Cycle
 * Management have their own governed admin routes/tools... they are not
 * tabs belonging to a selected Set").
 *
 * Field names/shapes transcribed directly from
 * `server/src/validators/resultsVnextOkr.validators.ts` L136-217 and
 * `server/src/services/resultsVnext/okr/{okrProgramTypes,okrCycleTypes}.ts`.
 *
 * ── REAL, CONFIRMED GAP — Program lifecycle is INCOMPLETE server-side ────
 * Design §5.1: `draft → active → suspended → active / retired`. The ONLY
 * mounted Program routes are (`okr.routes.ts` L425-626, grepped in full):
 * `POST /programs` (create, always starts 'draft' —
 * `okrProgramCommands.ts` L202), `GET /programs`, `GET /programs/:id`,
 * `PATCH /programs/:id/draft` (edit while draft), `POST /programs/:id/publish`
 * (draft -> active). There is NO suspend/reactivate/retire route anywhere in
 * this file. This admin page therefore offers exactly create + edit-draft +
 * publish — suspend/retire buttons are NOT built because there is no
 * endpoint to call; this is a disclosed backend gap for the acceptance
 * report, not a client-side omission.
 *
 * Cycle lifecycle (`planned → drafting → active → review → closed`, plus
 * `cancel` from any of the first four) IS fully mounted
 * (`okr.routes.ts` L769-773) and fully wired below.
 */
import { API_URL, getHeaders } from '@/services/api';

export class OkrAdminApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrAdminApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getJson<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const query = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = `${API_URL}${path}${query ? `?${query}` : ''}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getHeaders() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new OkrAdminApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body
    }
    throw new OkrAdminApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
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
    throw new OkrAdminApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const { error, code, ...details } = parsed as { error?: string; code?: string; [k: string]: unknown };
    throw new OkrAdminApiError(
      (typeof error === 'string' && error) || `Request failed (${res.status})`,
      res.status,
      typeof code === 'string' ? code : undefined,
      Object.keys(details).length > 0 ? details : undefined
    );
  }
  return parsed as T;
}

export function newOkrAdminIdempotencyKey(): string {
  return crypto.randomUUID();
}

// ==========================================
// Program (OKR-E001) — okr.routes.ts L425-626
// ==========================================

export const OKR_PROGRAM_STATUSES = ['draft', 'active', 'suspended', 'retired'] as const;
export type OkrProgramStatus = (typeof OKR_PROGRAM_STATUSES)[number];
export const OKR_CYCLE_MODELS = ['quarterly', 'trimester', 'half_year', 'annual', 'custom'] as const;
export type OkrCycleModel = (typeof OKR_CYCLE_MODELS)[number];
export const OKR_CHECKIN_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'custom'] as const;
export type OkrCheckinFrequency = (typeof OKR_CHECKIN_FREQUENCIES)[number];
export const OKR_SCORING_MODELS = ['zero_to_one', 'percentage', 'categories', 'custom'] as const;
export type OkrScoringModel = (typeof OKR_SCORING_MODELS)[number];
export const OKR_OBJECTIVE_ROLLUP_MODELS = ['equal_average', 'weighted_average', 'manual', 'none'] as const;
export type OkrObjectiveRollupModel = (typeof OKR_OBJECTIVE_ROLLUP_MODELS)[number];
export const OKR_CONFIDENCE_MODELS = ['high_medium_low', 'numeric', 'custom'] as const;
export type OkrConfidenceModel = (typeof OKR_CONFIDENCE_MODELS)[number];
export const OKR_OBJECTIVE_CONFIDENCE_MODELS = ['lowest_kr', 'owner_selected', 'custom'] as const;
export type OkrObjectiveConfidenceModel = (typeof OKR_OBJECTIVE_CONFIDENCE_MODELS)[number];
export const OKR_VISIBILITY_DEFAULTS = ['OPEN_ORG', 'SCOPE', 'MANAGEMENT_CHAIN', 'PRIVATE', 'RESTRICTED_ACL'] as const;
export type OkrVisibilityDefault = (typeof OKR_VISIBILITY_DEFAULTS)[number];

export interface OkrProgramPolicyFields {
  cycleModel: OkrCycleModel;
  annualDirectionEnabled: boolean;
  objectiveMinRecommended: number | null;
  objectiveMaxRecommended: number | null;
  krMinRequired: number;
  krMaxRecommended: number | null;
  checkinFrequency: OkrCheckinFrequency;
  approvalRequired: boolean;
  scoringModel: OkrScoringModel;
  objectiveRollupModel: OkrObjectiveRollupModel;
  confidenceEnabled: boolean;
  confidenceModel: OkrConfidenceModel;
  objectiveConfidenceModel: OkrObjectiveConfidenceModel;
  visibilityDefault: OkrVisibilityDefault;
  committedVsAspirationalEnabled: boolean;
  managerReviewRequired: boolean;
  selfReviewRequired: boolean;
  reflectionRequiredForClose: boolean;
  recognitionEnabled: boolean;
}

export interface OkrProgramDto extends OkrProgramPolicyFields {
  programId: string;
  organizationId: string;
  name: string;
  status: OkrProgramStatus;
  activePolicyVersionId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export async function listOkrPrograms(status?: OkrProgramStatus): Promise<OkrProgramDto[]> {
  const { programs } = await getJson<{ programs: OkrProgramDto[] }>('/vnext/results/okr/programs', { status });
  return programs;
}
export async function getOkrProgram(programId: string): Promise<OkrProgramDto | null> {
  try {
    const { program } = await getJson<{ program: OkrProgramDto }>(`/vnext/results/okr/programs/${encodeURIComponent(programId)}`);
    return program;
  } catch (err) {
    if (err instanceof OkrAdminApiError && err.status === 404) return null;
    throw err;
  }
}

export interface CreateOkrProgramInput extends Partial<OkrProgramPolicyFields> {
  name: string;
  reason?: string | null;
  idempotencyKey: string;
}
export interface OkrProgramMutationResponse {
  outcome: 'applied' | 'duplicate';
  program: OkrProgramDto;
}
export function createOkrProgram(input: CreateOkrProgramInput): Promise<OkrProgramMutationResponse> {
  return mutateJson('POST', '/vnext/results/okr/programs', input);
}

export interface EditOkrProgramDraftInput extends Partial<OkrProgramPolicyFields> {
  expectedVersion: number;
  name?: string;
  reason?: string | null;
  idempotencyKey: string;
}
export function editOkrProgramDraft(programId: string, input: EditOkrProgramDraftInput): Promise<OkrProgramMutationResponse> {
  return mutateJson('PATCH', `/vnext/results/okr/programs/${encodeURIComponent(programId)}/draft`, input);
}

export interface OkrProgramPublishResponse {
  outcome: 'applied' | 'duplicate';
  program: OkrProgramDto;
  policyVersion: { policyVersionId: string; versionNumber: number };
}
export function publishOkrProgram(
  programId: string,
  input: { expectedVersion: number; reason?: string | null; idempotencyKey: string }
): Promise<OkrProgramPublishResponse> {
  return mutateJson('POST', `/vnext/results/okr/programs/${encodeURIComponent(programId)}/publish`, input);
}

// ==========================================
// Cycle (OKR-E001) — okr.routes.ts L629-773
// ==========================================

export const OKR_CYCLE_STATUSES = ['planned', 'drafting', 'active', 'review', 'closed', 'cancelled'] as const;
export type OkrCycleStatus = (typeof OKR_CYCLE_STATUSES)[number];

export interface OkrCycleDto {
  cycleId: string;
  organizationId: string;
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  approvalDueAt: string | null;
  activeStartAt: string;
  midcycleReviewAt: string | null;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  managerReviewDueAt: string | null;
  closeAt: string;
  status: OkrCycleStatus;
  policyVersionId: string;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export async function listOkrCycles(programId?: string, status?: OkrCycleStatus): Promise<OkrCycleDto[]> {
  const { cycles } = await getJson<{ cycles: OkrCycleDto[] }>('/vnext/results/okr/cycles', { programId, status });
  return cycles;
}
export async function getOkrCycle(cycleId: string): Promise<OkrCycleDto | null> {
  try {
    const { cycle } = await getJson<{ cycle: OkrCycleDto }>(`/vnext/results/okr/cycles/${encodeURIComponent(cycleId)}`);
    return cycle;
  } catch (err) {
    if (err instanceof OkrAdminApiError && err.status === 404) return null;
    throw err;
  }
}

export interface CreateOkrCycleInput {
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  approvalDueAt?: string | null;
  activeStartAt: string;
  midcycleReviewAt?: string | null;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  managerReviewDueAt?: string | null;
  closeAt: string;
  reason?: string | null;
  idempotencyKey: string;
}
export interface OkrCycleMutationResponse {
  outcome: 'applied' | 'duplicate';
  cycle: OkrCycleDto;
}
export function createOkrCycle(input: CreateOkrCycleInput): Promise<OkrCycleMutationResponse> {
  return mutateJson('POST', '/vnext/results/okr/cycles', input);
}

export interface OkrCycleTransitionInput {
  expectedVersion: number;
  reason?: string | null;
  idempotencyKey: string;
}
function postCycleTransition(cycleId: string, segment: string, input: OkrCycleTransitionInput): Promise<OkrCycleMutationResponse> {
  return mutateJson('POST', `/vnext/results/okr/cycles/${encodeURIComponent(cycleId)}/${segment}`, input);
}
export const openDraftingOkrCycle = (cycleId: string, input: OkrCycleTransitionInput) => postCycleTransition(cycleId, 'open-drafting', input);
export const activateOkrCycle = (cycleId: string, input: OkrCycleTransitionInput) => postCycleTransition(cycleId, 'activate', input);
export const openReviewOkrCycle = (cycleId: string, input: OkrCycleTransitionInput) => postCycleTransition(cycleId, 'open-review', input);
export const closeOkrCycle = (cycleId: string, input: OkrCycleTransitionInput) => postCycleTransition(cycleId, 'close', input);
export const cancelOkrCycle = (cycleId: string, input: OkrCycleTransitionInput) => postCycleTransition(cycleId, 'cancel', input);
