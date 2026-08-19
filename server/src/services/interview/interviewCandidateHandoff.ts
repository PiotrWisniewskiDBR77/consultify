/**
 * INT-08 — Interview (accepted submission OR accepted insight finding) →
 * canonical Candidate handoff.
 *
 * Mirrors the ASM-08 pattern exactly (same writer, same lock discipline,
 * same idempotency shape) — see `server/src/services/assessment/drdCandidateHandoff.ts`
 * for the sibling implementation this was modeled on.
 *
 * Reuses the EXISTING `initiative_candidates` table (F2 "Skrzynka
 * Kandydatów") via `createCandidateFromSource` (added for ASM-08, commit
 * e80a01eca3, cherry-picked onto this branch) — no new candidate table, no
 * parallel candidate service. Interview code never creates an Initiative
 * directly through this module; a Candidate is as far as this goes. The
 * separate, pre-existing "accept candidate -> create Initiative" flow
 * (`initiativeCandidateService.ts`'s `acceptCandidate`) is untouched and
 * will promote this Candidate on its own schedule, if a human later does so.
 *
 * Two source shapes, deliberately distinct from F2's own automatic-scan
 * source_type values ('interview_insight' | 'assessment' | 'audit' — see
 * `initiativeCandidateService.ts` `DiscoverySourceType` / `scanForCandidates`,
 * which already writes 'interview_insight' candidates for ANY
 * `interview_insights` row lacking an initiative, completely independent of
 * any manager-accept gate):
 *
 *   - 'interview_submission'      — a manager-APPROVED interview assignment.
 *     Source of truth for "accepted": `interview_assignments.status = 'approved'`
 *     (set by `InterviewController.approveAssignment`). The closest thing to
 *     an immutable snapshot is `interview_answer_history` rows with
 *     `reason = 'submission'` for that assignment (append-only, written at
 *     submit time — see `InterviewController.snapshotInterviewAnswers`) — the
 *     MOST RECENT such batch (by `saved_at`) is "the" accepted snapshot; an
 *     assignment that was sent back and resubmitted accumulates more than
 *     one batch, and a fresh manager-approve of a fresh resubmission is a
 *     legitimately NEW accepted snapshot (see `accepted_snapshot_id` below).
 *
 *   - 'interview_insight_finding' — a published, client-confirmed insight
 *     finding. Source of truth: `interview_insight_findings.review_status =
 *     'published'` AND `readback_status = 'confirmed_by_client'` (the SAME
 *     gate the existing direct-to-Initiative handoff route already uses,
 *     `server/src/routes/v8/interview-insights.routes.ts` around line 888).
 *
 * Candidate content is deliberately minimal — NOT the raw respondent answer
 * text. Submission-path candidates reference the assignment/template by
 * name only; insight-path candidates use the finding's own curated
 * `finding_statement` (an analyst-authored synthesis meant to be read, not a
 * verbatim quote dump) truncated to a short summary. This satisfies "don't
 * persist full sensitive answers in the Candidate unless needed."
 *
 * Idempotency/lineage receipt: `interview_candidate_handoffs` (migration
 * `server/migrations/20260802_int008_candidate_handoff.sql`). Unique index
 * on `(organization_id, source_type, accepted_snapshot_id)` — the hard
 * idempotency key. `accepted_snapshot_id` is a composite string identifying
 * the SPECIFIC accepted version being handed off, so a retry of the exact
 * same accepted snapshot returns the same candidateId, while a genuinely
 * new accepted snapshot (e.g. resubmit -> re-approve) is allowed to become a
 * new candidate.
 *
 * Every mutating operation is serialized per source row with
 * `SELECT ... FOR UPDATE` inside `withPinnedPostgresTransaction` — the same
 * mechanism `drdQualityReview.ts`/`drdCandidateHandoff.ts` already use. No
 * separate advisory lock or mutex is introduced.
 *
 * INT-BVP-001 (exactly-one-candidate hardening, migration
 * `20260910_claude_a_interview_candidate_exactly_once.sql`): `source_type`
 * strings alone can never unify this module's 'interview_insight_finding'
 * writes with the independent, unconditioned `scanForCandidates` writer's
 * 'interview_insight' writes (initiativeCandidateService.ts — OUTSIDE this
 * module's lease). The two use DIFFERENT id domains for `source_id` (a
 * FINDING id here vs an INSIGHT id there), so a plain unique index on
 * (source_type, source_id) would never catch the cross-path duplicate. The
 * shared business identity is the INSIGHT id
 * (`interview_insight_findings.insight_id` here, `interview_insights.id`
 * there), so for the 'insight_finding' kind this module now writes the
 * CANDIDATE row's `source_id` as the INSIGHT id, not the finding id — see
 * `candidateSourceId` in `approveInterviewCandidateHandoff` below. The
 * RECEIPT's own `source_id` column (`interview_candidate_handoffs`) is left
 * unchanged (still the finding id) because
 * `routes/interviewCandidateHandoff.routes.ts` looks receipts up by
 * findingId. A partial unique index on
 * `initiative_candidates(organization_id, source_id)` scoped to
 * `source_type IN ('interview_insight','interview_insight_finding') AND
 * status <> 'dismissed'` then binds BOTH writers without editing the
 * out-of-lease scan writer at all. `createCandidateFromSource` has no ON
 * CONFLICT clause (deliberately fail-closed for its normal callers), so a
 * losing insert here is caught via a SAVEPOINT (Postgres 25P02-safe — same
 * pattern `roiCaseCommands.ts`/`okrSetCommands.ts` already use) and resolved
 * to the winning candidate instead of failing the handoff or creating a
 * duplicate.
 */
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../database/PostgresDatabase.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  createCandidateFromSource,
  type CandidateDb,
} from '../initiative/initiativeCandidateService.js';

