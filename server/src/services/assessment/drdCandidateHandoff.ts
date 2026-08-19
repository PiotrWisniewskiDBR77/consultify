/**
 * ASM-08 — DRD accepted-output → Candidate handoff.
 *
 * This service owns the bridge between an already-accepted DRD assessment
 * output (ASM-05/06/07: `assessments.status = 'APPROVED'` + a current row in
 * `assessment_accepted_snapshots`) and a canonical row in the EXISTING
 * `initiative_candidates` table (F2 "Skrzynka kandydatów"). It does NOT
 * create a new table and does NOT duplicate the separate, later, human-driven
 * "accept candidate -> create Initiative" flow that already lives in
 * `initiativeCandidateService.ts` (`acceptCandidate`) — this module only ever
 * calls that file's `createCandidateFromSource`, nothing else from it.
 *
 * Idempotency/lineage receipt: `assessment_candidate_handoffs` (migration
 * `server/migrations/20260802_asm008_candidate_handoff.sql`). The unique
 * index on `(organization_id, assessment_id)` is the hard idempotency key —
 * exactly one handoff receipt per assessment, ever. A retry for an assessment
 * that already has a receipt returns the SAME candidateId instead of creating
 * a duplicate candidate.
 *
 * Every query is scoped by `organization_id` in the same WHERE clause as the
 * row lookup — never trust an id alone (matches the convention throughout
 * this codebase's assessment services, e.g. `drdQualityReview.ts`).
 *
 * The handoff mutation is serialized per assessment with the same
 * `SELECT ... FOR UPDATE` lock on the `assessments` row that
 * `reviewAssessment` (in `drdQualityReview.ts`) already uses to serialize
 * accept/return — two concurrent handoff calls (or a handoff racing an
 * accept/return) for the same assessment_id will have the second BLOCK until
 * the first's transaction commits or rolls back, then see the first's
 * committed state. No separate advisory lock or mutex is introduced.
 */
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../database/PostgresDatabase.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { createCandidateFromSource } from '../initiative/initiativeCandidateService.js';

/**
 * Error shape for this module. Callers (route layer) should catch this and
 * map `.status` -> HTTP status, `.code` -> the `code` field in the JSON error
 * body, and may include `.details` for machine-readable context.
 *
 * Verbatim code/status pairs used by this module:
 *   - ASSESSMENT_NOT_FOUND          404  (assessment row not found for org)
 *   - OUTPUT_NOT_ACCEPTED           409  (no CURRENT accepted snapshot right now —
 *                                         covers both "never accepted" and
 *                                         "accepted then returned/reopened";
 *                                         details: { assessmentStatus, hasCurrentSnapshot })
 *   - CANDIDATE_HANDOFF_INCONSISTENT 500 (a handoff receipt exists but the
 *                                         candidate row it points at is gone —
 *                                         data-integrity anomaly, never
 *                                         silently recreated)
 */
export class CandidateHandoffError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'CandidateHandoffError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface HandoffRecord {
  id: string;
  organizationId: string;
  assessmentId: string;
  outputId: string;
  reviewId: string | null;
  candidateId: string;
  sourceType: string;
  createdBy: string;
  createdAt: string;
  sourceVersion: string | null;
  snapshotContentHash: string | null;
}

type CandidateHandoffFaultStage = 'candidate-created' | 'receipt-inserted';
let testFaultInjector: ((stage: CandidateHandoffFaultStage) => void | Promise<void>) | null = null;

/** Test-only seam used by the real-Postgres rollback acceptance test. */
export function setCandidateHandoffFaultInjectorForTests(
  injector: ((stage: CandidateHandoffFaultStage) => void | Promise<void>) | null
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  testFaultInjector = injector;
}

interface AssessmentRow {
  id: string;
  organization_id: string;
  status: string | null;
  name: string | null;
  assessment_type: string | null;
}

interface AcceptedSnapshotRow {
  id: string;
  review_id: string | null;
  snapshot_json: string | null;
  provenance_json: string | null;
  accepted_by: string;
  accepted_at: string | Date;
}

interface HandoffRow {
  id: string;
  organization_id: string;
  assessment_id: string;
  output_id: string;
  review_id: string | null;
  candidate_id: string;
  source_type: string;
  created_by: string;
  created_at: string | Date;
  source_version: string | null;
  snapshot_content_hash: string | null;
}

