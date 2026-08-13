/**
 * ROI-E005 — Organization/manager Benefits Realization perspective (AC-05:
 * org perspective only from governed data).
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §2, Decisions
 * D15/D16. Mirrors `kpi/kpiPerspectivesRepository.ts`'s
 * `listOrganizationKpiAttention`/`buildScopedKpisBase` shape exactly: the
 * same `chain_members`/`scoped_*` CTE pattern, `resource_type='roi_case'`,
 * a management-chain scope on `owner_user_id` LAYERED ON TOP of (not
 * instead of) the standard per-case `rvn_visible_resources` visibility join
 * (Decision D16 — identical two-layer shape).
 *
 * Reads ONLY `rvn_roi_cases` / `rvn_roi_approval_snapshots` /
 * `rvn_roi_actual_snapshots` — the literal mechanism satisfying AC-05
 * ("org perspective only from governed data"); never a legacy table
 * (`roi_realized_values`, `initiative_benefits`, `benefits_register`,
 * `v8_roi_realization_entries`, `analysis_financials`,
 * `digitization_analyses` — ROI-E001 §2's permanently-excluded set).
 *
 * Every `vr.resource_id = <uuid column>` join carries the `::text` cast —
 * the exact bug class fixed program-wide in EXECUTION_LEDGER.md §24
 * (`roiRepository.ts`'s own file header repeats this warning); do not drop
 * it here.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { buildVisibilityScopedCte } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE, ROI_TRACKING_ACTIVE_STATUSES } from './roiCaseCommands.js';
import type { RoiPirOutcome } from './roiPirTypes.js';
import type { RoiCaseStatus } from './roiTypes.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function queryRows<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[]
): Promise<T[]> {
  const result = await client.query<T>(sql, values);
  return result.rows;
}

export interface OrganizationRoiBenefitsRealizationCaseRow {
  caseId: string;
  initiativeId: string;
  title: string;
  status: RoiCaseStatus;
  approvedFinancialBenefits: number | null;
  actualFinancialBenefits: number | null;
  /** Plain nullable number (not the 2-reason typed slot the single-case
   * `getRoiCaseBenefitsRealizationView` returns) — `null` whenever either
   * side is missing or the approved denominator is 0; per-row missing-
   * reason DETAIL is what the single-case view is for (design §2). */
  benefitsRealizationPct: number | null;
}

export interface OrganizationRoiBenefitsRealization {
  cases: OrganizationRoiBenefitsRealizationCaseRow[];
  portfolioTotals: {
    totalApprovedFinancialBenefits: number;
    totalActualFinancialBenefits: number;
    caseCountWithActual: number;
    caseCountTotal: number;
  };
}

export interface ListOrganizationRoiBenefitsRealizationParams {
  managerId: string;
  organizationId: string;
}

/**
 * Design §2: same `chain_members`/`scoped_cases` shape as
 * `kpiPerspectivesRepository.ts`'s `buildScopedKpisBase`. `$1`=organizationId
 * `$2`=resourceType ('roi_case') `$3`=managerId (visibility CTE params,
 * reused) `$4`=managerId (chain params, deliberately separate placeholder,
 * per that file's own precedent). `scoped_cases` is additionally filtered to
 * `statuses` (design §2: "Scoped to cases with status IN
 * ROI_TRACKING_ACTIVE_STATUSES") — this repository has exactly one caller,
 * unlike the KPI file's multi-metric orchestrator, so the status filter is
 * baked into the shared base rather than repeated per metric.
 *
 * ROI-E006 §6/D14 (Decision D14: extend, not duplicate): `statuses` defaults
 * to `ROI_TRACKING_ACTIVE_STATUSES` — `listOrganizationRoiBenefitsRealization`
 * below keeps calling this with two positional args and gets byte-identical
 * behavior. `listOrganizationRoiPirOutcomes` passes its OWN status set
 * (`'post_investment_review'`/`'closed'`) explicitly — a case in either of
 * those two statuses is never in `ROI_TRACKING_ACTIVE_STATUSES`, so the
 * status filter genuinely must be parameterized, not just reused as-is.
 */
