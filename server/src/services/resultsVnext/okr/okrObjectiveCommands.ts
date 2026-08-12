/**
 * OKR-E003 — Objective command layer + the two extension points E002
 * forward-declared (`hasSufficientKeyResultCoverage` wraps, never replaces,
 * `isOkrSetReadyForSubmissionEligible`; `buildObjectivesSnapshotFragment`
 * populates `buildOkrSetApprovalSnapshotPayload`'s `objectives: []`
 * placeholder) + shared helpers `okrKeyResultCommands.ts` also imports
 * (`assertSetEditableForUpdate`, `resolveOkrCyclePinnedPolicySnapshot`,
 * `insertManualOkrEvent`, `recomputeObjectiveRollup`).
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §10-§12, ratified
 * by the §-IO Integration Owner rulings block at the top of that document.
 *
 * Re-verified against OKR-E001/E002's ACTUAL LANDED code (ruling IO-1) —
 * both epics are merged in this worktree, not just their frozen design
 * docs. `isOkrSetReadyForSubmissionEligible` and
 * `buildOkrSetApprovalSnapshotPayload` are read verbatim from
 * `okrSetCommands.ts` before this file wraps/extends them; `getOkrSet`
 * (`okrSetRepository.ts`) does NOT return nested Objectives/KRs — it
 * returns a flat `OkrSet` — so §-IO item 10's `GET /sets/:setId/objectives`
 * route is ADDITIVE, not duplicative, and is kept (see `okr.routes.ts`).
 *
 * One-directional import: this file does NOT import from `okrSetCommands.ts`
 * (its own `assertSetEditableForUpdate` queries `okr_vnext_sets` directly,
 * mirroring `roiCostLineCommands.ts`'s local `assertCaseEditableForUpdate`)
 * — `okrSetCommands.ts` imports FROM this file (`hasSufficientKeyResultCoverage`,
 * `resolveOkrCyclePinnedPolicySnapshot`), never the reverse, so there is no
 * import cycle.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  EVENT_INSERT_SQL,
  executeAtomicCommand,
  executeAtomicCreate,
  resolveConsumerGroups,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { assertCommandCapability, type CommandAccessContext } from '../platform/commandCapabilityGuard.js';

import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import type { OkrProgramPolicySnapshot } from './okrProgramTypes.js';
import {
  toOkrObjective,
  type OkrObjective,
  type OkrObjectiveAmbitionType,
  type OkrObjectiveConfidence,
  type OkrObjectiveRow,
  type OkrObjectiveStatus,
} from './okrObjectiveTypes.js';
import {
  calculateObjectiveConfidenceRollup,
  calculateObjectiveProgressRollup,
  type OkrConfidenceValue,
} from './okrProgressEngine.js';
import type { OkrSetRow } from './okrSetTypes.js';

// ==========================================
// ERRORS
// ==========================================

/** Generic invalid-input / policy-gating guard for Objective commands —
 * mirrors `OkrSetValidationError`'s role in the Set command layer. */
export class OkrObjectiveValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrObjectiveValidationError';
    this.code = code;
    this.details = details;
  }
}

/** Parent Set is not in an editable status (`draft`/`changes_requested`) —
 * mirrors `RoiEconomicModelNotEditableError`'s role for cost/benefit lines. */
export class OkrObjectiveSetNotEditableError extends Error {
  code = 'SET_NOT_EDITABLE';
  details: Record<string, unknown>;
  constructor(setId: string, status: string) {
    super(`OKR Set ${setId} is "${status}" — Objective/KeyResult content may not be edited from this status`);
    this.name = 'OkrObjectiveSetNotEditableError';
    this.details = { setId, status };
  }
}

