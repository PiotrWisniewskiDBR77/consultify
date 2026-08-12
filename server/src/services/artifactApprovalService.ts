/**
 * Artifact Approval Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * HP-7 (Harvey-Parity §Blok B, Workflow Engine): draft→review→approved dla
 * ARTEFAKTÓW (Insight/Decision/Report/Initiative/Deck/...) na TEJ SAMEJ
 * `approval_assignments` tabeli, którą audyt HP-6 potwierdził jako:
 *   - dziś używaną WYŁĄCZNIE dla propozycji akcji AI (proposal_id -> action_decisions),
 *     egzekwowaną przez slaService.ts (jedyny aktywny caller — cron/Scheduler.ts)
 *     i workqueueService.ts (CRUD bez aktywnego callera poza sobą samym);
 *   - NIEUŻYWANĄ przez PMO stage-gates (stageGateService.ts pisze do OSOBNEJ
 *     tabeli `stage_gates`) — więc rozszerzenie poniżej ma zero powierzchni
 *     nakładania z gates projektowymi PMO.
 *
 * Rozróżnik `assignment_kind` ('project_gate' domyślnie dla wierszy
 * sprzed tej migracji | 'artifact' dla wierszy tworzonych tym serwisem)
 * + polimorficzna para (artifact_type, artifact_id) — patrz migracja
 * `20260714_workflow_artifact_approvals.sql`.
 *
 * Stan artefaktu jest WYLICZANY z najnowszego wiersza approval_assignments
 * (assignment_kind='artifact', artifact_type, artifact_id), nie przechowywany
 * osobno:
 *   brak wiersza                        -> draft
 *   status IN (PENDING, ACKED, EXPIRED) -> review
 *   status = DONE                       -> approved
 *   status = REJECTED                   -> rejected
 *
 * `proposal_id` (NOT NULL w schemacie historycznym, projektowanym pod
 * action_decisions) jest dla wierszy assignment_kind='artifact' wypełniany
 * wartością artifact_id — reużycie istniejącej kolumny zamiast rozluźniania
 * NOT NULL na kolumnie czytanej przez slaService/workqueueService (mniejsze
 * ryzyko regresji).
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import auditLogger from '../utils/auditLogger.js';
import * as DbPromise from '../utils/DbPromise.js';

// ==========================================
// CONSTANTS
// ==========================================

export const ARTIFACT_APPROVAL_KIND = 'artifact' as const;

export const ARTIFACT_APPROVAL_STATUSES = {
  PENDING: 'PENDING',
  ACKED: 'ACKED',
  DONE: 'DONE',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
} as const;

export const ARTIFACT_STATES = {
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type ArtifactApprovalState = (typeof ARTIFACT_STATES)[keyof typeof ARTIFACT_STATES];

const DEFAULT_ARTIFACT_SLA_HOURS = 72;

// ==========================================
// TYPES
// ==========================================

export interface ApprovalAssignmentRow {
  id: string;
  org_id: string;
  proposal_id: string;
  assigned_to_user_id: string;
  status: string;
  sla_due_at: string;
  escalated_to_user_id?: string | null;
  escalated_at?: string | null;
  escalation_reason?: string | null;
  acked_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  assignment_kind: string;
  artifact_type: string | null;
  artifact_id: string | null;
  requested_by_user_id?: string | null;
}

export interface ArtifactApprovalStatus {
  state: ArtifactApprovalState;
  assignment: ApprovalAssignmentRow | null;
}

interface AppError extends Error {
  status?: number;
}

function makeError(message: string, status: number): AppError {
  const error = new Error(message) as AppError;
  error.status = status;
  return error;
}

// ==========================================
// SERVICE STATE (test-injectable, wzór slaService.ts)
// ==========================================

let db: IDatabase = getDatabase();

export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

// ==========================================
// HELPERS
// ==========================================

function mapStatusToState(status: string | undefined | null): ArtifactApprovalState {
  switch (status) {
    case ARTIFACT_APPROVAL_STATUSES.DONE:
      return ARTIFACT_STATES.APPROVED;
    case ARTIFACT_APPROVAL_STATUSES.REJECTED:
      return ARTIFACT_STATES.REJECTED;
    case ARTIFACT_APPROVAL_STATUSES.PENDING:
    case ARTIFACT_APPROVAL_STATUSES.ACKED:
    case ARTIFACT_APPROVAL_STATUSES.EXPIRED:
      return ARTIFACT_STATES.REVIEW;
    default:
      return ARTIFACT_STATES.DRAFT;
  }
}

/**
 * "Latest" state for an artifact. Prefers an ACTIVE (PENDING/ACKED) row over
 * terminal (DONE/REJECTED/EXPIRED) ones, falling back to the most recent
 * terminal row only when no review is currently in flight. This is not just
 * an optimization: `created_at` has second-level precision on some engines
 * (e.g. SQLite's CURRENT_TIMESTAMP), so a reject-then-resubmit within the
 * same second would otherwise tie on `ORDER BY created_at DESC` and could
 * surface the stale REJECTED row instead of the new active review — found by
 * a real (non-decorative) test in
 * tests/unit/backend/services/artifactApprovalService.test.ts.
 */