export async function buildScopedRoiCasesBase(
  managerId: string,
  organizationId: string,
  statuses: readonly RoiCaseStatus[] = ROI_TRACKING_ACTIVE_STATUSES
): Promise<{ sql: string; values: unknown[] }> {
  const cte = await buildVisibilityScopedCte({
    userId: managerId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values: unknown[] = [...cte.values, managerId];
  const statusPlaceholders = statuses.map((_, idx) => `$${values.length + 1 + idx}`).join(', ');
  values.push(...statuses);
  const sql = `${cte.sql},
chain_members AS (
  SELECT descendant_user_id AS user_id
    FROM rvn_platform_management_chain_closure
   WHERE organization_id = $1 AND ancestor_user_id = $4
  UNION
  SELECT $4
),
scoped_cases AS (
  SELECT rc.*
    FROM rvn_roi_cases rc
    INNER JOIN rvn_visible_resources vr
            ON vr.resource_type = 'roi_case' AND vr.resource_id = rc.case_id::text
    INNER JOIN chain_members cm ON cm.user_id = rc.owner_user_id
   WHERE rc.organization_id = $1
     AND rc.status IN (${statusPlaceholders})
)`;
  return { sql, values };
}

/**
 * Design §2/D15/D16: an orchestrator-free single query (this domain has one
 * metric, not the KPI file's seven independent ones) — the per-case rows and
 * the portfolio totals are derived from the SAME `scoped_cases` base in one
 * round trip via `LEFT JOIN LATERAL`, then aggregated in JS rather than a
 * second SQL pass, since the row-level shape is what the caller needs
 * anyway.
 */
export async function listOrganizationRoiBenefitsRealization(
  params: ListOrganizationRoiBenefitsRealizationParams
): Promise<OrganizationRoiBenefitsRealization> {
  const { managerId, organizationId } = params;

  const base = await buildScopedRoiCasesBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT
    sc.case_id,
    sc.initiative_id,
    sc.title,
    sc.status,
    approved.total_financial_benefits AS approved_financial_benefits,
    actual.total_actual_financial_benefits AS actual_financial_benefits
  FROM scoped_cases sc
  LEFT JOIN LATERAL (
    SELECT (ras.snapshot_payload->'decisionCalculationRun'->>'totalFinancialBenefits')::numeric
             AS total_financial_benefits
      FROM rvn_roi_approval_snapshots ras
     WHERE ras.snapshot_id = sc.latest_approved_snapshot_id AND ras.case_id = sc.case_id
       AND ras.organization_id = sc.organization_id
  ) approved ON true
  LEFT JOIN LATERAL (
    SELECT rvs.total_actual_financial_benefits
      FROM rvn_roi_actual_snapshots rvs
     WHERE rvs.actual_snapshot_id = sc.current_actual_snapshot_id AND rvs.case_id = sc.case_id
       AND rvs.organization_id = sc.organization_id
  ) actual ON true
 ORDER BY sc.case_id`;

  const rows = await withReadClient((client) =>
    queryRows<{
      case_id: string;
      initiative_id: string;
      title: string;
      status: RoiCaseStatus;
      approved_financial_benefits: string | null;
      actual_financial_benefits: string | null;
    }>(client, sql, base.values)
  );

  let totalApprovedFinancialBenefits = 0;
  let totalActualFinancialBenefits = 0;
  let caseCountWithActual = 0;

  const cases: OrganizationRoiBenefitsRealizationCaseRow[] = rows.map((row) => {
    const approvedFinancialBenefits =
      row.approved_financial_benefits === null ? null : Number(row.approved_financial_benefits);
    const actualFinancialBenefits =
      row.actual_financial_benefits === null ? null : Number(row.actual_financial_benefits);

    if (approvedFinancialBenefits !== null) totalApprovedFinancialBenefits += approvedFinancialBenefits;
    if (actualFinancialBenefits !== null) {
      totalActualFinancialBenefits += actualFinancialBenefits;
      caseCountWithActual += 1;
    }

    // Same D10 formula as the single-case view: null when either side is
    // missing OR the approved denominator is 0.
    const benefitsRealizationPct =
      approvedFinancialBenefits === null || approvedFinancialBenefits === 0 || actualFinancialBenefits === null
        ? null
        : (actualFinancialBenefits / approvedFinancialBenefits) * 100;

    return {
      caseId: row.case_id,
      initiativeId: row.initiative_id,
      title: row.title,
      status: row.status,
      approvedFinancialBenefits,
      actualFinancialBenefits,
      benefitsRealizationPct,
    };
  });

  return {
    cases,
    portfolioTotals: {
      totalApprovedFinancialBenefits,
      totalActualFinancialBenefits,
      caseCountWithActual,
      caseCountTotal: cases.length,
    },
  };
}

// ==========================================
// ROI-E006 §6/D14 — listOrganizationRoiPirOutcomes (AC-05)
// ==========================================

const ROI_PIR_OUTCOME_STATUSES: readonly RoiCaseStatus[] = ['post_investment_review', 'closed'];

export interface OrganizationRoiPirOutcomeCaseRow {
  caseId: string;
  initiativeId: string;
  title: string;
  status: RoiCaseStatus;
  /** The latest (by `sequence_number`) PIR row's `outcome` for this case —
   * `null` for a case still mid-review (`status='post_investment_review'`,
   * PIR still `status='draft'`, `outcome` not yet recorded) as well as for
   * one whose PIR row somehow does not exist yet (should not happen given
   * `ROI_PIR_OUTCOME_STATUSES`, but never fabricated either way). */
  pirOutcome: RoiPirOutcome | null;
  benefitsRealizationPct: number | null;
  /** The latest PIR row's `finalized_at` — `null` while still `draft`. */
  finalizedAt: string | null;
}

export interface OrganizationRoiPirOutcomes {
  cases: OrganizationRoiPirOutcomeCaseRow[];
  portfolioTotals: {
    closedCaseCount: number;
    fullyRealizedCount: number;
    partiallyRealizedCount: number;
    notRealizedCount: number;
  };
}

export interface ListOrganizationRoiPirOutcomesParams {
  managerId: string;
  organizationId: string;
}

/**
 * Design §6/D14: reuses `buildScopedRoiCasesBase` (not a near-duplicate CTE
 * file), scoped to `status IN ('post_investment_review', 'closed')` —
 * cases that have started or finished their PIR. Joins the LATEST
 * (finalized, or draft for an in-flight case) `rvn_roi_post_investment_reviews`
 * row per case via `LEFT JOIN LATERAL ... ORDER BY sequence_number DESC
 * LIMIT 1`, plus the same approved/actual financial-benefits lookup
 * `listOrganizationRoiBenefitsRealization` above uses for
 * `benefitsRealizationPct`. Reads ONLY `rvn_roi_cases`/
 * `rvn_roi_post_investment_reviews`/`rvn_roi_approval_snapshots`/
 * `rvn_roi_actual_snapshots` — the literal AC-05 mechanism, never a legacy
 * table.
 */
export async function listOrganizationRoiPirOutcomes(
  params: ListOrganizationRoiPirOutcomesParams
): Promise<OrganizationRoiPirOutcomes> {
  const { managerId, organizationId } = params;

  const base = await buildScopedRoiCasesBase(managerId, organizationId, ROI_PIR_OUTCOME_STATUSES);
  const sql = `${base.sql}
SELECT
    sc.case_id,
    sc.initiative_id,
    sc.title,
    sc.status,
    pir.outcome AS pir_outcome,
    pir.finalized_at,
    approved.total_financial_benefits AS approved_financial_benefits,
    actual.total_actual_financial_benefits AS actual_financial_benefits
  FROM scoped_cases sc
  LEFT JOIN LATERAL (
    SELECT p.outcome, p.finalized_at
      FROM rvn_roi_post_investment_reviews p
     WHERE p.case_id = sc.case_id AND p.organization_id = sc.organization_id
     ORDER BY p.sequence_number DESC
     LIMIT 1
  ) pir ON true
  LEFT JOIN LATERAL (
    SELECT (ras.snapshot_payload->'decisionCalculationRun'->>'totalFinancialBenefits')::numeric
             AS total_financial_benefits
      FROM rvn_roi_approval_snapshots ras
     WHERE ras.snapshot_id = sc.latest_approved_snapshot_id AND ras.case_id = sc.case_id
       AND ras.organization_id = sc.organization_id
  ) approved ON true
  LEFT JOIN LATERAL (
    SELECT rvs.total_actual_financial_benefits
      FROM rvn_roi_actual_snapshots rvs
     WHERE rvs.actual_snapshot_id = sc.current_actual_snapshot_id AND rvs.case_id = sc.case_id
       AND rvs.organization_id = sc.organization_id
  ) actual ON true
 ORDER BY sc.case_id`;

  const rows = await withReadClient((client) =>
    queryRows<{
      case_id: string;
      initiative_id: string;
      title: string;
      status: RoiCaseStatus;
      pir_outcome: RoiPirOutcome | null;
      finalized_at: string | null;
      approved_financial_benefits: string | null;
      actual_financial_benefits: string | null;
    }>(client, sql, base.values)
  );

  let closedCaseCount = 0;
  let fullyRealizedCount = 0;
  let partiallyRealizedCount = 0;
  let notRealizedCount = 0;

  const cases: OrganizationRoiPirOutcomeCaseRow[] = rows.map((row) => {
    const approvedFinancialBenefits =
      row.approved_financial_benefits === null ? null : Number(row.approved_financial_benefits);
    const actualFinancialBenefits =
      row.actual_financial_benefits === null ? null : Number(row.actual_financial_benefits);
    const benefitsRealizationPct =
      approvedFinancialBenefits === null || approvedFinancialBenefits === 0 || actualFinancialBenefits === null
        ? null
        : (actualFinancialBenefits / approvedFinancialBenefits) * 100;

    if (row.status === 'closed') {
      closedCaseCount += 1;
      if (row.pir_outcome === 'benefits_fully_realized') fullyRealizedCount += 1;
      else if (row.pir_outcome === 'benefits_partially_realized') partiallyRealizedCount += 1;
      else if (row.pir_outcome === 'benefits_not_realized') notRealizedCount += 1;
    }

    return {
      caseId: row.case_id,
      initiativeId: row.initiative_id,
      title: row.title,
      status: row.status,
      pirOutcome: row.pir_outcome,
      benefitsRealizationPct,
      finalizedAt: row.finalized_at,
    };
  });

  return {
    cases,
    portfolioTotals: { closedCaseCount, fullyRealizedCount, partiallyRealizedCount, notRealizedCount },
  };
}