export class OkrObjectiveNotFoundError extends Error {
  code = 'OBJECTIVE_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(objectiveId: string) {
    super(`OKR Objective ${objectiveId} not found`);
    this.name = 'OkrObjectiveNotFoundError';
    this.details = { objectiveId };
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const OKR_OBJECTIVE_CAPABILITIES = {
  create: 'results.okr.objective.create',
  update: 'results.okr.objective.update',
  cancel: 'results.okr.objective.cancel',
} as const;

// ==========================================
// SHARED HELPERS (also imported by okrKeyResultCommands.ts)
// ==========================================

const OKR_SET_CONTENT_EDITABLE_STATUSES = ['draft', 'changes_requested'];

/**
 * Design §10.1: mirrors `roiCostLineCommands.ts`'s `assertCaseEditableForUpdate`
 * exactly. Objective/KR content is editable only while the OWNING Set is
 * `draft`/`changes_requested` — once a Set is `approved`/`active`, adding,
 * editing, or cancelling Objectives/KRs is out of scope for this epic (a
 * stated design gap, not silently missing — see EXECUTION_LEDGER closure
 * entry).
 */
export async function assertSetEditableForUpdate(
  client: PoolClient,
  setId: string,
  organizationId: string,
  op: string
): Promise<OkrSetRow> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
    [setId, organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`[${op}] set ${setId} not found`);
  }
  if (!OKR_SET_CONTENT_EDITABLE_STATUSES.includes(row.status)) {
    throw new OkrObjectiveSetNotEditableError(setId, row.status);
  }
  return row;
}

export interface OkrCyclePinnedPolicy {
  policyVersionId: string;
  snapshot: OkrProgramPolicySnapshot;
}

/**
 * D-E3-6: resolves the Cycle's PINNED policy snapshot
 * (`okr_vnext_program_policy_versions.snapshot`, reached via
 * `okr_vnext_sets.cycle_id -> okr_vnext_cycles.policy_version_id`) — NEVER
 * a live re-read of `okr_vnext_programs`'s current row. This is the literal
 * mechanism the DoD's pinned-policy-version proof exercises: publishing a
 * NEW Program policy version after a Cycle already exists must never change
 * what an existing Set's Objectives/KRs resolve.
 */