import { canonicalStatusToken } from './interviewStatusNormalization.js';

export type InterviewCandidateSourceType = 'interview_submission' | 'interview_insight_finding';

export type InterviewCandidateSource =
  | { kind: 'submission'; assignmentId: string }
  | { kind: 'insight_finding'; findingId: string };

/**
 * Error shape for this module. Callers (route layer) should catch this and
 * map `.status` -> HTTP status, `.code` -> the `code` field in the JSON
 * error body, and may include `.details`.
 *
 * Verbatim code/status pairs used by this module:
 *   - SUBMISSION_NOT_FOUND   404  (assignment not found for this org)
 *   - FINDING_NOT_FOUND      404  (finding not found for this org)
 *   - SUBMISSION_NOT_ACCEPTED 409 (assignment.status !== 'approved', or no
 *                                  submission snapshot exists; details:
 *                                  { assignmentStatus, hasSubmissionSnapshot })
 *   - FINDING_NOT_ACCEPTED    409 (finding not published+confirmed; details:
 *                                  { reviewStatus, readbackStatus })
 *   - HANDOFF_INCONSISTENT    500 (a handoff receipt exists but its
 *                                  candidate row is gone — data-integrity
 *                                  anomaly, never silently recreated)
 */
export class InterviewCandidateHandoffError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'InterviewCandidateHandoffError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface InterviewHandoffRecord {
  id: string;
  organizationId: string;
  sourceType: InterviewCandidateSourceType;
  sourceId: string;
  interviewSessionId: string | null;
  submissionId: string | null;
  insightId: string | null;
  acceptedSnapshotId: string;
  candidateId: string;
  createdBy: string;
  createdAt: string;
  sourceVersion: string | null;
  snapshotContentHash: string | null;
}

type CandidateHandoffFaultStage = 'candidate-created' | 'receipt-inserted';
let testFaultInjector: ((stage: CandidateHandoffFaultStage) => void | Promise<void>) | null = null;

/** Test-only seam used by the real-Postgres rollback acceptance test. */
export function setInterviewCandidateHandoffFaultInjectorForTests(
  injector: ((stage: CandidateHandoffFaultStage) => void | Promise<void>) | null
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  testFaultInjector = injector;
}

