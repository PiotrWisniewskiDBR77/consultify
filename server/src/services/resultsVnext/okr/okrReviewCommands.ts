/**
 * OKR-E007 — Manager/self review command layer.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.3, D5/D6.
 * Schema: server/migrations/20260826_rvn_okr_review_reflection.sql.
 *
 * D6 (terminology hazard, must be named explicitly): `self_review_required`
 * (a Program policy flag — "the owner must submit their own self-
 * assessment") and "self-review denial" (OKR-F-022's maker-checker — "a
 * MANAGER review cannot be performed by the Set's own author") share
 * overlapping English words for TWO UNRELATED CONCEPTS. The maker-checker
 * error class here is `OkrManagerReviewSelfApprovalDeniedError` — never
 * `SelfReviewDenied*`, which would misname it after the policy flag it does
 * NOT gate. `submitOkrSetSelfReview`'s own "must be the owner" check is a
 * plain eligibility guard (`OkrReviewValidationError`), not a denial — the
 * Program is *asking* the owner to review themselves; requiring otherwise
 * would defeat the feature.
 *
 * The `(set_id, review_type)` row (D5) may need to be created (first
 * submit) or updated (resubmit after changes-requested, or any later
 * transition) — same "target row may not exist yet" shape
 * `okrReflectionCommands.ts`'s `recordObjectiveReflection` hand-rolls, for
 * the same reason (`executeAtomicCommand.loadForUpdate` cannot express
 * "create if absent"). `submitOkrSetSelfReview`/`submitOkrSetForManagerReview`
 * reuse that same `expectedVersion=0` == "create" convention.
 * `approveOkrSetManagerReview`/`requestChangesOnOkrSetManagerReview`/
 * `recordOkrSetReviewComment` all require an existing row (a review must
 * have been submitted before it can be decided or commented on).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import logger from '../../../utils/Logger.js';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  resolveConsumerGroups,
  EVENT_INSERT_SQL,
  type AtomicCommandOutcome,
  type AtomicEventInput,
  type ExistingEventRow,
} from '../platform/atomicWrite.js';
import { createObligation } from '../platform/obligations.js';
import { VISIBILITY_CTE_PARAM_COUNT, wrapWithVisibilityScope } from '../platform/visibilityScopedQuery.js';

import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import { OKR_SET_RESOURCE_TYPE, OkrSetValidationError } from './okrSetCommands.js';
import type { OkrSetRow } from './okrSetTypes.js';
import {
  toOkrReview,
  type OkrReview,
  type OkrReviewComment,
  type OkrReviewCommentLevel,
  type OkrReviewRow,
  type OkrReviewType,
} from './okrReviewTypes.js';

// ==========================================
// SHARED CONSTANTS
// ==========================================

/** Design §4.3: created by `submitOkrSetForManagerReview`, no completer
 * ships in this epic yet (a future consumer of the review's own
 * approve/request-changes decision would complete it) — same
 * "obligation opened now, completion is a later epic's concern"
 * forward-declaration posture `CONDUCT_PIR_OBLIGATION_TYPE` used before
 * ROI-E006 gave it a real completer. */
export const MANAGER_REVIEW_OKR_SET_OBLIGATION_TYPE = 'manager_review_okr_set';

// ==========================================
// ERRORS
// ==========================================

/** OKR-F-022's maker-checker (D6) — a MANAGER review cannot be approved by
 * the Set's own author. Deliberately NOT named `SelfReviewDenied*` (D6). */
export class OkrManagerReviewSelfApprovalDeniedError extends Error {
  code = 'MANAGER_REVIEW_SELF_APPROVAL_DENIED';
  details: Record<string, unknown>;
  constructor(setId: string, actorUserId: string, reasonField: 'submitted_by' | 'owner_user_id' | 'created_by') {
    super(`User ${actorUserId} may not approve the manager review for OKR Set ${setId}: matches its own ${reasonField}`);
    this.name = 'OkrManagerReviewSelfApprovalDeniedError';
    this.details = { setId, actorUserId, reasonField };
  }
}

/** `closeOkrSet`'s manager-review-required gate (§4.5 step 3). */
export class OkrSetManagerReviewRequiredError extends Error {
  code = 'MANAGER_REVIEW_REQUIRED';
  details: Record<string, unknown>;
  constructor(setId: string) {
    super(`OKR Set ${setId} cannot close: an approved manager review is required by Program policy`);
    this.name = 'OkrSetManagerReviewRequiredError';
    this.details = { setId };
  }
}

