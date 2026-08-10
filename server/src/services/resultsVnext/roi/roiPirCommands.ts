/**
 * ROI-E006 — PIR & Learning command layer.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §4, Decisions D1-D19.
 * Schema: server/migrations/20260819_rvn_roi_pir_learning.sql.
 *
 * Closes the Case's entire lifecycle: `benefits_realization ->
 * post_investment_review_due -> post_investment_review -> closed`.
 *
 * `markRoiCasePostInvestmentReviewDue` is the FIRST real caller of
 * `completeObligation` anywhere in this entire program (Decision D5) — it
 * closes ROI-E005's `confirm_benefits_realization` obligation and opens a
 * new, distinct `conduct_post_investment_review` obligation, both on the
 * SAME pinned client/transaction as the status write.
 *
 * `startRoiCasePostInvestmentReview` freezes the review snapshot AT REVIEWER
 * START (AC-02's literal tense, Decision D7) — pointer IDs plus a frozen
 * copy of the compare/benefits-realization views and all Variances (Decision
 * D8), reusing `getRoiCaseCompareView`/`getRoiCaseBenefitsRealizationView`/
 * `listVariances` verbatim rather than reimplementing them. Narrative
 * content (`outcome`/`lessonsLearned`/`recommendation`) stays editable while
 * `status='draft'`; `closeRoiCase` is the second, separate freeze (AC-03),
 * gated on open-variance resolution-or-waiver, PIR completeness, and D6's
 * self-close denial (checked BEFORE any write).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import { completeObligation, createObligation } from '../platform/obligations.js';

import { CONFIRM_BENEFITS_REALIZATION_OBLIGATION_TYPE } from './roiBenefitsRealizationCommands.js';
import { getRoiCaseBenefitsRealizationView } from './roiBenefitsRealizationRepository.js';
import { getRoiCaseCompareView } from './roiCompareRepository.js';
import { ROI_EVENT_SOURCE, RoiCaseValidationError } from './roiCaseCommands.js';
import { listVariances } from './roiVarianceRepository.js';
import {
  toRoiPostInvestmentReview,
  type RoiPirOutcome,
  type RoiPirReviewSnapshotPayload,
  type RoiPirTeresaDraftDisposition,
  type RoiPostInvestmentReview,
  type RoiPostInvestmentReviewRow,
} from './roiPirTypes.js';
import { toRoiCase, type RoiCase, type RoiCaseRow, type RoiCaseStatus } from './roiTypes.js';

// ==========================================
// SHARED CONSTANTS
// ==========================================

/** Design §4.2, Decision D5: obligation type created by
 * `markRoiCasePostInvestmentReviewDue`, completed by `closeRoiCase`. No
 * source doc names the exact string — a reasonable, explicitly flagged
 * choice mirroring `CONFIRM_BENEFITS_REALIZATION_OBLIGATION_TYPE`'s own
 * naming convention, not a guess presented as fact. */
export const CONDUCT_PIR_OBLIGATION_TYPE = 'conduct_post_investment_review';

/** Decision D3: the two statuses `scheduleRoiCasePostInvestmentReview` may
 * be called from — advisory metadata only, no status change. */
const SCHEDULABLE_STATUSES: readonly RoiCaseStatus[] = ['tracking', 'benefits_realization'];

// ==========================================
// ERRORS
// ==========================================

/** Generic PIR-row guard/precondition failure — mirrors
 * `RoiCaseValidationError`'s/`RoiVarianceValidationError`'s role for their
 * own aggregates. Used for: draft-not-editable, AC-03's
 * `OPEN_VARIANCES_UNRESOLVED`/`PIR_INCOMPLETE` closure gates, and AC-06's
 * `FINAL_LESSONS_TEXT_REQUIRED` disposition guard. */
export class RoiPirValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_PIR_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiPirValidationError';
    this.code = code;
    this.details = details;
  }
}

/** `closeRoiCase` found no active `status='draft'` PIR row for the case —
 * internal-invariant violation (a case cannot reach `post_investment_review`
 * without `startRoiCasePostInvestmentReview` having inserted exactly one),
 * should be unreachable in normal operation. Mapped to 404. */
export class RoiPirNotFoundError extends Error {
  code = 'PIR_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(caseId: string) {
    super(`ROI case ${caseId} has no active draft post-investment review`);
    this.name = 'RoiPirNotFoundError';
    this.details = { caseId };
  }
}

