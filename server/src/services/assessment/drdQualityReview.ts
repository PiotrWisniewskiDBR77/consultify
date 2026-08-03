/**
 * ASM-005/007 — DRD manager review (accept / return) + accepted-output snapshot wiring.
 *
 * This service owns the "quality gate" that sits between a completed DRD
 * assessment and its promotion to an approved, citable output:
 *   - `reviewAssessment` implements the manager decision itself (accept or
 *     return-for-rework), always writing an append-only audit row to
 *     `assessment_quality_reviews` (see migration
 *     `server/migrations/20260801_asm005_007_evidence_quality_output.sql`).
 *   - `return` reopens the assessment for editing (status -> DRAFT) and does
 *     NOT touch any previously accepted snapshot — a manager can send an
 *     assessment back for rework without destroying the last accepted
 *     output.
 *   - `accept` is DRD-only for this slice, and is gated on two hard rules:
 *     completion must be 100% (server-derived, via `computeDrdCompletion`,
 *     never trusted from the client) and every DRD axis must carry at least
 *     one evidence row (via server-derived scoring) — "a reviewer cannot
 *     accept without required data". On success it derives server-side
 *     scoring, snapshots it via `createAcceptedSnapshot`, and flips the
 *     assessment to APPROVED.
 *   - `listReviewHistory` is a plain org-scoped read of the audit trail.
 *
 * Every query is scoped by `organization_id` in the same WHERE clause as the
 * row lookup — never trust an assessment id alone (matches the convention in
 * `server/src/routes/v8/assessment.routes.ts`).
 *
 * Accept/return is serialized per assessment with SELECT ... FOR UPDATE and
 * all reads/writes run on one pinned PostgreSQL client transaction.
 */
import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../database/PostgresDatabase.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type { SnapshotRecord } from './drdAcceptedSnapshot.js';
import { createAcceptedSnapshot } from './drdAcceptedSnapshot.js';
import { computeDrdCompletion } from './drdCompletion.js';
import type { DrdAreasMap } from './drdEvidenceScoring.js';
import { computeDrdScoring, listEvidence } from './drdEvidenceScoring.js';

export type ReviewAction = 'accept' | 'return';

export interface ReviewRecord {
  id: string;
  organizationId: string;
  assessmentId: string;
  action: ReviewAction;
  actorId: string;
  actorRole: string | null;
  rationale: string;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: string;
}

/**
 * Error shape for this module. Callers (route layer) should catch this and
 * map `.status` -> HTTP status, `.code` -> the `code` field in the JSON
 * error body, and may include `.details` for machine-readable context
 * (e.g. `{ completionPercent }` or `{ axesMissingEvidence }`).
 *
 * Verbatim code/status pairs used by this module:
 *   - ASSESSMENT_NOT_FOUND        404  (assessment row not found for org)
 *   - REVIEW_RATIONALE_REQUIRED   400  (rationale missing/too short, both actions)
 *   - UNSUPPORTED_ASSESSMENT_TYPE 400  (accept attempted on non-DRD assessment)
 *   - ASSESSMENT_INCOMPLETE       409  (accept attempted below 100% completion; details: { completionPercent })
 *   - MISSING_EVIDENCE            409  (accept attempted with axes missing evidence; details: { axesMissingEvidence })
 */
export class QualityReviewError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'QualityReviewError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type ReviewFaultStage =
  | 'review-inserted'
  | 'snapshot-flipped'
  | 'snapshot-inserted'
  | 'status-updated';
let testFaultInjector: ((stage: ReviewFaultStage) => void | Promise<void>) | null = null;

/** Test-only seam used by the real-Postgres rollback acceptance test. */
export function setQualityReviewFaultInjectorForTests(
  injector: ((stage: ReviewFaultStage) => void | Promise<void>) | null
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  testFaultInjector = injector;
}

