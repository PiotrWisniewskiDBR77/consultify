/**
 * OKR-E007 — Final scoring + Reflection command layer.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.1-§4.2, D1-D4.
 * Schema: server/migrations/20260826_rvn_okr_review_reflection.sql.
 *
 * `finalScoreOkrSet` (OKR-F-021) is a Set-level batch command — CAS'd on
 * the Set's own `row_version` via `executeAtomicCommand`, freezes every
 * non-cancelled Objective's `progress` (E003's live, continuously-updated
 * value — never recomputed here) through the Program's pinned
 * `scoring_model` (D1/D2). `categories`/`custom` have no source-defined
 * bucket boundaries anywhere in this program (IO-5) — `final_score` stays
 * NULL, `scoring_model_unsupported=true`, never a fabricated threshold.
 *
 * `recordObjectiveReflection` cannot use `executeAtomicCommand` as-is: the
 * design permits an Owner to reflect on an Objective BEFORE
 * `finalScoreOkrSet` has ever run (an owner finishing early shouldn't wait
 * for the cycle boundary), so the target `okr_vnext_reflections` row may
 * not exist yet. `executeAtomicCommand.loadForUpdate` returning nothing is
 * hard-coded to `AtomicWriteAggregateNotFoundError` — the wrong shape for
 * "create it if absent, CAS it if present". This file hand-rolls the same
 * BEGIN/mutate/insert-event(idempotency-guarded)/outbox/COMMIT sequence
 * `executeAtomicCommand` implements, reusing its exported `EVENT_INSERT_SQL`/
 * `resolveConsumerGroups` primitives — identical precedent to
 * `kpiDeviationCommands.ts`'s `insertManualDeviationEvent`/
 * `okrObjectiveCommands.ts`'s `insertManualOkrEvent`, both cited by
 * `atomicWrite.ts`'s own header comment as the reason those two helpers are
 * exported. Convention: `expectedVersion=0` means "the caller believes no
 * reflection row exists yet for this Objective" (create path);
 * `expectedVersion>=1` CAS's against an existing row's own `row_version`
 * (update path) — this is this file's own explicit extension, not a
 * platform-wide convention.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import logger from '../../../utils/Logger.js';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  resolveConsumerGroups,
  EVENT_INSERT_SQL,
  type AtomicCommandOutcome,
  type AtomicEventInput,
  type ExistingEventRow,
} from '../platform/atomicWrite.js';

import { resolveOkrCyclePinnedPolicySnapshot } from './okrObjectiveCommands.js';
import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import type { OkrScoringModel } from './okrProgramTypes.js';
import { OkrSetValidationError } from './okrSetCommands.js';
import { toOkrSet, type OkrSet, type OkrSetRow } from './okrSetTypes.js';
import {
  toOkrReflection,
  type OkrFinalScoreKeyResultSnapshot,
  type OkrReflection,
  type OkrReflectionDisposition,
  type OkrReflectionRow,
} from './okrReflectionTypes.js';

// ==========================================
// ERRORS
// ==========================================

/** `closeOkrSet`'s reflection-completeness gate (§4.5 step 5) — carries
 * EVERY offending Objective id, not just the first, so a caller can fix
 * every gap in one pass. */
export class OkrSetReflectionRequiredError extends Error {
  code = 'REFLECTION_REQUIRED';
  details: Record<string, unknown>;
  constructor(setId: string, missingObjectiveIds: string[]) {
    super(
      `OKR Set ${setId} cannot close: ${missingObjectiveIds.length} Objective(s) are missing a required reflection`
    );
    this.name = 'OkrSetReflectionRequiredError';
    this.details = { setId, missingObjectiveIds };
  }
}

/** `recordObjectiveReflection` found no `okr_vnext_reflections` row for a
 * caller that expected one to already exist (`expectedVersion >= 1`). */
export class OkrReflectionNotFoundError extends Error {
  code = 'REFLECTION_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(objectiveId: string) {
    super(`OKR Reflection for Objective ${objectiveId} not found`);
    this.name = 'OkrReflectionNotFoundError';
    this.details = { objectiveId };
  }
}

/** Generic guard/precondition failure for this file's own commands —
 * mirrors `OkrSetValidationError`'s role for the Set aggregate. */
export class OkrReflectionValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_REFLECTION_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrReflectionValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// applyOkrScoringModel (D2)
// ==========================================

/**
 * `objective.progress` (E003 §5.4) is the RAW, UNCLAMPED ratio the KR
 * geometry engine already computed (confirmed by direct read of
 * `okrProgressEngine.ts`'s own §-IO ruling comment) — this function NEVER
 * re-clamps or re-derives it. `zero_to_one`/`percentage` pass it through
 * (unchanged / x100); `categories`/`custom` have no source-defined bucket
 * boundaries anywhere in this program (IO-5, §9 EVIDENCE_NEEDED) — always
 * `{score: null, unsupported: true}`, never a fabricated threshold.
 */
