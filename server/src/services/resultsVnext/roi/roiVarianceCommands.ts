/**
 * ROI-E004 — Variance commands (AC-05: Variance has a cause+contribution
 * structure).
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D9.
 *
 * `rvn_roi_variances`/`rvn_roi_variance_causes` are the STORED, human-
 * curated half of D9's "both, for different jobs" split — durable,
 * fact-immutable-after-creation records (backed by the migration's own
 * `rvn_roi_variances_protect_facts` trigger), distinct from
 * `roiCompareRepository.ts`'s always-fresh, never-persisted compare view.
 *
 * METRIC-VALUE EXTRACTION, DOCUMENTED: the DDL's `metric` column is plain
 * `TEXT NOT NULL` (no CHECK constraint the way `comparison_type` has one) —
 * but `recordVariance` must know WHICH numeric field on the referenced
 * Approved/Forecast/Actual row to snapshot as `baseline_value`/
 * `comparison_value`. This command restricts `metric` to the same five
 * headline metrics `roiCompareRepository.ts`'s compare view already exposes
 * (`npv`/`simpleRoi`/`totalCosts`/`totalFinancialBenefits`/`paybackPeriods`)
 * — a reasonable, explicit command-layer constraint (not a DB one) rather
 * than accepting arbitrary text the command could not act on.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';

import { ROI_EVENT_SOURCE } from './roiCaseCommands.js';
import { ROI_COMPARE_METRICS, type RoiCompareMetric } from './roiCompareRepository.js';
import {
  toRoiVariance,
  toRoiVarianceCause,
  type RoiActualSnapshotRow,
  type RoiForecastVersionRow,
  type RoiVariance,
  type RoiVarianceCause,
  type RoiVarianceCauseRow,
  type RoiVarianceComparisonType,
  type RoiVarianceRow,
  type RoiVarianceStatus,
} from './roiForecastActualTypes.js';
import type { RoiApprovalSnapshotRow } from './roiApprovalSnapshotTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiVarianceValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_VARIANCE_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiVarianceValidationError';
    this.code = code;
    this.details = details;
  }
}

export class RoiVarianceNotFoundError extends Error {
  code = 'VARIANCE_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(varianceId: string, organizationId: string) {
    super(`Variance ${varianceId} not found in organization ${organizationId}`);
    this.name = 'RoiVarianceNotFoundError';
    this.details = { varianceId, organizationId };
  }
}

// ==========================================
// METRIC VALUE EXTRACTION
// ==========================================

type VarianceScope = 'approved' | 'forecast' | 'actual';

async function readScopedMetricValue(
  client: PoolClient,
  params: { scope: VarianceScope; referenceId: string; caseId: string; organizationId: string; metric: RoiCompareMetric }
): Promise<number | null> {
  const { scope, referenceId, caseId, organizationId, metric } = params;

  if (scope === 'approved') {
    const result = await client.query<RoiApprovalSnapshotRow>(
      `SELECT * FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
      [referenceId, caseId, organizationId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new RoiVarianceValidationError(
        `Approval snapshot ${referenceId} not found for case ${caseId}`,
        'APPROVAL_SNAPSHOT_NOT_FOUND',
        { caseId, referenceId }
      );
    }
    return row.snapshot_payload.decisionCalculationRun[metric];
  }

  if (scope === 'forecast') {
    const result = await client.query<RoiForecastVersionRow>(
      `SELECT * FROM rvn_roi_forecast_versions WHERE forecast_version_id = $1 AND case_id = $2 AND organization_id = $3`,
      [referenceId, caseId, organizationId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new RoiVarianceValidationError(
        `Forecast version ${referenceId} not found for case ${caseId}`,
        'FORECAST_VERSION_NOT_FOUND',
        { caseId, referenceId }
      );
    }
    const columnByMetric: Record<RoiCompareMetric, string | null> = {
      npv: row.npv,
      simpleRoi: row.simple_roi,
      totalCosts: row.total_costs,
      totalFinancialBenefits: row.total_financial_benefits,
      paybackPeriods: row.payback_periods,
    };
    const value = columnByMetric[metric];
    return value === null ? null : Number(value);
  }

  // 'actual'
  const result = await client.query<RoiActualSnapshotRow>(
    `SELECT * FROM rvn_roi_actual_snapshots WHERE actual_snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
    [referenceId, caseId, organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new RoiVarianceValidationError(
      `Actual snapshot ${referenceId} not found for case ${caseId}`,
      'ACTUAL_SNAPSHOT_NOT_FOUND',
      { caseId, referenceId }
    );
  }
  if (metric === 'paybackPeriods') {
    // Documented gap — see roiCompareRepository.ts's file header:
    // rvn_roi_actual_snapshots has no payback_periods column at all.
    throw new RoiVarianceValidationError(
      `paybackPeriods has no Actual value to compare (rvn_roi_actual_snapshots stores no payback_periods column)`,
      'METRIC_NOT_AVAILABLE_FOR_ACTUAL',
      { caseId, referenceId, metric }
    );
  }
  const columnByMetric: Record<Exclude<RoiCompareMetric, 'paybackPeriods'>, string | null> = {
    npv: row.actual_npv,
    simpleRoi: row.actual_simple_roi,
    totalCosts: row.total_actual_costs,
    totalFinancialBenefits: row.total_actual_financial_benefits,
  };
  const value = columnByMetric[metric as Exclude<RoiCompareMetric, 'paybackPeriods'>];
  return value === null ? null : Number(value);
}

const COMPARISON_TYPE_SCOPES: Record<RoiVarianceComparisonType, { baseline: VarianceScope; comparison: VarianceScope }> = {
  approved_vs_forecast: { baseline: 'approved', comparison: 'forecast' },
  approved_vs_actual: { baseline: 'approved', comparison: 'actual' },
  forecast_vs_actual: { baseline: 'forecast', comparison: 'actual' },
};

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md)
export const ROI_VARIANCE_CAPABILITIES = {
  record: 'results.roi.variance.record',
  updateStatus: 'results.roi.variance.update_status',
  addCause: 'results.roi.variance.add_cause',
  removeCause: 'results.roi.variance.remove_cause',
} as const;

async function loadRoiCaseOwnerUserId(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<string | null> {
  const result = await client.query<{ owner_user_id: string | null }>(
    `SELECT owner_user_id FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  return result.rows[0]?.owner_user_id ?? null;
}

// ==========================================
// recordVariance
// ==========================================

export interface RecordVarianceInput {
  caseId: string;
  organizationId: string;
  comparisonType: RoiVarianceComparisonType;
  metric: RoiCompareMetric;
  referenceApprovalSnapshotId?: string | null;
  referenceForecastVersionId?: string | null;
  referenceActualSnapshotId?: string | null;
  ownerUserId?: string | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function recordVariance(input: RecordVarianceInput): Promise<AtomicCommandOutcome<RoiVariance>> {
  const {
    caseId,
    organizationId,
    comparisonType,
    metric,
    referenceApprovalSnapshotId = null,
    referenceForecastVersionId = null,
    referenceActualSnapshotId = null,
    ownerUserId = null,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  if (!ROI_COMPARE_METRICS.includes(metric)) {
    throw new RoiVarianceValidationError(`Unknown metric "${metric}"`, 'UNKNOWN_METRIC', { metric });
  }

  const scopes = COMPARISON_TYPE_SCOPES[comparisonType];
  const referenceByScope: Record<VarianceScope, string | null> = {
    approved: referenceApprovalSnapshotId,
    forecast: referenceForecastVersionId,
    actual: referenceActualSnapshotId,
  };
  const baselineReferenceId = referenceByScope[scopes.baseline];
  const comparisonReferenceId = referenceByScope[scopes.comparison];
  if (!baselineReferenceId || !comparisonReferenceId) {
    throw new RoiVarianceValidationError(
      `comparisonType "${comparisonType}" requires both a ${scopes.baseline} reference and a ${scopes.comparison} reference`,
      'MISSING_REFERENCE',
      { comparisonType, baselineReferenceId, comparisonReferenceId }
    );
  }

  return executeAtomicCreate<RoiVariance>({
    organizationId,
    applyMutation: async (client) => {
      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, caseId, organizationId);
      assertCommandCapability({
        access,
        actorUserId: createdBy,
        capability: ROI_VARIANCE_CAPABILITIES.record,
        responsibleUserIds: [caseOwnerUserId],
      });

      const baselineValue = await readScopedMetricValue(client, {
        scope: scopes.baseline,
        referenceId: baselineReferenceId,
        caseId,
        organizationId,
        metric,
      });
      const comparisonValue = await readScopedMetricValue(client, {
        scope: scopes.comparison,
        referenceId: comparisonReferenceId,
        caseId,
        organizationId,
        metric,
      });

      const varianceAmount = baselineValue === null || comparisonValue === null ? null : comparisonValue - baselineValue;
      const variancePct =
        varianceAmount === null || baselineValue === null || baselineValue === 0 ? null : (varianceAmount / baselineValue) * 100;

      const insertResult = await client.query<RoiVarianceRow>(
        `INSERT INTO rvn_roi_variances (
           case_id, organization_id, comparison_type, metric,
           reference_approval_snapshot_id, reference_forecast_version_id, reference_actual_snapshot_id,
           baseline_value, comparison_value, variance_amount, variance_pct,
           owner_user_id, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          caseId,
          organizationId,
          comparisonType,
          metric,
          referenceApprovalSnapshotId,
          referenceForecastVersionId,
          referenceActualSnapshotId,
          baselineValue,
          comparisonValue,
          varianceAmount,
          variancePct,
          ownerUserId,
          createdBy,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) {
        throw new Error('[recordVariance] insert returned no row');
      }
      return toRoiVariance(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { variance: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.material_variance_detected',
        aggregateType: 'roi_case',
        aggregateId: caseId,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { caseId, varianceId: result.varianceId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// updateVarianceStatus
// ==========================================

async function loadRoiVarianceForUpdate(
  client: PoolClient,
  varianceId: string,
  organizationId: string
): Promise<RoiVarianceRow | undefined> {
  const result = await client.query<RoiVarianceRow>(
    `SELECT * FROM rvn_roi_variances WHERE variance_id = $1 AND organization_id = $2 FOR UPDATE`,
    [varianceId, organizationId]
  );
  return result.rows[0];
}

function varianceRowVersion(row: RoiVarianceRow): number {
  return row.row_version;
}

export interface UpdateVarianceStatusInput {
  varianceId: string;
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  status?: RoiVarianceStatus;
  ownerUserId?: string | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

/** CAS on the variance's OWN `row_version` — a variance is not CAS'd
 * against its parent case, matching the shape a Variance's independent
 * lifecycle needs (many variances can exist per case, each edited
 * independently). Only `status`/`owner_user_id` writable — the migration's
 * own `rvn_roi_variances_protect_facts` trigger backs this up at the DB
 * layer even if a future caller bypasses this command. */
