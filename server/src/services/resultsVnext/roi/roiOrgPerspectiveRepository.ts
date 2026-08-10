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
 * `ROI_TRACKING_ACTIVE_STATUSES` (design §2: "Scoped to cases with status IN
 * ROI_TRACKING_ACTIVE_STATUSES") — this repository has exactly one caller,
 * unlike the KPI file's multi-metric orchestrator, so the status filter is
 * baked into the shared base rather than repeated per metric.
 */
export async function buildScopedRoiCasesBase(
  managerId: string,
  organizationId: string
): Promise<{ sql: string; values: unknown[] }> {
  const cte = await buildVisibilityScopedCte({
    userId: managerId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values: unknown[] = [...cte.values, managerId];
  const statusPlaceholders = ROI_TRACKING_ACTIVE_STATUSES.map((_, idx) => `$${values.length + 1 + idx}`).join(', ');
  values.push(...ROI_TRACKING_ACTIVE_STATUSES);
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
