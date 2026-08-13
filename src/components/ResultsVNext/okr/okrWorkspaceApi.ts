/**
 * RN-G3 lane `okr` (task 2026-08-11) — API client for everything the OKR
 * FULL TOOL needs beyond the already-shipped Sets registry (`okrApi.ts`) and
 * Objectives/KeyResults/check-ins (`okrObjectiveApi.ts`/`okrCheckInApi.ts`):
 * Set lifecycle transitions, alignments, reviews, reflection/final-score,
 * closing/carry-forward/history/approval-snapshots, and support/
 * recognition/comments/decision-links.
 *
 * Same hand-written, small-surface convention every other RN-G2/G3 OKR
 * client file states for itself (`okrApi.ts`/`okrObjectiveApi.ts` headers) —
 * exactly the endpoints the full-tool workspace needs, not a generic
 * wrapper. Field names, required/optional-ness and response envelopes below
 * are transcribed directly from:
 *  - `server/src/routes/resultsVnext/okr.routes.ts` (paths + response shape
 *    per route, read in full, L419-2998)
 *  - `server/src/validators/resultsVnextOkr.validators.ts` (body/query
 *    shapes, read in full)
 *  - `server/src/services/resultsVnext/okr/{okrAlignmentTypes,okrReviewTypes,
 *    okrReflectionTypes,okrSupportTypes,okrSetApprovedSnapshotTypes}.ts`
 *    (`OkrXxx`/`toOkrXxx` DTO shapes)
 *  - `server/src/services/resultsVnext/okr/okrSetHistoryRepository.ts`
 *    (`OkrSetHistoryEntry` union)
 *
 * ── REAL, CONFIRMED GAPS (do not build UI around a value these do not
 * carry — see this task's own D08 instruction to re-verify, not assume) ──
 * 1. Set-level `overallProgress`/`overallConfidence` (`okrApi.ts`'s
 *    `OkrSetDto`) has NO persisted/returned "why is this null" reason —
 *    `computeSetRollup`'s own `reason` string (okrSetRollupCalculator.ts
 *    L96/L161) is computed and then DISCARDED: `applySetRollupUpdate`
 *    (okrCheckInCommands.ts L278-295) writes `overall_progress`/
 *    `overall_confidence`/`attention_state`/`last_checkin_at`/
 *    `next_checkin_due_at` only — `rollup.reason` is never in that UPDATE's
 *    column list and no GET route anywhere in `okr.routes.ts` exposes it.
 *    Re-verified independently in this task (matches OQ-UI-C exactly).
 * 2. Check-in `calculatedProgress` (`okrCheckInTypes.ts`) is `string | null`
 *    with NO sibling reason field anywhere on `OkrCheckInRow`/`OkrCheckIn` —
 *    same 2-way (not 3-way) gap as the Set level.
 * 3. Objective/KeyResult DO carry a real, persisted, returned reason
 *    (`progressCalcReason`/`confidenceCalcReason` — `okrObjectiveApi.ts`
 *    already documents and uses this correctly; unchanged here).
 * 4. `okr_vnext_checkin_occurrences` (`cadenceOccurrenceId`, required by
 *    every check-in write) has NO `GET` route anywhere in `okr.routes.ts`
 *    (confirmed by grepping the full route list) — `OkrCheckInRecordDialog`
 *    already documents this and uses a manual-paste-with-explanation
 *    pattern; unchanged here, restated because the alignment target picker
 *    below follows the same precedent for the identical reason (no
 *    "search objectives across the org" endpoint exists either).
 * 5. Program lifecycle (design §5.1: draft → active → suspended → active /
 *    retired) has NO suspend/retire/reactivate route — `okr.routes.ts` only
 *    mounts `POST /programs` (create), `GET /programs`, `GET /programs/:id`,
 *    `PATCH /programs/:id/draft`, `POST /programs/:id/publish` (draft →
 *    active only). The admin UI below therefore offers only create/edit-
 *    draft/publish — a real, disclosed backend gap, not a UI omission.
 */
import { API_URL, getHeaders } from '@/services/api';
import type { OkrSetStatus } from './okrApi';

// ==========================================
// Fetch plumbing — same shape as `okrObjectiveApi.ts`'s
// `OkrObjectiveApiError`/`getJson`/`mutateJson` (this file's own domain
// concern, not shared across file boundaries per this program's convention).
// ==========================================