export async function updateVarianceStatus(
  input: UpdateVarianceStatusInput
): Promise<AtomicCommandOutcome<RoiVariance>> {
  const {
    varianceId,
    caseId,
    organizationId,
    expectedVersion,
    status,
    ownerUserId,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiVarianceRow, RoiVariance>({
    organizationId,
    aggregateId: varianceId,
    expectedVersion,
    loadForUpdate: loadRoiVarianceForUpdate,
    getCurrentVersion: varianceRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.case_id !== caseId) {
        throw new RoiVarianceNotFoundError(varianceId, organizationId);
      }

      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, caseId, organizationId);
      assertCommandCapability({
        access,
        actorUserId,
        capability: ROI_VARIANCE_CAPABILITIES.updateStatus,
        responsibleUserIds: [currentRow.owner_user_id, caseOwnerUserId],
      });

      beforeState = { variance: toRoiVariance(currentRow) };

      const merged = {
        status: status ?? currentRow.status,
        owner_user_id: ownerUserId !== undefined ? ownerUserId : currentRow.owner_user_id,
      };

      const updateResult = await client.query<RoiVarianceRow>(
        `UPDATE rvn_roi_variances
            SET status = $1, owner_user_id = $2, row_version = $3, updated_by = $4, updated_at = now()
          WHERE variance_id = $5
          RETURNING *`,
        [merged.status, merged.owner_user_id, nextVersion, actorUserId, varianceId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new Error(`[updateVarianceStatus] update returned no row for ${varianceId}`);
      }
      return toRoiVariance(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { variance: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.variance_status_updated',
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
        payload: { caseId, varianceId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// addVarianceCause / removeVarianceCause — simple child inserts/deletes
// ==========================================

export interface AddVarianceCauseInput {
  varianceId: string;
  organizationId: string;
  causeCategory: string;
  contributionPct?: number | null;
  narrative: string;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export async function addVarianceCause(input: AddVarianceCauseInput): Promise<AtomicCommandOutcome<RoiVarianceCause>> {
  const {
    varianceId,
    organizationId,
    causeCategory,
    contributionPct = null,
    narrative,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<RoiVarianceCause>({
    organizationId,
    applyMutation: async (client) => {
      const varianceResult = await client.query<{ variance_id: string; case_id: string; owner_user_id: string | null }>(
        `SELECT variance_id, case_id, owner_user_id FROM rvn_roi_variances WHERE variance_id = $1 AND organization_id = $2`,
        [varianceId, organizationId]
      );
      const varianceRow = varianceResult.rows[0];
      if (!varianceRow) {
        throw new RoiVarianceNotFoundError(varianceId, organizationId);
      }

      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, varianceRow.case_id, organizationId);
      assertCommandCapability({
        access,
        actorUserId: createdBy,
        capability: ROI_VARIANCE_CAPABILITIES.addCause,
        responsibleUserIds: [varianceRow.owner_user_id, caseOwnerUserId],
      });

      const insertResult = await client.query<RoiVarianceCauseRow>(
        `INSERT INTO rvn_roi_variance_causes (variance_id, organization_id, cause_category, contribution_pct, narrative, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [varianceId, organizationId, causeCategory, contributionPct, narrative, createdBy]
      );
      const row = insertResult.rows[0];
      if (!row) {
        throw new Error('[addVarianceCause] insert returned no row');
      }
      return toRoiVarianceCause(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { varianceCause: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.variance_cause_added',
        aggregateType: 'roi_case',
        aggregateId: varianceId,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { varianceId, causeId: result.causeId },
      } satisfies AtomicEventInput;
    },
  });
}

export interface RemoveVarianceCauseInput {
  causeId: string;
  varianceId: string;
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export interface RemoveVarianceCauseResult {
  causeId: string;
}

/**
 * Reuses the `roi.variance_cause_added` event type (design §6's
 * `EVENT_TYPE_CONSUMER_GROUPS` catalog registers only three variance event
 * types total — `material_variance_detected`/`variance_status_updated`/
 * `variance_cause_added` — with no distinct "removed" key) — `payload.removed:
 * true` disambiguates a remove from an add for any consumer reading the
 * event log, without inventing a fourth event type the design doc's own
 * literal §6 list does not name.
 */
export async function removeVarianceCause(
  input: RemoveVarianceCauseInput
): Promise<AtomicCommandOutcome<RemoveVarianceCauseResult>> {
  const {
    causeId,
    varianceId,
    organizationId,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<RemoveVarianceCauseResult>({
    organizationId,
    applyMutation: async (client) => {
      const varianceResult = await client.query<{ case_id: string; owner_user_id: string | null }>(
        `SELECT case_id, owner_user_id FROM rvn_roi_variances WHERE variance_id = $1 AND organization_id = $2`,
        [varianceId, organizationId]
      );
      const varianceRow = varianceResult.rows[0];
      if (!varianceRow) {
        throw new RoiVarianceNotFoundError(varianceId, organizationId);
      }
      const caseOwnerUserId = await loadRoiCaseOwnerUserId(client, varianceRow.case_id, organizationId);
      assertCommandCapability({
        access,
        actorUserId,
        capability: ROI_VARIANCE_CAPABILITIES.removeCause,
        responsibleUserIds: [varianceRow.owner_user_id, caseOwnerUserId],
      });

      const deleteResult = await client.query<{ cause_id: string }>(
        `DELETE FROM rvn_roi_variance_causes WHERE cause_id = $1 AND variance_id = $2 AND organization_id = $3 RETURNING cause_id`,
        [causeId, varianceId, organizationId]
      );
      const row = deleteResult.rows[0];
      if (!row) {
        throw new RoiVarianceValidationError(
          `Variance cause ${causeId} not found for variance ${varianceId}`,
          'VARIANCE_CAUSE_NOT_FOUND',
          { varianceId, causeId }
        );
      }
      return { causeId: row.cause_id };
    },
    buildEvent: ({ result }) => {
      const afterState = { causeId: result.causeId };
      return {
        schemaVersion: 1,
        eventType: 'roi.variance_cause_added',
        aggregateType: 'roi_case',
        aggregateId: varianceId,
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
        payload: { varianceId, causeId: result.causeId, removed: true },
      } satisfies AtomicEventInput;
    },
  });
}
