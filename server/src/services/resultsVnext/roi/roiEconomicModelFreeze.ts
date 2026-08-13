/**
 * ROI-E002 — `freezeRoiEconomicModel`, the cross-epic contract for ROI-E003.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §1 Decision D7,
 * mirrors `roiBaselineCommands.ts`'s `freezeRoiBaseline` exactly (ROI-E001
 * §4.5): called by ROI-E003's future `approveRoiCase`, on the SAME pinned
 * client, inside the SAME transaction as the case-approval CAS, immediately
 * AFTER `freezeRoiBaseline` — this function does NOT open its own
 * transaction and does NOT check case status itself, the caller is
 * responsible for calling it only when the case transition it is CASing
 * actually reaches `'approved'`.
 *
 * Freezes every mutable ROI-E002 table's ACTIVE (`deleted_at IS NULL`) rows
 * for the case: `rvn_roi_calculation_policy` (1:1, always exactly one row),
 * `rvn_roi_assumptions`, `rvn_roi_cost_lines`, `rvn_roi_benefit_lines`,
 * `rvn_roi_scenarios`. `rvn_roi_benefit_evidence_links` and
 * `rvn_roi_scenario_overrides` carry no `frozen_at` column of their own
 * (design §3 DDL) — they are metadata ABOUT an already-frozen benefit
 * line/scenario, not independently-mutable financial facts, so they need no
 * freeze trigger of their own. `rvn_roi_calculation_runs` needs no freeze
 * call — immutable by construction (never UPDATEd after INSERT).
 *
 * Each `UPDATE ... WHERE frozen_at IS NULL` is idempotent — calling this
 * twice (e.g. a future reapproval cycle) simply freezes zero additional
 * rows the second time for already-frozen content, and any row created
 * AFTER the first freeze (there should be none, since NON_EDITABLE_STATUSES
 * blocks add/update once the case leaves its editable statuses) would still
 * get frozen on this call.
 */
import type { PoolClient } from 'pg';

export interface FreezeRoiEconomicModelParams {
  caseId: string;
  organizationId: string;
  frozenBy: string;
}

export async function freezeRoiEconomicModel(client: PoolClient, params: FreezeRoiEconomicModelParams): Promise<void> {
  const { caseId, organizationId, frozenBy } = params;

  await client.query(
    `UPDATE rvn_roi_calculation_policy
        SET frozen_at = now(), frozen_by = $3, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NULL`,
    [caseId, organizationId, frozenBy]
  );

  await client.query(
    `UPDATE rvn_roi_assumptions
        SET frozen_at = now(), frozen_by = $3, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NULL AND deleted_at IS NULL`,
    [caseId, organizationId, frozenBy]
  );

  await client.query(
    `UPDATE rvn_roi_cost_lines
        SET frozen_at = now(), frozen_by = $3, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NULL AND deleted_at IS NULL`,
    [caseId, organizationId, frozenBy]
  );

  await client.query(
    `UPDATE rvn_roi_benefit_lines
        SET frozen_at = now(), frozen_by = $3, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NULL AND deleted_at IS NULL`,
    [caseId, organizationId, frozenBy]
  );

  await client.query(
    `UPDATE rvn_roi_scenarios
        SET frozen_at = now(), frozen_by = $3, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NULL AND deleted_at IS NULL`,
    [caseId, organizationId, frozenBy]
  );
}

// ==========================================
// unfreezeRoiEconomicModel (ROI-E003 §4.6 — symmetric counterpart, first
// called by ROI-E003's reopenApprovedRoiCaseForRevision)
// ==========================================

export interface UnfreezeRoiEconomicModelParams {
  caseId: string;
  organizationId: string;
}

/**
 * Called by ROI-E003's `reopenApprovedRoiCaseForRevision`, on the SAME
 * pinned client, inside the SAME transaction as the case's approved ->
 * modeling CAS, immediately AFTER `unfreezeRoiBaseline` — same contract
 * shape as `freezeRoiEconomicModel` above (no own transaction, no own
 * status check, caller's responsibility). Unfreezes the SAME five tables
 * `freezeRoiEconomicModel` freezes, each `UPDATE ... WHERE frozen_at IS NOT
 * NULL` idempotent.
 */
export async function unfreezeRoiEconomicModel(
  client: PoolClient,
  params: UnfreezeRoiEconomicModelParams
): Promise<void> {
  const { caseId, organizationId } = params;

  await client.query(
    `UPDATE rvn_roi_calculation_policy
        SET frozen_at = NULL, frozen_by = NULL, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NOT NULL`,
    [caseId, organizationId]
  );

  await client.query(
    `UPDATE rvn_roi_assumptions
        SET frozen_at = NULL, frozen_by = NULL, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NOT NULL`,
    [caseId, organizationId]
  );

  await client.query(
    `UPDATE rvn_roi_cost_lines
        SET frozen_at = NULL, frozen_by = NULL, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NOT NULL`,
    [caseId, organizationId]
  );

  await client.query(
    `UPDATE rvn_roi_benefit_lines
        SET frozen_at = NULL, frozen_by = NULL, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NOT NULL`,
    [caseId, organizationId]
  );

  await client.query(
    `UPDATE rvn_roi_scenarios
        SET frozen_at = NULL, frozen_by = NULL, row_version = row_version + 1, updated_at = now()
      WHERE case_id = $1 AND organization_id = $2 AND frozen_at IS NOT NULL`,
    [caseId, organizationId]
  );
}