export class OkrWorkspaceApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrWorkspaceApiError';
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
    throw new OkrWorkspaceApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  if (!res.ok) {
    let body: { error?: string; code?: string } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — fall through with generic message
    }
    throw new OkrWorkspaceApiError(body.error || `Request failed (${res.status})`, res.status, body.code);
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
    throw new OkrWorkspaceApiError(`Network error contacting ${url}: ${msg}`, 0);
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = await res.json();
  } catch {
    // non-JSON body — fall through with a generic message/empty details
  }
  if (!res.ok) {
    const { error, code, ...details } = parsed as { error?: string; code?: string; [k: string]: unknown };
    throw new OkrWorkspaceApiError(
      (typeof error === 'string' && error) || `Request failed (${res.status})`,
      res.status,
      typeof code === 'string' ? code : undefined,
      Object.keys(details).length > 0 ? details : undefined
    );
  }
  return parsed as T;
}

export function newOkrWorkspaceIdempotencyKey(): string {
  return crypto.randomUUID();
}

// ==========================================
// Set lifecycle transitions (okr.routes.ts L1077-1288, L2457-2531)
// ==========================================

export interface OkrTransitionInput {
  expectedVersion: number;
  reason?: string | null;
  idempotencyKey: string;
}

import type { OkrSetDto } from './okrApi';

export interface OkrSetTransitionResponse {
  outcome: 'applied' | 'duplicate';
  set: OkrSetDto;
}

function postSetTransition(setId: string, segment: string, input: OkrTransitionInput): Promise<OkrSetTransitionResponse> {
  return mutateJson<OkrSetTransitionResponse>('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/${segment}`, input);
}

export const submitOkrSetForApproval = (setId: string, input: OkrTransitionInput) => postSetTransition(setId, 'submit', input);
export const activateOkrSet = (setId: string, input: OkrTransitionInput) => postSetTransition(setId, 'activate', input);
export const cancelOkrSet = (setId: string, input: OkrTransitionInput) => postSetTransition(setId, 'cancel', input);
export const openOkrSetReview = (setId: string, input: OkrTransitionInput) => postSetTransition(setId, 'open-review', input);

export interface OkrSetApproveResponse {
  outcome: 'applied' | 'duplicate';
  set: OkrSetDto;
  snapshot: { snapshotId: string; setId: string; sequenceNumber: number; approvedBy: string; approvedAt: string; contentHash: string };
}
export function approveOkrSet(setId: string, input: OkrTransitionInput): Promise<OkrSetApproveResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/approve`, input);
}

export interface OkrRequestChangesInput {
  expectedVersion: number;
  changeRequestNotes: string;
  idempotencyKey: string;
}
export function requestChangesOnOkrSet(setId: string, input: OkrRequestChangesInput): Promise<OkrSetTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/request-changes`, input);
}

// finalScoreOkrSet / closeOkrSet share the exact same request shape as
// OkrTransitionInput (OkrSetReviewLifecycleTransitionSchema).
export interface OkrFinalScoreResponse {
  outcome: 'applied' | 'duplicate';
  set: OkrSetDto;
  scoredObjectives: Array<{ objectiveId: string; finalScore: string | null; scoringModelUnsupported: boolean }>;
}
export function finalScoreOkrSet(setId: string, input: OkrTransitionInput): Promise<OkrFinalScoreResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/final-score`, input);
}

export function closeOkrSet(setId: string, input: OkrTransitionInput): Promise<OkrSetTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/close`, input);
}