interface AssignmentRow {
  id: string;
  organization_id: string;
  status: string | null;
  session_id: string | null;
  template_id: string | null;
}

interface SubmissionSnapshotRow {
  saved_at: string | Date;
}

interface SubmissionSnapshotEntryRow {
  id: string;
  question_id: string;
  answer_text: string | null;
}

interface FindingRow {
  id: string;
  organization_id: string;
  insight_id: string;
  finding_statement: string;
  review_status: string | null;
  readback_status: string | null;
  updated_at: string | Date;
}

interface HandoffRow {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string;
  interview_session_id: string | null;
  submission_id: string | null;
  insight_id: string | null;
  accepted_snapshot_id: string;
  candidate_id: string;
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

// Postgres reports a unique-index violation as error code '23505'. The
// SQLite driver used elsewhere in the repo's unit tests reports
// 'SQLITE_CONSTRAINT' for the same condition — matching both mirrors
// ToolController.ts's `isUniqueViolation` convention so this helper stays
// usable regardless of backend, even though the DoD evidence for this fix
// is real-Postgres only.
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return code === '23505' || code === 'SQLITE_CONSTRAINT';
}

function toHandoffRecord(row: HandoffRow): InterviewHandoffRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceType: row.source_type as InterviewCandidateSourceType,
    sourceId: row.source_id,
    interviewSessionId: row.interview_session_id ?? null,
    submissionId: row.submission_id ?? null,
    insightId: row.insight_id ?? null,
    acceptedSnapshotId: row.accepted_snapshot_id,
    candidateId: row.candidate_id,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    sourceVersion: row.source_version ?? null,
    snapshotContentHash: row.snapshot_content_hash ?? null,
  };
}

/**
 * Resolves the (sourceType, gate-checked-eligible, snapshot identity, draft
 * title/rationale) tuple for a handoff source — shared by both the
 * read-only preview and the mutating approve path so they can never
 * disagree about what "eligible" means. Runs on whichever query client is
 * passed (a pinned tx for the mutating path, plain `queryHelpers` for the
 * read-only preview) — MUST use `FOR UPDATE` when called with a tx so the
 * mutating path serializes correctly; the preview path passes no tx and
 * gets a plain (non-locking) read.
 */
