/**
 * ROI-E002 — calculation-policy command layer (`captureOrUpdateCalculationPolicy`).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4, Decision D5.
 * Schema: server/migrations/20260816_rvn_roi_economic_model.sql.
 *
 * Always-update, mirrors `roiBaselineCommands.ts`'s `captureOrUpdateBaseline`
 * exactly: the policy shell row always exists from Case creation (§4.1), so
 * this is ALWAYS an `executeAtomicCommand` CAS on the row's own
 * `row_version`, never a create/upsert branch. Guard: `frozen_at !== null`
 * -> typed 409, and (unlike the baseline, which has no case-status guard of
 * its own) the case must also still be in an editable status
 * (`NON_EDITABLE_STATUSES`, exported by `roiCaseCommands.ts`) — matching
 * every other ROI-E002 list-item command's guard shape.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { NON_EDITABLE_STATUSES, ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import {
  toRoiCalculationPolicy,
  type RoiCalculationPolicy,
  type RoiCalculationPolicyRow,
  type RoiTaxTreatment,
  type RoiConfidenceLevel,
  type RoiRoundingPolicy,
} from './roiEconomicModelTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiCalculationPolicyFrozenError extends Error {
  code = 'CALCULATION_POLICY_FROZEN';
  details: Record<string, unknown>;
  constructor(caseId: string, policyRowId: string) {
    super(`ROI calculation policy ${policyRowId} for case ${caseId} is frozen — cannot be edited`);
    this.name = 'RoiCalculationPolicyFrozenError';
    this.details = { caseId, policyRowId };
  }
}

export class RoiEconomicModelNotEditableError extends Error {
  code = 'NOT_EDITABLE';
  details: Record<string, unknown>;
  constructor(caseId: string, status: string) {
    super(`ROI case ${caseId} is "${status}" — the economic model may not be edited from this status`);
    this.name = 'RoiEconomicModelNotEditableError';
    this.details = { caseId, status };
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadRoiCalculationPolicyForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<RoiCalculationPolicyRow | undefined> {
  const result = await client.query<RoiCalculationPolicyRow>(
    `SELECT * FROM rvn_roi_calculation_policy WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return result.rows[0];
}

function policyRowVersion(row: RoiCalculationPolicyRow): number {
  return row.row_version;
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_CALCULATION_POLICY_CAPABILITIES = {
  captureOrUpdate: 'results.roi.calculation_policy.capture_or_update',
} as const;

// ==========================================
// captureOrUpdateCalculationPolicy
// ==========================================

export interface CaptureOrUpdateCalculationPolicyInput {
  organizationId: string;
  caseId: string;
  expectedVersion: number;
  discountRatePct?: number | null;
  taxTreatment?: RoiTaxTreatment | null;
  inflationRatePct?: number | null;
  roundingPolicy?: RoiRoundingPolicy;
  requiredMetrics?: string[] | null;
  notes?: string | null;
  confidence?: RoiConfidenceLevel | null;
  ownerUserId?: string | null;
  actorId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function captureOrUpdateCalculationPolicy(
  input: CaptureOrUpdateCalculationPolicyInput
): Promise<AtomicCommandOutcome<RoiCalculationPolicy>> {
  const {
    organizationId,
    caseId,
    expectedVersion,
    actorId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
    ...edits
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiCalculationPolicyRow, RoiCalculationPolicy>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCalculationPolicyForUpdate,
    getCurrentVersion: policyRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      const caseStatusResult = await client.query<{ status: string; owner_user_id: string }>(
        `SELECT status, owner_user_id FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
        [caseId, organizationId]
      );
      const caseStatusRow = caseStatusResult.rows[0];
      if (!caseStatusRow) {
        throw new Error(`[captureOrUpdateCalculationPolicy] case ${caseId} not found`);
      }

      assertCommandCapability({
        access,
        actorUserId: actorId,
        capability: ROI_CALCULATION_POLICY_CAPABILITIES.captureOrUpdate,
        responsibleUserIds: [caseStatusRow.owner_user_id, currentRow.owner_user_id],
      });

      if (currentRow.frozen_at !== null) {
        throw new RoiCalculationPolicyFrozenError(caseId, currentRow.policy_row_id);
      }
      if (NON_EDITABLE_STATUSES.includes(caseStatusRow.status as (typeof NON_EDITABLE_STATUSES)[number])) {
        throw new RoiEconomicModelNotEditableError(caseId, caseStatusRow.status);
      }

      beforeState = { calculationPolicy: toRoiCalculationPolicy(currentRow) };

      const merged = {
        discount_rate_pct: edits.discountRatePct !== undefined ? edits.discountRatePct : currentRow.discount_rate_pct,
        tax_treatment: edits.taxTreatment !== undefined ? edits.taxTreatment : currentRow.tax_treatment,
        inflation_rate_pct:
          edits.inflationRatePct !== undefined ? edits.inflationRatePct : currentRow.inflation_rate_pct,
        rounding_policy: edits.roundingPolicy ?? currentRow.rounding_policy,
        required_metrics: edits.requiredMetrics !== undefined ? edits.requiredMetrics : currentRow.required_metrics,
        notes: edits.notes !== undefined ? edits.notes : currentRow.notes,
        confidence: edits.confidence !== undefined ? edits.confidence : currentRow.confidence,
        owner_user_id: edits.ownerUserId !== undefined ? edits.ownerUserId : currentRow.owner_user_id,
      };

      const updateResult = await client.query<RoiCalculationPolicyRow>(
        `UPDATE rvn_roi_calculation_policy
            SET discount_rate_pct = $1, tax_treatment = $2, inflation_rate_pct = $3, rounding_policy = $4,
                required_metrics = $5, notes = $6, confidence = $7, owner_user_id = $8,
                row_version = $9, updated_at = now()
          WHERE case_id = $10
          RETURNING *`,
        [
          merged.discount_rate_pct,
          merged.tax_treatment,
          merged.inflation_rate_pct,
          merged.rounding_policy,
          merged.required_metrics,
          merged.notes,
          merged.confidence,
          merged.owner_user_id,
          nextVersion,
          caseId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[captureOrUpdateCalculationPolicy] update returned no row for case ${caseId}`);
      }
      return toRoiCalculationPolicy(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { calculationPolicy: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.calculation_policy_updated',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: actorId,
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
        payload: { caseId, policyRowId: result.policyRowId },
      } satisfies AtomicEventInput;
    },
  });
}