interface CandidateRow {
  id: string;
  title: string;
  rationale: string;
  status: string;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toHandoffRecord(row: HandoffRow): HandoffRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentId: row.assessment_id,
    outputId: row.output_id,
    reviewId: row.review_id ?? null,
    candidateId: row.candidate_id,
    sourceType: row.source_type,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    sourceVersion: row.source_version ?? null,
    snapshotContentHash: row.snapshot_content_hash ?? null,
  };
}

/**
 * Hands off an assessment's current accepted DRD output to a canonical
 * Candidate row in `initiative_candidates`. Idempotent per assessment: a
 * retry for an assessment that already has a handoff receipt returns the
 * existing candidateId (created: false) instead of creating a duplicate.
 */
export async function handoffAssessmentToCandidate(params: {
  organizationId: string;
  assessmentId: string;
  actorId: string;
}): Promise<{
  handoff: HandoffRecord;
  created: boolean;
  candidate: { id: string; title: string; rationale: string; status: string };
}> {
  const { organizationId, assessmentId, actorId } = params;

  return withPinnedPostgresTransaction(async (tx) => {
    const assessment = await tx.queryOne<AssessmentRow>(
      `SELECT id, organization_id, status, name, assessment_type
       FROM assessments
       WHERE id = ? AND organization_id = ?
       FOR UPDATE`,
      [assessmentId, organizationId]
    );
    if (!assessment) {
      throw new CandidateHandoffError('ASSESSMENT_NOT_FOUND', 404, 'Assessment not found');
    }

    const currentSnapshot = await tx.queryOne<AcceptedSnapshotRow>(
      `SELECT id, review_id, snapshot_json, provenance_json, accepted_by, accepted_at
       FROM assessment_accepted_snapshots
       WHERE organization_id = ? AND assessment_id = ? AND is_current = true
       LIMIT 1`,
      [organizationId, assessmentId]
    );

    const hasCurrentSnapshot = Boolean(currentSnapshot);
    if (assessment.status !== 'APPROVED' || !currentSnapshot) {
      throw new CandidateHandoffError(
        'OUTPUT_NOT_ACCEPTED',
        409,
        'Assessment has no current accepted output to hand off',
        { assessmentStatus: assessment.status, hasCurrentSnapshot }
      );
    }

    // Idempotency check: a receipt already exists for this assessment -> retry.
    const existingHandoff = await tx.queryOne<HandoffRow>(
      `SELECT id, organization_id, assessment_id, output_id, review_id, candidate_id, source_type, created_by, created_at,
              source_version, snapshot_content_hash
       FROM assessment_candidate_handoffs
       WHERE organization_id = ? AND assessment_id = ?`,
      [organizationId, assessmentId]
    );
    if (existingHandoff) {
      const sourceVersion = currentSnapshot.id;
      const snapshotContentHash = createHash('sha256')
        .update(currentSnapshot.snapshot_json ?? '')
        .update('\u0000')
        .update(currentSnapshot.provenance_json ?? '')
        .digest('hex');
      if (!existingHandoff.source_version || !existingHandoff.snapshot_content_hash) {
        throw new CandidateHandoffError(
          'CANDIDATE_HANDOFF_LINEAGE_MISSING',
          409,
          'Historical receipt has no immutable output hash; replay cannot infer it'
        );
      }
      if (
        existingHandoff.source_version !== sourceVersion ||
        existingHandoff.snapshot_content_hash !== snapshotContentHash
      ) {
        throw new CandidateHandoffError(
          'CANDIDATE_HANDOFF_OUTPUT_MISMATCH',
          409,
          'Receipt belongs to different accepted output bytes'
        );
      }
      const existingCandidate = await tx.queryOne<CandidateRow>(
        `SELECT id, title, rationale, status FROM initiative_candidates WHERE id = ? AND organization_id = ?`,
        [existingHandoff.candidate_id, organizationId]
      );
      if (!existingCandidate) {
        throw new CandidateHandoffError(
          'CANDIDATE_HANDOFF_INCONSISTENT',
          500,
          'Handoff receipt exists but its candidate row is missing',
          { handoffId: existingHandoff.id, candidateId: existingHandoff.candidate_id }
        );
      }
      return {
        handoff: toHandoffRecord(existingHandoff),
        created: false,
        candidate: {
          id: existingCandidate.id,
          title: existingCandidate.title,
          rationale: existingCandidate.rationale,
          status: existingCandidate.status,
        },
      };
    }

    // Fresh handoff — derive a starting title/rationale for the new
    // candidate from the assessment label + review id. This is a starting
    // draft a human edits later in the F2 Candidates panel, not a work of
    // art, so the accepted snapshot's answer/scoring content is deliberately
    // not mined for copy here.
    const assessmentLabel =
      (assessment.name && assessment.name.trim()) ||
      (assessment.assessment_type && assessment.assessment_type.trim()) ||
      assessmentId;
    const title = `Assessment: ${assessmentLabel}`;
    const reviewId = currentSnapshot.review_id ?? null;
    const sourceVersion = currentSnapshot.id;
    const snapshotContentHash = createHash('sha256')
      .update(currentSnapshot.snapshot_json ?? '')
      .update('\u0000')
      .update(currentSnapshot.provenance_json ?? '')
      .digest('hex');
    const rationale = `Promoted from accepted DRD assessment output (review ${
      reviewId ?? currentSnapshot.id
    }).`;

    const candidate = await createCandidateFromSource(tx, {
      organizationId,
      sourceType: 'assessment_accepted_output',
      sourceId: assessmentId,
      title,
      rationale,
      fitScore: 1,
      createdBy: actorId ?? null,
    });
    await testFaultInjector?.('candidate-created');

    const handoffId = uuidv4();
    const now = new Date().toISOString();
    const inserted = await tx.queryOne<HandoffRow>(
      `INSERT INTO assessment_candidate_handoffs
         (id, organization_id, assessment_id, output_id, review_id, candidate_id, source_type, created_by, created_at,
          source_version, snapshot_content_hash)
       VALUES (?, ?, ?, ?, ?, ?, 'assessment_accepted_output', ?, ?, ?, ?)
       ON CONFLICT (organization_id, assessment_id) DO NOTHING
       RETURNING *`,
      [
        handoffId,
        organizationId,
        assessmentId,
        currentSnapshot.id,
        reviewId,
        candidate.id,
        actorId,
        now,
        sourceVersion,
        snapshotContentHash,
      ]
    );
    await testFaultInjector?.('receipt-inserted');

    // Extremely unlikely race: the ON CONFLICT actually fired (someone else's
    // transaction beat us despite the FOR UPDATE lock, e.g. lock was somehow
    // bypassed). Re-select the now-authoritative row instead of failing.
    const receiptRow =
      inserted ??
      (await tx.queryOne<HandoffRow>(
        `SELECT id, organization_id, assessment_id, output_id, review_id, candidate_id, source_type, created_by, created_at,
                source_version, snapshot_content_hash
         FROM assessment_candidate_handoffs
         WHERE organization_id = ? AND assessment_id = ?`,
        [organizationId, assessmentId]
      ));
    if (!receiptRow) {
      throw new CandidateHandoffError(
        'CANDIDATE_HANDOFF_INCONSISTENT',
        500,
        'Handoff receipt insert did not return a row and none could be re-read',
        { assessmentId, candidateId: candidate.id }
      );
    }

    return {
      handoff: toHandoffRecord(receiptRow),
      created: true,
      candidate: {
        id: candidate.id,
        title: candidate.title,
        rationale: candidate.rationale,
        status: candidate.status,
      },
    };
  });
}

