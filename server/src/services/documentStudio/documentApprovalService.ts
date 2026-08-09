/**
 * Consultify Document Studio — Approval Workflow Service
 * (Epic E10, Slice 10.1).
 *
 * Multi-reviewer approval gate for document artifacts. Today the
 * `documentLifecycleService.transitionDocumentStatus` call accepts any
 * authenticated user moving `in_review → approved` because lifecycle is
 * a pure state machine. For enterprise governance we need an evidentiary
 * trail: who requested approval, which reviewers were required, what
 * decisions they recorded, and when the request resolved.
 *
 * This module owns that evidentiary surface. Lifecycle remains
 * decoupled — the approval state machine lives independently and the
 * route layer (Slice 10.3) wires the gate by checking
 * `getActiveApprovalForArtifact()` before allowing
 * `in_review → approved`.
 *
 * Lifecycle of a single ApprovalRequest:
 *
 *   pending → approved             (quorum policy satisfied)
 *           → rejected             (any required reviewer rejects)
 *           → changes_requested    (any reviewer requests changes)
 *           → cancelled            (author withdraws the request)
 *
 * At most one non-terminal approval per (organization, artifact) — the
 * service rejects a second open request with `approval_already_open`
 * so two parallel approval tracks cannot drift.
 *
 * Quorum policies:
 *   - 'unanimous'       — every required reviewer must approve.
 *   - 'majority'        — strictly more than half of required reviewers
 *                         must approve.
 *   - 'single_approval' — any required reviewer approving resolves
 *                         immediately.
 *
 * Rejection / changes-requested are policy-independent: any required
 * reviewer's `'reject'` flips the request to `'rejected'`, and any
 * `'request_changes'` flips it to `'changes_requested'`.
 *
 * Decisions are append-only. A second decision from the same reviewer
 * is rejected with `decision_already_recorded` to keep the audit trail
 * honest. Reviewers who are not on the participant list are rejected
 * with `reviewer_not_participant`.
 *
 * Design contract mirrors `documentBrandVoiceService.ts`:
 *
 *   - In-process `Map<key, ApprovalRequest>` is the synchronous source
 *     of truth. Persistence is ordered write-through to the DAO and lazy
 *     hydration on the first read per (org, artifact).
 *   - Mutations enqueue approval + audit writes per approval. HTTP route
 *     handlers flush that queue before acknowledging the mutation.
 *   - `ensureApprovalRegistryHydrated(organizationId, artifactId)` is
 *     awaited by the route layer before reads.
 *
 * Tenant boundary: every operation accepts and validates
 * `organizationId`; cross-tenant reads return `null` /
 * `'approval_not_found'` deny-by-default.
 */

import {
  __resetApprovalRegistryDaoForTests,
  loadApprovalById,
  loadApprovalsForArtifact,
  loadApprovalsForOrganization,
  loadAuditForApproval,
  persistApproval,
  persistApprovalAuditEntry,
} from './documentApprovalRegistryDao.js';
import type {
  DocumentApprovalAuditAction,
  DocumentApprovalAuditEntry,
  DocumentApprovalDecision,
  DocumentApprovalDecisionKind,
  DocumentApprovalParticipant,
  DocumentApprovalQuorumPolicy,
  DocumentApprovalRequest,
  DocumentApprovalStatus,
} from './documentStudioTypes.js';

// =============================================================================
// Errors
// =============================================================================

export type DocumentApprovalErrorCode =
  | 'invalid_input'
  | 'approval_not_found'
  | 'approval_already_open'
  | 'approval_already_resolved'
  | 'reviewer_not_participant'
  | 'decision_already_recorded'
  | 'self_approval_forbidden'
  | 'forbidden';

export class DocumentApprovalError extends Error {
  readonly code: DocumentApprovalErrorCode;
  constructor(code: DocumentApprovalErrorCode, message: string) {
    super(message);
    this.name = 'DocumentApprovalError';
    this.code = code;
  }
}

// =============================================================================
// In-process registry + write-through
// =============================================================================

