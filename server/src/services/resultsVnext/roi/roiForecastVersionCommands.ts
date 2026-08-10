/**
 * ROI-E004 — `createRoiForecastVersion` (AC-01: forecast never mutates
 * Approved).
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decisions
 * D1/D3/D4/D5/D6/D7.
 *
 * Reuses `roiCalculationEngine.ts` UNMODIFIED (Decision D4 — the engine
 * already accepts `scenarioType:'custom'` + caller-supplied
 * `scenarioOverrides`, no DB dependency on `rvn_roi_scenario_overrides` rows
 * existing) and the exported (Decision D5) row->engine mappers from
 * `roiCalculationRunCommands.ts` — never re-derives the DATE-deserialization
 * fix or row-mapping logic. `analysisStart`/`analysisEnd`/`currency`/
 * `granularity` are taken from the case row UNCHANGED (Decision D7 — a
 * forecast may not extend the analysis horizon beyond the approved window).
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';

import { ROI_EVENT_SOURCE, ROI_TRACKING_ACTIVE_STATUSES } from './roiCaseCommands.js';
import {
  assumptionRowToEngine,
  benefitLineRowToEngine,
  costLineRowToEngine,
  policyStampObject,
  toDateOnlyString,
} from './roiCalculationRunCommands.js';
import { ROI_CALCULATION_ENGINE_VERSION, runRoiCalculationEngine } from './engine/roiCalculationEngine.js';
import type { RoiCalculationEngineInput, RoiEngineScenarioOverride } from './engine/roiCalculationEngine.types.js';
import {
  toRoiForecastVersion,
  type RoiForecastVersion,
  type RoiForecastVersionRow,
} from './roiForecastActualTypes.js';
import type {
  RoiAssumptionRow,
  RoiBenefitLineRow,
  RoiCalculationPolicyRow,
  RoiCostLineRow,
} from './roiEconomicModelTypes.js';
import type { RoiCaseRow } from './roiTypes.js';

// ==========================================
// ERRORS
// ==========================================

export class RoiForecastVersionValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_FORECAST_VERSION_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'RoiForecastVersionValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// SHARED ROW LOADER
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

// ==========================================
// createRoiForecastVersion
// ==========================================

export interface CreateRoiForecastVersionOverrideInput {
  targetType: 'assumption' | 'cost_line' | 'benefit_line';
  targetId: string;
  overrideValue?: number | null;
  overrideAmount?: number | null;
}

export interface CreateRoiForecastVersionInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  /** Business reason for this forecast run (`rvn_roi_forecast_versions.reason`
   * is NOT NULL — always required, unlike most commands' optional audit
   * `reason`). */
  reason: string;
  overrides?: CreateRoiForecastVersionOverrideInput[];
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