async function findLatestArtifactAssignment(
  orgId: string,
  artifactType: string,
  artifactId: string
): Promise<ApprovalAssignmentRow | null> {
  const active = await findActiveArtifactAssignment(orgId, artifactType, artifactId);
  if (active) {
    return active;
  }

  return DbPromise.get<ApprovalAssignmentRow>(
    db,
    `SELECT * FROM approval_assignments
     WHERE org_id = ? AND assignment_kind = ? AND artifact_type = ? AND artifact_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, ARTIFACT_APPROVAL_KIND, artifactType, artifactId]
  );
}

async function findActiveArtifactAssignment(
  orgId: string,
  artifactType: string,
  artifactId: string
): Promise<ApprovalAssignmentRow | null> {
  return DbPromise.get<ApprovalAssignmentRow>(
    db,
    `SELECT * FROM approval_assignments
     WHERE org_id = ? AND assignment_kind = ? AND artifact_type = ? AND artifact_id = ?
       AND status IN ('PENDING', 'ACKED')
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, ARTIFACT_APPROVAL_KIND, artifactType, artifactId]
  );
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Current draft/review/approved/rejected state of one artifact.
 * No row yet = 'draft' (artifact hasn't entered the workflow).
 */
export async function getArtifactApprovalStatus(
  orgId: string,
  artifactType: string,
  artifactId: string
): Promise<ArtifactApprovalStatus> {
  const row = await findLatestArtifactAssignment(orgId, artifactType, artifactId);
  return { state: mapStatusToState(row?.status), assignment: row };
}

/**
 * draft -> review. Fails (409) if an active (PENDING/ACKED) review already
 * exists for this artifact — mirrors workqueueService.assignApproval's guard
 * against duplicate active assignments for the same subject.
 */
export async function submitForReview(params: {
  orgId: string;
  artifactType: string;
  artifactId: string;
  assignedToUserId: string;
  submittedBy: string;
  slaDueAt?: Date;
}): Promise<ApprovalAssignmentRow> {
  const { orgId, artifactType, artifactId, assignedToUserId, submittedBy, slaDueAt } = params;

  if (!orgId || !artifactType || !artifactId || !assignedToUserId || !submittedBy) {
    throw makeError(
      'orgId, artifactType, artifactId, assignedToUserId, submittedBy are required',
      400
    );
  }
  if (assignedToUserId === submittedBy) {
    throw makeError('Artifact requester cannot be assigned as its reviewer', 409);
  }

  const active = await findActiveArtifactAssignment(orgId, artifactType, artifactId);
  if (active) {
    throw makeError('Artifact already has an active review', 409);
  }

  const id = uuidv4();
  const dueAt = slaDueAt || new Date(Date.now() + DEFAULT_ARTIFACT_SLA_HOURS * 60 * 60 * 1000);

  const result = await DbPromise.run(
    db,
    `INSERT INTO approval_assignments
       (id, org_id, proposal_id, assigned_to_user_id, status, sla_due_at,
        assignment_kind, artifact_type, artifact_id, requested_by_user_id, created_at)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      id,
      orgId,
      artifactId,
      assignedToUserId,
      dueAt.toISOString(),
      ARTIFACT_APPROVAL_KIND,
      artifactType,
      artifactId,
      submittedBy,
    ],
    { fallback: false }
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to submit artifact for review');
  }

  auditLogger.info('ARTIFACT_SUBMITTED_FOR_REVIEW', {
    metadata: {
      assignment_id: id,
      artifact_type: artifactType,
      artifact_id: artifactId,
      assigned_to: assignedToUserId,
      org_id: orgId,
      submitted_by: submittedBy,
      sla_due_at: dueAt.toISOString(),
    },
  });

  const row = await findLatestArtifactAssignment(orgId, artifactType, artifactId);
  if (!row) {
    throw new Error('Assignment created but could not be re-read');
  }
  return row;
}

/**
 * review (PENDING) -> review (ACKED). Optional intermediate step — marks that
 * a reviewer has started looking at the artifact, mirrors
 * workqueueService.acknowledgeApproval.
 */
export async function acknowledgeReview(params: {
  orgId: string;
  artifactType: string;
  artifactId: string;
  userId: string;
}): Promise<ApprovalAssignmentRow> {
  const { orgId, artifactType, artifactId, userId } = params;

  const active = await findActiveArtifactAssignment(orgId, artifactType, artifactId);
  if (!active || active.status !== ARTIFACT_APPROVAL_STATUSES.PENDING) {
    throw makeError('No pending review found for this artifact', 404);
  }
  if (active.assigned_to_user_id !== userId) {
    throw makeError('Only the assigned reviewer may acknowledge this review', 403);
  }

  const result = await DbPromise.run(
    db,
    `UPDATE approval_assignments SET status = 'ACKED', acked_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [active.id],
    { fallback: false }
  );
  if (!result.success) {
    throw new Error(result.error || 'Failed to acknowledge review');
  }

  auditLogger.info('ARTIFACT_REVIEW_ACKED', {
    metadata: {
      assignment_id: active.id,
      artifact_type: artifactType,
      artifact_id: artifactId,
      user_id: userId,
    },
  });

  return { ...active, status: ARTIFACT_APPROVAL_STATUSES.ACKED };
}

/**
 * review -> approved.
 */
export async function approveArtifact(params: {
  orgId: string;
  artifactType: string;
  artifactId: string;
  approvedByUserId: string;
}): Promise<ApprovalAssignmentRow> {
  const { orgId, artifactType, artifactId, approvedByUserId } = params;

  const active = await findActiveArtifactAssignment(orgId, artifactType, artifactId);
  if (!active) {
    throw makeError('No active review found for this artifact', 404);
  }
  if (active.assigned_to_user_id !== approvedByUserId) {
    throw makeError('Only the assigned reviewer may approve this artifact', 403);
  }
  if (active.requested_by_user_id === approvedByUserId) {
    throw makeError('Artifact requester cannot approve their own submission', 403);
  }

  const result = await DbPromise.run(
    db,
    `UPDATE approval_assignments SET status = 'DONE', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [active.id],
    { fallback: false }
  );
  if (!result.success) {
    throw new Error(result.error || 'Failed to approve artifact');
  }

  auditLogger.info('ARTIFACT_APPROVED', {
    metadata: {
      assignment_id: active.id,
      artifact_type: artifactType,
      artifact_id: artifactId,
      approved_by: approvedByUserId,
    },
  });

  return { ...active, status: ARTIFACT_APPROVAL_STATUSES.DONE };
}

/**
 * review -> rejected. Rejection sends the artifact back to the author; a new
 * submitForReview() call (new row) starts a fresh review cycle — REJECTED is
 * not an "active" status so it never blocks resubmission.
 */
export async function rejectArtifact(params: {
  orgId: string;
  artifactType: string;
  artifactId: string;
  rejectedByUserId: string;
  reason?: string;
}): Promise<ApprovalAssignmentRow> {
  const { orgId, artifactType, artifactId, rejectedByUserId, reason } = params;

  const active = await findActiveArtifactAssignment(orgId, artifactType, artifactId);
  if (!active) {
    throw makeError('No active review found for this artifact', 404);
  }
  if (active.assigned_to_user_id !== rejectedByUserId) {
    throw makeError('Only the assigned reviewer may reject this artifact', 403);
  }
  if (active.requested_by_user_id === rejectedByUserId) {
    throw makeError('Artifact requester cannot reject their own submission', 403);
  }

  const result = await DbPromise.run(
    db,
    `UPDATE approval_assignments SET status = 'REJECTED', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [active.id],
    { fallback: false }
  );
  if (!result.success) {
    throw new Error(result.error || 'Failed to reject artifact');
  }

  auditLogger.warn('ARTIFACT_REJECTED', {
    metadata: {
      assignment_id: active.id,
      artifact_type: artifactType,
      artifact_id: artifactId,
      rejected_by: rejectedByUserId,
      reason: reason || null,
    },
  });

  return { ...active, status: ARTIFACT_APPROVAL_STATUSES.REJECTED };
}

// Default export for backward-compatibility with the rest of the codebase's
// service style (slaService/workqueueService both export a default object).
const ArtifactApprovalService = {
  ARTIFACT_APPROVAL_KIND,
  ARTIFACT_APPROVAL_STATUSES,
  ARTIFACT_STATES,
  setDependencies,
  getArtifactApprovalStatus,
  submitForReview,
  acknowledgeReview,
  approveArtifact,
  rejectArtifact,
};

export default ArtifactApprovalService;