const registryStore = new Map<string, DocumentApprovalRequest>();
const auditStore = new Map<string, DocumentApprovalAuditEntry[]>();
const hydratedKeys = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();
const persistenceQueues = new Map<string, Promise<boolean>>();

function approvalKey(organizationId: string, approvalId: string): string {
  return `${organizationId}::${approvalId}`;
}

function hydrationKey(organizationId: string, artifactId: string): string {
  return `${organizationId}::${artifactId}`;
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Serialize approval and audit writes per approval. The previous fire-and-forget
 * writes could complete out of order (for example a pending request overwriting
 * an already-approved row) and allowed the HTTP response to win the race with
 * durable persistence. Keeping a per-approval queue preserves mutation order;
 * route handlers call `flushApprovalPersistence` before acknowledging success.
 */
function enqueuePersistence(
  organizationId: string,
  approvalId: string,
  write: () => Promise<{ ok: boolean }>
): void {
  const key = approvalKey(organizationId, approvalId);
  const previous = persistenceQueues.get(key) ?? Promise.resolve(true);
  const next = previous.then(async (previousOk) => {
    const result = await write().catch(() => ({ ok: false }));
    return previousOk && result.ok;
  });
  persistenceQueues.set(key, next);
}

/** Wait until every write scheduled for this approval is durable. */
export async function flushApprovalPersistence(
  organizationId: string,
  approvalId: string
): Promise<boolean> {
  const key = approvalKey(organizationId, approvalId);
  const pending = persistenceQueues.get(key);
  if (!pending) return true;
  const ok = await pending;
  if (persistenceQueues.get(key) === pending) {
    persistenceQueues.delete(key);
  }
  return ok;
}

function clone(approval: DocumentApprovalRequest): DocumentApprovalRequest {
  return {
    ...approval,
    participants: approval.participants.map((p) => ({ ...p })),
    decisions: approval.decisions.map((d) => ({ ...d })),
  };
}

const TERMINAL_STATUSES: ReadonlySet<DocumentApprovalStatus> = new Set([
  'approved',
  'rejected',
  'changes_requested',
  'cancelled',
]);

export function isTerminalApprovalStatus(status: DocumentApprovalStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

function pushAudit(entry: DocumentApprovalAuditEntry): void {
  const key = approvalKey(entry.organizationId, entry.approvalId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
  enqueuePersistence(entry.organizationId, entry.approvalId, () =>
    persistApprovalAuditEntry(entry)
  );
}

function recordMutation(
  approval: DocumentApprovalRequest,
  action: DocumentApprovalAuditAction,
  actorId: string,
  details?: Record<string, unknown>
): void {
  pushAudit({
    auditId: makeId('approval-audit'),
    approvalId: approval.approvalId,
    organizationId: approval.organizationId,
    artifactId: approval.artifactId,
    action,
    actorId,
    occurredAt: nowIso(),
    details,
  });
}

async function ensureHydrated(organizationId: string, artifactId: string): Promise<void> {
  const k = hydrationKey(organizationId, artifactId);
  if (hydratedKeys.has(k)) return;
  const inflight = hydrationInflight.get(k);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const approvals = await loadApprovalsForArtifact(artifactId, organizationId);
      for (const approval of approvals) {
        registryStore.set(approvalKey(approval.organizationId, approval.approvalId), approval);
        const audit = await loadAuditForApproval(approval.approvalId, approval.organizationId);
        if (audit.length > 0) {
          auditStore.set(approvalKey(approval.organizationId, approval.approvalId), audit);
        }
      }
    } catch {
      // Persistence offline → cache stays empty; subsequent writes still
      // attempt write-through and the in-process state remains operational.
    }
    hydratedKeys.add(k);
  })();
  hydrationInflight.set(k, promise);
  try {
    await promise;
  } finally {
    hydrationInflight.delete(k);
  }
}

/**
 * Public hydration trigger used by route handlers before list / get
 * reads so a cold-start process always serves the persisted catalogue.
 * Idempotent per (org, artifact); subsequent calls are no-ops.
 */
export async function ensureApprovalRegistryHydrated(
  organizationId: string,
  artifactId: string
): Promise<void> {
  return ensureHydrated(organizationId, artifactId);
}