/** `closeOkrSet`'s self-review-required gate (§4.5 step 4). */
export class OkrSetSelfReviewRequiredError extends Error {
  code = 'SELF_REVIEW_REQUIRED';
  details: Record<string, unknown>;
  constructor(setId: string) {
    super(`OKR Set ${setId} cannot close: a submitted self-review is required by Program policy`);
    this.name = 'OkrSetSelfReviewRequiredError';
    this.details = { setId };
  }
}

/** `recordOkrSetReviewComment`/`approveOkrSetManagerReview`/
 * `requestChangesOnOkrSetManagerReview` found no review row of the
 * requested type for this Set. */
export class OkrReviewNotFoundError extends Error {
  code = 'REVIEW_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(setId: string, reviewType: OkrReviewType) {
    super(`OKR Set ${setId} has no "${reviewType}" review`);
    this.name = 'OkrReviewNotFoundError';
    this.details = { setId, reviewType };
  }
}

/** Generic guard/precondition failure for this file's own commands. */
export class OkrReviewValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_REVIEW_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrReviewValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// SHARED HELPERS
// ==========================================

async function lockOkrSetRow(client: PoolClient, setId: string, organizationId: string): Promise<OkrSetRow> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
    [setId, organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new OkrSetValidationError(`OKR Set ${setId} not found`, 'SET_NOT_FOUND', { setId });
  }
  return row;
}

async function lockOkrReviewRow(
  client: PoolClient,
  setId: string,
  organizationId: string,
  reviewType: OkrReviewType
): Promise<OkrReviewRow | undefined> {
  const result = await client.query<OkrReviewRow>(
    `SELECT * FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = $3 FOR UPDATE`,
    [setId, organizationId, reviewType]
  );
  return result.rows[0];
}

interface WriteReviewEventResult {
  outcome: 'applied' | 'duplicate';
  eventId: string;
  resultingVersion: number;
}

/** Inserts the idempotency-guarded event + outbox fan-out, same shape as
 * `atomicWrite.ts`'s own steps 5-6 — this file's commands manage their own
 * BEGIN/COMMIT (see file header) so cannot call `executeAtomicCommand`
 * directly for that half either. On a duplicate idempotency key, the
 * caller's own mutation is rolled back by the caller (this function does
 * NOT roll back — callers own transaction boundaries). */
