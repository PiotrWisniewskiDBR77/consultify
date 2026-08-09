/**
 * ROI-E002 §5 — extension point on ROI-E001's `isRoiCaseReadyForReviewEligible`.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §5.
 *
 * Wraps E001's own baseline-only check (`roiCaseCommands.ts`), never
 * replaces its body (ROI-E001 Decision D2's own instruction to whoever
 * lands E002). Adds ROI-E002's own gate: a successful, FRESH calculation
 * run (input_hash matches the current economic-model state) with no
 * unresolved double-counting group.
 */
import type { PoolClient } from 'pg';

import { isRoiCaseReadyForReviewEligible, type RoiCaseReadyForReviewCheck } from './roiCaseCommands.js';
import { computeCurrentEconomicModelHash } from './roiCalculationRunCommands.js';
import type { RoiCalculationRunRow } from './roiEconomicModelTypes.js';
import type { RoiBaselineRow, RoiCaseRow } from './roiTypes.js';

/** ROI-E002's extension point on ROI-E001's guard (ROI-E001 Decision D2):
 * wraps `isRoiCaseReadyForReviewEligible`, never replaces its body. */
export async function isRoiCaseReadyForReviewEligibleWithEconomicModel(
  client: PoolClient,
  caseRow: RoiCaseRow,
  baselineRow: RoiBaselineRow
): Promise<RoiCaseReadyForReviewCheck> {
  const baselineCheck = isRoiCaseReadyForReviewEligible(caseRow, baselineRow);
  if (!baselineCheck.eligible) return baselineCheck;

  const { rows } = await client.query<RoiCalculationRunRow>(
    `SELECT * FROM rvn_roi_calculation_runs
      WHERE case_id = $1 AND organization_id = $2
      ORDER BY created_at DESC LIMIT 1`,
    [caseRow.case_id, caseRow.organization_id]
  );
  const latestRun = rows[0];
  if (!latestRun || latestRun.status !== 'completed') {
    return { eligible: false, reason: 'no_successful_calculation_run' };
  }
  const currentHash = await computeCurrentEconomicModelHash(client, caseRow.case_id, caseRow.organization_id);
  if (latestRun.input_hash !== currentHash) {
    return { eligible: false, reason: 'calculation_run_stale' };
  }
  if (latestRun.has_unresolved_double_counting) {
    return { eligible: false, reason: 'unresolved_double_counting_group' };
  }
  return { eligible: true };
}