// =============================================================================
// Validation helpers
// =============================================================================

const VALID_QUORUM_POLICIES: ReadonlySet<DocumentApprovalQuorumPolicy> = new Set([
  'unanimous',
  'majority',
  'single_approval',
]);

const VALID_DECISION_KINDS: ReadonlySet<DocumentApprovalDecisionKind> = new Set([
  'approve',
  'reject',
  'request_changes',
]);

function normalizeParticipants(
  raw: DocumentApprovalParticipant[] | undefined
): DocumentApprovalParticipant[] {
  if (!Array.isArray(raw)) return [];
  const out: DocumentApprovalParticipant[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== 'object') continue;
    const userId = typeof candidate.userId === 'string' ? candidate.userId.trim() : '';
    if (!userId) continue;
    if (seen.has(userId)) continue;
    seen.add(userId);
    const role = typeof candidate.role === 'string' ? candidate.role.trim() : undefined;
    out.push({
      userId,
      role: role && role.length > 0 ? role : undefined,
      required: candidate.required !== false,
    });
  }
  return out;
}

function findActiveForArtifact(
  organizationId: string,
  artifactId: string
): DocumentApprovalRequest | undefined {
  const prefix = `${organizationId}::`;
  for (const [k, approval] of registryStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    if (approval.artifactId !== artifactId) continue;
    if (!isTerminalApprovalStatus(approval.status)) return approval;
  }
  return undefined;
}

// =============================================================================
// Resolution algorithm
// =============================================================================

/**
 * Compute the next approval status given the current decisions + policy.
 * Pure; does not mutate the input.
 */
export function evaluateApprovalResolution(
  participants: DocumentApprovalParticipant[],
  decisions: DocumentApprovalDecision[],
  quorumPolicy: DocumentApprovalQuorumPolicy
): DocumentApprovalStatus {
  const requiredParticipants = participants.filter((p) => p.required);
  const requiredUserIds = new Set(requiredParticipants.map((p) => p.userId));

  // Any reviewer (required or optional) requesting changes flips the
  // request to changes_requested — that signal blocks resolution
  // regardless of who said it because the document is no longer
  // approval-ready.
  if (decisions.some((d) => d.kind === 'request_changes')) {
    return 'changes_requested';
  }

  // Any REQUIRED reviewer rejecting flips to rejected. Optional
  // reviewers' rejections are recorded but do not block.
  if (decisions.some((d) => d.kind === 'reject' && requiredUserIds.has(d.reviewerId))) {
    return 'rejected';
  }

  if (requiredParticipants.length === 0) {
    // Edge case: no required reviewers. Treat the request as approved
    // immediately — author is implicitly the sole approver and the
    // request was essentially a notification.
    return 'approved';
  }

  const approvalsByRequired = decisions.filter(
    (d) => d.kind === 'approve' && requiredUserIds.has(d.reviewerId)
  );
  const approvalUserIds = new Set(approvalsByRequired.map((d) => d.reviewerId));

  switch (quorumPolicy) {
    case 'single_approval':
      return approvalUserIds.size >= 1 ? 'approved' : 'pending';
    case 'unanimous':
      return approvalUserIds.size === requiredParticipants.length ? 'approved' : 'pending';
    case 'majority': {
      const half = requiredParticipants.length / 2;
      return approvalUserIds.size > half ? 'approved' : 'pending';
    }
    default:
      return 'pending';
  }
}

// =============================================================================
// Request approval
// =============================================================================

export interface RequestDocumentApprovalParams {
  organizationId: string;
  artifactId: string;
  /** Required by the HTTP route; optional only for legacy service callers. */
  versionId?: string;
  userId: string;
  participants: DocumentApprovalParticipant[];
  quorumPolicy?: DocumentApprovalQuorumPolicy;
  reason?: string;
}

/**
 * Open a new approval request for a document artifact. At most one
 * non-terminal request per (organization, artifact) — a duplicate open
 * throws `approval_already_open` so two reviewer pools cannot stomp.
 */
