/**
 * RN-G3 lane (KPI full tool, klasa L) — typed fetch wrappers over
 * `/api/vnext/results/kpi/deviation-cases*`
 * (`server/src/routes/resultsVnext/kpiDeviation.routes.ts`).
 *
 * Every field/shape below is copied from the REAL router + validators, not
 * guessed:
 *  - `server/src/routes/resultsVnext/kpiDeviation.routes.ts` (endpoints,
 *    response envelopes — `{ case: DeviationCase }` / `{ outcome, eventId,
 *    resultingVersion, case }` etc.)
 *  - `server/src/validators/resultsVnextKpiDeviation.validators.ts` (request
 *    body shapes)
 *  - `server/src/services/resultsVnext/kpi/kpiDeviationTypes.ts` (DTO field
 *    names — camelCase, server-side `toDeviationCase`/`toCorrectiveAction`)
 *
 * -- STATE MACHINE (9 states + non-exclusive `escalated` overlay — NEVER a
 * 10th state, `KPI_E003_DESIGN.md` L75-78 / plan §4.6):
 *   open -> analysis_required -> plan_required -> plan_submitted -> approved
 *   -> executing -> recovery_observed -> verification -> closed
 * Guards (file:line, `kpiDeviationCommands.ts`):
 *   - acknowledgeDeviationCase: currentRow.status !== 'open' throws (:517-518) — open -> analysis_required
 *   - submitRootCause: currentRow.status !== 'analysis_required' throws (:601-602) — analysis_required -> plan_required (only when rootCauseSummary+Category set — see command; this client always sends both together)
 *   - addCorrectiveAction (kpiCorrectiveActionCommands.ts): caseRow.status !== 'plan_required' throws "NOT_PLAN_REQUIRED" (~L94-98)
 *   - submitPlan: currentRow.status !== 'plan_required' throws (:704-705); AND requires >=1 corrective action (:712-722, code NO_CORRECTIVE_ACTIONS) — plan_required -> plan_submitted
 *   - approvePlan: self-approval denial FIRST (plan_submitted_by === approverId :796-798, created_by === approverId :799-801, both DeviationSelfApprovalDeniedError); currentRow.status !== 'plan_submitted' throws (:803-809) — plan_submitted -> approved
 *   - updateCorrectiveAction (kpiCorrectiveActionCommands.ts): terminal actions (completed/cancelled) reject further edits; FIRST action reaching 'active' auto-transitions the case approved -> executing (decision #8, response echoes `caseAutoTransitionedToExecuting`)
 *   - recordRecoveryObservation: currentRow.status !== 'executing' throws (:882-883) — executing -> recovery_observed
 *   - submitEffectivenessVerification: currentRow.status not in ('executing','recovery_observed') throws (:985-986); outcome='ineffective' returns the case to 'executing' — executing|recovery_observed -> verification
 *   - closeDeviationCase: currentRow.status !== 'verification' throws (:400-401); requires the LATEST EffectivenessVerification's status to be in the KPI's response-policy accepted list (default ['effective','partially_effective']) — verification -> closed
 *   - escalateDeviationCase/deescalateDeviationCase: overlay only, case status untouched, any state != 'closed' (kpiDeviationCommands.ts ~L1091-1092 rejects status==='closed')
 *   - reopenDeviationCase: prior.status !== 'closed' throws (:1211-1212); creates a NEW row (`executeAtomicCreate`), never mutates the old one — closed(prior) -> open(new row), `reopenedFromCaseId` links back
 *
 * -- KNOWN GAP (do not paper over with a fake role check): NO role/actor
 * check of ANY kind exists anywhere in `kpiDeviationCommands.ts` except the
 * two self-approval denials on `approvePlan` quoted above. Any org member
 * who can see the case can acknowledge/submit-root-cause/add-action/submit-
 * plan/record-recovery/submit-verification/close/escalate/reopen it. This
 * mirrors the identical, already-documented gap for KPI measurement
 * verify/dispute/correct (`../kpiApi.ts` file header) — flagged, not
 * disguised by a client-side disabled state this package has no authority
 * to invent.
 *
 * -- KNOWN GAP #2 (blocks a fully "cold reopen"-safe Corrective Actions /
 * Effectiveness Verifications list): `kpiDeviationRepository.ts` exports
 * `listCorrectiveActions`/`listEffectivenessVerifications` (confirmed by
 * reading that file — `export async function listCorrectiveActions`
 * L173, `listEffectivenessVerifications` L223), but
 * `kpiDeviation.routes.ts`'s own header comment says explicitly (L46-54)
 * this package's task brief did NOT include `GET .../corrective-actions` or
 * `GET .../effectiveness-verifications` list routes — "left for a future
 * package". `getDeviationCase` (repository L80) also returns only the bare
 * case row, no nested actions/verifications. Net effect: THIS UI CANNOT
 * HONESTLY RE-LOAD an existing case's corrective-action/verification list
 * after a fresh page load — there is no GET endpoint anywhere that returns
 * it. Per server/** being outside this package's allowlist, this is
 * reported as a BLOCKER (see task report), not silently worked around. The
 * subview still lets a user ADD/UPDATE actions and submit verifications
 * (those write endpoints are real and exist) — it just cannot prove, after
 * a reload, what was added before this session. See
 * `KpiDeviationCaseSubview.tsx`'s own header comment for how this is
 * disclosed in the UI itself (an explicit banner, never a silently-empty
 * list pretending to be "no actions yet").
 */