async function resolveEligibleSource(
  db: Pick<CandidateDb, 'queryOne' | 'queryAll'>,
  organizationId: string,
  source: InterviewCandidateSource,
  opts: { forUpdate: boolean }
): Promise<{
  sourceType: InterviewCandidateSourceType;
  sourceId: string;
  interviewSessionId: string | null;
  submissionId: string | null;
  insightId: string | null;
  acceptedSnapshotId: string;
  sourceVersion: string;
  snapshotContentHash: string;
  title: string;
  rationale: string;
}> {
  const lockClause = opts.forUpdate ? ' FOR UPDATE' : '';

  if (source.kind === 'submission') {
    const assignment = await db.queryOne<AssignmentRow>(
      `SELECT id, organization_id, status, session_id, template_id
       FROM interview_assignments
       WHERE id = ? AND organization_id = ?${lockClause}`,
      [source.assignmentId, organizationId]
    );
    if (!assignment) {
      throw new InterviewCandidateHandoffError('SUBMISSION_NOT_FOUND', 404, 'Assignment not found');
    }

    // The most recent immutable submission batch for this assignment.
    const latestSubmission = await db.queryOne<SubmissionSnapshotRow>(
      `SELECT saved_at FROM interview_answer_history
       WHERE organization_id = ? AND assignment_id = ? AND reason = 'submission'
       ORDER BY saved_at DESC LIMIT 1`,
      [organizationId, source.assignmentId]
    );
    const hasSubmissionSnapshot = Boolean(latestSubmission);

    // M03R-004: porównanie odporne na wielkość liter — w danych istnieje
    // `SUBMITTED` obok `submitted`, więc dosłowne `!==` odrzucałoby część
    // poprawnie zatwierdzonych zgłoszeń jako niezaakceptowane.
    if (canonicalStatusToken(assignment.status) !== 'approved' || !hasSubmissionSnapshot) {
      throw new InterviewCandidateHandoffError(
        'SUBMISSION_NOT_ACCEPTED',
        409,
        'Assignment has no accepted (approved + submitted) output to hand off',
        { assignmentStatus: assignment.status, hasSubmissionSnapshot }
      );
    }

    // M03R-002 — nazwa szablonu czytana z KANONICZNEGO rejestru (library).
    //
    // Do 2026-08-04 to zapytanie szło do legacy `interview_templates`, podczas
    // gdy `interview_assignments.template_id` wskazuje w 114 na 117 przypadków
    // (demo, 2026-08-04) na `interview_library_templates` — a `InterviewAssignmentService`
    // już wcześniej joinował do library. Skutek był cichy: `template` wychodziło
    // `null`, `label` spadał na `assignment.id` i tytuł kandydata brzmiał
    // „Interview submission: <uuid>" zamiast nazwy szablonu. Nic nie rzucało
    // błędu, bo fallback jest poprawny składniowo.
    //
    // Fallback do legacy zostaje do czasu wygaszenia starego rejestru — dotyczy
    // dziś 3 wierszy (plan retirement: docs/.../M03_TEMPLATE_REGISTRY_RETIREMENT).
    const template = assignment.template_id
      ? ((await db.queryOne<{ name: string | null }>(
          `SELECT name FROM interview_library_templates WHERE id = ?`,
          [assignment.template_id]
        )) ??
        (await db.queryOne<{ name: string | null }>(
          `SELECT name FROM interview_templates WHERE id = ?`,
          [assignment.template_id]
        )))
      : null;

    const acceptedSnapshotId = `${assignment.id}:${toIsoString(latestSubmission!.saved_at)}`;
    const snapshotEntries = await db.queryAll<SubmissionSnapshotEntryRow>(
      `SELECT id, question_id, answer_text FROM interview_answer_history
       WHERE organization_id = ? AND assignment_id = ? AND reason = 'submission' AND saved_at = ?
       ORDER BY question_id, id`,
      [organizationId, assignment.id, latestSubmission!.saved_at]
    );
    const snapshotContentHash = createHash('sha256')
      .update(JSON.stringify(snapshotEntries))
      .digest('hex');
    const label = (template?.name && template.name.trim()) || assignment.id;

    return {
      sourceType: 'interview_submission',
      sourceId: assignment.id,
      interviewSessionId: assignment.session_id ?? null,
      submissionId: acceptedSnapshotId,
      insightId: null,
      acceptedSnapshotId,
      sourceVersion: acceptedSnapshotId,
      snapshotContentHash,
      title: `Interview submission: ${label}`,
      rationale: `Promoted from an approved interview submission (assignment ${assignment.id}).`,
    };
  }

  // source.kind === 'insight_finding'
  const finding = await db.queryOne<FindingRow>(
    `SELECT id, organization_id, insight_id, finding_statement, review_status, readback_status, updated_at
     FROM interview_insight_findings
     WHERE id = ? AND organization_id = ?${lockClause}`,
    [source.findingId, organizationId]
  );
  if (!finding) {
    throw new InterviewCandidateHandoffError('FINDING_NOT_FOUND', 404, 'Insight finding not found');
  }

  const isAccepted =
    finding.review_status === 'published' && finding.readback_status === 'confirmed_by_client';
  if (!isAccepted) {
    throw new InterviewCandidateHandoffError(
      'FINDING_NOT_ACCEPTED',
      409,
      'Insight finding is not published and client-confirmed',
      { reviewStatus: finding.review_status, readbackStatus: finding.readback_status }
    );
  }

  const acceptedSnapshotId = `${finding.insight_id}:${finding.id}:${toIsoString(finding.updated_at)}`;
  const snapshotContentHash = createHash('sha256')
    .update(
      JSON.stringify({
        id: finding.id,
        insightId: finding.insight_id,
        statement: finding.finding_statement,
        reviewStatus: finding.review_status,
        readbackStatus: finding.readback_status,
        updatedAt: toIsoString(finding.updated_at),
      })
    )
    .digest('hex');
  const statement = (finding.finding_statement || '').trim();
  const summary = statement.length > 160 ? `${statement.slice(0, 157)}...` : statement;

  return {
    sourceType: 'interview_insight_finding',
    sourceId: finding.id,
    interviewSessionId: null,
    submissionId: null,
    insightId: finding.insight_id,
    acceptedSnapshotId,
    sourceVersion: acceptedSnapshotId,
    snapshotContentHash,
    title: summary ? `Interview insight: ${summary}` : `Interview insight finding ${finding.id}`,
    rationale: `Promoted from a published, client-confirmed interview insight finding (${finding.id}).`,
  };
}

