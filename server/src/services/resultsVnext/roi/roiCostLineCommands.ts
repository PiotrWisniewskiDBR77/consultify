/**
 * ROI-E002 — cost-line command layer (`addCostLine`/`updateCostLine`/
 * `removeCostLine`).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4.
 * Schema: server/migrations/20260816_rvn_roi_economic_model.sql.
 *
 * Same add/update/remove(soft-delete) shape as `roiAssumptionCommands.ts` —
 * see that file's header for the shared template rationale.
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
  toRoiCostLine,
  type RoiConfidenceLevel,
  type RoiCostLine,
  type RoiCostLineRow,
  type RoiRecurrenceCadence,
  type RoiTimingType,
} from './roiEconomicModelTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiCostLineFrozenError extends Error {
  code = 'COST_LINE_FROZEN';
  details: Record<string, unknown>;
  constructor(costLineId: string) {
    super(`ROI cost line ${costLineId} is frozen — cannot be edited`);
    this.name = 'RoiCostLineFrozenError';
    this.details = { costLineId };
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_COST_LINE_CAPABILITIES = {
  add: 'results.roi.cost_line.add',
  update: 'results.roi.cost_line.update',
  remove: 'results.roi.cost_line.remove',
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
// addCostLine
// ==========================================

export interface AddCostLineInput {
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  description?: string | null;
  amount: number;
  currency: string;
  timingType: RoiTimingType;
  oneTimePeriodDate?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceCadence?: RoiRecurrenceCadence | null;
  confidence?: RoiConfidenceLevel | null;
  source?: string | null;
  ownerUserId?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function addCostLine(input: AddCostLineInput): Promise<AtomicCommandOutcome<RoiCostLine>> {
  const {
    caseId,
    organizationId,
    category,
    label,
    description = null,
    amount,
    currency,
    timingType,
    oneTimePeriodDate = null,
    recurrenceStartDate = null,
    recurrenceEndDate = null,
    recurrenceCadence = null,
    confidence = null,
    source = null,
    ownerUserId = null,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<RoiCostLine>({
    organizationId,
    applyMutation: async (client) => {
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'addCostLine', {
        access,
        actorUserId,
        capability: ROI_COST_LINE_CAPABILITIES.add,
      });

      const insertResult = await client.query<RoiCostLineRow>(
        `INSERT INTO rvn_roi_cost_lines
           (case_id, organization_id, category, label, description, amount, currency, timing_type,
            one_time_period_date, recurrence_start_date, recurrence_end_date, recurrence_cadence,
            confidence, source, owner_user_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          caseId,
          organizationId,
          category,
          label,
          description,
          amount,
          currency,
          timingType,
          oneTimePeriodDate,
          recurrenceStartDate,
          recurrenceEndDate,
          recurrenceCadence,
          confidence,
          source,
          ownerUserId,
          actorUserId,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[addCostLine] insert returned no row');
      return toRoiCostLine(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { costLine: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.cost_line_added',
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
        payload: { caseId, costLineId: result.costLineId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateCostLine / removeCostLine — shared row loader
// ==========================================

async function loadCostLineForUpdate(
  client: PoolClient,
  costLineId: string,
  organizationId: string
): Promise<RoiCostLineRow | undefined> {
  const result = await client.query<RoiCostLineRow>(
    `SELECT * FROM rvn_roi_cost_lines WHERE cost_line_id = $1 AND organization_id = $2 FOR UPDATE`,
    [costLineId, organizationId]
  );
  return result.rows[0];
}
const costLineRowVersion = (row: RoiCostLineRow) => row.row_version;

export interface UpdateCostLineInput {
  costLineId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  category?: string;
  label?: string;
  description?: string | null;
  amount?: number;
  currency?: string;
  timingType?: RoiTimingType;
  oneTimePeriodDate?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceCadence?: RoiRecurrenceCadence | null;
  confidence?: RoiConfidenceLevel | null;
  source?: string | null;
  ownerUserId?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function updateCostLine(input: UpdateCostLineInput): Promise<AtomicCommandOutcome<RoiCostLine>> {
  const {
    costLineId,
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

  return executeAtomicCommand<RoiCostLineRow, RoiCostLine>({
    organizationId,
    aggregateId: costLineId,
    expectedVersion,
    loadForUpdate: loadCostLineForUpdate,
    getCurrentVersion: costLineRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.frozen_at !== null) {
        throw new RoiCostLineFrozenError(costLineId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'updateCostLine', {
        access,
        actorUserId,
        capability: ROI_COST_LINE_CAPABILITIES.update,
      });

      beforeState = { costLine: toRoiCostLine(currentRow) };

      const merged = {
        category: edits.category ?? currentRow.category,
        label: edits.label ?? currentRow.label,
        description: edits.description !== undefined ? edits.description : currentRow.description,
        amount: edits.amount !== undefined ? edits.amount : currentRow.amount,
        currency: edits.currency ?? currentRow.currency,
        timing_type: edits.timingType ?? currentRow.timing_type,
        one_time_period_date:
          edits.oneTimePeriodDate !== undefined ? edits.oneTimePeriodDate : currentRow.one_time_period_date,
        recurrence_start_date:
          edits.recurrenceStartDate !== undefined ? edits.recurrenceStartDate : currentRow.recurrence_start_date,
        recurrence_end_date:
          edits.recurrenceEndDate !== undefined ? edits.recurrenceEndDate : currentRow.recurrence_end_date,
        recurrence_cadence:
          edits.recurrenceCadence !== undefined ? edits.recurrenceCadence : currentRow.recurrence_cadence,
        confidence: edits.confidence !== undefined ? edits.confidence : currentRow.confidence,
        source: edits.source !== undefined ? edits.source : currentRow.source,
        owner_user_id: edits.ownerUserId !== undefined ? edits.ownerUserId : currentRow.owner_user_id,
      };

      const updateResult = await client.query<RoiCostLineRow>(
        `UPDATE rvn_roi_cost_lines
            SET category = $1, label = $2, description = $3, amount = $4, currency = $5, timing_type = $6,
                one_time_period_date = $7, recurrence_start_date = $8, recurrence_end_date = $9,
                recurrence_cadence = $10, confidence = $11, source = $12, owner_user_id = $13,
                row_version = $14, updated_at = now()
          WHERE cost_line_id = $15
          RETURNING *`,
        [
          merged.category,
          merged.label,
          merged.description,
          merged.amount,
          merged.currency,
          merged.timing_type,
          merged.one_time_period_date,
          merged.recurrence_start_date,
          merged.recurrence_end_date,
          merged.recurrence_cadence,
          merged.confidence,
          merged.source,
          merged.owner_user_id,
          nextVersion,
          costLineId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[updateCostLine] update returned no row for ${costLineId}`);
      return toRoiCostLine(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { costLine: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.cost_line_updated',
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
        payload: { caseId, costLineId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// removeCostLine (soft delete)
// ==========================================

export interface RemoveCostLineInput {
  costLineId: string;
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

export async function removeCostLine(input: RemoveCostLineInput): Promise<AtomicCommandOutcome<RoiCostLine>> {
  const {
    costLineId,
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

  return executeAtomicCommand<RoiCostLineRow, RoiCostLine>({
    organizationId,
    aggregateId: costLineId,
    expectedVersion,
    loadForUpdate: loadCostLineForUpdate,
    getCurrentVersion: costLineRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.frozen_at !== null) {
        throw new RoiCostLineFrozenError(costLineId);
      }
      await assertCaseEditableForUpdate(client, caseId, organizationId, 'removeCostLine', {
        access,
        actorUserId,
        capability: ROI_COST_LINE_CAPABILITIES.remove,
      });

      beforeState = { costLine: toRoiCostLine(currentRow) };

      const updateResult = await client.query<RoiCostLineRow>(
        `UPDATE rvn_roi_cost_lines
            SET deleted_at = now(), deleted_by = $1, row_version = $2, updated_at = now()
          WHERE cost_line_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, costLineId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[removeCostLine] update returned no row for ${costLineId}`);
      return toRoiCostLine(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { costLine: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.cost_line_removed',
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
        payload: { caseId, costLineId },
      } satisfies AtomicEventInput;
    },
  });
}