export async function createRoiForecastVersion(
  input: CreateRoiForecastVersionInput
): Promise<AtomicCommandOutcome<RoiForecastVersion>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    reason,
    overrides = [],
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  return executeAtomicCommand<RoiCaseRow, RoiForecastVersion>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!ROI_TRACKING_ACTIVE_STATUSES.includes(currentRow.status)) {
        throw new RoiForecastVersionValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — a forecast version may only be published while the case is tracking`,
          'CASE_NOT_TRACKABLE',
          { caseId, status: currentRow.status }
        );
      }

      // Internal-invariant fail-loud, same shape as approveRoiCase's
      // decision-run null check — a case in a ROI_TRACKING_ACTIVE_STATUSES
      // status must have gone through approveRoiCase, which always sets
      // latest_approved_snapshot_id.
      const comparedAgainstSnapshotId = currentRow.latest_approved_snapshot_id;
      if (!comparedAgainstSnapshotId) {
        throw new Error(
          `[createRoiForecastVersion] case ${caseId} is "${currentRow.status}" but has no latest_approved_snapshot_id — internal invariant violated`
        );
      }

      const policyResult = await client.query<RoiCalculationPolicyRow>(
        `SELECT * FROM rvn_roi_calculation_policy WHERE case_id = $1 AND organization_id = $2`,
        [caseId, organizationId]
      );
      const policyRow = policyResult.rows[0];
      if (!policyRow) {
        throw new Error(`[createRoiForecastVersion] no calculation-policy row found for case ${caseId}`);
      }
      const assumptionsResult = await client.query<RoiAssumptionRow>(
        `SELECT * FROM rvn_roi_assumptions
          WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
          ORDER BY assumption_id`,
        [caseId, organizationId]
      );
      const costLinesResult = await client.query<RoiCostLineRow>(
        `SELECT * FROM rvn_roi_cost_lines
          WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
          ORDER BY cost_line_id`,
        [caseId, organizationId]
      );
      const benefitLinesResult = await client.query<RoiBenefitLineRow>(
        `SELECT * FROM rvn_roi_benefit_lines
          WHERE case_id = $1 AND organization_id = $2 AND deleted_at IS NULL
          ORDER BY benefit_line_id`,
        [caseId, organizationId]
      );

      const assumptionIds = new Set(assumptionsResult.rows.map((r) => r.assumption_id));
      const costLineIds = new Set(costLinesResult.rows.map((r) => r.cost_line_id));
      const benefitLineIds = new Set(benefitLinesResult.rows.map((r) => r.benefit_line_id));

      for (const override of overrides) {
        const validTarget =
          (override.targetType === 'assumption' && assumptionIds.has(override.targetId)) ||
          (override.targetType === 'cost_line' && costLineIds.has(override.targetId)) ||
          (override.targetType === 'benefit_line' && benefitLineIds.has(override.targetId));
        if (!validTarget) {
          throw new RoiForecastVersionValidationError(
            `Override target ${override.targetType}:${override.targetId} does not belong to case ${caseId}`,
            'OVERRIDE_TARGET_NOT_FOUND',
            { caseId, targetType: override.targetType, targetId: override.targetId }
          );
        }
      }

      const engineOverrides: RoiEngineScenarioOverride[] = overrides.map((o) => ({
        targetType: o.targetType,
        targetId: o.targetId,
        overrideValue: o.overrideValue ?? null,
        overrideAmount: o.overrideAmount ?? null,
      }));

      // Decision D7: analysisStart/analysisEnd/currency/granularity come
      // straight from the case row, UNCHANGED — a forecast may never extend
      // the analysis horizon beyond the approved window.
      const analysisStart = toDateOnlyString(currentRow.analysis_start);
      const analysisEnd = toDateOnlyString(currentRow.analysis_end);
      if (!analysisStart || !analysisEnd) {
        throw new RoiForecastVersionValidationError(
          `ROI case ${caseId} has no analysisStart/analysisEnd set — cannot publish a forecast without an analysis window`,
          'ANALYSIS_WINDOW_MISSING',
          { caseId, analysisStart, analysisEnd }
        );
      }

      const engineInput: RoiCalculationEngineInput = {
        currency: currentRow.currency,
        granularity: currentRow.granularity,
        analysisStart,
        analysisEnd,
        discountRatePct: policyRow.discount_rate_pct === null ? null : Number(policyRow.discount_rate_pct),
        roundingPolicy: policyRow.rounding_policy,
        requiredMetrics: policyRow.required_metrics,
        assumptions: assumptionsResult.rows.map(assumptionRowToEngine),
        costLines: costLinesResult.rows.map(costLineRowToEngine),
        benefitLines: benefitLinesResult.rows.map(benefitLineRowToEngine),
        scenarioType: engineOverrides.length ? 'custom' : null,
        scenarioOverrides: engineOverrides,
      };

      // Decision D4: pure, unmodified engine call.
      const output = runRoiCalculationEngine(engineInput);

      const inputHash = computeStateHash(engineInput as unknown as Record<string, unknown>);
      const policyVersionStamp = computeStateHash(policyStampObject(policyRow));

      // Decision D6: latest only — full history lives in this table,
      // queryable by sequence. Safe without its own lock; the case row's FOR
      // UPDATE (executeAtomicCommand step 2) already serializes concurrent
      // forecast publishes for the same case.
      const sequenceResult = await client.query<{ next_sequence: string }>(
        `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
           FROM rvn_roi_forecast_versions WHERE case_id = $1`,
        [caseId]
      );
      const sequenceNumber = Number(sequenceResult.rows[0]?.next_sequence ?? 1);

      const insertResult = await client.query<RoiForecastVersionRow>(
        `INSERT INTO rvn_roi_forecast_versions (
           case_id, organization_id, sequence_number, reason, published_by,
           compared_against_snapshot_id, engine_version, policy_version_stamp,
           input_overrides, input_snapshot, input_hash,
           status, total_costs, total_financial_benefits, simple_roi, npv, irr_pct, irr_status,
           payback_periods, discounted_payback_periods, benefit_cost_ratio,
           period_series, has_unresolved_double_counting, has_mixed_currency_failure,
           validation_findings, warnings
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14, $15, $16, $17, $18,
           $19, $20, $21,
           $22, $23, $24,
           $25, $26
         )
         RETURNING *`,
        [
          caseId,
          organizationId,
          sequenceNumber,
          reason,
          actorUserId,
          comparedAgainstSnapshotId,
          ROI_CALCULATION_ENGINE_VERSION,
          policyVersionStamp,
          JSON.stringify(overrides),
          JSON.stringify(engineInput),
          inputHash,
          output.status,
          output.totalCosts,
          output.totalFinancialBenefits,
          output.simpleRoi,
          output.npv,
          output.irrPct,
          output.irrStatus,
          output.paybackPeriods,
          output.discountedPaybackPeriods,
          output.benefitCostRatio,
          JSON.stringify(output.periodSeries),
          output.hasUnresolvedDoubleCounting,
          output.hasMixedCurrencyFailure,
          JSON.stringify(output.validationFindings),
          JSON.stringify(output.warnings),
        ]
      );
      const forecastRow = insertResult.rows[0];
      if (!forecastRow) {
        throw new Error('[createRoiForecastVersion] insert into rvn_roi_forecast_versions returned no row');
      }

      // Decision D6: current_forecast_version_id always moves to the latest.
      await client.query(
        `UPDATE rvn_roi_cases SET current_forecast_version_id = $1, row_version = $2, updated_by = $3, updated_at = now()
          WHERE case_id = $4`,
        [forecastRow.forecast_version_id, nextVersion, actorUserId, caseId]
      );

      return toRoiForecastVersion(forecastRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState: Record<string, unknown> = { forecastVersion: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.forecast_published',
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
        payload: { caseId, forecastVersionId: result.forecastVersionId, sequenceNumber: result.sequenceNumber },
      } satisfies AtomicEventInput;
    },
  });
}