/**
 * Read-only "Candidate preview" — computes what the Candidate would look
 * like WITHOUT persisting anything. Runs the exact same eligibility gate as
 * `approveInterviewCandidateHandoff` (same function, same errors), so a
 * manager previewing sees precisely what approving would do. Also reports
 * whether a handoff already exists for this exact accepted snapshot (so the
 * UI can show "already approved" instead of a misleading fresh preview).
 */
export async function previewInterviewCandidate(params: {
  organizationId: string;
  source: InterviewCandidateSource;
}): Promise<{
  sourceType: InterviewCandidateSourceType;
  sourceId: string;
  acceptedSnapshotId: string;
  sourceVersion: string;
  snapshotContentHash: string;
  title: string;
  rationale: string;
  alreadyHandedOff: boolean;
  existingCandidateId: string | null;
}> {
  const resolved = await resolveEligibleSource(queryHelpers, params.organizationId, params.source, {
    forUpdate: false,
  });

  const existing = await queryHelpers.queryOne<HandoffRow>(
    `SELECT * FROM interview_candidate_handoffs WHERE organization_id = ? AND source_type = ? AND accepted_snapshot_id = ?`,
    [params.organizationId, resolved.sourceType, resolved.acceptedSnapshotId]
  );

  return {
    sourceType: resolved.sourceType,
    sourceId: resolved.sourceId,
    acceptedSnapshotId: resolved.acceptedSnapshotId,
    sourceVersion: resolved.sourceVersion,
    snapshotContentHash: resolved.snapshotContentHash,
    title: resolved.title,
    rationale: resolved.rationale,
    alreadyHandedOff: Boolean(existing),
    existingCandidateId: existing?.candidate_id ?? null,
  };
}

/**
 * The "jawne zatwierdzenie" (explicit approval) — creates the Candidate +
 * receipt. Idempotent per (org, source_type, accepted_snapshot_id): a retry
 * for the SAME accepted snapshot returns the existing candidateId
 * (created: false) instead of creating a duplicate.
 */