export function applyOkrScoringModel(
  rawProgress: string | null,
  scoringModel: OkrScoringModel
): { score: number | null; unsupported: boolean } {
  if (scoringModel === 'categories' || scoringModel === 'custom') {
    return { score: null, unsupported: true };
  }
  if (rawProgress === null) {
    return { score: null, unsupported: false };
  }
  const numeric = Number(rawProgress);
  if (!Number.isFinite(numeric)) {
    return { score: null, unsupported: false };
  }
  if (scoringModel === 'percentage') {
    return { score: numeric * 100, unsupported: false };
  }
  // 'zero_to_one' — pass through unchanged, whatever clamping/overachievement
  // policy the engine already applied to `progress` is preserved as-is.
  return { score: numeric, unsupported: false };
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadOkrSetForUpdate(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<OkrSetRow | undefined> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
    [setId, organizationId]
  );
  return result.rows[0];
}

function setRowVersion(row: OkrSetRow): number {
  return row.row_version;
}

// ==========================================
// finalScoreOkrSet (OKR-F-021, D1-D3)
// ==========================================

export interface FinalScoreOkrSetInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface FinalScoreOkrSetResult {
  set: OkrSet;
  scoredObjectives: Array<{ objectiveId: string; finalScore: number | null; scoringModelUnsupported: boolean }>;
}

interface ScorableObjectiveRow {
  objective_id: string;
  progress: string | null;
}

interface ScorableKeyResultRow {
  key_result_id: string;
  progress: string | null;
  confidence: string | null;
  weight: string | null;
}

/**
 * Guard: `status === 'review'`. Reads the Cycle's PINNED policy snapshot
 * (never the Program's live current row, D11) for `scoring_model`. For
 * every non-cancelled Objective under the Set: freezes a KR-level snapshot
 * array (D3) plus the computed final score, upserted into
 * `okr_vnext_reflections` keyed on `objective_id`. No Set-row field changes
 * beyond `row_version`/`updated_at`.
 */