/** Decision D6 (maker-checker) — `closeRoiCase` denies when the closer is
 * also the PIR's own `started_by`. Checked BEFORE any write (design §4.6
 * step 3). Mapped to 403, same slot `RoiSelfApprovalDeniedError`/
 * `RoiActualSelfVerificationDeniedError` occupy. */
export class RoiPirSelfCloseDeniedError extends Error {
  code = 'PIR_SELF_CLOSE_DENIED';
  details: Record<string, unknown>;
  constructor(caseId: string, pirId: string, actorUserId: string) {
    super(
      `ROI case ${caseId} PIR ${pirId} cannot be closed by ${actorUserId} — the actor who started the review may not also close the case (maker-checker)`
    );
    this.name = 'RoiPirSelfCloseDeniedError';
    this.details = { caseId, pirId, actorUserId };
  }
}

// ==========================================
// SHARED ROW LOADERS
// ==========================================

async function loadRoiCaseForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<RoiCaseRow | undefined> {
  const result = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return result.rows[0];
}

function caseRowVersion(row: RoiCaseRow): number {
  return row.row_version;
}

async function loadRoiPirForUpdate(
  client: PoolClient,
  pirId: string,
  organizationId: string
): Promise<RoiPostInvestmentReviewRow | undefined> {
  const result = await client.query<RoiPostInvestmentReviewRow>(
    `SELECT * FROM rvn_roi_post_investment_reviews WHERE pir_id = $1 AND organization_id = $2 FOR UPDATE`,
    [pirId, organizationId]
  );
  return result.rows[0];
}

function pirRowVersion(row: RoiPostInvestmentReviewRow): number {
  return row.row_version;
}

// ==========================================
// scheduleRoiCasePostInvestmentReview (D3/D4)
// ==========================================