/**
 * Plain org-scoped read of the handoff receipt for an assessment, if any.
 * Also resolves whether an Initiative has since been created from the same
 * candidate: `acceptCandidate()` (untouched by this module) propagates the
 * candidate's own `source_type`/`source_id` onto the new Initiative row, so
 * looking up `initiatives` by that same (`assessment_accepted_output`,
 * assessmentId) pair reads the lineage back without this packet needing to
 * modify the existing accept-candidate flow at all.
 *
 * Returns null (not an error) when no handoff receipt exists yet — that is a
 * normal "not handed off yet" state, not a fault.
 */
export async function getCandidateHandoff(params: {
  organizationId: string;
  assessmentId: string;
}): Promise<(HandoffRecord & { initiativeId: string | null }) | null> {
  const { organizationId, assessmentId } = params;

  const row = await queryHelpers.queryOne<HandoffRow>(
    `SELECT * FROM assessment_candidate_handoffs WHERE organization_id = ? AND assessment_id = ?`,
    [organizationId, assessmentId]
  );
  if (!row) return null;

  const initiativeRow = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM initiatives WHERE organization_id = ? AND source_type = 'assessment_accepted_output' AND source_id = ? LIMIT 1`,
    [organizationId, assessmentId]
  );

  return {
    ...toHandoffRecord(row),
    initiativeId: initiativeRow?.id ?? null,
  };
}