export function requestDocumentApproval(
  params: RequestDocumentApprovalParams
): DocumentApprovalRequest {
  if (!params.organizationId) {
    throw new DocumentApprovalError('invalid_input', 'organizationId is required');
  }
  if (!params.artifactId) {
    throw new DocumentApprovalError('invalid_input', 'artifactId is required');
  }
  if (!params.userId) {
    throw new DocumentApprovalError('invalid_input', 'userId is required');
  }

  const participants = normalizeParticipants(params.participants);
  if (participants.length === 0) {
    throw new DocumentApprovalError('invalid_input', 'at least one participant is required');
  }
  if (!participants.some((p) => p.required)) {
    throw new DocumentApprovalError('invalid_input', 'at least one required participant is needed');
  }
  if (!participants.some((p) => p.required && p.userId !== params.userId)) {
    throw new DocumentApprovalError(
      'self_approval_forbidden',
      'at least one independent required reviewer is needed'
    );
  }

  const quorumPolicy: DocumentApprovalQuorumPolicy =
    params.quorumPolicy && VALID_QUORUM_POLICIES.has(params.quorumPolicy)
      ? params.quorumPolicy
      : 'unanimous';

  const existing = findActiveForArtifact(params.organizationId, params.artifactId);
  if (existing) {
    throw new DocumentApprovalError(
      'approval_already_open',
      `an active approval already exists for artifact ${params.artifactId}: ${existing.approvalId}`
    );
  }

  const now = nowIso();
  const approval: DocumentApprovalRequest = {
    approvalId: makeId('approval'),
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    ...(params.versionId?.trim() ? { versionId: params.versionId.trim() } : {}),
    requestedBy: params.userId,
    participants,
    quorumPolicy,
    status: 'pending',
    decisions: [],
    reason: params.reason?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  registryStore.set(approvalKey(approval.organizationId, approval.approvalId), approval);
  enqueuePersistence(approval.organizationId, approval.approvalId, () =>
    persistApproval(approval)
  );

  recordMutation(approval, 'approval_requested', params.userId, {
    ...(approval.versionId ? { versionId: approval.versionId } : {}),
    quorumPolicy,
    requiredCount: participants.filter((p) => p.required).length,
    optionalCount: participants.filter((p) => !p.required).length,
  });

  return clone(approval);
}

// =============================================================================
// Record decision
// =============================================================================

export interface RecordApprovalDecisionParams {
  organizationId: string;
  approvalId: string;
  reviewerId: string;
  kind: DocumentApprovalDecisionKind;
  comment?: string;
}

/**
 * Append a reviewer decision to an open approval request. Auto-resolves
 * the request when the quorum policy is satisfied (or any rejection /
 * changes_requested flips it to a terminal state).
 *
 * Errors:
 *   - 'approval_not_found'        — id does not exist for this tenant.
 *   - 'approval_already_resolved' — request is in a terminal state.
 *   - 'reviewer_not_participant'  — reviewer is not on the participant list.
 *   - 'decision_already_recorded' — same reviewer already submitted a
 *                                   decision; switching verdicts is not
 *                                   supported in MVP-5 (open a new
 *                                   request instead).
 *   - 'invalid_input'             — kind is not a recognized verdict.
 */
export function recordApprovalDecision(
  params: RecordApprovalDecisionParams
): DocumentApprovalRequest {
  if (!params.organizationId) {
    throw new DocumentApprovalError('invalid_input', 'organizationId is required');
  }
  if (!params.approvalId) {
    throw new DocumentApprovalError('invalid_input', 'approvalId is required');
  }
  if (!params.reviewerId) {
    throw new DocumentApprovalError('invalid_input', 'reviewerId is required');
  }
  if (!VALID_DECISION_KINDS.has(params.kind)) {
    throw new DocumentApprovalError('invalid_input', `unsupported decision kind: ${params.kind}`);
  }

  const existing = registryStore.get(approvalKey(params.organizationId, params.approvalId));
  if (!existing) {
    throw new DocumentApprovalError(
      'approval_not_found',
      `approval not found: ${params.approvalId}`
    );
  }
  if (isTerminalApprovalStatus(existing.status)) {
    throw new DocumentApprovalError(
      'approval_already_resolved',
      `approval is already in terminal state: ${existing.status}`
    );
  }
  const participant = existing.participants.find((p) => p.userId === params.reviewerId);
  if (!participant) {
    throw new DocumentApprovalError(
      'reviewer_not_participant',
      `reviewer is not a participant on this approval: ${params.reviewerId}`
    );
  }
  if (params.reviewerId === existing.requestedBy && params.kind === 'approve') {
    throw new DocumentApprovalError(
      'self_approval_forbidden',
      'the requester cannot approve their own document version'
    );
  }
  if (existing.decisions.some((d) => d.reviewerId === params.reviewerId)) {
    throw new DocumentApprovalError(
      'decision_already_recorded',
      `reviewer already submitted a decision: ${params.reviewerId}`
    );
  }

  const now = nowIso();
  const decision: DocumentApprovalDecision = {
    decisionId: makeId('approval-decision'),
    approvalId: existing.approvalId,
    reviewerId: params.reviewerId,
    kind: params.kind,
    comment: params.comment?.trim() || undefined,
    occurredAt: now,
  };
  const nextDecisions = [...existing.decisions, decision];
  const nextStatus = evaluateApprovalResolution(
    existing.participants,
    nextDecisions,
    existing.quorumPolicy
  );

  const next: DocumentApprovalRequest = {
    ...existing,
    decisions: nextDecisions,
    status: nextStatus,
    resolvedAt: isTerminalApprovalStatus(nextStatus) ? now : undefined,
    resolvedBy: isTerminalApprovalStatus(nextStatus) ? params.reviewerId : undefined,
    resolutionReason: isTerminalApprovalStatus(nextStatus) ? nextStatus : undefined,
    updatedAt: now,
  };

  registryStore.set(approvalKey(next.organizationId, next.approvalId), next);
  enqueuePersistence(next.organizationId, next.approvalId, () => persistApproval(next));

  recordMutation(next, 'approval_decision_recorded', params.reviewerId, {
    decisionId: decision.decisionId,
    kind: decision.kind,
  });
  if (isTerminalApprovalStatus(nextStatus) && existing.status !== nextStatus) {
    recordMutation(next, 'approval_resolved', params.reviewerId, { resolution: nextStatus });
  }

  return clone(next);
}

// =============================================================================
// Cancel approval
// =============================================================================

export interface CancelApprovalParams {
  organizationId: string;
  approvalId: string;
  userId: string;
  reason?: string;
}

/**
 * Withdraw a pending approval request. Only the original requester is
 * allowed to cancel — other actors get `forbidden`. Already-resolved
 * approvals throw `approval_already_resolved`.
 */
export function cancelApproval(params: CancelApprovalParams): DocumentApprovalRequest {
  if (!params.organizationId) {
    throw new DocumentApprovalError('invalid_input', 'organizationId is required');
  }
  if (!params.approvalId) {
    throw new DocumentApprovalError('invalid_input', 'approvalId is required');
  }
  if (!params.userId) {
    throw new DocumentApprovalError('invalid_input', 'userId is required');
  }
  const existing = registryStore.get(approvalKey(params.organizationId, params.approvalId));
  if (!existing) {
    throw new DocumentApprovalError(
      'approval_not_found',
      `approval not found: ${params.approvalId}`
    );
  }
  if (isTerminalApprovalStatus(existing.status)) {
    throw new DocumentApprovalError(
      'approval_already_resolved',
      `approval is already in terminal state: ${existing.status}`
    );
  }
  if (existing.requestedBy !== params.userId) {
    throw new DocumentApprovalError(
      'forbidden',
      'only the original requester may cancel an approval'
    );
  }

  const now = nowIso();
  const next: DocumentApprovalRequest = {
    ...existing,
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: params.userId,
    resolvedAt: now,
    resolvedBy: params.userId,
    resolutionReason: params.reason?.trim() || 'cancelled',
    updatedAt: now,
  };
  registryStore.set(approvalKey(next.organizationId, next.approvalId), next);
  enqueuePersistence(next.organizationId, next.approvalId, () => persistApproval(next));

  recordMutation(next, 'approval_cancelled', params.userId, {
    reason: params.reason?.trim() || undefined,
  });

  return clone(next);
}

// =============================================================================
// Reads
// =============================================================================

export function getApproval(
  approvalId: string,
  organizationId: string
): DocumentApprovalRequest | null {
  if (!approvalId || !organizationId) return null;
  const approval = registryStore.get(approvalKey(organizationId, approvalId));
  return approval ? clone(approval) : null;
}

/**
 * Returns the single non-terminal approval for an artifact (if any).
 * Used by lifecycle gating to decide whether `in_review → approved`
 * is permissible (the route layer translates a missing active record
 * into a 409 in MVP-5 or a permissive pass-through during rollout).
 */
export function getActiveApprovalForArtifact(
  organizationId: string,
  artifactId: string
): DocumentApprovalRequest | null {
  const found = findActiveForArtifact(organizationId, artifactId);
  return found ? clone(found) : null;
}

export interface ListDocumentApprovalsOptions {
  status?: DocumentApprovalStatus;
  /** Restrict to a single artifact within the tenant. */
  artifactId?: string;
}

export function listDocumentApprovals(
  organizationId: string,
  options: ListDocumentApprovalsOptions = {}
): DocumentApprovalRequest[] {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentApprovalRequest[] = [];
  for (const [k, approval] of registryStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    if (options.artifactId && approval.artifactId !== options.artifactId) continue;
    if (options.status && approval.status !== options.status) continue;
    out.push(clone(approval));
  }
  return out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export function listDocumentApprovalAuditEntries(
  approvalId: string,
  organizationId: string
): DocumentApprovalAuditEntry[] {
  if (!approvalId || !organizationId) return [];
  const entries = auditStore.get(approvalKey(organizationId, approvalId));
  return entries
    ? entries.map((entry) => ({
        ...entry,
        details: entry.details ? { ...entry.details } : undefined,
      }))
    : [];
}

/**
 * Records that approvals for the previously current document version no longer
 * authorize the new material revision. The approved request remains immutable
 * historical evidence; currentness is derived from its versionId.
 */
export function markDocumentApprovalsStaleForVersionChange(params: {
  organizationId: string;
  artifactId: string;
  previousVersionId: string;
  currentVersionId: string;
  actorId: string;
}): string[] {
  if (
    !params.organizationId ||
    !params.artifactId ||
    !params.previousVersionId ||
    !params.currentVersionId ||
    !params.actorId ||
    params.previousVersionId === params.currentVersionId
  ) {
    return [];
  }

  const staleApprovalIds: string[] = [];
  for (const approval of listDocumentApprovals(params.organizationId, {
    artifactId: params.artifactId,
    status: 'approved',
  })) {
    if (approval.versionId !== params.previousVersionId) continue;
    const alreadyRecorded = listDocumentApprovalAuditEntries(
      approval.approvalId,
      params.organizationId
    ).some(
      (entry) =>
        entry.action === 'approval_became_stale' &&
        entry.details?.currentVersionId === params.currentVersionId
    );
    if (alreadyRecorded) continue;
    recordMutation(approval, 'approval_became_stale', params.actorId, {
      approvedVersionId: approval.versionId,
      previousVersionId: params.previousVersionId,
      currentVersionId: params.currentVersionId,
      reason: 'material_content_changed',
    });
    staleApprovalIds.push(approval.approvalId);
  }
  return staleApprovalIds;
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetApprovalServiceForTests(): void {
  registryStore.clear();
  auditStore.clear();
  hydratedKeys.clear();
  hydrationInflight.clear();
  persistenceQueues.clear();
}

/** @internal */
export async function __resetApprovalServiceAndPersistenceForTests(): Promise<void> {
  __resetApprovalServiceForTests();
  await __resetApprovalRegistryDaoForTests();
}

/** @internal */
export async function __loadApprovalByIdForTests(
  approvalId: string,
  organizationId: string
): Promise<DocumentApprovalRequest | null> {
  return loadApprovalById(approvalId, organizationId);
}

/** @internal */
export async function __loadApprovalsForOrganizationForTests(
  organizationId: string
): Promise<DocumentApprovalRequest[]> {
  return loadApprovalsForOrganization(organizationId);
}