export interface ScheduleRoiCasePostInvestmentReviewInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  /** ISO date/time — the scheduled checkpoint. Set once; left as a
   * historical record thereafter (Decision D4 — never overwritten by
   * `markRoiCasePostInvestmentReviewDue`/`closeRoiCase`). */
  nextReviewAt: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Advisory metadata only — no status change (Decision D3). Guard:
 * `fromStatuses: ['tracking', 'benefits_realization']`. Sets
 * `next_review_at`/`next_action_type='post_investment_review'`/
 * `next_action_due_at` (mirrors `next_review_at` at schedule time — Decision
 * D4's rolling "what's next" pointer). No obligation write.
 */
export async function scheduleRoiCasePostInvestmentReview(
  input: ScheduleRoiCasePostInvestmentReviewInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    nextReviewAt,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!SCHEDULABLE_STATUSES.includes(currentRow.status)) {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — a post-investment review may only be scheduled from "tracking" or "benefits_realization"`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status }
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET next_review_at = $1, next_action_type = 'post_investment_review', next_action_due_at = $1,
                row_version = $2, updated_by = $3, updated_at = now()
          WHERE case_id = $4
          RETURNING *`,
        [nextReviewAt, nextVersion, actorUserId, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[scheduleRoiCasePostInvestmentReview] update returned no row for ${caseId}`);
      }
      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.post_investment_review_scheduled',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// markRoiCasePostInvestmentReviewDue (AC-01, Decision D5)
// ==========================================

export interface MarkRoiCasePostInvestmentReviewDueInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Guard: `status === 'benefits_realization'`. Same transaction as the status
 * write (Decision D5): (1) `completeObligation` closes ROI-E005's
 * `confirm_benefits_realization` obligation — the FIRST real caller of
 * `completeObligation` anywhere in this program; (2) `createObligation`
 * opens a distinct new `conduct_post_investment_review` obligation, assigned
 * to the case owner, due at `next_review_at` (whatever
 * `scheduleRoiCasePostInvestmentReview` last set it to, or `null` if never
 * scheduled).
 */
export async function markRoiCasePostInvestmentReviewDue(
  input: MarkRoiCasePostInvestmentReviewDueInput
): Promise<AtomicCommandOutcome<RoiCase>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, RoiCase>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'benefits_realization') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only a "benefits_realization" case may be marked PIR-due`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status, toStatus: 'post_investment_review_due' }
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      const updateResult = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'post_investment_review_due', next_action_type = 'conduct_post_investment_review',
                row_version = $1, updated_by = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, caseId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[markRoiCasePostInvestmentReviewDue] update returned no row for ${caseId}`);
      }

      // Decision D5 — first real completeObligation call site in this
      // program. A retried command (idempotency-key replay) matches zero
      // rows the second time, which is the expected harmless no-op.
      await completeObligation(client, {
        organizationId,
        referenceType: 'roi_case',
        referenceId: caseId,
        obligationType: CONFIRM_BENEFITS_REALIZATION_OBLIGATION_TYPE,
        completedViaCommand: 'markRoiCasePostInvestmentReviewDue',
      });

      await createObligation(client, {
        organizationId,
        assigneeUserId: currentRow.owner_user_id,
        referenceType: 'roi_case',
        referenceId: caseId,
        aggregateVersionAtCreation: nextVersion,
        obligationType: CONDUCT_PIR_OBLIGATION_TYPE,
        dueAt: currentRow.next_review_at,
        deduplicationKey: `${organizationId}:roi_case:${caseId}:${CONDUCT_PIR_OBLIGATION_TYPE}`,
      });

      return toRoiCase(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.post_investment_review_due',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// startRoiCasePostInvestmentReview (AC-02, D7/D8)
// ==========================================

export interface StartRoiCasePostInvestmentReviewInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface StartRoiCasePostInvestmentReviewResult {
  case: RoiCase;
  pir: RoiPostInvestmentReview;
}

/**
 * Guard: `status === 'post_investment_review_due'`. Freezes the review
 * snapshot AT REVIEWER START (Decision D7 — narrative fields freeze
 * separately, later, at `closeRoiCase`). Decision D8: the frozen payload is
 * pointer IDs plus a frozen copy of the compare/benefits-realization views
 * and all Variances — reuses `getRoiCaseCompareView`/
 * `getRoiCaseBenefitsRealizationView`/`listVariances` verbatim (read-only),
 * never the full multi-KB ApprovalSnapshot payload.
 */
export async function startRoiCasePostInvestmentReview(
  input: StartRoiCasePostInvestmentReviewInput
): Promise<AtomicCommandOutcome<StartRoiCasePostInvestmentReviewResult>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, StartRoiCasePostInvestmentReviewResult>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'post_investment_review_due') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only a "post_investment_review_due" case may start its post-investment review`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status, toStatus: 'post_investment_review' }
        );
      }

      // Internal-invariant check (design §4.3 step 2): a case cannot reach
      // 'post_investment_review_due' without having passed through
      // 'approved' -> 'tracking' first, which requires a
      // latest_approved_snapshot_id — should be unreachable. Fail loudly
      // rather than freeze a payload with no approved baseline.
      if (!currentRow.latest_approved_snapshot_id) {
        throw new Error(
          `[startRoiCasePostInvestmentReview] ROI case ${caseId} has no latest_approved_snapshot_id — internal invariant violated`
        );
      }

      beforeState = { case: toRoiCase(currentRow) };

      // Design §4.3 step 3 (D8) — reused verbatim, read-only. Each of these
      // acquires its own pooled connection (not the pinned transactional
      // client) — safe here: the case row is FOR UPDATE-locked for the
      // whole transaction, and every value these reads pull (the approval
      // snapshot pinned by latest_approved_snapshot_id, the Forecast/Actual
      // rows pinned by the case's own pointer columns, and the Variance
      // rows) is either already-immutable or a plain live read whose
      // CURRENT value is exactly what "freeze at reviewer start" means to
      // capture.
      const [compareView, benefitsRealizationView, variances] = await Promise.all([
        getRoiCaseCompareView({ userId: actorUserId, organizationId, caseId }),
        getRoiCaseBenefitsRealizationView({ userId: actorUserId, organizationId, caseId }),
        listVariances({ userId: actorUserId, organizationId, caseId }),
      ]);
      if (!compareView || !benefitsRealizationView) {
        throw new Error(
          `[startRoiCasePostInvestmentReview] ROI case ${caseId} compare/benefits-realization view returned null while its own row is locked — internal invariant violated`
        );
      }

      const reviewSnapshotPayload: RoiPirReviewSnapshotPayload = {
        caseId,
        latestApprovedSnapshotId: currentRow.latest_approved_snapshot_id,
        currentForecastVersionId: currentRow.current_forecast_version_id,
        currentActualSnapshotId: currentRow.current_actual_snapshot_id,
        compareView,
        benefitsRealizationView,
        variances,
      };
      // Fixed key order (object literal above, never reconstructed from a
      // Postgres JSONB round-trip) — computeStateHash is only ever called
      // on THIS in-memory object, once, before the INSERT below.
      const reviewSnapshotHash = computeStateHash(reviewSnapshotPayload as unknown as Record<string, unknown>);

      // Design §4.3 step 5 — safe under the case row's own FOR UPDATE lock:
      // no concurrent startRoiCasePostInvestmentReview call for this case
      // can interleave with this SELECT+INSERT pair.
      const seqResult = await client.query<{ next_seq: string }>(
        `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq FROM rvn_roi_post_investment_reviews WHERE case_id = $1`,
        [caseId]
      );
      const sequenceNumber = Number(seqResult.rows[0]?.next_seq ?? 1);

      const pirInsert = await client.query<RoiPostInvestmentReviewRow>(
        `INSERT INTO rvn_roi_post_investment_reviews
           (case_id, organization_id, sequence_number, status, started_by, review_snapshot_payload, review_snapshot_hash, created_by)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6, $4)
         RETURNING *`,
        [caseId, organizationId, sequenceNumber, actorUserId, JSON.stringify(reviewSnapshotPayload), reviewSnapshotHash]
      );
      const pirRow = pirInsert.rows[0];
      if (!pirRow) {
        throw new Error('[startRoiCasePostInvestmentReview] insert into rvn_roi_post_investment_reviews returned no row');
      }

      const caseUpdate = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'post_investment_review', next_action_type = 'finalize_post_investment_review',
                row_version = $1, updated_by = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, caseId]
      );
      const updatedCaseRow = caseUpdate.rows[0];
      if (!updatedCaseRow) {
        throw new Error(`[startRoiCasePostInvestmentReview] case update returned no row for ${caseId}`);
      }

      return { case: toRoiCase(updatedCaseRow), pir: toRoiPostInvestmentReview(pirRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result.case, pir: result.pir };
      return {
        schemaVersion: 1,
        eventType: 'roi.post_investment_review_started',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, pirId: result.pir.pirId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateRoiPostInvestmentReviewDraft
// ==========================================

export interface UpdateRoiPostInvestmentReviewDraftInput {
  pirId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  outcome?: RoiPirOutcome | null;
  lessonsLearned?: string | null;
  recommendation?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** CAS on the PIR row's OWN `row_version` (not the case's — same
 * "child aggregate CAS'd independently" shape `updateVarianceStatus` uses).
 * Guard: `status === 'draft'`. Writable: `outcome`/`lessonsLearned`/
 * `recommendation` only. */
export async function updateRoiPostInvestmentReviewDraft(
  input: UpdateRoiPostInvestmentReviewDraftInput
): Promise<AtomicCommandOutcome<RoiPostInvestmentReview>> {
  const {
    pirId,
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    ...edits
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiPostInvestmentReviewRow, RoiPostInvestmentReview>({
    organizationId,
    aggregateId: pirId,
    expectedVersion,
    loadForUpdate: loadRoiPirForUpdate,
    getCurrentVersion: pirRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.case_id !== caseId) {
        throw new RoiPirNotFoundError(caseId);
      }
      if (currentRow.status !== 'draft') {
        throw new RoiPirValidationError(
          `PIR ${pirId} is "${currentRow.status}" — the draft may not be edited once finalized`,
          'NOT_EDITABLE',
          { pirId, status: currentRow.status }
        );
      }

      beforeState = { pir: toRoiPostInvestmentReview(currentRow) };

      const merged = {
        outcome: edits.outcome !== undefined ? edits.outcome : currentRow.outcome,
        lessons_learned: edits.lessonsLearned !== undefined ? edits.lessonsLearned : currentRow.lessons_learned,
        recommendation: edits.recommendation !== undefined ? edits.recommendation : currentRow.recommendation,
      };

      const updateResult = await client.query<RoiPostInvestmentReviewRow>(
        `UPDATE rvn_roi_post_investment_reviews
            SET outcome = $1, lessons_learned = $2, recommendation = $3,
                row_version = $4, updated_by = $5, updated_at = now()
          WHERE pir_id = $6
          RETURNING *`,
        [merged.outcome, merged.lessons_learned, merged.recommendation, nextVersion, actorUserId, pirId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[updateRoiPostInvestmentReviewDraft] update returned no row for ${pirId}`);
      }
      return toRoiPostInvestmentReview(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { pir: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.post_investment_review_draft_updated',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, pirId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// recordRoiPirTeresaDraftDisposition (AC-06)
// ==========================================

export interface RecordRoiPirTeresaDraftDispositionInput {
  pirId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  disposition: RoiPirTeresaDraftDisposition;
  /** Required when `disposition !== 'rejected'` — the human-approved final
   * text that becomes the authoritative `lessonsLearned`. */
  finalLessonsText?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * CAS on the PIR row. Guard: `status === 'draft'`. This IS the literal AC-06
 * mechanism: a Teresa-drafted lessons text (`teresa_draft_lessons_payload`,
 * written by a future ROI-E008 caller — no writer ships in this epic) never
 * reaches the authoritative `lessons_learned` column without this explicit
 * human call. `'rejected'` leaves `lessons_learned` COMPLETELY untouched;
 * only `'accepted'`/`'edited_then_accepted'` copy `finalLessonsText` into it.
 */
export async function recordRoiPirTeresaDraftDisposition(
  input: RecordRoiPirTeresaDraftDispositionInput
): Promise<AtomicCommandOutcome<RoiPostInvestmentReview>> {
  const {
    pirId,
    caseId,
    organizationId,
    expectedVersion,
    disposition,
    finalLessonsText = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  if (disposition !== 'rejected' && !finalLessonsText) {
    throw new RoiPirValidationError(
      `disposition "${disposition}" requires finalLessonsText`,
      'FINAL_LESSONS_TEXT_REQUIRED',
      { pirId, disposition }
    );
  }

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiPostInvestmentReviewRow, RoiPostInvestmentReview>({
    organizationId,
    aggregateId: pirId,
    expectedVersion,
    loadForUpdate: loadRoiPirForUpdate,
    getCurrentVersion: pirRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.case_id !== caseId) {
        throw new RoiPirNotFoundError(caseId);
      }
      if (currentRow.status !== 'draft') {
        throw new RoiPirValidationError(
          `PIR ${pirId} is "${currentRow.status}" — the Teresa draft disposition may only be recorded while the PIR is a draft`,
          'NOT_EDITABLE',
          { pirId, status: currentRow.status }
        );
      }

      beforeState = { pir: toRoiPostInvestmentReview(currentRow) };

      // AC-06's literal mechanism.
      const lessonsLearned = disposition === 'rejected' ? currentRow.lessons_learned : (finalLessonsText as string);

      const updateResult = await client.query<RoiPostInvestmentReviewRow>(
        `UPDATE rvn_roi_post_investment_reviews
            SET teresa_draft_disposition = $1, teresa_draft_disposition_by = $2, teresa_draft_disposition_at = now(),
                lessons_learned = $3,
                row_version = $4, updated_by = $2, updated_at = now()
          WHERE pir_id = $5
          RETURNING *`,
        [disposition, actorUserId, lessonsLearned, nextVersion, pirId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[recordRoiPirTeresaDraftDisposition] update returned no row for ${pirId}`);
      }
      return toRoiPostInvestmentReview(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { pir: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.pir_teresa_draft_disposition_recorded',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, pirId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// closeRoiCase (AC-03, D6)
// ==========================================

export interface CloseRoiCaseInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  /** Mandatory only when open variances exist (AC-03's blanket-waiver
   * shape, Decision D9) — a per-category waiver is not supported. */
  openVarianceWaiverReason?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface CloseRoiCaseResult {
  case: RoiCase;
  pir: RoiPostInvestmentReview;
}

/**
 * CAS on the case's `row_version`. Design §4.6's exact step ordering:
 * (1) guard `status === 'post_investment_review'`; (2) `SELECT ... FOR
 * UPDATE` the active `status='draft'` PIR row — none found ->
 * `RoiPirNotFoundError`; (3) self-close denial (D6) BEFORE any write;
 * (4) open-variance gate (waiver required); (5) PIR-completeness gate;
 * (6) finalize the PIR row; (7) `completeObligation`; (8) close the case.
 * Steps 6-8 all run on the SAME pinned client as the CAS'd case update
 * (this function's own `applyMutation`), inside the ONE transaction
 * `executeAtomicCommand` wraps around the whole call.
 */
export async function closeRoiCase(input: CloseRoiCaseInput): Promise<AtomicCommandOutcome<CloseRoiCaseResult>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    openVarianceWaiverReason = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCaseRow, CloseRoiCaseResult>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // Step 1.
      if (currentRow.status !== 'post_investment_review') {
        throw new RoiCaseValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — only a "post_investment_review" case may be closed`,
          'INVALID_ROI_CASE_STATUS_TRANSITION',
          { caseId, currentStatus: currentRow.status, toStatus: 'closed' }
        );
      }

      // Step 2.
      const pirResult = await client.query<RoiPostInvestmentReviewRow>(
        `SELECT * FROM rvn_roi_post_investment_reviews
          WHERE case_id = $1 AND organization_id = $2 AND status = 'draft'
          FOR UPDATE`,
        [caseId, organizationId]
      );
      const pirRow = pirResult.rows[0];
      if (!pirRow) {
        throw new RoiPirNotFoundError(caseId);
      }

      // Step 3 (D6) — BEFORE any write.
      if (actorUserId === pirRow.started_by) {
        throw new RoiPirSelfCloseDeniedError(caseId, pirRow.pir_id, actorUserId);
      }

      // Step 4 (AC-03 open-variance gate, Decision D9's blanket waiver).
      const variancesResult = await client.query<{ variance_id: string }>(
        `SELECT variance_id FROM rvn_roi_variances WHERE case_id = $1 AND organization_id = $2 AND status = 'open'`,
        [caseId, organizationId]
      );
      const openVarianceIds = variancesResult.rows.map((row) => row.variance_id);
      if (openVarianceIds.length > 0 && !openVarianceWaiverReason) {
        throw new RoiPirValidationError(
          `ROI case ${caseId} has ${openVarianceIds.length} open variance(s) — closure requires either resolving them or an explicit openVarianceWaiverReason`,
          'OPEN_VARIANCES_UNRESOLVED',
          { caseId, openVarianceIds }
        );
      }

      // Step 5 (AC-03 PIR-completeness gate).
      if (pirRow.outcome === null || pirRow.lessons_learned === null) {
        throw new RoiPirValidationError(
          `ROI case ${caseId} PIR is incomplete — outcome and lessonsLearned are required before closure`,
          'PIR_INCOMPLETE',
          { caseId, pirId: pirRow.pir_id }
        );
      }

      beforeState = { case: toRoiCase(currentRow), pir: toRoiPostInvestmentReview(pirRow) };

      // Step 6.
      const pirUpdate = await client.query<RoiPostInvestmentReviewRow>(
        `UPDATE rvn_roi_post_investment_reviews
            SET status = 'finalized', finalized_by = $1, finalized_at = now(),
                open_variance_waiver_reason = $2, row_version = row_version + 1, updated_by = $1, updated_at = now()
          WHERE pir_id = $3
          RETURNING *`,
        [actorUserId, openVarianceWaiverReason, pirRow.pir_id]
      );
      const finalizedPirRow = pirUpdate.rows[0];
      if (!finalizedPirRow) {
        throw new Error(`[closeRoiCase] PIR finalize update returned no row for ${pirRow.pir_id}`);
      }

      // Step 7 — same pinned client/transaction as steps 6 and 8.
      await completeObligation(client, {
        organizationId,
        referenceType: 'roi_case',
        referenceId: caseId,
        obligationType: CONDUCT_PIR_OBLIGATION_TYPE,
        completedViaCommand: 'closeRoiCase',
      });

      // Step 8. next_review_at deliberately left as-is (Decision D4 —
      // historical record); only the rolling next_action_* pointer clears.
      const caseUpdate = await client.query<RoiCaseRow>(
        `UPDATE rvn_roi_cases
            SET status = 'closed', next_action_type = NULL, next_action_due_at = NULL,
                row_version = $1, updated_by = $2, updated_at = now()
          WHERE case_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, caseId]
      );
      const closedCaseRow = caseUpdate.rows[0];
      if (!closedCaseRow) {
        throw new Error(`[closeRoiCase] case update returned no row for ${caseId}`);
      }

      return { case: toRoiCase(closedCaseRow), pir: toRoiPostInvestmentReview(finalizedPirRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { case: result.case, pir: result.pir };
      return {
        schemaVersion: 1,
        eventType: 'roi.case_closed',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, pirId: result.pir.pirId },
      } satisfies AtomicEventInput;
    },
  });
}
