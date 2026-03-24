/**
 * V8 Shared Publish and Review Semantics Service — WP-W6-OUT-04
 *
 * Unified publish lifecycle, review gates, coordinated publish for paired
 * outputs, output recall, and finance locked state.
 *
 * Decisions applied:
 *   W6-11 — finance locked state extends shared lifecycle
 *   W6-12 — coordinated publish (independent by capability, coordinated by workflow)
 *   W6-13 — output recall: explicit, auditable, lineage preserved
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  PublishRecord,
  ReviewGate,
  CoordinatedPublish,
  OutputRecall,
  FinanceLockedState,
  CreatePublishRecordParams,
  TransitionPublishStateParams,
  SubmitReviewGateParams,
  CreateCoordinatedPublishParams,
  RecallOutputParams,
  ApplyFinanceLockParams,
  PublishLifecycleState,
} from '../../types/publishReviewSemantics.js';
import {
  CreatePublishRecordParamsSchema,
  TransitionPublishStateParamsSchema,
  SubmitReviewGateParamsSchema,
  CreateCoordinatedPublishParamsSchema,
  RecallOutputParamsSchema,
  ApplyFinanceLockParamsSchema,
  VALID_STATE_TRANSITIONS,
} from '../../types/publishReviewSemantics.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:PublishReview]';

interface PublishRecordRow {
  record_id: string;
  artifact_id: string;
  artifact_type: string;
  organization_id: string;
  current_state: string;
  published_by: string;
  published_at: string | null;
  reviewers: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewGateRow {
  gate_id: string;
  artifact_id: string;
  organization_id: string;
  review_type: string;
  reviewer_id: string;
  result: string;
  comments: string | null;
  created_at: string;
}

interface CoordinatedPublishRow {
  coordination_id: string;
  primary_artifact_id: string;
  paired_artifact_id: string;
  organization_id: string;
  coordination_mode: string;
  coordinated_publish_at: string | null;
  created_at: string;
}

interface OutputRecallRow {
  recall_id: string;
  artifact_id: string;
  organization_id: string;
  recalled_by: string;
  reason: string;
  recalled_at: string;
  post_recall_state: string;
  lineage_preserved: number;
}

interface FinanceLockedRow {
  lock_id: string;
  artifact_id: string;
  organization_id: string;
  locked_by: string;
  lock_reason: string;
  lock_level: string;
  locked_at: string;
  unlocked_at: string | null;
}

function rowToPublishRecord(row: PublishRecordRow): PublishRecord {
  return {
    recordId: row.record_id,
    artifactId: row.artifact_id,
    artifactType: row.artifact_type as PublishRecord['artifactType'],
    organizationId: row.organization_id,
    currentState: row.current_state as PublishLifecycleState,
    publishedBy: row.published_by,
    publishedAt: row.published_at || null,
    reviewers: JSON.parse(row.reviewers || '[]'),
    approvedBy: row.approved_by || null,
    approvedAt: row.approved_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToReviewGate(row: ReviewGateRow): ReviewGate {
  return {
    gateId: row.gate_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    reviewType: row.review_type as ReviewGate['reviewType'],
    reviewerId: row.reviewer_id,
    result: row.result as ReviewGate['result'],
    comments: row.comments || null,
    createdAt: row.created_at,
  };
}

function rowToCoordinatedPublish(row: CoordinatedPublishRow): CoordinatedPublish {
  return {
    coordinationId: row.coordination_id,
    primaryArtifactId: row.primary_artifact_id,
    pairedArtifactId: row.paired_artifact_id,
    organizationId: row.organization_id,
    coordinationMode: row.coordination_mode as CoordinatedPublish['coordinationMode'],
    coordinatedPublishAt: row.coordinated_publish_at || null,
    createdAt: row.created_at,
  };
}

function rowToOutputRecall(row: OutputRecallRow): OutputRecall {
  return {
    recallId: row.recall_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    recalledBy: row.recalled_by,
    reason: row.reason,
    recalledAt: row.recalled_at,
    postRecallState: 'recalled',
    lineagePreserved: true,
  };
}

function rowToFinanceLocked(row: FinanceLockedRow): FinanceLockedState {
  return {
    lockId: row.lock_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    lockedBy: row.locked_by,
    lockReason: row.lock_reason,
    lockLevel: row.lock_level as FinanceLockedState['lockLevel'],
    lockedAt: row.locked_at,
    unlockedAt: row.unlocked_at || null,
  };
}

// ==========================================
// PUBLISH LIFECYCLE
// ==========================================

export async function createPublishRecord(
  params: CreatePublishRecordParams,
): Promise<PublishRecord> {
  const validated = CreatePublishRecordParamsSchema.parse(params);

  const recordId = uuidv4();
  const now = new Date().toISOString();

  const record: PublishRecord = {
    recordId,
    artifactId: validated.artifactId,
    artifactType: validated.artifactType,
    organizationId: validated.organizationId,
    currentState: 'private_draft',
    publishedBy: validated.publishedBy,
    publishedAt: null,
    reviewers: validated.reviewers,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_publish_records (
      record_id, artifact_id, artifact_type, organization_id, current_state,
      published_by, published_at, reviewers, approved_by, approved_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.recordId,
      record.artifactId,
      record.artifactType,
      record.organizationId,
      record.currentState,
      record.publishedBy,
      record.publishedAt,
      JSON.stringify(record.reviewers),
      record.approvedBy,
      record.approvedAt,
      record.createdAt,
      record.updatedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created publish record ${recordId} for artifact ${record.artifactId} ` +
    `(type=${record.artifactType}, state=${record.currentState})`,
  );
  return record;
}

export async function transitionPublishState(
  params: TransitionPublishStateParams,
): Promise<PublishRecord> {
  const validated = TransitionPublishStateParamsSchema.parse(params);

  const row = await dbGet<PublishRecordRow>(
    `SELECT * FROM v8_publish_records
     WHERE record_id = ? AND organization_id = ?`,
    [validated.recordId, validated.organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Publish record ${validated.recordId} not found`);
  }

  const currentState = row.current_state as PublishLifecycleState;
  const allowedNext = VALID_STATE_TRANSITIONS[currentState];

  if (!allowedNext.includes(validated.newState)) {
    throw new Error(
      `Invalid state transition: ${currentState} → ${validated.newState}. ` +
      `Allowed transitions from ${currentState}: [${allowedNext.join(', ')}]`,
    );
  }

  const now = new Date().toISOString();
  let publishedAt = row.published_at;
  let approvedBy = row.approved_by;
  let approvedAt = row.approved_at;

  if (validated.newState === 'approved') {
    approvedBy = validated.actor;
    approvedAt = now;
  }
  if (validated.newState === 'published') {
    publishedAt = now;
  }

  await dbRun(
    `UPDATE v8_publish_records
     SET current_state = ?, published_at = ?, approved_by = ?, approved_at = ?, updated_at = ?
     WHERE record_id = ? AND organization_id = ?`,
    [validated.newState, publishedAt, approvedBy, approvedAt, now, validated.recordId, validated.organizationId],
  );

  logger.info(
    `${LOG_PREFIX} Transitioned record ${validated.recordId}: ${currentState} → ${validated.newState} ` +
    `(actor=${validated.actor})`,
  );

  return rowToPublishRecord({
    ...row,
    current_state: validated.newState,
    published_at: publishedAt,
    approved_by: approvedBy,
    approved_at: approvedAt,
    updated_at: now,
  });
}

export async function getPublishRecord(
  artifactId: string,
  organizationId: string,
): Promise<PublishRecord | null> {
  const row = await dbGet<PublishRecordRow>(
    `SELECT * FROM v8_publish_records
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToPublishRecord(row);
}

// ==========================================
// REVIEW GATES
// ==========================================

export async function submitReviewGate(
  params: SubmitReviewGateParams,
): Promise<ReviewGate> {
  const validated = SubmitReviewGateParamsSchema.parse(params);

  const gateId = uuidv4();
  const now = new Date().toISOString();

  const gate: ReviewGate = {
    gateId,
    artifactId: validated.artifactId,
    organizationId: validated.organizationId,
    reviewType: validated.reviewType,
    reviewerId: validated.reviewerId,
    result: validated.result,
    comments: validated.comments,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_review_gates (
      gate_id, artifact_id, organization_id, review_type,
      reviewer_id, result, comments
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      gate.gateId,
      gate.artifactId,
      gate.organizationId,
      gate.reviewType,
      gate.reviewerId,
      gate.result,
      gate.comments,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Submitted review gate ${gateId} for artifact ${gate.artifactId} ` +
    `(type=${gate.reviewType}, result=${gate.result})`,
  );
  return gate;
}

export async function getReviewGates(
  artifactId: string,
  organizationId: string,
): Promise<ReviewGate[]> {
  const rows = await dbAll<ReviewGateRow>(
    `SELECT * FROM v8_review_gates
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [artifactId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToReviewGate);
}

// ==========================================
// COORDINATED PUBLISH (Decision W6-12)
// ==========================================

export async function createCoordinatedPublish(
  params: CreateCoordinatedPublishParams,
): Promise<CoordinatedPublish> {
  const validated = CreateCoordinatedPublishParamsSchema.parse(params);

  const coordinationId = uuidv4();
  const now = new Date().toISOString();

  const coord: CoordinatedPublish = {
    coordinationId,
    primaryArtifactId: validated.primaryArtifactId,
    pairedArtifactId: validated.pairedArtifactId,
    organizationId: validated.organizationId,
    coordinationMode: validated.coordinationMode,
    coordinatedPublishAt: null,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_coordinated_publishes (
      coordination_id, primary_artifact_id, paired_artifact_id,
      organization_id, coordination_mode, coordinated_publish_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      coord.coordinationId,
      coord.primaryArtifactId,
      coord.pairedArtifactId,
      coord.organizationId,
      coord.coordinationMode,
      coord.coordinatedPublishAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created coordinated publish ${coordinationId} ` +
    `(primary=${coord.primaryArtifactId}, paired=${coord.pairedArtifactId}, mode=${coord.coordinationMode})`,
  );
  return coord;
}

// ==========================================
// OUTPUT RECALL (Decision W6-13)
// ==========================================

export async function recallOutput(
  params: RecallOutputParams,
): Promise<OutputRecall> {
  const validated = RecallOutputParamsSchema.parse(params);

  const recallId = uuidv4();
  const now = new Date().toISOString();

  const recall: OutputRecall = {
    recallId,
    artifactId: validated.artifactId,
    organizationId: validated.organizationId,
    recalledBy: validated.recalledBy,
    reason: validated.reason,
    recalledAt: now,
    postRecallState: 'recalled',
    lineagePreserved: true,
  };

  await dbRun(
    `INSERT INTO v8_output_recalls (
      recall_id, artifact_id, organization_id, recalled_by,
      reason, recalled_at, post_recall_state, lineage_preserved
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recall.recallId,
      recall.artifactId,
      recall.organizationId,
      recall.recalledBy,
      recall.reason,
      recall.recalledAt,
      recall.postRecallState,
      1,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recalled output ${recall.artifactId} by ${recall.recalledBy} ` +
    `(reason=${recall.reason})`,
  );
  return recall;
}

export async function getRecallHistory(
  artifactId: string,
  organizationId: string,
): Promise<OutputRecall[]> {
  const rows = await dbAll<OutputRecallRow>(
    `SELECT * FROM v8_output_recalls
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY recalled_at ASC`,
    [artifactId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToOutputRecall);
}

// ==========================================
// FINANCE LOCKED STATE (Decision W6-11)
// ==========================================

export async function applyFinanceLock(
  params: ApplyFinanceLockParams,
): Promise<FinanceLockedState> {
  const validated = ApplyFinanceLockParamsSchema.parse(params);

  const lockId = uuidv4();
  const now = new Date().toISOString();

  const lock: FinanceLockedState = {
    lockId,
    artifactId: validated.artifactId,
    organizationId: validated.organizationId,
    lockedBy: validated.lockedBy,
    lockReason: validated.lockReason,
    lockLevel: validated.lockLevel,
    lockedAt: now,
    unlockedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_finance_locked_states (
      lock_id, artifact_id, organization_id, locked_by,
      lock_reason, lock_level, locked_at, unlocked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lock.lockId,
      lock.artifactId,
      lock.organizationId,
      lock.lockedBy,
      lock.lockReason,
      lock.lockLevel,
      lock.lockedAt,
      lock.unlockedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Applied finance lock ${lockId} on artifact ${lock.artifactId} ` +
    `(level=${lock.lockLevel})`,
  );
  return lock;
}

export async function removeFinanceLock(
  lockId: string,
  organizationId: string,
  unlockedBy: string,
): Promise<FinanceLockedState> {
  const row = await dbGet<FinanceLockedRow>(
    `SELECT * FROM v8_finance_locked_states
     WHERE lock_id = ? AND organization_id = ?`,
    [lockId, organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Finance lock ${lockId} not found`);
  }

  if (row.unlocked_at) {
    throw new Error(`Finance lock ${lockId} is already unlocked`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_finance_locked_states
     SET unlocked_at = ?
     WHERE lock_id = ? AND organization_id = ?`,
    [now, lockId, organizationId],
  );

  logger.info(
    `${LOG_PREFIX} Removed finance lock ${lockId} by ${unlockedBy}`,
  );

  return rowToFinanceLocked({
    ...row,
    unlocked_at: now,
  });
}

export async function getFinanceLocks(
  artifactId: string,
  organizationId: string,
): Promise<FinanceLockedState[]> {
  const rows = await dbAll<FinanceLockedRow>(
    `SELECT * FROM v8_finance_locked_states
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY locked_at ASC`,
    [artifactId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToFinanceLocked);
}