async function writeReviewEvent(
  client: PoolClient,
  eventInput: AtomicEventInput
): Promise<WriteReviewEventResult> {
  const eventResult = await client.query<{ event_id: string; resulting_version: number }>(EVENT_INSERT_SQL, [
    eventInput.schemaVersion,
    eventInput.eventType,
    eventInput.aggregateType,
    eventInput.aggregateId,
    eventInput.organizationId,
    eventInput.actorUserId,
    eventInput.actorEffectiveRole,
    eventInput.commandId,
    eventInput.correlationId,
    eventInput.causationId,
    eventInput.occurredAt,
    eventInput.policyVersion,
    eventInput.beforeState === null ? null : JSON.stringify(eventInput.beforeState),
    eventInput.afterState === null ? null : JSON.stringify(eventInput.afterState),
    eventInput.stateHash,
    eventInput.reason,
    JSON.stringify(eventInput.evidenceRefs ?? []),
    eventInput.source,
    eventInput.idempotencyKey,
    eventInput.expectedVersion,
    eventInput.resultingVersion,
    JSON.stringify(eventInput.payload ?? {}),
  ]);
  const inserted = eventResult.rows[0];
  if (!inserted) {
    const existingResult = await client.query<ExistingEventRow>(
      `SELECT event_id, resulting_version FROM rvn_platform_events WHERE organization_id = $1 AND idempotency_key = $2`,
      [eventInput.organizationId, eventInput.idempotencyKey]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      throw new Error(
        `[writeReviewEvent] idempotency conflict on (${eventInput.organizationId}, ${eventInput.idempotencyKey}) but existing event row not found`
      );
    }
    return { outcome: 'duplicate', eventId: existing.event_id, resultingVersion: existing.resulting_version };
  }
  const consumerGroups = resolveConsumerGroups(eventInput.eventType);
  if (consumerGroups.length > 0) {
    await client.query(
      `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
         SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
      [inserted.event_id, consumerGroups]
    );
  }
  return { outcome: 'applied', eventId: inserted.event_id, resultingVersion: inserted.resulting_version };
}

// ==========================================
// submitOkrSetSelfReview (D6's "must be the owner" eligibility check)
// ==========================================

export interface SubmitOkrSetSelfReviewInput {
  setId: string;
  organizationId: string;
  /** `0` = create path (no self-review row exists yet); `>=1` = CAS an
   * existing row's own `row_version` (resubmit). */
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function submitOkrSetSelfReview(
  input: SubmitOkrSetSelfReviewInput
): Promise<AtomicCommandOutcome<OkrReview>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    const setRow = await lockOkrSetRow(client, setId, organizationId);

    // D6: plain eligibility guard, NOT a denial — the Program is asking
    // the owner to review themselves.
    if (actorUserId !== setRow.owner_user_id) {
      await client.query('ROLLBACK');
      throw new OkrReviewValidationError(
        `Only the OKR Set's own Owner may submit its self-review`,
        'NOT_SET_OWNER',
        { setId, actorUserId, ownerUserId: setRow.owner_user_id }
      );
    }

    const existingRow = await lockOkrReviewRow(client, setId, organizationId, 'self');
    let beforeState: Record<string, unknown> | null = null;
    let resultRow: OkrReviewRow;
    let nextVersion: number;

    if (!existingRow) {
      if (expectedVersion !== 0) {
        await client.query('ROLLBACK');
        throw new OkrReviewNotFoundError(setId, 'self');
      }
      nextVersion = 1;
      const insertResult = await client.query<OkrReviewRow>(
        `INSERT INTO okr_vnext_reviews
           (set_id, organization_id, review_type, reviewer_user_id, status, reviewed_set_version,
            submitted_by, submitted_at, created_by)
         VALUES ($1, $2, 'self', $3, 'submitted', $4, $3, now(), $3)
         RETURNING *`,
        [setId, organizationId, actorUserId, setRow.current_version]
      );
      resultRow = insertResult.rows[0]!;
    } else {
      if (existingRow.row_version !== expectedVersion) {
        await client.query('ROLLBACK');
        throw new OkrReviewValidationError(
          `Self-review for OKR Set ${setId} was modified since it was last read`,
          'STALE_VERSION',
          { setId, currentVersion: existingRow.row_version, expectedVersion }
        );
      }
      beforeState = { review: toOkrReview(existingRow) };
      nextVersion = existingRow.row_version + 1;
      const updateResult = await client.query<OkrReviewRow>(
        `UPDATE okr_vnext_reviews
            SET status = 'submitted', reviewed_set_version = $1, submitted_by = $2, submitted_at = now(),
                row_version = $3, updated_by = $2, updated_at = now()
          WHERE set_id = $4 AND review_type = 'self'
          RETURNING *`,
        [setRow.current_version, actorUserId, nextVersion, setId]
      );
      resultRow = updateResult.rows[0]!;
    }

    const result = toOkrReview(resultRow);
    const eventInput: AtomicEventInput = {
      schemaVersion: 1,
      eventType: 'okr_set.review_submitted',
      aggregateType: 'okr_set',
      aggregateId: setId,
      organizationId,
      actorUserId,
      actorEffectiveRole,
      commandId: randomUUID(),
      correlationId: correlationId ?? randomUUID(),
      causationId,
      occurredAt: new Date().toISOString(),
      policyVersion: '',
      beforeState,
      afterState: { review: result },
      stateHash: computeStateHash({ review: result }),
      reason,
      evidenceRefs: [],
      source: OKR_EVENT_SOURCE,
      idempotencyKey,
      expectedVersion,
      resultingVersion: nextVersion,
      payload: { setId, reviewType: 'self' },
    };

    const eventOutcome = await writeReviewEvent(client, eventInput);
    if (eventOutcome.outcome === 'duplicate') {
      await client.query('ROLLBACK');
      const duplicate = await client.query<OkrReviewRow>(
        `SELECT * FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = 'self'`,
        [setId, organizationId]
      );
      const duplicateRow = duplicate.rows[0];
      return { ...eventOutcome, result: duplicateRow ? toOkrReview(duplicateRow) : result };
    }

    await client.query('COMMIT');
    return { ...eventOutcome, result };
  } catch (err) {
    await safeRollback(client);
    throw err;
  } finally {
    client.release();
  }
}

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackErr) {
    logger.warn('[resultsVnext/okr/okrReviewCommands] rollback after error failed', {
      error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
    });
  }
}