export interface OkrCarryForwardInput {
  targetCycleId: string;
  reason?: string | null;
  idempotencyKey: string;
}
export interface OkrCarryForwardResponse {
  sourceSet: OkrSetDto;
  carriedSet: OkrSetDto;
  created: boolean;
}
export function carryForwardOkrSet(setId: string, input: OkrCarryForwardInput): Promise<OkrCarryForwardResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/carry-forward`, input);
}

// ==========================================
// History (okr.routes.ts L2538-2560) — merges rvn_platform_events with
// okr_vnext_set_versions material-change rows (okrSetHistoryRepository.ts).
// ==========================================

export interface OkrSetHistoryEventEntry {
  kind: 'event';
  eventId: string;
  sequence: string;
  eventType: string;
  actorUserId: string | null;
  actorEffectiveRole: string;
  occurredAt: string;
  reason: string | null;
  payload: Record<string, unknown>;
}
export interface OkrSetHistoryMaterialChangeEntry {
  kind: 'material_change';
  versionId: string;
  versionNumber: number;
  fieldName: string;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string;
  requestedBy: string;
  requestedAt: string;
}
export type OkrSetHistoryEntry = OkrSetHistoryEventEntry | OkrSetHistoryMaterialChangeEntry;

export async function getOkrSetHistory(
  setId: string,
  params: { cursor?: string; limit?: number } = {}
): Promise<{ entries: OkrSetHistoryEntry[]; nextCursor: string | null }> {
  return getJson(`/vnext/results/okr/sets/${encodeURIComponent(setId)}/history`, params);
}

export interface OkrSetApprovedSnapshotSummary {
  snapshotId: string;
  setId: string;
  sequenceNumber: number;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
}
export async function listOkrSetApprovalSnapshots(setId: string): Promise<OkrSetApprovedSnapshotSummary[]> {
  const { snapshots } = await getJson<{ snapshots: OkrSetApprovedSnapshotSummary[] }>(
    `/vnext/results/okr/sets/${encodeURIComponent(setId)}/approval-snapshots`
  );
  return snapshots;
}

// ==========================================
// Alignments (OKR-E005) — okr.routes.ts L1918-2120
// ==========================================

export const OKR_ALIGNMENT_STATUSES = ['proposed', 'accepted', 'rejected', 'removed'] as const;
export type OkrAlignmentStatus = (typeof OKR_ALIGNMENT_STATUSES)[number];

export interface OkrAlignmentDto {
  alignmentId: string;
  organizationId: string;
  sourceObjectiveId: string;
  targetObjectiveId: string;
  relation: 'contributes_to';
  rationale: string | null;
  status: OkrAlignmentStatus;
  sourceCycleId: string;
  targetCycleId: string;
  proposedBy: string;
  proposedAt: string;
  respondedBy: string | null;
  respondedAt: string | null;
  responseReason: string | null;
  removedBy: string | null;
  removedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export async function listAlignmentsForObjective(
  objectiveId: string,
  direction: 'outgoing' | 'incoming',
  status?: OkrAlignmentStatus
): Promise<OkrAlignmentDto[]> {
  const { alignments } = await getJson<{ alignments: OkrAlignmentDto[] }>(
    `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}/alignments`,
    { direction, status }
  );
  return alignments;
}

export interface OkrAlignmentTreeNode {
  objectiveId: string;
  title: string;
  setId: string;
  depth: number;
  [key: string]: unknown;
}
export async function getAlignmentTreeUnderObjective(objectiveId: string, maxDepth?: number): Promise<OkrAlignmentTreeNode[]> {
  const { nodes } = await getJson<{ nodes: OkrAlignmentTreeNode[] }>(
    `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}/alignment-tree`,
    { maxDepth }
  );
  return nodes;
}

export interface ProposeAlignmentInput {
  targetObjectiveId: string;
  rationale?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}
export interface ProposeAlignmentResponse {
  outcome: 'applied' | 'duplicate';
  alignment: OkrAlignmentDto;
  created: boolean;
}
export function proposeAlignment(sourceObjectiveId: string, input: ProposeAlignmentInput): Promise<ProposeAlignmentResponse> {
  return mutateJson('POST', `/vnext/results/okr/objectives/${encodeURIComponent(sourceObjectiveId)}/alignments`, input);
}

export interface OkrAlignmentTransitionResponse {
  outcome: 'applied' | 'duplicate';
  alignment: OkrAlignmentDto;
}
export function acceptAlignment(alignmentId: string, input: OkrTransitionInput): Promise<OkrAlignmentTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/alignments/${encodeURIComponent(alignmentId)}/accept`, input);
}
export interface RejectAlignmentInput {
  expectedVersion: number;
  responseReason?: string | null;
  idempotencyKey: string;
}
export function rejectAlignment(alignmentId: string, input: RejectAlignmentInput): Promise<OkrAlignmentTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/alignments/${encodeURIComponent(alignmentId)}/reject`, input);
}
export function removeAlignment(alignmentId: string, input: OkrTransitionInput): Promise<OkrAlignmentTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/alignments/${encodeURIComponent(alignmentId)}/remove`, input);
}

// ==========================================
// Reviews + final score + reflection (OKR-E007) — okr.routes.ts L2138-2451
// ==========================================

