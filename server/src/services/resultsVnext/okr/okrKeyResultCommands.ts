/**
 * OKR-E003 — KeyResult command layer.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §10.5-§10.7,
 * ratified by the §-IO Integration Owner rulings block at the top of that
 * document.
 *
 * Every write here synchronously calls the pure `okrProgressEngine.ts` in
 * the SAME transaction as the KR row write, then recomputes the parent
 * Objective's rollup (`recomputeObjectiveRollup`, `okrObjectiveCommands.ts`)
 * in the SAME transaction — no background job, no async recompute pipeline
 * (D-E3-7: no AC names one for MVP).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { assertCommandCapability, type CommandAccessContext } from '../platform/commandCapabilityGuard.js';

import {
  assertSetEditableForUpdate,
  recomputeObjectiveRollup,
  resolveOkrCyclePinnedPolicySnapshot,
  OkrObjectiveNotFoundError,
} from './okrObjectiveCommands.js';
import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import {
  toOkrKeyResult,
  type OkrKeyResult,
  type OkrKeyResultConfidence,
  type OkrKeyResultDirection,
  type OkrKeyResultMeasurementType,
  type OkrKeyResultRow,
  type OkrKeyResultSourceType,
  type OkrKeyResultStatus,
} from './okrKeyResultTypes.js';
import { calculateKeyResultProgress } from './okrProgressEngine.js';

// ==========================================
// ERRORS
// ==========================================

export class OkrKeyResultValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrKeyResultValidationError';
    this.code = code;
    this.details = details;
  }
}

export class OkrKeyResultNotFoundError extends Error {
  code = 'KEY_RESULT_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(keyResultId: string) {
    super(`OKR KeyResult ${keyResultId} not found`);
    this.name = 'OkrKeyResultNotFoundError';
    this.details = { keyResultId };
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const OKR_KEY_RESULT_CAPABILITIES = {
  create: 'results.okr.key_result.create',
  update: 'results.okr.key_result.update',
  cancel: 'results.okr.key_result.cancel',
} as const;

// ==========================================
// D-E3-4: MVP-supported measurement_type gate
// ==========================================

const MVP_SUPPORTED_MEASUREMENT_TYPES: readonly OkrKeyResultMeasurementType[] = [
  'numeric',
  'percentage',
  'currency',
  'binary',
];

function assertMeasurementTypeImplemented(measurementType: OkrKeyResultMeasurementType): void {
  if (!MVP_SUPPORTED_MEASUREMENT_TYPES.includes(measurementType)) {
    throw new OkrKeyResultValidationError(
      `KeyResult measurement_type "${measurementType}" is not implemented in OKR-E003 MVP (numeric/percentage/currency/binary only)`,
      'MEASUREMENT_TYPE_NOT_IMPLEMENTED',
      { measurementType }
    );
  }
}

function assertCrossFieldValidity(fields: {
  measurementType: OkrKeyResultMeasurementType;
  currency: string | null;
  direction: OkrKeyResultDirection;
  rangeMin: number | null;
  rangeMax: number | null;
}): void {
  if (fields.measurementType === 'currency' && !fields.currency) {
    throw new OkrKeyResultValidationError(
      'currency is required when measurement_type="currency"',
      'CURRENCY_REQUIRED',
      {}
    );
  }
  if (fields.direction === 'maintain_range' && (fields.rangeMin === null || fields.rangeMax === null)) {
    throw new OkrKeyResultValidationError(
      'range_min and range_max are both required when direction="maintain_range"',
      'RANGE_REQUIRED',
      {}
    );
  }
}

// ==========================================
// createKeyResult (design §10.5)
// ==========================================

export interface CreateKeyResultInput {
  objectiveId: string;
  organizationId: string;
  ownerUserId: string;
  title: string;
  description?: string | null;
  measurementType: OkrKeyResultMeasurementType;
  unit?: string | null;
  currency?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  startValue?: number | null;
  currentValue?: number | null;
  direction: OkrKeyResultDirection;
  rangeMin?: number | null;
  rangeMax?: number | null;
  confidence?: OkrKeyResultConfidence | null;
  confidenceNumericValue?: number | null;
  sourceType?: OkrKeyResultSourceType;
  sourceReference?: string | null;
  weight?: number | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function createKeyResult(input: CreateKeyResultInput): Promise<AtomicCommandOutcome<OkrKeyResult>> {
  const {
    objectiveId,
    organizationId,
    ownerUserId,
    title,
    description = null,
    measurementType,
    unit = null,
    currency = null,
    baselineValue = null,
    targetValue = null,
    startValue = null,
    currentValue = null,
    direction,
    rangeMin = null,
    rangeMax = null,
    confidence = null,
    confidenceNumericValue = null,
    sourceType = 'manual',
    sourceReference = null,
    weight = null,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let resolvedSetId = '';

  return executeAtomicCreate<OkrKeyResult>({
    organizationId,
    applyMutation: async (client) => {
      const objectiveResult = await client.query<{ objective_id: string; set_id: string; owner_user_id: string }>(
        `SELECT objective_id, set_id, owner_user_id FROM okr_vnext_objectives WHERE objective_id = $1 AND organization_id = $2 FOR UPDATE`,
        [objectiveId, organizationId]
      );
      const objectiveRow = objectiveResult.rows[0];
      if (!objectiveRow) throw new OkrObjectiveNotFoundError(objectiveId);
      resolvedSetId = objectiveRow.set_id;

      // RN-G5: no KeyResult row exists yet — gated on the parent
      // Objective's own owner (same "CREATE gated on parent aggregate's
      // responsible person" shape as createObjective on the Set's
      // owner/reviewer). `ownerUserId` on the input is caller-supplied
      // content (the NEW KR's owner-to-be), never an authorization signal.
      assertCommandCapability({
        access,
        actorUserId: createdBy,
        capability: OKR_KEY_RESULT_CAPABILITIES.create,
        responsibleUserIds: [objectiveRow.owner_user_id],
      });

      await assertSetEditableForUpdate(client, objectiveRow.set_id, organizationId, 'createKeyResult');
      assertMeasurementTypeImplemented(measurementType);
      assertCrossFieldValidity({ measurementType, currency, direction, rangeMin, rangeMax });

      const { policyVersionId, snapshot } = await resolveOkrCyclePinnedPolicySnapshot(
        client,
        objectiveRow.set_id,
        organizationId
      );

      const progressCalc = calculateKeyResultProgress({
        direction,
        baselineValue,
        targetValue,
        currentValue,
        rangeMin,
        rangeMax,
      });

      const insertResult = await client.query<OkrKeyResultRow>(
        `INSERT INTO okr_vnext_key_results
           (objective_id, set_id, organization_id, owner_user_id, title, description,
            measurement_type, unit, currency, baseline_value, target_value, start_value, current_value,
            direction, range_min, range_max, progress, progress_calc_policy_version_id, progress_calc_reason,
            out_of_range_distance, confidence, confidence_numeric_value, source_type, source_reference, weight,
            created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
         RETURNING *`,
        [
          objectiveId,
          objectiveRow.set_id,
          organizationId,
          ownerUserId,
          title,
          description,
          measurementType,
          unit,
          currency,
          baselineValue,
          targetValue,
          startValue,
          currentValue,
          direction,
          rangeMin,
          rangeMax,
          progressCalc.progress,
          policyVersionId,
          progressCalc.reason,
          progressCalc.outOfRangeDistance,
          confidence,
          confidenceNumericValue,
          sourceType,
          sourceReference,
          weight,
          createdBy,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[createKeyResult] insert returned no row');
      const keyResult = toOkrKeyResult(row);

      // D-E3-9/§10.5: recompute the parent Objective's rollup in the SAME
      // transaction, over ALL its current KRs (not just this new one).
      await recomputeObjectiveRollup(client, {
        objectiveId,
        setId: objectiveRow.set_id,
        organizationId,
        policyVersionId,
        snapshot,
        actorUserId: createdBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
      });

      return keyResult;
    },
    buildEvent: ({ result }) => {
      const afterState = { keyResult: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_key_result.created',
        aggregateType: 'okr_set',
        aggregateId: resolvedSetId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.rowVersion,
        payload: { objectiveId, keyResultId: result.keyResultId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateKeyResult (design §10.6)
// ==========================================

async function loadKeyResultForUpdate(
  client: PoolClient,
  keyResultId: string,
  organizationId: string
): Promise<OkrKeyResultRow | undefined> {
  const result = await client.query<OkrKeyResultRow>(
    `SELECT * FROM okr_vnext_key_results WHERE key_result_id = $1 AND organization_id = $2 FOR UPDATE`,
    [keyResultId, organizationId]
  );
  return result.rows[0];
}
const keyResultRowVersion = (row: OkrKeyResultRow) => row.row_version;

export interface UpdateKeyResultInput {
  keyResultId: string;
  organizationId: string;
  expectedVersion: number;
  title?: string;
  description?: string | null;
  ownerUserId?: string;
  measurementType?: OkrKeyResultMeasurementType;
  unit?: string | null;
  currency?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  startValue?: number | null;
  currentValue?: number | null;
  direction?: OkrKeyResultDirection;
  rangeMin?: number | null;
  rangeMax?: number | null;
  confidence?: OkrKeyResultConfidence | null;
  confidenceNumericValue?: number | null;
  /** Owner-declared only (§-IO item 9) — any value except 'cancelled' (use
   * `cancelKeyResult` for that transition instead, kept as the one guarded
   * path to 'cancelled'). */
  status?: Exclude<OkrKeyResultStatus, 'cancelled'>;
  sourceType?: OkrKeyResultSourceType;
  sourceReference?: string | null;
  weight?: number | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function updateKeyResult(input: UpdateKeyResultInput): Promise<AtomicCommandOutcome<OkrKeyResult>> {
  const {
    keyResultId,
    organizationId,
    expectedVersion,
    title,
    description,
    ownerUserId,
    measurementType,
    unit,
    currency,
    baselineValue,
    targetValue,
    startValue,
    currentValue,
    direction,
    rangeMin,
    rangeMax,
    confidence,
    confidenceNumericValue,
    status,
    sourceType,
    sourceReference,
    weight,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrKeyResultRow, OkrKeyResult>({
    organizationId,
    aggregateId: keyResultId,
    expectedVersion,
    loadForUpdate: loadKeyResultForUpdate,
    getCurrentVersion: keyResultRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: OKR_KEY_RESULT_CAPABILITIES.update,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      await assertSetEditableForUpdate(client, currentRow.set_id, organizationId, 'updateKeyResult');

      const mergedMeasurementType = measurementType ?? currentRow.measurement_type;
      if (measurementType !== undefined) {
        assertMeasurementTypeImplemented(measurementType);
      }
      const merged = {
        title: title ?? currentRow.title,
        description: description !== undefined ? description : currentRow.description,
        ownerUserId: ownerUserId ?? currentRow.owner_user_id,
        measurementType: mergedMeasurementType,
        unit: unit !== undefined ? unit : currentRow.unit,
        currency: currency !== undefined ? currency : currentRow.currency,
        baselineValue: baselineValue !== undefined ? baselineValue : currentRow.baseline_value === null ? null : Number(currentRow.baseline_value),
        targetValue: targetValue !== undefined ? targetValue : currentRow.target_value === null ? null : Number(currentRow.target_value),
        startValue: startValue !== undefined ? startValue : currentRow.start_value === null ? null : Number(currentRow.start_value),
        currentValue: currentValue !== undefined ? currentValue : currentRow.current_value === null ? null : Number(currentRow.current_value),
        direction: direction ?? currentRow.direction,
        rangeMin: rangeMin !== undefined ? rangeMin : currentRow.range_min === null ? null : Number(currentRow.range_min),
        rangeMax: rangeMax !== undefined ? rangeMax : currentRow.range_max === null ? null : Number(currentRow.range_max),
        confidence: confidence !== undefined ? confidence : currentRow.confidence,
        confidenceNumericValue:
          confidenceNumericValue !== undefined
            ? confidenceNumericValue
            : currentRow.confidence_numeric_value === null
              ? null
              : Number(currentRow.confidence_numeric_value),
        status: status ?? currentRow.status,
        sourceType: sourceType ?? currentRow.source_type,
        sourceReference: sourceReference !== undefined ? sourceReference : currentRow.source_reference,
        weight: weight !== undefined ? weight : currentRow.weight === null ? null : Number(currentRow.weight),
      };

      assertCrossFieldValidity({
        measurementType: merged.measurementType,
        currency: merged.currency,
        direction: merged.direction,
        rangeMin: merged.rangeMin,
        rangeMax: merged.rangeMax,
      });

      const { policyVersionId, snapshot } = await resolveOkrCyclePinnedPolicySnapshot(
        client,
        currentRow.set_id,
        organizationId
      );

      // Always recompute progress from the merged inputs — simpler and
      // always-correct than selectively deciding which field changes
      // "count" as recompute-triggering (a deliberate simplification vs.
      // the design's illustrative field list, stated here rather than
      // silently narrowed).
      const progressCalc = calculateKeyResultProgress({
        direction: merged.direction,
        baselineValue: merged.baselineValue,
        targetValue: merged.targetValue,
        currentValue: merged.currentValue,
        rangeMin: merged.rangeMin,
        rangeMax: merged.rangeMax,
      });

      beforeState = { keyResult: toOkrKeyResult(currentRow) };

      const updateResult = await client.query<OkrKeyResultRow>(
        `UPDATE okr_vnext_key_results
            SET title = $1, description = $2, owner_user_id = $3, measurement_type = $4, unit = $5, currency = $6,
                baseline_value = $7, target_value = $8, start_value = $9, current_value = $10,
                direction = $11, range_min = $12, range_max = $13,
                progress = $14, progress_calc_policy_version_id = $15, progress_calc_reason = $16, out_of_range_distance = $17,
                confidence = $18, confidence_numeric_value = $19, status = $20, source_type = $21, source_reference = $22,
                weight = $23, row_version = $24, updated_by = $25, updated_at = now()
          WHERE key_result_id = $26
          RETURNING *`,
        [
          merged.title,
          merged.description,
          merged.ownerUserId,
          merged.measurementType,
          merged.unit,
          merged.currency,
          merged.baselineValue,
          merged.targetValue,
          merged.startValue,
          merged.currentValue,
          merged.direction,
          merged.rangeMin,
          merged.rangeMax,
          progressCalc.progress,
          policyVersionId,
          progressCalc.reason,
          progressCalc.outOfRangeDistance,
          merged.confidence,
          merged.confidenceNumericValue,
          merged.status,
          merged.sourceType,
          merged.sourceReference,
          merged.weight,
          nextVersion,
          actorUserId,
          keyResultId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[updateKeyResult] update returned no row for ${keyResultId}`);
      const keyResult = toOkrKeyResult(updatedRow);

      await recomputeObjectiveRollup(client, {
        objectiveId: currentRow.objective_id,
        setId: currentRow.set_id,
        organizationId,
        policyVersionId,
        snapshot,
        actorUserId,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
      });

      return keyResult;
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { keyResult: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_key_result.updated',
        aggregateType: 'okr_set',
        aggregateId: result.setId,
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
        payload: { keyResultId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// cancelKeyResult (maps DELETE /key-results/:keyResultId, design §10.7)
// ==========================================

const OKR_KEY_RESULT_CANCEL_FROM_STATUSES: readonly OkrKeyResultStatus[] = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'not_achieved',
];

export interface CancelKeyResultInput {
  keyResultId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function cancelKeyResult(input: CancelKeyResultInput): Promise<AtomicCommandOutcome<OkrKeyResult>> {
  const {
    keyResultId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrKeyResultRow, OkrKeyResult>({
    organizationId,
    aggregateId: keyResultId,
    expectedVersion,
    loadForUpdate: loadKeyResultForUpdate,
    getCurrentVersion: keyResultRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: OKR_KEY_RESULT_CAPABILITIES.cancel,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      await assertSetEditableForUpdate(client, currentRow.set_id, organizationId, 'cancelKeyResult');
      if (!OKR_KEY_RESULT_CANCEL_FROM_STATUSES.includes(currentRow.status)) {
        throw new OkrKeyResultValidationError(
          `KeyResult ${keyResultId} is "${currentRow.status}" — cannot cancel from there`,
          'INVALID_TRANSITION',
          { keyResultId, currentStatus: currentRow.status }
        );
      }
      beforeState = { keyResult: toOkrKeyResult(currentRow) };

      const updateResult = await client.query<OkrKeyResultRow>(
        `UPDATE okr_vnext_key_results
            SET status = 'cancelled', row_version = $1, updated_by = $2, updated_at = now()
          WHERE key_result_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, keyResultId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[cancelKeyResult] update returned no row for ${keyResultId}`);
      const keyResult = toOkrKeyResult(updatedRow);

      // §9.3/§10.7: a cancelled KR is excluded from the Objective rollup's
      // input (recomputeObjectiveRollup's own query filters status <>
      // 'cancelled') — recompute so the parent Objective no longer counts it.
      const { policyVersionId, snapshot } = await resolveOkrCyclePinnedPolicySnapshot(
        client,
        currentRow.set_id,
        organizationId
      );
      await recomputeObjectiveRollup(client, {
        objectiveId: currentRow.objective_id,
        setId: currentRow.set_id,
        organizationId,
        policyVersionId,
        snapshot,
        actorUserId,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
      });

      return keyResult;
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { keyResult: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_key_result.cancelled',
        aggregateType: 'okr_set',
        aggregateId: result.setId,
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
        payload: { keyResultId },
      } satisfies AtomicEventInput;
    },
  });
}