import { Api } from '@/services/api';
import { isNotFoundError, type HttpError } from '../kpiApi';

export const DEVIATION_CASE_STATUSES = [
  'open',
  'analysis_required',
  'plan_required',
  'plan_submitted',
  'approved',
  'executing',
  'recovery_observed',
  'verification',
  'closed',
] as const;
export type DeviationCaseStatus = (typeof DEVIATION_CASE_STATUSES)[number];

export const DEVIATION_SEVERITIES = ['warning', 'critical'] as const;
export type DeviationSeverity = (typeof DEVIATION_SEVERITIES)[number];

export const CORRECTIVE_ACTION_STATUSES = [
  'planned',
  'active',
  'blocked',
  'completed',
  'cancelled',
] as const;
export type CorrectiveActionStatus = (typeof CORRECTIVE_ACTION_STATUSES)[number];

export const EFFECTIVENESS_VERIFICATION_STATUSES = [
  'pending',
  'effective',
  'partially_effective',
  'ineffective',
] as const;
export type EffectivenessVerificationStatus = (typeof EFFECTIVENESS_VERIFICATION_STATUSES)[number];

export interface DeviationCaseDto {
  caseId: string;
  organizationId: string;
  kpiId: string;
  triggerMeasurementId: string;
  severity: DeviationSeverity;
  status: DeviationCaseStatus;
  escalated: boolean;
  escalatedAt: string | null;
  escalatedReason: string | null;
  escalatedBy: string | null;
  ownerUserId: string;
  managerUserId: string | null;
  detectedAt: string;
  responseDueAt: string | null;
  rootCauseSummary: string | null;
  rootCauseCategory: string | null;
  recurrenceFlag: boolean;
  expectedRecoveryDate: string | null;
  expectedRecoveryValue: number | null;
  planSubmittedBy: string | null;
  planSubmittedAt: string | null;
  planApprovedBy: string | null;
  planApprovedAt: string | null;
  recoveryObservedBy: string | null;
  recoveryObservedAt: string | null;
  recoveryObservationMeasurementId: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closeEffectivenessVerificationId: string | null;
  reopenedFromCaseId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CorrectiveActionDto {
  actionId: string;
  deviationCaseId: string;
  organizationId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  dueDate: string | null;
  status: CorrectiveActionStatus;
  expectedEffect: string | null;
  actualEffect: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EffectivenessVerificationDto {
  verificationId: string;
  deviationCaseId: string;
  verificationWindowStart: string;
  verificationWindowEnd: string;
  status: EffectivenessVerificationStatus;
  rationale: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface ListDeviationCasesParams {
  kpiId?: string;
  status?: DeviationCaseStatus;
  ownerUserId?: string;
  escalatedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** `GET /api/vnext/results/kpi/deviation-cases` (`kpiDeviation.routes.ts:216-239`). */
export async function listDeviationCases(
  params: ListDeviationCasesParams = {}
): Promise<DeviationCaseDto[]> {
  const qs = new URLSearchParams();
  if (params.kpiId) qs.set('kpiId', params.kpiId);
  if (params.status) qs.set('status', params.status);
  if (params.ownerUserId) qs.set('ownerUserId', params.ownerUserId);
  if (params.escalatedOnly) qs.set('escalatedOnly', 'true');
  qs.set('limit', String(params.limit ?? 100));
  qs.set('offset', String(params.offset ?? 0));
  const resp = await Api.get(`/vnext/results/kpi/deviation-cases?${qs.toString()}`);
  return (resp?.cases ?? []) as DeviationCaseDto[];
}

/** `GET /api/vnext/results/kpi/deviation-cases/:caseId` (`kpiDeviation.routes.ts:245-267`).
 * Returns `null` on 404 (collapses "does not exist" and "visibility-denied",
 * same documented convention as `kpiApi.ts`'s `getKpi`). */
export async function getDeviationCase(caseId: string): Promise<DeviationCaseDto | null> {
  try {
    const resp = await Api.get(`/vnext/results/kpi/deviation-cases/${encodeURIComponent(caseId)}`);
    return (resp?.case ?? null) as DeviationCaseDto | null;
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

export interface DeviationCaseErrorDetail {
  code?: string;
  message: string;
  details?: Record<string, unknown>;
  /** RN-G5 polish: true when `.message` is `httpErr.data.error` — a
   * SERVER-AUTHORED business-rule string (`NOT_PLAN_REQUIRED`, "Self
   * approval is not allowed", …). The subview shows THAT verbatim, by
   * design (see its own header: "a server-side REJECTION … is shown
   * verbatim via `errorDetail` — these are workflow/maker-checker rules,
   * not ABAC visibility denials"). False means there was no such server
   * payload and `.message` fell back to a raw JS/network-error string
   * (e.g. `TypeError: Failed to fetch`) that was never meant for a user —
   * the caller must translate that case via `toUserFacingErrorMessage`
   * instead of rendering it. */
  isServerMessage: boolean;
}

/** Reads `err.data.code`/`.error`/`.details` from a failed command call —
 * used by the subview to render `NOT_PLAN_REQUIRED` / `NO_CORRECTIVE_ACTIONS`
 * / `EFFECTIVENESS_NOT_VERIFIED` / `SelfApprovalDenied`-style codes as an
 * honest inline error instead of a raw toast string. */
export function deviationErrorDetail(err: unknown): DeviationCaseErrorDetail {
  const httpErr = err as HttpError;
  const serverMessage = httpErr?.data?.error;
  return {
    code: httpErr?.data?.code,
    message: serverMessage || (err instanceof Error ? err.message : String(err)),
    details: httpErr?.data?.details,
    isServerMessage: !!serverMessage,
  };
}

interface CaseActionOutcome {
  outcome: string;
  eventId: string | null;
  resultingVersion: number;
  case: DeviationCaseDto;
}

async function postCaseAction(
  caseId: string,
  path: string,
  // `Api.post`'s real declared param is `data: any` (`src/services/api.ts`)
  // — `unknown` here (not `Record<string, unknown>`) because named
  // interfaces without an explicit index signature (CaseActionInput,
  // EscalationInput, RecordRecoveryObservationInput) are not structurally
  // assignable to `Record<string, unknown>` in strict TS, even though every
  // field is compatible (a real tsc error caught during verification, not
  // a runtime concern — `Api.post` never inspects this type).
  body: unknown
): Promise<CaseActionOutcome> {
  const resp = await Api.post(
    `/vnext/results/kpi/deviation-cases/${encodeURIComponent(caseId)}${path}`,
    body
  );
  return resp as CaseActionOutcome;
}

export interface CaseActionInput {
  expectedVersion: number;
  reason?: string | null;
}

/** `POST .../:caseId/acknowledge` — open -> analysis_required. */
export const acknowledgeDeviationCase = (caseId: string, input: CaseActionInput) =>
  postCaseAction(caseId, '/acknowledge', input);

export interface SubmitRootCauseInput {
  expectedVersion: number;
  rootCauseSummary: string;
  rootCauseCategory: string;
  recurrenceFlag?: boolean;
  expectedRecoveryDate?: string | null;
  expectedRecoveryValue?: number | null;
  reason?: string | null;
}

/** `PUT .../:caseId/root-cause` — analysis_required -> plan_required (server
 * only advances the status once BOTH `rootCauseSummary` and
 * `rootCauseCategory` are non-empty; this client always sends both, so every
 * submit from this UI is a real transition, never a "saved without
 * transition" partial). */
export async function submitRootCause(
  caseId: string,
  input: SubmitRootCauseInput
): Promise<CaseActionOutcome> {
  const resp = await Api.put(
    `/vnext/results/kpi/deviation-cases/${encodeURIComponent(caseId)}/root-cause`,
    input
  );
  return resp as CaseActionOutcome;
}

export interface AddCorrectiveActionInput {
  title: string;
  description?: string | null;
  ownerUserId: string;
  dueDate?: string | null;
  expectedEffect?: string | null;
  reason?: string | null;
}

interface AddCorrectiveActionOutcome {
  outcome: string;
  eventId: string | null;
  resultingVersion: number;
  action: CorrectiveActionDto;
}

/** `POST .../:caseId/corrective-actions` — requires case status
 * 'plan_required' server-side (see file header). */
export async function addCorrectiveAction(
  caseId: string,
  input: AddCorrectiveActionInput
): Promise<AddCorrectiveActionOutcome> {
  const resp = await Api.post(
    `/vnext/results/kpi/deviation-cases/${encodeURIComponent(caseId)}/corrective-actions`,
    input
  );
  return resp as AddCorrectiveActionOutcome;
}

export interface UpdateCorrectiveActionInput {
  expectedVersion: number;
  status?: CorrectiveActionStatus;
  title?: string;
  description?: string | null;
  ownerUserId?: string;
  dueDate?: string | null;
  expectedEffect?: string | null;
  actualEffect?: string | null;
  reason?: string | null;
}

interface UpdateCorrectiveActionOutcome {
  outcome: string;
  eventId: string | null;
  resultingVersion: number;
  action: CorrectiveActionDto;
  /** True when this update's `status -> 'active'` auto-transitioned the
   * parent case `approved -> executing` (decision #8, kpiCorrectiveActionCommands.ts). */
  caseAutoTransitionedToExecuting: boolean;
}

/** `PATCH .../:caseId/corrective-actions/:actionId`. */
export async function updateCorrectiveAction(
  caseId: string,
  actionId: string,
  input: UpdateCorrectiveActionInput
): Promise<UpdateCorrectiveActionOutcome> {
  const resp = await Api.patch(
    `/vnext/results/kpi/deviation-cases/${encodeURIComponent(caseId)}/corrective-actions/${encodeURIComponent(actionId)}`,
    input
  );
  return resp as UpdateCorrectiveActionOutcome;
}

/** `POST .../:caseId/plan/submit` — plan_required -> plan_submitted (server
 * rejects with `NO_CORRECTIVE_ACTIONS` when zero actions exist yet). */
export const submitPlan = (caseId: string, input: CaseActionInput) =>
  postCaseAction(caseId, '/plan/submit', input);

/** `POST .../:caseId/plan/approve` — plan_submitted -> approved. Maker-
 * checker: server denies when the caller is `plan_submitted_by` OR
 * `created_by` (`DeviationSelfApprovalDeniedError`, 403). */
export const approvePlan = (caseId: string, input: CaseActionInput) =>
  postCaseAction(caseId, '/plan/approve', input);

export interface RecordRecoveryObservationInput {
  expectedVersion: number;
  recoveryObservationMeasurementId: string;
  reason?: string | null;
}

/** `POST .../:caseId/recovery-observation` — executing -> recovery_observed. */
export const recordRecoveryObservation = (caseId: string, input: RecordRecoveryObservationInput) =>
  postCaseAction(caseId, '/recovery-observation', input);

export interface SubmitEffectivenessVerificationInput {
  expectedVersion: number;
  verificationWindowStart: string;
  verificationWindowEnd: string;
  outcome: EffectivenessVerificationStatus;
  rationale?: string | null;
  measurementIds?: string[];
  reason?: string | null;
}

interface SubmitEffectivenessVerificationOutcome {
  outcome: string;
  eventId: string | null;
  resultingVersion: number;
  case: DeviationCaseDto;
  verification: EffectivenessVerificationDto;
}

/** `POST .../:caseId/effectiveness-verifications` — executing|recovery_observed
 * -> verification (outcome='ineffective' returns the case to 'executing'
 * server-side, `kpiDeviationCommands.ts` ~L1030-1040). */
export async function submitEffectivenessVerification(
  caseId: string,
  input: SubmitEffectivenessVerificationInput
): Promise<SubmitEffectivenessVerificationOutcome> {
  const resp = await Api.post(
    `/vnext/results/kpi/deviation-cases/${encodeURIComponent(caseId)}/effectiveness-verifications`,
    input
  );
  return resp as SubmitEffectivenessVerificationOutcome;
}

/** `POST .../:caseId/close` — verification -> closed (server requires the
 * latest EffectivenessVerification to have an accepted outcome per the KPI's
 * response policy, default ['effective','partially_effective'] —
 * `closeDeviationCase` L372-394). */
export const closeDeviationCase = (caseId: string, input: CaseActionInput) =>
  postCaseAction(caseId, '/close', input);

export interface EscalationInput {
  expectedVersion: number;
  escalatedReason?: string | null;
  reason?: string | null;
}

/** `POST .../:caseId/escalate` — non-exclusive overlay, case status unchanged. */
export const escalateDeviationCase = (caseId: string, input: EscalationInput) =>
  postCaseAction(caseId, '/escalate', input);

/** `POST .../:caseId/deescalate` — non-exclusive overlay, case status unchanged. */
export const deescalateDeviationCase = (caseId: string, input: EscalationInput) =>
  postCaseAction(caseId, '/deescalate', input);

export interface ReopenDeviationCaseInput {
  triggerMeasurementId?: string;
  ownerUserId?: string | null;
  managerUserId?: string | null;
  reason?: string | null;
}

interface ReopenDeviationCaseOutcome {
  outcome: string;
  eventId: string | null;
  resultingVersion: number;
  case: DeviationCaseDto;
}

/** `POST .../:caseId/reopen` — `:caseId` is the PRIOR (closed) case; the
 * server creates a NEW row (`reopenedFromCaseId` links back), it never
 * mutates the prior one. Requires `prior.status === 'closed'`. */
export async function reopenDeviationCase(
  priorCaseId: string,
  input: ReopenDeviationCaseInput
): Promise<ReopenDeviationCaseOutcome> {
  const resp = await Api.post(
    `/vnext/results/kpi/deviation-cases/${encodeURIComponent(priorCaseId)}/reopen`,
    input
  );
  return resp as ReopenDeviationCaseOutcome;
}