export async function finalScoreOkrSet(
  input: FinalScoreOkrSetInput
): Promise<AtomicCommandOutcome<FinalScoreOkrSetResult>> {
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

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrSetRow, FinalScoreOkrSetResult>({
    organizationId,
    aggregateId: setId,
    expectedVersion,
    loadForUpdate: loadOkrSetForUpdate,
    getCurrentVersion: setRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'review') {
        throw new OkrSetValidationError(
          `OKR Set ${setId} is "${currentRow.status}" — final scoring may only run while the Set is "review"`,
          'NOT_IN_REVIEW',
          { setId, status: currentRow.status }
        );
      }

      const { policyVersionId, snapshot } = await resolveOkrCyclePinnedPolicySnapshot(client, setId, organizationId);
      const scoringModel = snapshot.scoringModel;

      const objectivesResult = await client.query<ScorableObjectiveRow>(
        `SELECT objective_id, progress FROM okr_vnext_objectives
          WHERE set_id = $1 AND organization_id = $2 AND status <> 'cancelled'`,
        [setId, organizationId]
      );

      const scoredObjectives: FinalScoreOkrSetResult['scoredObjectives'] = [];

      for (const objectiveRow of objectivesResult.rows) {
        const krResult = await client.query<ScorableKeyResultRow>(
          `SELECT key_result_id, progress, confidence, weight FROM okr_vnext_key_results
            WHERE objective_id = $1 AND organization_id = $2 AND status <> 'cancelled'
            ORDER BY created_at ASC`,
          [objectiveRow.objective_id, organizationId]
        );
        const finalScorePayload: OkrFinalScoreKeyResultSnapshot[] = krResult.rows.map((kr) => ({
          keyResultId: kr.key_result_id,
          progress: kr.progress,
          confidence: kr.confidence,
          weight: kr.weight,
        }));

        const { score, unsupported } = applyOkrScoringModel(objectiveRow.progress, scoringModel);

        await client.query(
          `INSERT INTO okr_vnext_reflections
             (set_id, objective_id, organization_id, final_score, scoring_model_unsupported,
              final_score_payload, scoring_policy_version_id, scored_by, scored_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $8)
           ON CONFLICT (objective_id) DO UPDATE SET
             final_score = EXCLUDED.final_score,
             scoring_model_unsupported = EXCLUDED.scoring_model_unsupported,
             final_score_payload = EXCLUDED.final_score_payload,
             scoring_policy_version_id = EXCLUDED.scoring_policy_version_id,
             scored_by = EXCLUDED.scored_by,
             scored_at = now(),
             row_version = okr_vnext_reflections.row_version + 1,
             updated_by = EXCLUDED.scored_by,
             updated_at = now()
           WHERE okr_vnext_reflections.status = 'draft'`,
          [
            setId,
            objectiveRow.objective_id,
            organizationId,
            score,
            unsupported,
            JSON.stringify(finalScorePayload),
            policyVersionId,
            actorUserId,
          ]
        );

        scoredObjectives.push({
          objectiveId: objectiveRow.objective_id,
          finalScore: score,
          scoringModelUnsupported: unsupported,
        });
      }

      beforeState = { set: toOkrSet(currentRow) };

      const updateResult = await client.query<OkrSetRow>(
        `UPDATE okr_vnext_sets
            SET row_version = $1, updated_by = $2, updated_at = now()
          WHERE set_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, setId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[finalScoreOkrSet] update returned no row for ${setId}`);
      }

      return { set: toOkrSet(updatedRow), scoredObjectives };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState: Record<string, unknown> = { set: result.set, scoredObjectives: result.scoredObjectives };
      return {
        schemaVersion: 1,
        eventType: 'okr_set.final_scored',
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
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { setId, objectiveCount: result.scoredObjectives.length },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// recordObjectiveReflection (OKR-F-021)
// ==========================================

export interface RecordObjectiveReflectionInput {
  objectiveId: string;
  setId: string;
  organizationId: string;
  /** `0` = "no reflection row exists yet for this Objective" (create path);
   * `>=1` = CAS against an existing row's own `row_version` (update path).
   * See file header. */
  expectedVersion: number;
  whatWorked?: string | null;
  whatDidNotWork?: string | null;
  why?: string | null;
  learning?: string | null;
  nextCycleChange?: string | null;
  disposition?: OkrReflectionDisposition | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Hand-rolled BEGIN/mutate/event/outbox/COMMIT, mirroring
 * `executeAtomicCommand` step-for-step but supporting create-or-update
 * (file header). Guard: parent Set `status IN ('active','review')`. Guard:
 * if the reflection row already exists, `status === 'draft'` (protect-
 * frozen trigger backs this a second time as defense-in-depth). Authorized
 * writer enforcement (Objective Owner or Set Owner) is a route-layer
 * concern per this program's established RBAC/ABAC split — not re-derived
 * here.
 */
export async function recordObjectiveReflection(
  input: RecordObjectiveReflectionInput
): Promise<AtomicCommandOutcome<OkrReflection>> {
  const {
    objectiveId,
    setId,
    organizationId,
    expectedVersion,
    whatWorked = null,
    whatDidNotWork = null,
    why = null,
    learning = null,
    nextCycleChange = null,
    disposition = null,
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

    const objectiveResult = await client.query<{ set_id: string }>(
      `SELECT set_id FROM okr_vnext_objectives WHERE objective_id = $1 AND organization_id = $2`,
      [objectiveId, organizationId]
    );
    const objectiveRow = objectiveResult.rows[0];
    if (!objectiveRow) {
      await client.query('ROLLBACK');
      throw new OkrReflectionValidationError(`OKR Objective ${objectiveId} not found`, 'OBJECTIVE_NOT_FOUND', {
        objectiveId,
      });
    }
    if (objectiveRow.set_id !== setId) {
      await client.query('ROLLBACK');
      throw new OkrReflectionValidationError(
        `OKR Objective ${objectiveId} does not belong to Set ${setId}`,
        'OBJECTIVE_SET_MISMATCH',
        { objectiveId, setId }
      );
    }

    const setResult = await client.query<{ status: string }>(
      `SELECT status FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
      [setId, organizationId]
    );
    const setRow = setResult.rows[0];
    if (!setRow) {
      await client.query('ROLLBACK');
      throw new OkrSetValidationError(`OKR Set ${setId} not found`, 'SET_NOT_FOUND', { setId });
    }
    if (setRow.status !== 'active' && setRow.status !== 'review') {
      await client.query('ROLLBACK');
      throw new OkrSetValidationError(
        `OKR Set ${setId} is "${setRow.status}" — reflections may only be recorded while the Set is "active" or "review"`,
        'SET_NOT_REFLECTABLE',
        { setId, status: setRow.status }
      );
    }

    const existingResult = await client.query<OkrReflectionRow>(
      `SELECT * FROM okr_vnext_reflections WHERE objective_id = $1 AND organization_id = $2 FOR UPDATE`,
      [objectiveId, organizationId]
    );
    const existingRow = existingResult.rows[0];

    let beforeState: Record<string, unknown> | null = null;
    let resultRow: OkrReflectionRow;
    let nextVersion: number;

    if (!existingRow) {
      if (expectedVersion !== 0) {
        await client.query('ROLLBACK');
        throw new OkrReflectionNotFoundError(objectiveId);
      }
      nextVersion = 1;
      const insertResult = await client.query<OkrReflectionRow>(
        `INSERT INTO okr_vnext_reflections
           (set_id, objective_id, organization_id, what_worked, what_did_not_work, why, learning,
            next_cycle_change, disposition, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [setId, objectiveId, organizationId, whatWorked, whatDidNotWork, why, learning, nextCycleChange, disposition, actorUserId]
      );
      const inserted = insertResult.rows[0];
      if (!inserted) {
        throw new Error(`[recordObjectiveReflection] insert returned no row for objective ${objectiveId}`);
      }
      resultRow = inserted;
    } else {
      if (existingRow.row_version !== expectedVersion) {
        await client.query('ROLLBACK');
        throw new OkrReflectionValidationError(
          `OKR Reflection for Objective ${objectiveId} was modified since it was last read`,
          'STALE_VERSION',
          { objectiveId, currentVersion: existingRow.row_version, expectedVersion }
        );
      }
      if (existingRow.status !== 'draft') {
        await client.query('ROLLBACK');
        throw new OkrReflectionValidationError(
          `OKR Reflection for Objective ${objectiveId} is finalized — narrative fields may not be edited`,
          'NOT_EDITABLE',
          { objectiveId, status: existingRow.status }
        );
      }
      beforeState = { reflection: toOkrReflection(existingRow) };
      nextVersion = existingRow.row_version + 1;
      const updateResult = await client.query<OkrReflectionRow>(
        `UPDATE okr_vnext_reflections
            SET what_worked = $1, what_did_not_work = $2, why = $3, learning = $4,
                next_cycle_change = $5, disposition = $6,
                row_version = $7, updated_by = $8, updated_at = now()
          WHERE objective_id = $9
          RETURNING *`,
        [whatWorked, whatDidNotWork, why, learning, nextCycleChange, disposition, nextVersion, actorUserId, objectiveId]
      );
      const updated = updateResult.rows[0];
      if (!updated) {
        throw new Error(`[recordObjectiveReflection] update returned no row for objective ${objectiveId}`);
      }
      resultRow = updated;
    }

    const result = toOkrReflection(resultRow);
    const afterState: Record<string, unknown> = { reflection: result };
    const eventInput: AtomicEventInput = {
      schemaVersion: 1,
      eventType: 'okr_set.objective_reflection_recorded',
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
      afterState,
      stateHash: computeStateHash(afterState),
      reason,
      evidenceRefs: [],
      source: OKR_EVENT_SOURCE,
      idempotencyKey,
      expectedVersion,
      resultingVersion: nextVersion,
      payload: { setId, objectiveId },
    };

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

    const insertedEvent = eventResult.rows[0];
    if (!insertedEvent) {
      // Duplicate idempotency_key — roll back THIS call's mutation, return
      // the previously-committed result (same shape as
      // executeAtomicCommand's own duplicate handling).
      const existingEventResult = await client.query<ExistingEventRow>(
        `SELECT event_id, sequence, event_type, aggregate_type, aggregate_id, organization_id,
                occurred_at, recorded_at, before_state, after_state, resulting_version, idempotency_key
           FROM rvn_platform_events
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [organizationId, idempotencyKey]
      );
      const existingEvent = existingEventResult.rows[0];
      await client.query('ROLLBACK');
      if (!existingEvent) {
        throw new Error(
          `[recordObjectiveReflection] idempotency conflict on (${organizationId}, ${idempotencyKey}) but existing event row not found`
        );
      }
      const duplicateReflectionResult = await client.query<OkrReflectionRow>(
        `SELECT * FROM okr_vnext_reflections WHERE objective_id = $1 AND organization_id = $2`,
        [objectiveId, organizationId]
      );
      const duplicateRow = duplicateReflectionResult.rows[0];
      return {
        outcome: 'duplicate',
        eventId: existingEvent.event_id,
        resultingVersion: existingEvent.resulting_version,
        result: duplicateRow ? toOkrReflection(duplicateRow) : result,
      };
    }

    const consumerGroups = resolveConsumerGroups(eventInput.eventType);
    if (consumerGroups.length > 0) {
      await client.query(
        `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
        [insertedEvent.event_id, consumerGroups]
      );
    }

    await client.query('COMMIT');

    return {
      outcome: 'applied',
      eventId: insertedEvent.event_id,
      resultingVersion: insertedEvent.resulting_version,
      result,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.warn('[resultsVnext/okr/okrReflectionCommands] rollback after error failed', {
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}