// ==========================================
// submitOkrSetForManagerReview
// ==========================================

export interface SubmitOkrSetForManagerReviewInput {
  setId: string;
  organizationId: string;
  /** `0` = create path; `>=1` = CAS an existing row (resubmit after
   * changes-requested). */
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** Owner-initiated, no self-check at submission time (mirrors E002's
 * `submitOkrSetForApproval`, which has none either — the maker-checker
 * lives entirely in `approveOkrSetManagerReview`, D6). Requires
 * `reviewer_user_id` to already be set on the Set (reused from E002, not a
 * new field) — a Set with no assigned reviewer cannot request a manager
 * review, same "reviewer_not_assigned" gap `isOkrSetReadyForSubmissionEligible`
 * already guards for the Set's own initial-submission path. */
export async function submitOkrSetForManagerReview(
  input: SubmitOkrSetForManagerReviewInput
): Promise<AtomicCommandOutcome<OkrReview>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    const setRow = await lockOkrSetRow(client, setId, organizationId);

    if (!setRow.reviewer_user_id) {
      await client.query('ROLLBACK');
      throw new OkrReviewValidationError(
        `OKR Set ${setId} has no reviewer_user_id assigned — cannot submit for manager review`,
        'REVIEWER_NOT_ASSIGNED',
        { setId }
      );
    }

    const existingRow = await lockOkrReviewRow(client, setId, organizationId, 'manager');
    let beforeState: Record<string, unknown> | null = null;
    let resultRow: OkrReviewRow;
    let nextVersion: number;

    if (!existingRow) {
      if (expectedVersion !== 0) {
        await client.query('ROLLBACK');
        throw new OkrReviewNotFoundError(setId, 'manager');
      }
      nextVersion = 1;
      const insertResult = await client.query<OkrReviewRow>(
        `INSERT INTO okr_vnext_reviews
           (set_id, organization_id, review_type, reviewer_user_id, status, reviewed_set_version,
            submitted_by, submitted_at, created_by)
         VALUES ($1, $2, 'manager', $3, 'submitted', $4, $5, now(), $5)
         RETURNING *`,
        [setId, organizationId, setRow.reviewer_user_id, setRow.current_version, actorUserId]
      );
      resultRow = insertResult.rows[0]!;
    } else {
      if (existingRow.row_version !== expectedVersion) {
        await client.query('ROLLBACK');
        throw new OkrReviewValidationError(
          `Manager review for OKR Set ${setId} was modified since it was last read`,
          'STALE_VERSION',
          { setId, currentVersion: existingRow.row_version, expectedVersion }
        );
      }
      beforeState = { review: toOkrReview(existingRow) };
      nextVersion = existingRow.row_version + 1;
      const updateResult = await client.query<OkrReviewRow>(
        `UPDATE okr_vnext_reviews
            SET status = 'submitted', reviewer_user_id = $1, reviewed_set_version = $2,
                submitted_by = $3, submitted_at = now(),
                row_version = $4, updated_by = $3, updated_at = now()
          WHERE set_id = $5 AND review_type = 'manager'
          RETURNING *`,
        [setRow.reviewer_user_id, setRow.current_version, actorUserId, nextVersion, setId]
      );
      resultRow = updateResult.rows[0]!;
    }

    // Same transaction as the row write — D14 obligation, assignee is the
    // Set's own reviewer_user_id.
    await createObligation(client, {
      organizationId,
      assigneeUserId: setRow.reviewer_user_id,
      referenceType: OKR_SET_RESOURCE_TYPE,
      referenceId: setId,
      aggregateVersionAtCreation: setRow.row_version,
      obligationType: MANAGER_REVIEW_OKR_SET_OBLIGATION_TYPE,
      deduplicationKey: `${organizationId}:${OKR_SET_RESOURCE_TYPE}:${setId}:${MANAGER_REVIEW_OKR_SET_OBLIGATION_TYPE}:${resultRow.review_id}`,
    });