export const OKR_REVIEW_STATUSES = ['draft', 'submitted', 'approved', 'changes_requested'] as const;
export type OkrReviewStatus = (typeof OKR_REVIEW_STATUSES)[number];
export type OkrReviewType = 'self' | 'manager';
export type OkrReviewCommentLevel = 'set' | 'objective' | 'key_result';

export interface OkrReviewComment {
  level: OkrReviewCommentLevel;
  targetId: string;
  text: string;
  createdAt: string;
  createdBy: string;
}
export interface OkrReviewDto {
  reviewId: string;
  setId: string;
  organizationId: string;
  reviewType: OkrReviewType;
  reviewerUserId: string;
  status: OkrReviewStatus;
  outcome: string | null;
  comments: OkrReviewComment[];
  reviewedSetVersion: number | null;
  submittedBy: string | null;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export async function listOkrSetReviews(setId: string): Promise<OkrReviewDto[]> {
  const { reviews } = await getJson<{ reviews: OkrReviewDto[] }>(`/vnext/results/okr/sets/${encodeURIComponent(setId)}/reviews`);
  return reviews;
}

/** `expectedVersion: 0` when no review row exists yet for this Set/type —
 * the create path (`okrReviewCommands.ts` L283-288/L436-440: "0 = create
 * path (no review row exists yet)"). Callers must look this up from
 * `listOkrSetReviews` first, never guess. */
export interface OkrReviewSubmitInput {
  expectedVersion: number;
  reason?: string | null;
  idempotencyKey: string;
}
export interface OkrReviewTransitionResponse {
  outcome: 'applied' | 'duplicate';
  review: OkrReviewDto;
}
export function submitOkrSetSelfReview(setId: string, input: OkrReviewSubmitInput): Promise<OkrReviewTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/reviews/self/submit`, input);
}
export function submitOkrSetForManagerReview(setId: string, input: OkrReviewSubmitInput): Promise<OkrReviewTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/reviews/manager/submit`, input);
}
export interface OkrManagerReviewApproveInput {
  expectedVersion: number;
  outcome?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}