interface AssessmentRow {
  id: string;
  organization_id: string;
  status: string | null;
  answers_json: string | null;
  assessment_type: string | null;
  assessment_definition_id: string | null;
  assessment_definition_version: string | number | null;
  updated_at: string | null;
}

interface ReviewRow {
  id: string;
  organization_id: string;
  assessment_id: string;
  action: ReviewAction;
  actor_id: string;
  actor_role: string | null;
  rationale: string;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
}

function toReviewRecord(row: ReviewRow): ReviewRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentId: row.assessment_id,
    action: row.action,
    actorId: row.actor_id,
    actorRole: row.actor_role ?? null,
    rationale: row.rationale,
    previousStatus: row.previous_status ?? null,
    newStatus: row.new_status ?? null,
    createdAt: row.created_at,
  };
}

function parseAnswersSafely(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Org-scoped audit trail for an assessment's accept/return decisions,
 * newest first.
 */
export async function listReviewHistory(params: {
  organizationId: string;
  assessmentId: string;
}): Promise<ReviewRecord[]> {
  const rows = await queryHelpers.queryAll<ReviewRow>(
    `SELECT id, organization_id, assessment_id, action, actor_id, actor_role, rationale, previous_status, new_status, created_at
     FROM assessment_quality_reviews
     WHERE organization_id = ? AND assessment_id = ?
     ORDER BY created_at DESC`,
    [params.organizationId, params.assessmentId]
  );
  return rows.map(toReviewRecord);
}

/**
 * Records a manager decision (accept/return) on an assessment. See module
 * doc-comment and `QualityReviewError` doc-comment above for the full
 * accept-gate rules and the exact code/status pairs thrown.
 */
export async function reviewAssessment(params: {
  organizationId: string;
  assessmentId: string;
  actorId: string;
  actorRole: string;
  action: ReviewAction;
  rationale: string;
}): Promise<{ review: ReviewRecord; snapshot?: SnapshotRecord }> {
  const { organizationId, assessmentId, actorId, actorRole, action } = params;

  return withPinnedPostgresTransaction(async (tx) => {
    const assessment = await tx.queryOne<AssessmentRow>(
      `SELECT id, organization_id, status, answers_json, assessment_type, assessment_definition_id, assessment_definition_version, updated_at
     FROM assessments
     WHERE id = ? AND organization_id = ?
     FOR UPDATE`,
      [assessmentId, organizationId]
    );
    if (!assessment) {
      throw new QualityReviewError('ASSESSMENT_NOT_FOUND', 404, 'Assessment not found');
    }

    const rationale = typeof params.rationale === 'string' ? params.rationale.trim() : '';
    if (rationale.length < 3) {
      throw new QualityReviewError(
        'REVIEW_RATIONALE_REQUIRED',
        400,
        'A rationale of at least 3 characters is required to accept or return an assessment'
      );
    }

    const previousStatus = assessment.status ?? null;
    const now = new Date().toISOString();

    if (action === 'return') {
      const reviewId = uuidv4();
      const newStatus = 'DRAFT';
      await tx.queryRun(
        `INSERT INTO assessment_quality_reviews
         (id, organization_id, assessment_id, action, actor_id, actor_role, rationale, previous_status, new_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reviewId,
          organizationId,
          assessmentId,
          'return',
          actorId,
          actorRole ?? null,
          rationale,
          previousStatus,
          newStatus,
          now,
        ]
      );
      await testFaultInjector?.('review-inserted');

      // Reopens the assessment for editing. Does NOT touch
      // assessment_drd_accepted_snapshots — a prior accepted output must stay
      // retrievable while the assessment is reworked.
      await tx.queryRun(
        `UPDATE assessments SET status = ?, updated_by = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [newStatus, actorId, now, assessmentId, organizationId]
      );
      await testFaultInjector?.('status-updated');

      const review = await tx.queryOne<ReviewRow>(
        `SELECT id, organization_id, assessment_id, action, actor_id, actor_role, rationale, previous_status, new_status, created_at
       FROM assessment_quality_reviews WHERE id = ?`,
        [reviewId]
      );

      return {
        review: review
          ? toReviewRecord(review)
          : {
              id: reviewId,
              organizationId,
              assessmentId,
              action: 'return',
              actorId,
              actorRole: actorRole ?? null,
              rationale,
              previousStatus,
              newStatus,
              createdAt: now,
            },
      };
    }

    // action === 'accept'
    if (String(assessment.assessment_type ?? '').toUpperCase() !== 'DRD') {
      throw new QualityReviewError(
        'UNSUPPORTED_ASSESSMENT_TYPE',
        400,
        'Only DRD assessments can be accepted through this review flow'
      );
    }

    const answers = parseAnswersSafely(assessment.answers_json);
    const areas = (answers as { drd?: { areas?: DrdAreasMap } })?.drd?.areas;

    const completionPercent = computeDrdCompletion(areas);
    if (completionPercent !== 100) {
      throw new QualityReviewError(
        'ASSESSMENT_INCOMPLETE',
        409,
        'Assessment must be 100% complete before it can be accepted',
        { completionPercent }
      );
    }

    const evidenceRows = await listEvidence({ organizationId, assessmentId }, tx);
    const axesMissingEvidence = computeDrdScoring(areas, evidenceRows).axesMissingEvidence;
    if (axesMissingEvidence.length > 0) {
      throw new QualityReviewError(
        'MISSING_EVIDENCE',
        409,
        'Every DRD axis must have supporting evidence before the assessment can be accepted',
        { axesMissingEvidence }
      );
    }

    const scoring = computeDrdScoring(areas, evidenceRows);

    const reviewId = uuidv4();
    const newStatus = 'APPROVED';
    await tx.queryRun(
      `INSERT INTO assessment_quality_reviews
       (id, organization_id, assessment_id, action, actor_id, actor_role, rationale, previous_status, new_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reviewId,
        organizationId,
        assessmentId,
        'accept',
        actorId,
        actorRole ?? null,
        rationale,
        previousStatus,
        newStatus,
        now,
      ]
    );
    await testFaultInjector?.('review-inserted');

    const snapshotPayload = {
      assessmentId,
      assessmentType: 'DRD',
      assessmentDefinitionId: assessment.assessment_definition_id ?? null,
      assessmentDefinitionVersion: assessment.assessment_definition_version ?? null,
      answers,
      scoring,
    };
    const provenance = {
      acceptedBy: actorId,
      acceptedAt: now,
      actorRole: actorRole ?? null,
      reviewId,
      assessmentSourceUpdatedAt: assessment.updated_at ?? null,
      assessmentDefinitionId: assessment.assessment_definition_id ?? null,
      assessmentDefinitionVersion: assessment.assessment_definition_version ?? null,
    };

    const snapshot = await createAcceptedSnapshot(
      {
        organizationId,
        assessmentId,
        reviewId,
        acceptedBy: actorId,
        snapshot: snapshotPayload,
        provenance,
      },
      tx,
      async (stage) => testFaultInjector?.(stage)
    );

    await tx.queryRun(
      `UPDATE assessments SET status = ?, approved_at = ?, updated_by = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [newStatus, now, actorId, now, assessmentId, organizationId]
    );
    await testFaultInjector?.('status-updated');

    const review = await tx.queryOne<ReviewRow>(
      `SELECT id, organization_id, assessment_id, action, actor_id, actor_role, rationale, previous_status, new_status, created_at
     FROM assessment_quality_reviews WHERE id = ?`,
      [reviewId]
    );

    return {
      review: review
        ? toReviewRecord(review)
        : {
            id: reviewId,
            organizationId,
            assessmentId,
            action: 'accept',
            actorId,
            actorRole: actorRole ?? null,
            rationale,
            previousStatus,
            newStatus,
            createdAt: now,
          },
      snapshot,
    };
  });
}