    const result = toOkrReview(resultRow);
    const eventInput: AtomicEventInput = {
      schemaVersion: 1,
      eventType: 'okr_set.review_submitted',
      aggregateType: 'okr_set',
      aggregateId: setId,
      organizationId,
      actorUserId,
      actorEffectiveRole,
      commandId: randomUUID(),
      correlationId: correlationId ?? randomUUID(),
      causationId,
      occurredAt: new Date().toISOString(),
      policyVersion: '',
      beforeState,
      afterState: { review: result },
      stateHash: computeStateHash({ review: result }),
      reason,
      evidenceRefs: [],
      source: OKR_EVENT_SOURCE,
      idempotencyKey,
      expectedVersion,
      resultingVersion: nextVersion,
      payload: { setId, reviewType: 'manager' },
    };

    const eventOutcome = await writeReviewEvent(client, eventInput);
    if (eventOutcome.outcome === 'duplicate') {
      await client.query('ROLLBACK');
      const duplicate = await client.query<OkrReviewRow>(
        `SELECT * FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = 'manager'`,
        [setId, organizationId]
      );
      const duplicateRow = duplicate.rows[0];
      return { ...eventOutcome, result: duplicateRow ? toOkrReview(duplicateRow) : result };
    }

    await client.query('COMMIT');
    return { ...eventOutcome, result };
  } catch (err) {
    await safeRollback(client);
    throw err;
  } finally {
    client.release();
  }
}

// ==========================================
// approveOkrSetManagerReview (OKR-F-022, D6)
// ==========================================

export interface ApproveOkrSetManagerReviewInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  outcome?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function approveOkrSetManagerReview(
  input: ApproveOkrSetManagerReviewInput
): Promise<AtomicCommandOutcome<OkrReview>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    outcome = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    const setRow = await lockOkrSetRow(client, setId, organizationId);
    const existingRow = await lockOkrReviewRow(client, setId, organizationId, 'manager');
    if (!existingRow) {
      await client.query('ROLLBACK');
      throw new OkrReviewNotFoundError(setId, 'manager');
    }

    // D6: self-approval denial FIRST, before any other check/write.
    if (actorUserId === existingRow.submitted_by) {
      await client.query('ROLLBACK');
      throw new OkrManagerReviewSelfApprovalDeniedError(setId, actorUserId, 'submitted_by');
    }
    if (actorUserId === setRow.owner_user_id) {
      await client.query('ROLLBACK');
      throw new OkrManagerReviewSelfApprovalDeniedError(setId, actorUserId, 'owner_user_id');
    }
    if (actorUserId === setRow.created_by) {
      await client.query('ROLLBACK');
      throw new OkrManagerReviewSelfApprovalDeniedError(setId, actorUserId, 'created_by');
    }

    if (existingRow.row_version !== expectedVersion) {
      await client.query('ROLLBACK');
      throw new OkrReviewValidationError(
        `Manager review for OKR Set ${setId} was modified since it was last read`,
        'STALE_VERSION',
        { setId, currentVersion: existingRow.row_version, expectedVersion }
      );
    }
    if (existingRow.status !== 'submitted') {
      await client.query('ROLLBACK');
      throw new OkrReviewValidationError(
        `Manager review for OKR Set ${setId} is "${existingRow.status}" — only a "submitted" review may be approved`,
        'NOT_SUBMITTED',
        { setId, status: existingRow.status }
      );
    }

    const beforeState = { review: toOkrReview(existingRow) };
    const nextVersion = existingRow.row_version + 1;
    const updateResult = await client.query<OkrReviewRow>(
      `UPDATE okr_vnext_reviews
          SET status = 'approved', outcome = $1, decided_by = $2, decided_at = now(),
              row_version = $3, updated_by = $2, updated_at = now()
        WHERE set_id = $4 AND review_type = 'manager'
        RETURNING *`,
      [outcome, actorUserId, nextVersion, setId]
    );
    const result = toOkrReview(updateResult.rows[0]!);

    const eventInput: AtomicEventInput = {
      schemaVersion: 1,
      eventType: 'okr_set.review_approved',
      aggregateType: 'okr_set',
      aggregateId: setId,
      organizationId,
      actorUserId,
      actorEffectiveRole,
      commandId: randomUUID(),
      correlationId: correlationId ?? randomUUID(),
      causationId,
      occurredAt: new Date().toISOString(),
      policyVersion: '',
      beforeState,
      afterState: { review: result },
      stateHash: computeStateHash({ review: result }),
      reason,
      evidenceRefs: [],
      source: OKR_EVENT_SOURCE,
      idempotencyKey,
      expectedVersion,
      resultingVersion: nextVersion,
      payload: { setId, reviewType: 'manager' },
    };
    const eventOutcome = await writeReviewEvent(client, eventInput);
    if (eventOutcome.outcome === 'duplicate') {
      await client.query('ROLLBACK');
      const duplicate = await client.query<OkrReviewRow>(
        `SELECT * FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = 'manager'`,
        [setId, organizationId]
      );
      const duplicateRow = duplicate.rows[0];
      return { ...eventOutcome, result: duplicateRow ? toOkrReview(duplicateRow) : result };
    }
    await client.query('COMMIT');
    return { ...eventOutcome, result };
  } catch (err) {
    await safeRollback(client);
    throw err;
  } finally {
    client.release();
  }
}

