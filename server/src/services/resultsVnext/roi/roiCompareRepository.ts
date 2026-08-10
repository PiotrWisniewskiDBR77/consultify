/**
 * ROI-E004 — `getRoiCaseCompareView` (AC-04: compare view has separate,
 * distinguishable missing states).
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4, Decision D9.
 *
 * Pure read, computed live on every call, NEVER persisted (satisfies AC-04's
 * freshness need — distinct from `rvn_roi_variances`, which is the STORED,
 * human-curated mechanism satisfying AC-05's durable cause+contribution
 * need). Pulls the latest approval snapshot / forecast version / actual
 * snapshot the case's own pointer columns reference and returns one object
 * per headline metric with THREE TYPED SLOTS (`approved`/`forecast`/
 * `actual`), each `{ status: 'available', value } | { status:
 * 'not_yet_available', reason }` — the literal mechanism satisfying AC-04,
 * never a bare `number | null` that collapses "not approved yet" and
 * "approved but zero" into the same value.
 *
 * `paybackPeriods`'s ACTUAL slot is a DOCUMENTED, permanent gap, not a bug:
 * `rvn_roi_actual_snapshots` (this epic's own DDL, §3) has no
 * `payback_periods` column — Actual entries have no fixed period grid the
 * way a CalculationRun/ForecastVersion's `periodSeries` does, so there is no
 * honest per-period cash-flow series to derive a payback point from (same
 * "no source doc specifies discounting for irregular actual cash flows"
 * reasoning `roiActualSnapshotCommands.ts`'s header already documents for
 * `actual_npv`). The actual slot for this one metric therefore always
 * reports `not_yet_available` / `no_actual_recorded`, even once an actual
 * snapshot exists — there is genuinely no stored value to surface, and the
 * three-reason enum this design fixes has no "not computable" case distinct
 * from "not recorded yet".
 */
import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

import { getRoiCase } from './roiRepository.js';
import type { RoiActualSnapshotRow, RoiForecastVersionRow } from './roiForecastActualTypes.js';
import type { RoiApprovalSnapshotRow } from './roiApprovalSnapshotTypes.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export const ROI_COMPARE_METRICS = ['npv', 'simpleRoi', 'totalCosts', 'totalFinancialBenefits', 'paybackPeriods'] as const;
export type RoiCompareMetric = (typeof ROI_COMPARE_METRICS)[number];

export type RoiCompareMissingReason = 'not_yet_approved' | 'no_forecast_published' | 'no_actual_recorded';

export type RoiCompareSlot =
  | { status: 'available'; value: number | null }
  | { status: 'not_yet_available'; reason: RoiCompareMissingReason };

export interface RoiCompareMetricRow {
  metric: RoiCompareMetric;
  approved: RoiCompareSlot;
  forecast: RoiCompareSlot;
  actual: RoiCompareSlot;
}

export interface RoiCaseCompareView {
  caseId: string;
  metrics: RoiCompareMetricRow[];
}

export interface GetRoiCaseCompareViewParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

function availableOrNull(value: number | null): RoiCompareSlot {
  return { status: 'available', value };
}

export async function getRoiCaseCompareView(params: GetRoiCaseCompareViewParams): Promise<RoiCaseCompareView | null> {
  const { userId, organizationId, caseId } = params;

  // Visibility gate via the standard case read — every downstream row below
  // is read by exact id/case_id equality once this passes, since forecast/
  // approval/actual rows are each uniquely owned by this already-visibility-
  // checked case.
  const roiCase = await getRoiCase({ userId, organizationId, caseId, includeArchived: true });
  if (!roiCase) return null;

  return withReadClient(async (client) => {
    let approvedValues: {
      totalCosts: number | null;
      totalFinancialBenefits: number | null;
      simpleRoi: number | null;
      npv: number | null;
      paybackPeriods: number | null;
    } | null = null;
    if (roiCase.latestApprovedSnapshotId) {
      const result = await client.query<RoiApprovalSnapshotRow>(
        `SELECT * FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
        [roiCase.latestApprovedSnapshotId, caseId, organizationId]
      );
      const row = result.rows[0];
      if (row) {
        const run = row.snapshot_payload.decisionCalculationRun;
        approvedValues = {
          totalCosts: run.totalCosts,
          totalFinancialBenefits: run.totalFinancialBenefits,
          simpleRoi: run.simpleRoi,
          npv: run.npv,
          paybackPeriods: run.paybackPeriods,
        };
      }
    }

    let forecastValues: {
      totalCosts: number | null;
      totalFinancialBenefits: number | null;
      simpleRoi: number | null;
      npv: number | null;
      paybackPeriods: number | null;
    } | null = null;
    if (roiCase.currentForecastVersionId) {
      const result = await client.query<RoiForecastVersionRow>(
        `SELECT * FROM rvn_roi_forecast_versions WHERE forecast_version_id = $1 AND case_id = $2 AND organization_id = $3`,
        [roiCase.currentForecastVersionId, caseId, organizationId]
      );
      const row = result.rows[0];
      if (row) {
        forecastValues = {
          totalCosts: row.total_costs === null ? null : Number(row.total_costs),
          totalFinancialBenefits: row.total_financial_benefits === null ? null : Number(row.total_financial_benefits),
          simpleRoi: row.simple_roi === null ? null : Number(row.simple_roi),
          npv: row.npv === null ? null : Number(row.npv),
          paybackPeriods: row.payback_periods === null ? null : Number(row.payback_periods),
        };
      }
    }

    let actualValues: {
      totalCosts: number | null;
      totalFinancialBenefits: number | null;
      simpleRoi: number | null;
      npv: number | null;
    } | null = null;
    if (roiCase.currentActualSnapshotId) {
      const result = await client.query<RoiActualSnapshotRow>(
        `SELECT * FROM rvn_roi_actual_snapshots WHERE actual_snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
        [roiCase.currentActualSnapshotId, caseId, organizationId]
      );
      const row = result.rows[0];
      if (row) {
        actualValues = {
          totalCosts: row.total_actual_costs === null ? null : Number(row.total_actual_costs),
          totalFinancialBenefits:
            row.total_actual_financial_benefits === null ? null : Number(row.total_actual_financial_benefits),
          simpleRoi: row.actual_simple_roi === null ? null : Number(row.actual_simple_roi),
          npv: row.actual_npv === null ? null : Number(row.actual_npv),
        };
      }
    }

    function slotFor(
      metric: RoiCompareMetric,
      scope: 'approved' | 'forecast' | 'actual'
    ): RoiCompareSlot {
      if (scope === 'approved') {
        if (!approvedValues) return { status: 'not_yet_available', reason: 'not_yet_approved' };
        return availableOrNull(approvedValues[metric]);
      }
      if (scope === 'forecast') {
        if (!forecastValues) return { status: 'not_yet_available', reason: 'no_forecast_published' };
        return availableOrNull(forecastValues[metric]);
      }
      // actual
      if (!actualValues) return { status: 'not_yet_available', reason: 'no_actual_recorded' };
      if (metric === 'paybackPeriods') {
        // Documented gap — see file header.
        return { status: 'not_yet_available', reason: 'no_actual_recorded' };
      }
      return availableOrNull(actualValues[metric]);
    }

    const metrics: RoiCompareMetricRow[] = ROI_COMPARE_METRICS.map((metric) => ({
      metric,
      approved: slotFor(metric, 'approved'),
      forecast: slotFor(metric, 'forecast'),
      actual: slotFor(metric, 'actual'),
    }));

    return { caseId, metrics };
  });
}