export async function resolveOkrCyclePinnedPolicySnapshot(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<OkrCyclePinnedPolicy> {
  const result = await client.query<{ policy_version_id: string; snapshot: OkrProgramPolicySnapshot }>(
    `SELECT ppv.policy_version_id, ppv.snapshot
       FROM okr_vnext_sets s
       JOIN okr_vnext_cycles c ON c.cycle_id = s.cycle_id
       JOIN okr_vnext_program_policy_versions ppv ON ppv.policy_version_id = c.policy_version_id
      WHERE s.set_id = $1 AND s.organization_id = $2`,
    [setId, organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`[resolveOkrCyclePinnedPolicySnapshot] no pinned policy version found for set ${setId}`);
  }
  return { policyVersionId: row.policy_version_id, snapshot: row.snapshot };
}

/**
 * Replicates the "insert event row (idempotency-guarded) + fan out to
 * outbox" half of `executeAtomicCommand`/`executeAtomicCreate` for a SECOND
 * event emitted inside a transaction that is already committing a primary
 * event via one of those two helpers — same pattern as
 * `kpiDeviationCommands.ts`'s `insertManualDeviationEvent` (that file's own
 * header names this exact reuse). Used here for `okr_objective.progress_recalculated`,
 * which always rides along a KR create/update/cancel's own primary event
 * rather than being its own top-level command.
 */
export async function insertManualOkrEvent(client: PoolClient, eventInput: AtomicEventInput): Promise<string | undefined> {
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
  if (!inserted) return undefined;
  const consumerGroups = resolveConsumerGroups(eventInput.eventType);
  if (consumerGroups.length > 0) {
    await client.query(
      `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
         SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
      [inserted.event_id, consumerGroups]
    );
  }
  return inserted.event_id;
}

function numOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export interface RecomputeObjectiveRollupParams {
  objectiveId: string;
  setId: string;
  organizationId: string;
  policyVersionId: string;
  snapshot: OkrProgramPolicySnapshot;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

/**
 * D-E3-9/§10.5: recomputes and persists the parent Objective's rolled-up
 * `progress`/`confidence` from ALL its own non-cancelled KRs (not just the
 * one that just changed), in the SAME transaction/pinned client as the
 * KR write that triggered it. Emits `okr_objective.progress_recalculated`
 * via `insertManualOkrEvent` — a SECOND event in the same transaction as
 * the KR command's own primary event, using a deterministic but DISTINCT
 * idempotency key (reusing the caller's own key would collide on
 * `(organization_id, idempotency_key)` and silently drop this event via
 * `ON CONFLICT DO NOTHING`).
 *
 * D-E3-10: when `objectiveConfidenceModel` is `'owner_selected'`, the
 * existing owner-set value is PRESERVED, never overwritten by a rollup —
 * only `'lowest_kr'` is actually computed here. `'custom'` throws
 * `OkrObjectiveValidationError('CONFIDENCE_MODEL_NOT_IMPLEMENTED', ...)` —
 * a deliberate, literal reading of D-E3-10's "reject ... if a Program's
 * active policy specifies custom": this blocks the WHOLE triggering KR
 * write (transaction rollback), not just the confidence field, since E003
 * has no partial-recompute-failure story. Flagged in the EXECUTION_LEDGER
 * closure entry as a real, load-bearing consequence, not a silent side
 * effect.
 */
export async function recomputeObjectiveRollup(
  client: PoolClient,
  params: RecomputeObjectiveRollupParams
): Promise<OkrObjective> {
  const {
    objectiveId,
    setId,
    organizationId,
    policyVersionId,
    snapshot,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = params;

  if (snapshot.objectiveConfidenceModel === 'custom') {
    throw new OkrObjectiveValidationError(
      `Objective ${objectiveId}: objective_confidence_model "custom" is not implemented in OKR-E003 (D-E3-10)`,
      'CONFIDENCE_MODEL_NOT_IMPLEMENTED',
      { objectiveId, confidenceModel: 'custom' }
    );
  }

  const krResult = await client.query<{
    progress: string | null;
    weight: string | null;
    confidence: OkrConfidenceValue | null;
    confidence_numeric_value: string | null;
  }>(
    `SELECT progress, weight, confidence, confidence_numeric_value
       FROM okr_vnext_key_results
      WHERE objective_id = $1 AND organization_id = $2 AND status <> 'cancelled'`,
    [objectiveId, organizationId]
  );

  const keyResultProgresses = krResult.rows.map((row) => ({
    progress: numOrNull(row.progress),
    weight: numOrNull(row.weight),
  }));
  const keyResultConfidences = krResult.rows.map((row) => ({
    confidence: row.confidence,
    confidenceNumericValue: numOrNull(row.confidence_numeric_value),
  }));

  const progressResult = calculateObjectiveProgressRollup({
    keyResultProgresses,
    rollupModel: snapshot.objectiveRollupModel,
  });

  const currentObjectiveResult = await client.query<OkrObjectiveRow>(
    `SELECT * FROM okr_vnext_objectives WHERE objective_id = $1 AND organization_id = $2 FOR UPDATE`,
    [objectiveId, organizationId]
  );
  const currentObjectiveRow = currentObjectiveResult.rows[0];
  if (!currentObjectiveRow) {
    throw new OkrObjectiveNotFoundError(objectiveId);
  }

  const confidenceResult =
    snapshot.objectiveConfidenceModel === 'owner_selected'
      ? {
          confidence: currentObjectiveRow.confidence,
          confidenceNumericValue: numOrNull(currentObjectiveRow.confidence_numeric_value),
          reason: currentObjectiveRow.confidence_calc_reason ?? 'owner_selected: no value set by Objective Owner yet',
        }
      : calculateObjectiveConfidenceRollup({ keyResultConfidences, confidenceModel: snapshot.objectiveConfidenceModel });

  const nextVersion = currentObjectiveRow.row_version + 1;
  const updateResult = await client.query<OkrObjectiveRow>(
    `UPDATE okr_vnext_objectives
        SET progress = $1, progress_calc_policy_version_id = $2, progress_calc_reason = $3,
            confidence = $4, confidence_numeric_value = $5,
            confidence_calc_policy_version_id = $6, confidence_calc_reason = $7,
            row_version = $8, updated_by = $9, updated_at = now()
      WHERE objective_id = $10
      RETURNING *`,
    [
      progressResult.progress,
      policyVersionId,
      progressResult.reason,
      confidenceResult.confidence,
      confidenceResult.confidenceNumericValue,
      snapshot.objectiveConfidenceModel === 'owner_selected' ? currentObjectiveRow.confidence_calc_policy_version_id : policyVersionId,
      confidenceResult.reason,
      nextVersion,
      actorUserId,
      objectiveId,
    ]
  );
  const updatedRow = updateResult.rows[0];
  if (!updatedRow) {
    throw new Error(`[recomputeObjectiveRollup] update returned no row for ${objectiveId}`);
  }
  const updated = toOkrObjective(updatedRow);

  const afterState = { objective: updated };
  await insertManualOkrEvent(client, {
    schemaVersion: 1,
    eventType: 'okr_objective.progress_recalculated',
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
    beforeState: null,
    afterState,
    stateHash: computeStateHash(afterState),
    reason: 'objective progress/confidence rollup recomputed after a key result write',
    evidenceRefs: [],
    source: OKR_EVENT_SOURCE,
    // Distinct from the triggering command's own idempotency key — reusing
    // it would collide on (organization_id, idempotency_key) and silently
    // drop this second event via ON CONFLICT DO NOTHING.
    idempotencyKey: `${idempotencyKey}:objective_progress_recalculated`,
    expectedVersion: currentObjectiveRow.row_version,
    resultingVersion: nextVersion,
    payload: { objectiveId, setId },
  });

  return updated;
}

// ==========================================
// createObjective (OKR-F-007-AC-01, design §10.2)
// ==========================================

export interface CreateObjectiveInput {
  setId: string;
  organizationId: string;
  ownerUserId: string;
  title: string;
  description?: string | null;
  rationale?: string | null;
  ambitionType?: OkrObjectiveAmbitionType;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/**
 * D-E3-3: `ambitionType` CHECK is schema-permissive (all 3 values always
 * allowed) — this command rejects `committed`/`aspirational` at the
 * COMMAND layer when the Cycle's pinned policy has
 * `committedVsAspirationalEnabled=false`.
 */
export async function createObjective(input: CreateObjectiveInput): Promise<AtomicCommandOutcome<OkrObjective>> {
  const {
    setId,
    organizationId,
    ownerUserId,
    title,
    description = null,
    rationale = null,
    ambitionType = 'standard',
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<OkrObjective>({
    organizationId,
    applyMutation: async (client) => {
      const setRow = await assertSetEditableForUpdate(client, setId, organizationId, 'createObjective');

      // RN-G5: no Objective row exists yet to carry its own responsible
      // person, so this CREATE is authorized off the parent Set's own
      // owner/reviewer (the Set is already loaded above by
      // assertSetEditableForUpdate) — same "gate CREATE on the parent
      // aggregate's responsible people" shape as ROI's child-entity
      // commands (`roiAssumptionCommands.ts` et al., via
      // `assertCaseEditableForUpdate`). `ownerUserId` on the input is
      // caller-supplied content (who the NEW Objective's owner will be),
      // never trusted as an authorization signal.
      assertCommandCapability({
        access,
        actorUserId: createdBy,
        capability: OKR_OBJECTIVE_CAPABILITIES.create,
        responsibleUserIds: [setRow.owner_user_id, setRow.reviewer_user_id],
      });

      if (ambitionType !== 'standard') {
        const { snapshot } = await resolveOkrCyclePinnedPolicySnapshot(client, setId, organizationId);
        if (!snapshot.committedVsAspirationalEnabled) {
          throw new OkrObjectiveValidationError(
            `Objective ambition_type "${ambitionType}" is disabled by this Program's committed_vs_aspirational_enabled policy`,
            'AMBITION_TYPE_DISABLED',
            { ambitionType }
          );
        }
      }

      const sortOrderResult = await client.query<{ next_sort_order: string }>(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
           FROM okr_vnext_objectives WHERE set_id = $1 AND organization_id = $2`,
        [setId, organizationId]
      );
      const sortOrder = Number(sortOrderResult.rows[0]?.next_sort_order ?? 1);

      const insertResult = await client.query<OkrObjectiveRow>(
        `INSERT INTO okr_vnext_objectives
           (set_id, organization_id, owner_user_id, title, description, rationale, ambition_type, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [setId, organizationId, ownerUserId, title, description, rationale, ambitionType, sortOrder, createdBy]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[createObjective] insert returned no row');
      return toOkrObjective(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { objective: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_objective.created',
        aggregateType: 'okr_set',
        aggregateId: setId,
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
        payload: { setId, objectiveId: result.objectiveId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateObjective (design §10.3)
// ==========================================

async function loadObjectiveForUpdate(
  client: PoolClient,
  objectiveId: string,
  organizationId: string
): Promise<OkrObjectiveRow | undefined> {
  const result = await client.query<OkrObjectiveRow>(
    `SELECT * FROM okr_vnext_objectives WHERE objective_id = $1 AND organization_id = $2 FOR UPDATE`,
    [objectiveId, organizationId]
  );
  return result.rows[0];
}
const objectiveRowVersion = (row: OkrObjectiveRow) => row.row_version;

export interface UpdateObjectiveInput {
  objectiveId: string;
  organizationId: string;
  expectedVersion: number;
  title?: string;
  description?: string | null;
  rationale?: string | null;
  ambitionType?: OkrObjectiveAmbitionType;
  ownerUserId?: string;
  /** Only accepted when the Cycle's pinned `objectiveConfidenceModel` is
   * `'owner_selected'` — otherwise rejected with
   * `CONFIDENCE_NOT_OWNER_EDITABLE` (D-E3-10). */
  confidence?: OkrObjectiveConfidence | null;
  confidenceNumericValue?: number | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function updateObjective(input: UpdateObjectiveInput): Promise<AtomicCommandOutcome<OkrObjective>> {
  const {
    objectiveId,
    organizationId,
    expectedVersion,
    title,
    description,
    rationale,
    ambitionType,
    ownerUserId,
    confidence,
    confidenceNumericValue,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrObjectiveRow, OkrObjective>({
    organizationId,
    aggregateId: objectiveId,
    expectedVersion,
    loadForUpdate: loadObjectiveForUpdate,
    getCurrentVersion: objectiveRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // RN-G5: coarse authorization FIRST, before any business rule below.
      assertCommandCapability({
        access,
        actorUserId,
        capability: OKR_OBJECTIVE_CAPABILITIES.update,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      await assertSetEditableForUpdate(client, currentRow.set_id, organizationId, 'updateObjective');
      const { snapshot, policyVersionId } = await resolveOkrCyclePinnedPolicySnapshot(
        client,
        currentRow.set_id,
        organizationId
      );

      const nextAmbitionType = ambitionType ?? currentRow.ambition_type;
      if (nextAmbitionType !== 'standard' && !snapshot.committedVsAspirationalEnabled) {
        throw new OkrObjectiveValidationError(
          `Objective ambition_type "${nextAmbitionType}" is disabled by this Program's committed_vs_aspirational_enabled policy`,
          'AMBITION_TYPE_DISABLED',
          { ambitionType: nextAmbitionType }
        );
      }

      let confidenceUpdate = {
        confidence: currentRow.confidence,
        confidenceNumericValue: currentRow.confidence_numeric_value,
        calcPolicyVersionId: currentRow.confidence_calc_policy_version_id,
        calcReason: currentRow.confidence_calc_reason,
      };
      if (confidence !== undefined || confidenceNumericValue !== undefined) {
        if (snapshot.objectiveConfidenceModel !== 'owner_selected') {
          throw new OkrObjectiveValidationError(
            `Objective ${objectiveId}: confidence is engine-computed (objective_confidence_model="${snapshot.objectiveConfidenceModel}") and may not be edited directly`,
            'CONFIDENCE_NOT_OWNER_EDITABLE',
            { objectiveConfidenceModel: snapshot.objectiveConfidenceModel }
          );
        }
        confidenceUpdate = {
          confidence: confidence ?? null,
          confidenceNumericValue: confidenceNumericValue === undefined ? null : String(confidenceNumericValue),
          calcPolicyVersionId: policyVersionId,
          calcReason: 'owner_selected: Objective Owner value set via updateObjective',
        };
      }

      beforeState = { objective: toOkrObjective(currentRow) };

      const merged = {
        title: title ?? currentRow.title,
        description: description !== undefined ? description : currentRow.description,
        rationale: rationale !== undefined ? rationale : currentRow.rationale,
        ambitionType: nextAmbitionType,
        ownerUserId: ownerUserId ?? currentRow.owner_user_id,
      };

      const updateResult = await client.query<OkrObjectiveRow>(
        `UPDATE okr_vnext_objectives
            SET title = $1, description = $2, rationale = $3, ambition_type = $4, owner_user_id = $5,
                confidence = $6, confidence_numeric_value = $7,
                confidence_calc_policy_version_id = $8, confidence_calc_reason = $9,
                row_version = $10, updated_by = $11, updated_at = now()
          WHERE objective_id = $12
          RETURNING *`,
        [
          merged.title,
          merged.description,
          merged.rationale,
          merged.ambitionType,
          merged.ownerUserId,
          confidenceUpdate.confidence,
          confidenceUpdate.confidenceNumericValue,
          confidenceUpdate.calcPolicyVersionId,
          confidenceUpdate.calcReason,
          nextVersion,
          actorUserId,
          objectiveId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[updateObjective] update returned no row for ${objectiveId}`);
      return toOkrObjective(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { objective: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_objective.updated',
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
        payload: { objectiveId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// cancelObjective (maps DELETE /objectives/:objectiveId, design §10.4)
// ==========================================

const OKR_OBJECTIVE_CANCEL_FROM_STATUSES: readonly OkrObjectiveStatus[] = [
  'draft',
  'submitted',
  'approved',
  'active',
  'at_risk',
];

export interface CancelObjectiveInput {
  objectiveId: string;
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

/**
 * Design §10.4: guarded transition to `status='cancelled'`. §-IO item 8 /
 * D-E3-8's explicit no-cascade rule: this command does NOT touch any child
 * KeyResult row — an active/at_risk KR under a cancelled Objective is a
 * permitted state, covered by an explicit test
 * (`okrObjectiveLifecycle.realdb.test.ts`). Auto-cascade is exactly the
 * legacy `okr_objectives.parent_id` cascade-rollup pattern this program
 * exists to unwind (plan §3.2) — if a cascade is ever wanted it must be an
 * explicit, separately-named command, never an invisible side effect here.
 */
export async function cancelObjective(input: CancelObjectiveInput): Promise<AtomicCommandOutcome<OkrObjective>> {
  const {
    objectiveId,
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

  return executeAtomicCommand<OkrObjectiveRow, OkrObjective>({
    organizationId,
    aggregateId: objectiveId,
    expectedVersion,
    loadForUpdate: loadObjectiveForUpdate,
    getCurrentVersion: objectiveRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertCommandCapability({
        access,
        actorUserId,
        capability: OKR_OBJECTIVE_CAPABILITIES.cancel,
        responsibleUserIds: [currentRow.owner_user_id],
      });

      await assertSetEditableForUpdate(client, currentRow.set_id, organizationId, 'cancelObjective');
      if (!OKR_OBJECTIVE_CANCEL_FROM_STATUSES.includes(currentRow.status)) {
        throw new OkrObjectiveValidationError(
          `Objective ${objectiveId} is "${currentRow.status}" — cannot cancel from there`,
          'INVALID_TRANSITION',
          { objectiveId, currentStatus: currentRow.status }
        );
      }
      beforeState = { objective: toOkrObjective(currentRow) };

      const updateResult = await client.query<OkrObjectiveRow>(
        `UPDATE okr_vnext_objectives
            SET status = 'cancelled', row_version = $1, updated_by = $2, updated_at = now()
          WHERE objective_id = $3
          RETURNING *`,
        [nextVersion, actorUserId, objectiveId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[cancelObjective] update returned no row for ${objectiveId}`);
      // Deliberately NO update/query against okr_vnext_key_results here —
      // no cascade (§-IO item 8).
      return toOkrObjective(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { objective: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_objective.cancelled',
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
        payload: { objectiveId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// hasSufficientKeyResultCoverage (design §11) — wraps, never replaces,
// isOkrSetReadyForSubmissionEligible (okrSetCommands.ts, E002, untouched)
// ==========================================

export interface KeyResultCoverageCheck {
  eligible: boolean;
  reason?: string;
  details?: {
    totalObjectives: number;
    objectivesBelowMinimum: Array<{ objectiveId: string; title: string; krCount: number; required: number }>;
  };
}

/**
 * OKR-F-008-AC-02: every non-cancelled Objective on the Set must have at
 * least `krMinRequired` non-cancelled KeyResults before the Set may submit.
 * D-E3-5 / §-IO item 3 (binding): enforced PER-OBJECTIVE, not as a Set-wide
 * total — E002's own forward-declaration names this exact wording, ratified
 * as binding by the Integration Owner. §-IO item 6: no company/BU/team
 * special-casing — this query applies identically to every scope_type.
 *
 * MUST be called on the SAME pinned client/transaction `submitOkrSetForApproval`
 * already holds (okrSetCommands.ts, E002) — imported and called there, this
 * function is never a standalone top-level command.
 */
export async function hasSufficientKeyResultCoverage(
  client: PoolClient,
  setId: string,
  organizationId: string,
  krMinRequired: number
): Promise<KeyResultCoverageCheck> {
  const result = await client.query<{ objective_id: string; title: string; kr_count: string }>(
    `SELECT o.objective_id, o.title, COUNT(kr.key_result_id) AS kr_count
       FROM okr_vnext_objectives o
       LEFT JOIN okr_vnext_key_results kr
              ON kr.objective_id = o.objective_id AND kr.status <> 'cancelled'
      WHERE o.set_id = $1 AND o.organization_id = $2 AND o.status <> 'cancelled'
      GROUP BY o.objective_id, o.title`,
    [setId, organizationId]
  );

  if (result.rows.length === 0) {
    return { eligible: false, reason: 'no_objectives', details: { totalObjectives: 0, objectivesBelowMinimum: [] } };
  }

  const objectivesBelowMinimum = result.rows
    .filter((row) => Number(row.kr_count) < krMinRequired)
    .map((row) => ({ objectiveId: row.objective_id, title: row.title, krCount: Number(row.kr_count), required: krMinRequired }));

  if (objectivesBelowMinimum.length > 0) {
    return {
      eligible: false,
      reason: 'insufficient_key_results',
      details: { totalObjectives: result.rows.length, objectivesBelowMinimum },
    };
  }
  return { eligible: true };
}

// ==========================================
// buildObjectivesSnapshotFragment (design §12) — populates
// buildOkrSetApprovalSnapshotPayload's `objectives: []` placeholder
// (okrSetCommands.ts, E002, untouched body — only its call site widens).
// ==========================================

export interface ObjectiveSnapshotKeyResultFragment {
  keyResultId: string;
  title: string;
  description: string | null;
  measurementType: string;
  unit: string | null;
  currency: string | null;
  baselineValue: string | null;
  targetValue: string | null;
  startValue: string | null;
  currentValue: string | null;
  direction: string;
  rangeMin: string | null;
  rangeMax: string | null;
  progress: string | null;
  progressCalcReason: string | null;
  outOfRangeDistance: string | null;
  confidence: string | null;
  sourceType: string;
  sourceReference: string | null;
  weight: string | null;
}

export interface ObjectiveSnapshotFragment {
  objectiveId: string;
  title: string;
  description: string | null;
  rationale: string | null;
  ambitionType: string;
  ownerUserId: string;
  sortOrder: number;
  progress: string | null;
  progressCalcReason: string | null;
  confidence: string | null;
  keyResults: ObjectiveSnapshotKeyResultFragment[];
}

/**
 * Called from INSIDE `approveOkrSet`'s `applyMutation` (E002,
 * `okrSetCommands.ts`), same pinned client, same transaction as the
 * snapshot INSERT — this function only READS
 * okr_vnext_objectives/okr_vnext_key_results, never writes. Excludes
 * cancelled Objectives/KRs — a cancelled item was never really "approved
 * content," matching `hasSufficientKeyResultCoverage`'s own
 * cancelled-exclusion above.
 */
export async function buildObjectivesSnapshotFragment(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<ObjectiveSnapshotFragment[]> {
  const objectivesResult = await client.query<OkrObjectiveRow>(
    `SELECT * FROM okr_vnext_objectives
      WHERE set_id = $1 AND organization_id = $2 AND status <> 'cancelled'
      ORDER BY sort_order ASC`,
    [setId, organizationId]
  );

  const fragments: ObjectiveSnapshotFragment[] = [];
  for (const objectiveRow of objectivesResult.rows) {
    const krResult = await client.query<{
      key_result_id: string;
      title: string;
      description: string | null;
      measurement_type: string;
      unit: string | null;
      currency: string | null;
      baseline_value: string | null;
      target_value: string | null;
      start_value: string | null;
      current_value: string | null;
      direction: string;
      range_min: string | null;
      range_max: string | null;
      progress: string | null;
      progress_calc_reason: string | null;
      out_of_range_distance: string | null;
      confidence: string | null;
      source_type: string;
      source_reference: string | null;
      weight: string | null;
    }>(
      `SELECT key_result_id, title, description, measurement_type, unit, currency,
              baseline_value, target_value, start_value, current_value, direction,
              range_min, range_max, progress, progress_calc_reason, out_of_range_distance,
              confidence, source_type, source_reference, weight
         FROM okr_vnext_key_results
        WHERE objective_id = $1 AND organization_id = $2 AND status <> 'cancelled'
        ORDER BY created_at ASC`,
      [objectiveRow.objective_id, organizationId]
    );

    fragments.push({
      objectiveId: objectiveRow.objective_id,
      title: objectiveRow.title,
      description: objectiveRow.description,
      rationale: objectiveRow.rationale,
      ambitionType: objectiveRow.ambition_type,
      ownerUserId: objectiveRow.owner_user_id,
      sortOrder: objectiveRow.sort_order,
      progress: objectiveRow.progress,
      progressCalcReason: objectiveRow.progress_calc_reason,
      confidence: objectiveRow.confidence,
      keyResults: krResult.rows.map((row) => ({
        keyResultId: row.key_result_id,
        title: row.title,
        description: row.description,
        measurementType: row.measurement_type,
        unit: row.unit,
        currency: row.currency,
        baselineValue: row.baseline_value,
        targetValue: row.target_value,
        startValue: row.start_value,
        currentValue: row.current_value,
        direction: row.direction,
        rangeMin: row.range_min,
        rangeMax: row.range_max,
        progress: row.progress,
        progressCalcReason: row.progress_calc_reason,
        outOfRangeDistance: row.out_of_range_distance,
        confidence: row.confidence,
        sourceType: row.source_type,
        sourceReference: row.source_reference,
        weight: row.weight,
      })),
    });
  }
  return fragments;
}
