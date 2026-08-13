/**
 * ROI-E002 — scenario command layer (AC-04: a Scenario is a set of input
 * overrides, never a manually-typed headline number).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4, Decision D10.
 * Schema: server/migrations/20260816_rvn_roi_economic_model.sql.
 *
 * `addScenario`/`updateScenario`/`removeScenario` follow the same add/
 * update/remove(soft-delete) shape as the other list-item command files.
 * `setScenarioOverride`/`removeScenarioOverride` are `custom`-scenario-only
 * (Decision D10: canonical `downside`/`upside` scenarios read each
 * assumption's own `downside_value`/`upside_value` directly — they never
 * use `rvn_roi_scenario_overrides` rows) — both validate
 * `scenario.scenario_type === 'custom'` before allowing a write.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { RoiEconomicModelNotEditableError } from './roiCalculationPolicyCommands.js';
import { NON_EDITABLE_STATUSES, ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import {
  toRoiScenario,
  toRoiScenarioOverride,
  type RoiScenario,
  type RoiScenarioOverride,
  type RoiScenarioOverrideRow,
  type RoiScenarioOverrideTargetType,
  type RoiScenarioRow,
  type RoiScenarioType,
} from './roiEconomicModelTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiScenarioFrozenError extends Error {
  code = 'SCENARIO_FROZEN';
  details: Record<string, unknown>;
  constructor(scenarioId: string) {
    super(`ROI scenario ${scenarioId} is frozen — cannot be edited`);
    this.name = 'RoiScenarioFrozenError';
    this.details = { scenarioId };
  }
}

export class RoiScenarioValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_SCENARIO_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiScenarioValidationError';
    this.code = code;
    this.details = details;
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_SCENARIO_CAPABILITIES = {
  add: 'results.roi.scenario.add',
  update: 'results.roi.scenario.update',
  remove: 'results.roi.scenario.remove',
  setOverride: 'results.roi.scenario.set_override',
  removeOverride: 'results.roi.scenario.remove_override',
} as const;

/** RN-G5: authorization runs FIRST — same rationale as roiAssumptionCommands.ts's
 * identical helper (that file's own doc comment has the full rationale). */