// ==========================================
// requestChangesOnOkrSetManagerReview
// ==========================================

export interface RequestChangesOnOkrSetManagerReviewInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  changeRequestNotes?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

/** No self-check (D6: declining someone else's submission isn't the
 * conflict self-approval denial exists to prevent) — mirrors
 * `requestChangesOnOkrSet`'s identical stance. */
export async function requestChangesOnOkrSetManagerReview(
  input: RequestChangesOnOkrSetManagerReviewInput
): Promise<AtomicCommandOutcome<OkrReview>> {
  const {
    setId,
    organizationId,
    expectedVersion,
    changeRequestNotes = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    await lockOkrSetRow(client, setId, organizationId);
    const existingRow = await lockOkrReviewRow(client, setId, organizationId, 'manager');
    if (!existingRow) {
      await client.query('ROLLBACK');
      throw new OkrReviewNotFoundError(setId, 'manager');
    }
    if (existingRow.row_version !== expectedVersion) {
      await client.query('ROLLBACK');
      throw new OkrReviewValidationError(
        `Manager review for OKR Set ${setId} was modified since it was last read`,
        'STALE_VERSION',
        { setId, currentVersion: existingRow.row_version, expectedVersion }
      );
    }
    if (existingRow.status !== 'submitted') {
      await client.query('ROLLBACK');
      throw new OkrReviewValidationError(
        `Manager review for OKR Set ${setId} is "${existingRow.status}" — changes may only be requested on a "submitted" review`,
        'NOT_SUBMITTED',
        { setId, status: existingRow.status }
      );
    }

    const beforeState = { review: toOkrReview(existingRow) };
    const nextVersion = existingRow.row_version + 1;
    const updateResult = await client.query<OkrReviewRow>(
      `UPDATE okr_vnext_reviews
          SET status = 'changes_requested', outcome = $1, decided_by = $2, decided_at = now(),
              row_version = $3, updated_by = $2, updated_at = now()
        WHERE set_id = $4 AND review_type = 'manager'
        RETURNING *`,
      [changeRequestNotes, actorUserId, nextVersion, setId]
    );
    const result = toOkrReview(updateResult.rows[0]!);

    const eventInput: AtomicEventInput = {
      schemaVersion: 1,
      eventType: 'okr_set.review_changes_requested',
      aggregateType: 'okr_set',
      aggregateId: setId,
      organizationId,
      actorUserId,
      actorEffectiveRole,
      commandId: randomUUID(),
      correlationId: correlationId ?? randomUUID(),
      causationId,
      occurredAt: new Date().toISOString(),
      policyVersion: '',
      beforeState,
      afterState: { review: result },
      stateHash: computeStateHash({ review: result }),
      reason: changeRequestNotes,
      evidenceRefs: [],
      source: OKR_EVENT_SOURCE,
      idempotencyKey,
      expectedVersion,
      resultingVersion: nextVersion,
      payload: { setId, reviewType: 'manager' },
    };
    const eventOutcome = await writeReviewEvent(client, eventInput);
    if (eventOutcome.outcome === 'duplicate') {
      await client.query('ROLLBACK');
      const duplicate = await client.query<OkrReviewRow>(
        `SELECT * FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = 'manager'`,
        [setId, organizationId]
      );
      const duplicateRow = duplicate.rows[0];
      return { ...eventOutcome, result: duplicateRow ? toOkrReview(duplicateRow) : result };
    }
    await client.query('COMMIT');
    return { ...eventOutcome, result };
  } catch (err) {
    await safeRollback(client);
    throw err;
  } finally {
    client.release();
  }
}

// ==========================================
// recordOkrSetReviewComment
// ==========================================

