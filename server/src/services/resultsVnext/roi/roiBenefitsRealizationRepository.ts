/**
 * ROI-E005 — `getRoiCaseBenefitsRealizationView` (AC-03: realization %
 * computed from governed data).
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §2, Decisions
 * D10-D14.
 *
 * Pure read, live-computed, NEVER persisted (D11 — same half of ROI-E004's
 * own D9 split as `getRoiCaseCompareView`: a pure ratio over two already
 * -durable pointers has nothing to curate). Decision D10's formula:
 *   numerator   = the case's `currentActualSnapshotId`-pointed
 *                 `rvn_roi_actual_snapshots.total_actual_financial_benefits`
 *   denominator = the case's `latestApprovedSnapshotId`-pointed
 *                 `rvn_roi_approval_snapshots.snapshot_payload
 *                   .decisionCalculationRun.totalFinancialBenefits`
 *                 (the pinned APPROVED figure, never Forecast — immutable
 *                 -by-construction, cannot be gamed by re-forecasting a
 *                 smaller target)
 *   pct         = (actual / approved) * 100, `null` when approved is 0.
 *
 * Decision D12: 2-reason typed slot, reusing `RoiCompareSlot` from
 * `roiCompareRepository.ts` (NOT reimplemented) — reasons restricted to
 * `'not_yet_approved' | 'no_actual_recorded'` (approved-missing checked
 * first, then actual-missing; Forecast is not part of this ratio, so
 * `'no_forecast_published'` never appears here even though the underlying
 * type permits it).
 */
import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

import { getRoiCase } from './roiRepository.js';
import type { RoiCompareSlot } from './roiCompareRepository.js';
import type { RoiApprovalSnapshotRow } from './roiApprovalSnapshotTypes.js';
import type { RoiActualSnapshotRow } from './roiForecastActualTypes.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export type RoiBenefitsRealizationMissingReason = 'not_yet_approved' | 'no_actual_recorded';

export interface RoiCaseBenefitsRealizationView {
  caseId: string;
  benefitsRealizationPct: RoiCompareSlot;
  approvedFinancialBenefits: number | null;
  actualFinancialBenefits: number | null;
  asOfActualSnapshotId: string | null;
}

export interface GetRoiCaseBenefitsRealizationViewParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

/**
 * Visibility-gated via the same pattern `getRoiCaseCompareView` uses: the
 * standard case read is the ONE visibility check — every downstream row
 * below is read by exact id/case_id equality once this passes, since the
 * approval/actual snapshot rows are each uniquely owned by this already
 * -visibility-checked case.
 */
export async function getRoiCaseBenefitsRealizationView(
  params: GetRoiCaseBenefitsRealizationViewParams
): Promise<RoiCaseBenefitsRealizationView | null> {
  const { userId, organizationId, caseId } = params;

  const roiCase = await getRoiCase({ userId, organizationId, caseId, includeArchived: true });
  if (!roiCase) return null;

  return withReadClient(async (client) => {
    let approvedFinancialBenefits: number | null = null;
    let hasApprovedSnapshot = false;
    if (roiCase.latestApprovedSnapshotId) {
      const result = await client.query<RoiApprovalSnapshotRow>(
        `SELECT * FROM rvn_roi_approval_snapshots WHERE snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
        [roiCase.latestApprovedSnapshotId, caseId, organizationId]
      );
      const row = result.rows[0];
      if (row) {
        hasApprovedSnapshot = true;
        approvedFinancialBenefits = row.snapshot_payload.decisionCalculationRun.totalFinancialBenefits;
      }
    }

    let actualFinancialBenefits: number | null = null;
    let hasActualSnapshot = false;
    let asOfActualSnapshotId: string | null = null;
    if (roiCase.currentActualSnapshotId) {
      const result = await client.query<RoiActualSnapshotRow>(
        `SELECT * FROM rvn_roi_actual_snapshots WHERE actual_snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
        [roiCase.currentActualSnapshotId, caseId, organizationId]
      );
      const row = result.rows[0];
      if (row) {
        hasActualSnapshot = true;
        asOfActualSnapshotId = row.actual_snapshot_id;
        actualFinancialBenefits =
          row.total_actual_financial_benefits === null ? null : Number(row.total_actual_financial_benefits);
      }
    }

    // Decision D12: approved-missing checked FIRST, then actual-missing.
    let benefitsRealizationPct: RoiCompareSlot;
    if (!hasApprovedSnapshot) {
      benefitsRealizationPct = { status: 'not_yet_available', reason: 'not_yet_approved' };
    } else if (!hasActualSnapshot) {
      benefitsRealizationPct = { status: 'not_yet_available', reason: 'no_actual_recorded' };
    } else if (approvedFinancialBenefits === null || approvedFinancialBenefits === 0) {
      // Decision D10: null when the approved denominator is 0 (or, by the
      // same division-by-zero logic, absent even though the snapshot row
      // itself exists — a snapshot whose pinned run recorded no financial
      // benefits at all).
      benefitsRealizationPct = { status: 'available', value: null };
    } else {
      const pct = ((actualFinancialBenefits ?? 0) / approvedFinancialBenefits) * 100;
      benefitsRealizationPct = { status: 'available', value: pct };
    }

    return {
      caseId,
      benefitsRealizationPct,
      approvedFinancialBenefits,
      actualFinancialBenefits,
      asOfActualSnapshotId,
    };
  });
}