async function assertCaseEditableForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string,
  op: string,
  auth: { access: CommandAccessContext; actorUserId: string; capability: string }
): Promise<void> {
  const caseResult = await client.query<{ status: string; owner_user_id: string }>(
    `SELECT status, owner_user_id FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) {
    throw new Error(`[${op}] case ${caseId} not found`);
  }

  assertCommandCapability({
    access: auth.access,
    actorUserId: auth.actorUserId,
    capability: auth.capability,
    responsibleUserIds: [caseRow.owner_user_id],
  });

  if (NON_EDITABLE_STATUSES.includes(caseRow.status as (typeof NON_EDITABLE_STATUSES)[number])) {
    throw new RoiEconomicModelNotEditableError(caseId, caseRow.status);
  }
}

// ==========================================
// addScenario
// ==========================================

export interface AddScenarioInput {
  caseId: string;
  organizationId: string;
  scenarioType: RoiScenarioType;
  label: string;
  description?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function addScenario(input: AddScenarioInput): Promise<AtomicCommandOutcome<RoiScenario>> {
  const {
    caseId,
    organizationId,
    scenarioType,
    label,
    description = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<RoiScenario>({
    organizationId,
    applyMutation: async (client) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'addScenario', {
        access,
        actorUserId,
        capability: ROI_SCENARIO_CAPABILITIES.add,
      });

      const insertResult = await client.query<RoiScenarioRow>(
        `INSERT INTO rvn_roi_scenarios (case_id, organization_id, scenario_type, label, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [caseId, organizationId, scenarioType, label, description, actorUserId]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[addScenario] insert returned no row');
      return toRoiScenario(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { scenario: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.scenario_added',
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
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId, scenarioId: result.scenarioId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateScenario / removeScenario — shared row loader
// ==========================================

async function loadScenarioForUpdate(
  client: PoolClient,
  scenarioId: string,
  organizationId: string
): Promise<RoiScenarioRow | undefined> {
  const result = await client.query<RoiScenarioRow>(
    `SELECT * FROM rvn_roi_scenarios WHERE scenario_id = $1 AND organization_id = $2 FOR UPDATE`,
    [scenarioId, organizationId]
  );
  return result.rows[0];
}
const scenarioRowVersion = (row: RoiScenarioRow) => row.row_version;

export interface UpdateScenarioInput {
  scenarioId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  label?: string;
  description?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/** `scenario_type` is intentionally not editable after creation — the
 * `custom`/`downside`/`upside` distinction drives which override mechanism
 * applies (Decision D10); allowing it to change post-creation would let a
 * scenario's own override rows silently become semantically inconsistent
 * with its (new) type. Callers that picked the wrong type must remove and
 * re-add. */
export async function updateScenario(input: UpdateScenarioInput): Promise<AtomicCommandOutcome<RoiScenario>> {
  const {
    scenarioId,
    caseId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
    ...edits
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiScenarioRow, RoiScenario>({
    organizationId,
    aggregateId: scenarioId,
    expectedVersion,
    loadForUpdate: loadScenarioForUpdate,
    getCurrentVersion: scenarioRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.frozen_at !== null) {
        throw new RoiScenarioFrozenError(scenarioId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'updateScenario', {
        access,
        actorUserId,
        capability: ROI_SCENARIO_CAPABILITIES.update,
      });

      beforeState = { scenario: toRoiScenario(currentRow) };

      const merged = {
        label: edits.label ?? currentRow.label,
        description: edits.description !== undefined ? edits.description : currentRow.description,
      };

      const updateResult = await client.query<RoiScenarioRow>(
        `UPDATE rvn_roi_scenarios
            SET label = $1, description = $2, row_version = $3, updated_at = now()
          WHERE scenario_id = $4
          RETURNING *`,
        [merged.label, merged.description, nextVersion, scenarioId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[updateScenario] update returned no row for ${scenarioId}`);
      return toRoiScenario(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { scenario: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.scenario_updated',
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
        payload: { caseId, scenarioId },
      } satisfies AtomicEventInput;
    },
  });
}

export interface RemoveScenarioInput {
  scenarioId: string;
  caseId: string;
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

export async function removeScenario(input: RemoveScenarioInput): Promise<AtomicCommandOutcome<RoiScenario>> {
  const {
    scenarioId,
    caseId,
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

  return executeAtomicCommand<RoiScenarioRow, RoiScenario>({
    organizationId,
    aggregateId: scenarioId,
    expectedVersion,
    loadForUpdate: loadScenarioForUpdate,
    getCurrentVersion: scenarioRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.frozen_at !== null) {
        throw new RoiScenarioFrozenError(scenarioId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'removeScenario', {
        access,
        actorUserId,
        capability: ROI_SCENARIO_CAPABILITIES.remove,
      });

      beforeState = { scenario: toRoiScenario(currentRow) };

      const updateResult = await client.query<RoiScenarioRow>(
        `UPDATE rvn_roi_scenarios
            SET deleted_at = now(), deleted_by = $1, row_version = $2, updated_at = now()
          WHERE scenario_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, scenarioId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[removeScenario] update returned no row for ${scenarioId}`);
      return toRoiScenario(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { scenario: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.scenario_removed',
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
        payload: { caseId, scenarioId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// setScenarioOverride / removeScenarioOverride — 'custom' scenarios only
// ==========================================

function assertScenarioIsCustom(scenarioRow: RoiScenarioRow): void {
  if (scenarioRow.scenario_type !== 'custom') {
    throw new RoiScenarioValidationError(
      `Scenario ${scenarioRow.scenario_id} is "${scenarioRow.scenario_type}" — overrides may only be set on "custom" scenarios (Decision D10)`,
      'SCENARIO_NOT_CUSTOM',
      { scenarioId: scenarioRow.scenario_id, scenarioType: scenarioRow.scenario_type }
    );
  }
  if (scenarioRow.frozen_at !== null) {
    throw new RoiScenarioFrozenError(scenarioRow.scenario_id);
  }
}

export interface SetScenarioOverrideInput {
  scenarioId: string;
  caseId: string;
  organizationId: string;
  /** design §7: overrides CAS via the PARENT SCENARIO's own `row_version`
   * (overrides have no `row_version` column of their own, design §3 DDL) —
   * this bumps the scenario row's `row_version` as a side effect of writing
   * an override, serializing concurrent override edits on the same
   * scenario. */
  expectedVersion: number;
  targetType: RoiScenarioOverrideTargetType;
  targetId: string;
  overrideValue?: number | null;
  overrideAmount?: number | null;
  note?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/** `UNIQUE (scenario_id, target_type, target_id)` (design §3 DDL) makes
 * this an upsert-by-natural-key — `ON CONFLICT ... DO UPDATE` so calling it
 * twice for the same target replaces the prior override rather than
 * erroring or creating a duplicate row. */
export async function setScenarioOverride(
  input: SetScenarioOverrideInput
): Promise<AtomicCommandOutcome<RoiScenarioOverride>> {
  const {
    scenarioId,
    caseId,
    organizationId,
    expectedVersion,
    targetType,
    targetId,
    overrideValue = null,
    overrideAmount = null,
    note = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCommand<RoiScenarioRow, RoiScenarioOverride>({
    organizationId,
    aggregateId: scenarioId,
    expectedVersion,
    loadForUpdate: loadScenarioForUpdate,
    getCurrentVersion: scenarioRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertScenarioIsCustom(currentRow);
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'setScenarioOverride', {
        access,
        actorUserId,
        capability: ROI_SCENARIO_CAPABILITIES.setOverride,
      });

      const upsertResult = await client.query<RoiScenarioOverrideRow>(
        `INSERT INTO rvn_roi_scenario_overrides
           (scenario_id, organization_id, target_type, target_id, override_value, override_amount, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (scenario_id, target_type, target_id)
         DO UPDATE SET override_value = EXCLUDED.override_value, override_amount = EXCLUDED.override_amount,
                        note = EXCLUDED.note
         RETURNING *`,
        [scenarioId, organizationId, targetType, targetId, overrideValue, overrideAmount, note, actorUserId]
      );
      const row = upsertResult.rows[0];
      if (!row) throw new Error('[setScenarioOverride] upsert returned no row');

      // Bump the parent scenario's own row_version — overrides have none of
      // their own, so this IS the CAS surface a concurrent second override
      // write on the same scenario serializes against.
      await client.query(`UPDATE rvn_roi_scenarios SET row_version = $1, updated_at = now() WHERE scenario_id = $2`, [
        nextVersion,
        scenarioId,
      ]);

      return toRoiScenarioOverride(row);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { override: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.scenario_updated',
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
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, scenarioId, overrideId: result.overrideId },
      } satisfies AtomicEventInput;
    },
  });
}

export interface RemoveScenarioOverrideInput {
  overrideId: string;
  scenarioId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number; // the parent scenario's row_version, same as setScenarioOverride
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function removeScenarioOverride(
  input: RemoveScenarioOverrideInput
): Promise<AtomicCommandOutcome<{ overrideId: string }>> {
  const {
    overrideId,
    scenarioId,
    caseId,
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

  return executeAtomicCommand<RoiScenarioRow, { overrideId: string }>({
    organizationId,
    aggregateId: scenarioId,
    expectedVersion,
    loadForUpdate: loadScenarioForUpdate,
    getCurrentVersion: scenarioRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertScenarioIsCustom(currentRow);
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'removeScenarioOverride', {
        access,
        actorUserId,
        capability: ROI_SCENARIO_CAPABILITIES.removeOverride,
      });

      const deleteResult = await client.query(
        `DELETE FROM rvn_roi_scenario_overrides WHERE override_id = $1 AND scenario_id = $2 AND organization_id = $3`,
        [overrideId, scenarioId, organizationId]
      );
      if ((deleteResult.rowCount ?? 0) === 0) {
        throw new RoiScenarioValidationError(
          `Override ${overrideId} not found on scenario ${scenarioId}`,
          'OVERRIDE_NOT_FOUND',
          { overrideId, scenarioId }
        );
      }

      await client.query(`UPDATE rvn_roi_scenarios SET row_version = $1, updated_at = now() WHERE scenario_id = $2`, [
        nextVersion,
        scenarioId,
      ]);

      return { overrideId };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { override: null };
      return {
        schemaVersion: 1,
        eventType: 'roi.scenario_updated',
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
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, scenarioId, overrideId: result.overrideId },
      } satisfies AtomicEventInput;
    },
  });
}
