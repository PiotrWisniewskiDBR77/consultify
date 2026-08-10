/**
 * ROI-E002 — assumption command layer (`addAssumption`/`updateAssumption`/
 * `removeAssumption`).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4 (AC-01).
 * Schema: server/migrations/20260816_rvn_roi_economic_model.sql.
 *
 * Template: `kpiCorrectiveActionCommands.ts`'s `addCorrectiveAction`/
 * `updateCorrectiveAction` shape (design §4's own reference) — `add` is
 * `executeAtomicCreate` guarded on the parent case's editable status via a
 * `SELECT ... FOR UPDATE` inside `applyMutation`; `update`/`remove` are
 * `executeAtomicCommand` CAS'd on the assumption row's own `row_version`.
 * `removeAssumption` is a soft delete (Decision D6): sets `deleted_at`/
 * `deleted_by`, never a hard `DELETE`.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';

import { RoiEconomicModelNotEditableError } from './roiCalculationPolicyCommands.js';
import { NON_EDITABLE_STATUSES, ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import {
  toRoiAssumption,
  type RoiAssumption,
  type RoiAssumptionRow,
  type RoiConfidenceLevel,
} from './roiEconomicModelTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiAssumptionFrozenError extends Error {
  code = 'ASSUMPTION_FROZEN';
  details: Record<string, unknown>;
  constructor(assumptionId: string) {
    super(`ROI assumption ${assumptionId} is frozen — cannot be edited`);
    this.name = 'RoiAssumptionFrozenError';
    this.details = { assumptionId };
  }
}

async function assertCaseEditableForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string,
  op: string
): Promise<void> {
  const caseResult = await client.query<{ status: string }>(
    `SELECT status FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  const caseRow = caseResult.rows[0];
  if (!caseRow) {
    throw new Error(`[${op}] case ${caseId} not found`);
  }
  if (NON_EDITABLE_STATUSES.includes(caseRow.status as (typeof NON_EDITABLE_STATUSES)[number])) {
    throw new RoiEconomicModelNotEditableError(caseId, caseRow.status);
  }
}

// ==========================================
// addAssumption
// ==========================================

export interface AddAssumptionInput {
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  unit?: string | null;
  baseValue?: number | null;
  downsideValue?: number | null;
  upsideValue?: number | null;
  confidence?: RoiConfidenceLevel | null;
  evidenceRef?: string | null;
  source?: string | null;
  ownerUserId?: string | null;
  sensitivityRank?: number | null;
  notes?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function addAssumption(input: AddAssumptionInput): Promise<AtomicCommandOutcome<RoiAssumption>> {
  const {
    caseId,
    organizationId,
    category,
    label,
    unit = null,
    baseValue = null,
    downsideValue = null,
    upsideValue = null,
    confidence = null,
    evidenceRef = null,
    source = null,
    ownerUserId = null,
    sensitivityRank = null,
    notes = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCreate<RoiAssumption>({
    organizationId,
    applyMutation: async (client) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'addAssumption');

      const insertResult = await client.query<RoiAssumptionRow>(
        `INSERT INTO rvn_roi_assumptions
           (case_id, organization_id, category, label, unit, base_value, downside_value, upside_value,
            confidence, evidence_ref, source, owner_user_id, sensitivity_rank, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          caseId,
          organizationId,
          category,
          label,
          unit,
          baseValue,
          downsideValue,
          upsideValue,
          confidence,
          evidenceRef,
          source,
          ownerUserId,
          sensitivityRank,
          notes,
          actorUserId,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[addAssumption] insert returned no row');
      return toRoiAssumption(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { assumption: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.assumption_added',
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
        payload: { caseId, assumptionId: result.assumptionId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateAssumption / removeAssumption — shared row loader
// ==========================================

async function loadAssumptionForUpdate(
  client: PoolClient,
  assumptionId: string,
  organizationId: string
): Promise<RoiAssumptionRow | undefined> {
  const result = await client.query<RoiAssumptionRow>(
    `SELECT * FROM rvn_roi_assumptions WHERE assumption_id = $1 AND organization_id = $2 FOR UPDATE`,
    [assumptionId, organizationId]
  );
  return result.rows[0];
}
const assumptionRowVersion = (row: RoiAssumptionRow) => row.row_version;

export interface UpdateAssumptionInput {
  assumptionId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  category?: string;
  label?: string;
  unit?: string | null;
  baseValue?: number | null;
  downsideValue?: number | null;
  upsideValue?: number | null;
  confidence?: RoiConfidenceLevel | null;
  evidenceRef?: string | null;
  source?: string | null;
  ownerUserId?: string | null;
  sensitivityRank?: number | null;
  notes?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function updateAssumption(input: UpdateAssumptionInput): Promise<AtomicCommandOutcome<RoiAssumption>> {
  const {
    assumptionId,
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

  return executeAtomicCommand<RoiAssumptionRow, RoiAssumption>({
    organizationId,
    aggregateId: assumptionId,
    expectedVersion,
    loadForUpdate: loadAssumptionForUpdate,
    getCurrentVersion: assumptionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.frozen_at !== null) {
        throw new RoiAssumptionFrozenError(assumptionId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'updateAssumption');

      beforeState = { assumption: toRoiAssumption(currentRow) };

      const merged = {
        category: edits.category ?? currentRow.category,
        label: edits.label ?? currentRow.label,
        unit: edits.unit !== undefined ? edits.unit : currentRow.unit,
        base_value: edits.baseValue !== undefined ? edits.baseValue : currentRow.base_value,
        downside_value: edits.downsideValue !== undefined ? edits.downsideValue : currentRow.downside_value,
        upside_value: edits.upsideValue !== undefined ? edits.upsideValue : currentRow.upside_value,
        confidence: edits.confidence !== undefined ? edits.confidence : currentRow.confidence,
        evidence_ref: edits.evidenceRef !== undefined ? edits.evidenceRef : currentRow.evidence_ref,
        source: edits.source !== undefined ? edits.source : currentRow.source,
        owner_user_id: edits.ownerUserId !== undefined ? edits.ownerUserId : currentRow.owner_user_id,
        sensitivity_rank: edits.sensitivityRank !== undefined ? edits.sensitivityRank : currentRow.sensitivity_rank,
        notes: edits.notes !== undefined ? edits.notes : currentRow.notes,
      };

      const updateResult = await client.query<RoiAssumptionRow>(
        `UPDATE rvn_roi_assumptions
            SET category = $1, label = $2, unit = $3, base_value = $4, downside_value = $5, upside_value = $6,
                confidence = $7, evidence_ref = $8, source = $9, owner_user_id = $10, sensitivity_rank = $11,
                notes = $12, row_version = $13, updated_at = now()
          WHERE assumption_id = $14
          RETURNING *`,
        [
          merged.category,
          merged.label,
          merged.unit,
          merged.base_value,
          merged.downside_value,
          merged.upside_value,
          merged.confidence,
          merged.evidence_ref,
          merged.source,
          merged.owner_user_id,
          merged.sensitivity_rank,
          merged.notes,
          nextVersion,
          assumptionId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[updateAssumption] update returned no row for ${assumptionId}`);
      return toRoiAssumption(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { assumption: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.assumption_updated',
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
        payload: { caseId, assumptionId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// removeAssumption (soft delete)
// ==========================================

export interface RemoveAssumptionInput {
  assumptionId: string;
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

export async function removeAssumption(input: RemoveAssumptionInput): Promise<AtomicCommandOutcome<RoiAssumption>> {
  const {
    assumptionId,
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

  return executeAtomicCommand<RoiAssumptionRow, RoiAssumption>({
    organizationId,
    aggregateId: assumptionId,
    expectedVersion,
    loadForUpdate: loadAssumptionForUpdate,
    getCurrentVersion: assumptionRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.frozen_at !== null) {
        throw new RoiAssumptionFrozenError(assumptionId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'removeAssumption');

      beforeState = { assumption: toRoiAssumption(currentRow) };

      const updateResult = await client.query<RoiAssumptionRow>(
        `UPDATE rvn_roi_assumptions
            SET deleted_at = now(), deleted_by = $1, row_version = $2, updated_at = now()
          WHERE assumption_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, assumptionId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[removeAssumption] update returned no row for ${assumptionId}`);
      return toRoiAssumption(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { assumption: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.assumption_removed',
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
        payload: { caseId, assumptionId },
      } satisfies AtomicEventInput;
    },
  });
}