export async function approveInterviewCandidateHandoff(params: {
  organizationId: string;
  actorId: string;
  source: InterviewCandidateSource;
}): Promise<{
  handoff: InterviewHandoffRecord;
  created: boolean;
  candidate: { id: string; title: string; rationale: string; status: string };
}> {
  const { organizationId, actorId, source } = params;

  return withPinnedPostgresTransaction(async (tx) => {
    // Server-derived title/rationale/snapshot identity — NEVER trust a
    // client-supplied preview payload for the actual write.
    const resolved = await resolveEligibleSource(tx, organizationId, source, { forUpdate: true });

    const existingHandoff = await tx.queryOne<HandoffRow>(
      `SELECT * FROM interview_candidate_handoffs
       WHERE organization_id = ? AND source_type = ? AND accepted_snapshot_id = ?`,
      [organizationId, resolved.sourceType, resolved.acceptedSnapshotId]
    );
    if (existingHandoff) {
      if (!existingHandoff.source_version || !existingHandoff.snapshot_content_hash) {
        throw new InterviewCandidateHandoffError(
          'HANDOFF_LINEAGE_MISSING',
          409,
          'Historical receipt has no immutable snapshot hash; replay cannot infer it'
        );
      }
      if (
        existingHandoff.source_version !== resolved.sourceVersion ||
        existingHandoff.snapshot_content_hash !== resolved.snapshotContentHash
      ) {
        throw new InterviewCandidateHandoffError(
          'HANDOFF_SOURCE_MISMATCH',
          409,
          'Receipt belongs to different source bytes'
        );
      }
      const existingCandidate = await tx.queryOne<CandidateRow>(
        `SELECT id, title, rationale, status FROM initiative_candidates WHERE id = ? AND organization_id = ?`,
        [existingHandoff.candidate_id, organizationId]
      );
      if (!existingCandidate) {
        throw new InterviewCandidateHandoffError(
          'HANDOFF_INCONSISTENT',
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

    // INT-BVP-001 shared-key dedupe (see header comment): for the
    // 'insight_finding' kind, write the CANDIDATE's own source_id as the
    // INSIGHT id (not the finding id) so it lands in the same identity
    // domain scanForCandidates uses for its 'interview_insight' writes.
    // For 'submission', resolved.insightId is always null, so this is
    // byte-for-byte the previous behavior (falls back to resolved.sourceId).
    const candidateSourceId = resolved.insightId ?? resolved.sourceId;
    const sharesInsightDedupeDomain = resolved.sourceType === 'interview_insight_finding';

    let candidate: { id: string; title: string; rationale: string; status: string };
    let createdCandidate: boolean;

    if (sharesInsightDedupeDomain) {
      // `createCandidateFromSource` has no ON CONFLICT clause (it is
      // deliberately fail-closed for its normal single-record callers), so
      // a concurrent or earlier scanForCandidates() write — or a racing
      // call to this same function for a sibling finding on the same
      // insight — holding `uq_initiative_candidates_interview_insight_once`
      // surfaces here as a plain Postgres 23505. A SAVEPOINT is required to
      // recover cleanly: without one, Postgres aborts the WHOLE transaction
      // on the unique violation and the retry SELECT below would itself
      // fail with 25P02 (transaction aborted) — see roiCaseCommands.ts's
      // identical, previously-verified pattern.
      await tx.queryRun('SAVEPOINT interview_candidate_insight_dedupe');
      try {
        candidate = await createCandidateFromSource(tx, {
          organizationId,
          sourceType: resolved.sourceType,
          sourceId: candidateSourceId,
          title: resolved.title,
          rationale: resolved.rationale,
          fitScore: 1,
          createdBy: actorId,
        });
        await tx.queryRun('RELEASE SAVEPOINT interview_candidate_insight_dedupe');
        createdCandidate = true;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        await tx.queryRun('ROLLBACK TO SAVEPOINT interview_candidate_insight_dedupe');
        const winner = await tx.queryOne<CandidateRow>(
          `SELECT id, title, rationale, status FROM initiative_candidates
           WHERE organization_id = ? AND source_id = ?
             AND source_type IN ('interview_insight', 'interview_insight_finding')
             AND status <> 'dismissed'
           LIMIT 1`,
          [organizationId, candidateSourceId]
        );
        if (!winner) {
          throw new InterviewCandidateHandoffError(
            'HANDOFF_INCONSISTENT',
            500,
            'Unique violation on the shared insight candidate slot but no winning candidate row could be found',
            { organizationId, candidateSourceId }
          );
        }
        candidate = winner;
        createdCandidate = false;
      }
    } else {
      candidate = await createCandidateFromSource(tx, {
        organizationId,
        sourceType: resolved.sourceType,
        sourceId: candidateSourceId,
        title: resolved.title,
        rationale: resolved.rationale,
        fitScore: 1,
        createdBy: actorId,
      });
      createdCandidate = true;
    }
    await testFaultInjector?.('candidate-created');

    const handoffId = uuidv4();
    const now = new Date().toISOString();
    const inserted = await tx.queryOne<HandoffRow>(
      `INSERT INTO interview_candidate_handoffs
         (id, organization_id, source_type, source_id, interview_session_id, submission_id, insight_id, accepted_snapshot_id, candidate_id, created_by, created_at,
          source_version, snapshot_content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, source_type, accepted_snapshot_id) DO NOTHING
       RETURNING *`,
      [
        handoffId,
        organizationId,
        resolved.sourceType,
        resolved.sourceId,
        resolved.interviewSessionId,
        resolved.submissionId,
        resolved.insightId,
        resolved.acceptedSnapshotId,
        candidate.id,
        actorId,
        now,
        resolved.sourceVersion,
        resolved.snapshotContentHash,
      ]
    );
    await testFaultInjector?.('receipt-inserted');

    const receiptRow =
      inserted ??
      (await tx.queryOne<HandoffRow>(
        `SELECT * FROM interview_candidate_handoffs WHERE organization_id = ? AND source_type = ? AND accepted_snapshot_id = ?`,
        [organizationId, resolved.sourceType, resolved.acceptedSnapshotId]
      ));
    if (!receiptRow) {
      throw new InterviewCandidateHandoffError(
        'HANDOFF_INCONSISTENT',
        500,
        'Handoff receipt insert did not return a row and none could be re-read',
        { candidateId: candidate.id }
      );
    }

    return {
      handoff: toHandoffRecord(receiptRow),
      // Previously always `true` here (this branch is reached only when no
      // handoff RECEIPT existed yet). Now reflects whether a NEW candidate
      // row was actually inserted: a receipt is always freshly created in
      // this branch, but INT-BVP-001's shared-key dedupe can resolve the
      // candidate itself to an existing row created by the other path (or
      // a sibling finding on the same insight) — `false` in that case,
      // consistent with the existingHandoff branch above.
      created: createdCandidate,
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
 * Plain org-scoped read of the handoff receipt for a given source, if any.
 * Also resolves whether an Initiative has since been created from the same
 * candidate: `acceptCandidate()` (untouched by this module) propagates the
 * candidate's own `source_type`/`source_id` onto the new Initiative row
 * (same mechanism ASM-08 relies on), so looking up `initiatives` by that
 * same pair reads the lineage back without this module needing to modify
 * the existing accept-candidate flow at all.
 *
 * Returns null (not an error) when no handoff receipt exists yet.
 */
export async function getInterviewCandidateHandoff(params: {
  organizationId: string;
  sourceType: InterviewCandidateSourceType;
  sourceId: string;
}): Promise<(InterviewHandoffRecord & { initiativeId: string | null }) | null> {
  const { organizationId, sourceType, sourceId } = params;

  const row = await queryHelpers.queryOne<HandoffRow>(
    `SELECT * FROM interview_candidate_handoffs WHERE organization_id = ? AND source_type = ? AND source_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, sourceType, sourceId]
  );
  if (!row) return null;

  // `acceptCandidate()` (untouched, existing flow) propagates the
  // CANDIDATE's OWN source_type/source_id onto the Initiative it creates.
  // Read those directly off the candidate row (via `row.candidate_id`)
  // rather than reusing this receipt's own source_id: INT-BVP-001's
  // shared-insight dedupe (see this file's header comment) makes the
  // candidate's `source_id` differ from the receipt's `source_id` for the
  // 'interview_insight_finding' kind — the candidate uses the INSIGHT id,
  // while the receipt deliberately keeps the FINDING id (so
  // routes/interviewCandidateHandoff.routes.ts's findingId lookups keep
  // working). Joining through the candidate is the only value guaranteed
  // to match what acceptCandidate() actually copied onto the Initiative.
  const candidateRow = await queryHelpers.queryOne<{
    source_type: string | null;
    source_id: string | null;
  }>(
    `SELECT source_type, source_id FROM initiative_candidates WHERE id = ? AND organization_id = ?`,
    [row.candidate_id, organizationId]
  );

  const initiativeRow =
    candidateRow?.source_type && candidateRow?.source_id
      ? await queryHelpers.queryOne<{ id: string }>(
          `SELECT id FROM initiatives WHERE organization_id = ? AND source_type = ? AND source_id = ? LIMIT 1`,
          [organizationId, candidateRow.source_type, candidateRow.source_id]
        )
      : null;

  return {
    ...toHandoffRecord(row),
    initiativeId: initiativeRow?.id ?? null,
  };
}