export function approveOkrSetManagerReview(setId: string, input: OkrManagerReviewApproveInput): Promise<OkrReviewTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/reviews/manager/approve`, input);
}
export interface OkrManagerReviewRequestChangesInput {
  expectedVersion: number;
  changeRequestNotes?: string | null;
  idempotencyKey: string;
}
export function requestChangesOnOkrSetManagerReview(
  setId: string,
  input: OkrManagerReviewRequestChangesInput
): Promise<OkrReviewTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/reviews/manager/request-changes`, input);
}
export interface OkrReviewCommentInput {
  expectedVersion: number;
  level: OkrReviewCommentLevel;
  targetId: string;
  text: string;
  idempotencyKey: string;
}
export function recordOkrSetReviewComment(
  setId: string,
  reviewType: OkrReviewType,
  input: OkrReviewCommentInput
): Promise<OkrReviewTransitionResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/reviews/${reviewType}/comments`, input);
}

// Reflection (per-Objective) + final score (per-Set)

export const OKR_REFLECTION_DISPOSITIONS = ['complete', 'carry_forward', 'drop', 'redefine'] as const;
export type OkrReflectionDisposition = (typeof OKR_REFLECTION_DISPOSITIONS)[number];

export interface OkrFinalScoreKeyResultSnapshot {
  keyResultId: string;
  progress: string | null;
  confidence: string | null;
  weight: string | null;
}
export interface OkrReflectionDto {
  reflectionId: string;
  setId: string;
  objectiveId: string;
  organizationId: string;
  status: 'draft' | 'finalized';
  finalScore: string | null;
  scoringModelUnsupported: boolean;
  finalScorePayload: OkrFinalScoreKeyResultSnapshot[] | null;
  scoringPolicyVersionId: string | null;
  scoredBy: string | null;
  scoredAt: string | null;
  whatWorked: string | null;
  whatDidNotWork: string | null;
  why: string | null;
  learning: string | null;
  nextCycleChange: string | null;
  disposition: OkrReflectionDisposition | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

/** `expectedVersion: 0` = create path (no reflection row exists yet for
 * this Objective) — `RecordOkrObjectiveReflectionSchema`'s own comment
 * (`resultsVnextOkr.validators.ts` L679-681). NOTE: unlike reviews, there is
 * NO `GET` endpoint that returns one Objective's reflection row directly —
 * `okr.routes.ts` has no `GET .../objectives/:id/reflection` and no
 * `GET .../reflections` list route. The ONLY way this client can discover
 * an existing reflection's `rowVersion` is `getOkrSetHistory` (material-
 * change/event entries do not carry it either) or the Set's `close`
 * gate error response — in practice this means a second POST for the SAME
 * Objective before a page reload will 409 with `STALE_VERSION` if the
 * caller keeps guessing `0`. Disclosed as a real, confirmed gap (not a
 * client oversight) — the workspace UI keeps its own in-memory
 * `expectedVersion` per Objective for the current session (set from the
 * response of the FIRST successful save) and warns the user to reload after
 * a page refresh loses that state, rather than silently guessing `0` twice.
 */
export interface RecordReflectionInput {
  setId: string;
  expectedVersion: number;
  whatWorked?: string | null;
  whatDidNotWork?: string | null;
  why?: string | null;
  learning?: string | null;
  nextCycleChange?: string | null;
  disposition?: OkrReflectionDisposition | null;
  reason?: string | null;
  idempotencyKey: string;
}
export async function recordObjectiveReflection(
  objectiveId: string,
  input: RecordReflectionInput
): Promise<{ outcome: 'applied' | 'duplicate'; reflection: OkrReflectionDto }> {
  return mutateJson('POST', `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}/reflection`, input);
}

/**
 * RN-G6 C3 (2026-08-12) — closes the `expectedVersion` gap documented on
 * `RecordReflectionInput` above: callers should call this on load (per
 * Objective shown in the Review & Reflection tab) to discover the real
 * current `row_version` BEFORE the human edits/saves, instead of assuming
 * `0`. Returns `null` when no reflection row exists yet for this Objective
 * (the legitimate "never reflected yet" state — `expectedVersion` stays `0`
 * for that Objective).
 */
export async function getObjectiveReflection(objectiveId: string): Promise<OkrReflectionDto | null> {
  const { reflection } = await getJson<{ reflection: OkrReflectionDto | null }>(
    `/vnext/results/okr/objectives/${encodeURIComponent(objectiveId)}/reflection`
  );
  return reflection;
}

// ==========================================
// Support / recognition / comments / decision links (OKR-E006) —
// okr.routes.ts L2578-2977
// ==========================================

export const OKR_SUPPORT_REQUEST_KINDS = ['comment', 'recognition', 'support_request'] as const;
export type OkrSupportRequestKind = (typeof OKR_SUPPORT_REQUEST_KINDS)[number];
export const OKR_SUPPORT_REQUEST_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const;
export type OkrSupportRequestStatus = (typeof OKR_SUPPORT_REQUEST_STATUSES)[number];
export const OKR_RECOGNITION_VISIBILITIES = ['team', 'organization'] as const;
export type OkrRecognitionVisibility = (typeof OKR_RECOGNITION_VISIBILITIES)[number];

export interface OkrSupportRequestDto {
  requestId: string;
  organizationId: string;
  setId: string;
  objectiveId: string;
  keyResultId: string | null;
  kind: OkrSupportRequestKind;
  body: string;
  originCheckInId: string | null;
  status: OkrSupportRequestStatus | null;
  assignedToUserId: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  dismissedReason: string | null;
  decisionLinkId: string | null;
  recognitionVisibility: OkrRecognitionVisibility | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function listSupportRequestsForSet(setId: string, kind?: OkrSupportRequestKind): Promise<OkrSupportRequestDto[]> {
  const { supportRequests } = await getJson<{ supportRequests: OkrSupportRequestDto[] }>(
    `/vnext/results/okr/sets/${encodeURIComponent(setId)}/support-requests`,
    { kind }
  );
  return supportRequests;
}

export interface PostCommentInput {
  keyResultId?: string | null;
  body: string;
  reason?: string | null;
  idempotencyKey: string;
}
export interface OkrSupportRequestMutationResponse {
  outcome: 'applied' | 'duplicate';
  supportRequest: OkrSupportRequestDto;
}
export function postOkrComment(setId: string, objectiveId: string, input: PostCommentInput): Promise<OkrSupportRequestMutationResponse> {
  return mutateJson('POST', `/vnext/results/okr/sets/${encodeURIComponent(setId)}/objectives/${encodeURIComponent(objectiveId)}/comments`, input);
}

export interface PostRecognitionInput {
  keyResultId?: string | null;
  body: string;
  recognitionVisibility: OkrRecognitionVisibility;
  reason?: string | null;
  idempotencyKey: string;
}
export function postOkrRecognition(
  setId: string,
  objectiveId: string,
  input: PostRecognitionInput
): Promise<OkrSupportRequestMutationResponse> {
  return mutateJson(
    'POST',
    `/vnext/results/okr/sets/${encodeURIComponent(setId)}/objectives/${encodeURIComponent(objectiveId)}/recognition`,
    input
  );
}

export interface RaiseSupportRequestInput {
  keyResultId?: string | null;
  body: string;
  assignedToUserId: string;
  originCheckInId?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}
export function raiseOkrSupportRequest(
  setId: string,
  objectiveId: string,
  input: RaiseSupportRequestInput
): Promise<OkrSupportRequestMutationResponse> {
  return mutateJson(
    'POST',
    `/vnext/results/okr/sets/${encodeURIComponent(setId)}/objectives/${encodeURIComponent(objectiveId)}/support-requests`,
    input
  );
}

export function acknowledgeSupportRequest(requestId: string, input: OkrTransitionInput): Promise<OkrSupportRequestMutationResponse> {
  return mutateJson('POST', `/vnext/results/okr/support-requests/${encodeURIComponent(requestId)}/acknowledge`, input);
}
export interface ResolveSupportRequestInput {
  expectedVersion: number;
  resolutionNote: string;
  reason?: string | null;
  idempotencyKey: string;
}
export function resolveSupportRequest(requestId: string, input: ResolveSupportRequestInput): Promise<OkrSupportRequestMutationResponse> {
  return mutateJson('POST', `/vnext/results/okr/support-requests/${encodeURIComponent(requestId)}/resolve`, input);
}
export interface DismissSupportRequestInput {
  expectedVersion: number;
  dismissedReason: string;
  reason?: string | null;
  idempotencyKey: string;
}
export function dismissSupportRequest(requestId: string, input: DismissSupportRequestInput): Promise<OkrSupportRequestMutationResponse> {
  return mutateJson('POST', `/vnext/results/okr/support-requests/${encodeURIComponent(requestId)}/dismiss`, input);
}

export interface RequestDecisionInput {
  expectedVersion: number;
  requestedDecision: string;
  impactOfDelay: string;
  desiredDate?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}
export interface OkrDecisionLinkDto {
  linkId: string;
  organizationId: string;
  setId: string;
  supportRequestId: string;
  objectiveId: string;
  keyResultId: string | null;
  decisionId: string;
  requestedDecision: string;
  impactOfDelay: string;
  desiredDate: string | null;
  resolutionAcknowledged: boolean;
  resolutionAcknowledgedBy: string | null;
  resolutionAcknowledgedAt: string | null;
  requestedBy: string;
  requestedAt: string;
  rowVersion: number;
}
export interface RequestDecisionResponse {
  outcome: 'applied' | 'duplicate';
  supportRequest: OkrSupportRequestDto;
  decisionLink: OkrDecisionLinkDto;
}
export function requestDecisionFromSupportRequest(requestId: string, input: RequestDecisionInput): Promise<RequestDecisionResponse> {
  return mutateJson('POST', `/vnext/results/okr/support-requests/${encodeURIComponent(requestId)}/request-decision`, input);
}

export interface OkrDecisionLinkWithLiveStatus extends OkrDecisionLinkDto {
  decisionStatus: string | null;
  decisionRationale: string | null;
  decisionDecidedAt: string | null;
}
export async function getDecisionLinkForSupportRequest(requestId: string): Promise<OkrDecisionLinkWithLiveStatus | null> {
  try {
    const { decisionLink } = await getJson<{ decisionLink: OkrDecisionLinkWithLiveStatus }>(
      `/vnext/results/okr/support-requests/${encodeURIComponent(requestId)}/decision-link`
    );
    return decisionLink;
  } catch (err) {
    if (err instanceof OkrWorkspaceApiError && err.status === 404) return null;
    throw err;
  }
}

export function acknowledgeDecisionResolution(
  linkId: string,
  input: OkrTransitionInput
): Promise<{ outcome: 'applied' | 'duplicate'; decisionLink: OkrDecisionLinkDto; decisionStatus: string | null; decisionRationale: string | null; decisionDecidedAt: string | null }> {
  return mutateJson('POST', `/vnext/results/okr/decision-links/${encodeURIComponent(linkId)}/acknowledge-resolution`, input);
}

// Re-exported so consumers only need to import from this ONE workspace api
// file for anything beyond the registry/objectives/check-ins packages.
export type { OkrSetStatus };