export interface RecordOkrSetReviewCommentInput {
  setId: string;
  organizationId: string;
  reviewType: OkrReviewType;
  expectedVersion: number;
  level: OkrReviewCommentLevel;
  targetId: string;
  text: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

/** Appends one entry to the `comments` JSONB array WITHOUT changing
 * `status` — lets a reviewer leave running notes before a final decision.
 * Requires the review row to already exist (a review must have been
 * submitted at least once). */
export async function recordOkrSetReviewComment(
  input: RecordOkrSetReviewCommentInput
): Promise<AtomicCommandOutcome<OkrReview>> {
  const {
    setId,
    organizationId,
    reviewType,
    expectedVersion,
    level,
    targetId,
    text,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    await lockOkrSetRow(client, setId, organizationId);
    const existingRow = await lockOkrReviewRow(client, setId, organizationId, reviewType);
    if (!existingRow) {
      await client.query('ROLLBACK');
      throw new OkrReviewNotFoundError(setId, reviewType);
    }
    if (existingRow.row_version !== expectedVersion) {
      await client.query('ROLLBACK');
      throw new OkrReviewValidationError(
        `${reviewType} review for OKR Set ${setId} was modified since it was last read`,
        'STALE_VERSION',
        { setId, reviewType, currentVersion: existingRow.row_version, expectedVersion }
      );
    }

    const newComment: OkrReviewComment = { level, targetId, text, createdAt: new Date().toISOString(), createdBy: actorUserId };
    const comments: OkrReviewComment[] = [...(existingRow.comments ?? []), newComment];

    const beforeState = { review: toOkrReview(existingRow) };
    const nextVersion = existingRow.row_version + 1;
    const updateResult = await client.query<OkrReviewRow>(
      `UPDATE okr_vnext_reviews
          SET comments = $1, row_version = $2, updated_by = $3, updated_at = now()
        WHERE set_id = $4 AND review_type = $5
        RETURNING *`,
      [JSON.stringify(comments), nextVersion, actorUserId, setId, reviewType]
    );
    const result = toOkrReview(updateResult.rows[0]!);

    const eventInput: AtomicEventInput = {
      schemaVersion: 1,
      eventType: 'okr_set.review_comment_recorded',
      aggregateType: 'okr_set',
      aggregateId: setId,
      organizationId,
      actorUserId,
      actorEffectiveRole,
      commandId: randomUUID(),
      correlationId: correlationId ?? randomUUID(),
      causationId,
      occurredAt: new Date().toISOString(),
      policyVersion: '',
      beforeState,
      afterState: { review: result },
      stateHash: computeStateHash({ review: result }),
      reason: null,
      evidenceRefs: [],
      source: OKR_EVENT_SOURCE,
      idempotencyKey,
      expectedVersion,
      resultingVersion: nextVersion,
      payload: { setId, reviewType },
    };
    const eventOutcome = await writeReviewEvent(client, eventInput);
    if (eventOutcome.outcome === 'duplicate') {
      await client.query('ROLLBACK');
      const duplicate = await client.query<OkrReviewRow>(
        `SELECT * FROM okr_vnext_reviews WHERE set_id = $1 AND organization_id = $2 AND review_type = $3`,
        [setId, organizationId, reviewType]
      );
      const duplicateRow = duplicate.rows[0];
      return { ...eventOutcome, result: duplicateRow ? toOkrReview(duplicateRow) : result };
    }
    await client.query('COMMIT');
    return { ...eventOutcome, result };
  } catch (err) {
    await safeRollback(client);
    throw err;
  } finally {
    client.release();
  }
}

// ==========================================
// listOkrSetReviews (read) — visibility inherited via the parent Set
// (§5: no independent resource_type for reviews, same posture E003
// established for Objectives/KeyResults).
// ==========================================

export interface ListOkrSetReviewsParams {
  userId: string;
  organizationId: string;
  setId: string;
}

export async function listOkrSetReviews(params: ListOkrSetReviewsParams): Promise<OkrReview[]> {
  const { userId, organizationId, setId } = params;
  const baseQuerySql = `
    SELECT r.*
      FROM okr_vnext_reviews r
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = r.set_id::text
     WHERE r.organization_id = $1
       AND r.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY r.review_type ASC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, setId];
  const client = await acquirePgClient();
  try {
    const result = await client.query<OkrReviewRow>(wrapped.sql, values);
    return result.rows.map(toOkrReview);
  } finally {
    client.release();
  }
}
