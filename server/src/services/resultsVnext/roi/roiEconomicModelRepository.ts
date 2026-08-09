/**
 * ROI-E002 — read repository.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §6.
 *
 * Every new table inherits visibility via `case_id` only (Decision D15) —
 * same `INNER JOIN rvn_visible_resources ON resource_type='roi_case' AND
 * resource_id = <table>.case_id::text` shape `roiRepository.ts` (ROI-E001)
 * already uses. The `::text` cast applies to EVERY one of these joins, no
 * exceptions (ROI-E001 §5's exact lesson, restated in the design doc's own
 * §6 header — a bug class that was missed 7 times across the KPI domain in
 * an earlier epic and only caught by a dedicated realDB test afterward).
 *
 * KPI evidence-link hydration (Decision D14): `listBenefitEvidenceLinks`'s
 * `hydrateKpiDetails=true` path additionally scopes through KPI's own
 * `buildVisibilityScopedCte({ resourceType: 'kpi' })` — a caller without
 * KPI access still sees the link's own fields (pinned id/version/purpose/
 * dispute_status) but gets `kpiDetails: null` instead of the KPI's content.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import {
  toRoiAssumption,
  toRoiBenefitEvidenceLink,
  toRoiBenefitLine,
  toRoiCalculationPolicy,
  toRoiCalculationRun,
  toRoiCostLine,
  toRoiScenario,
  toRoiScenarioOverride,
  type RoiAssumption,
  type RoiAssumptionRow,
  type RoiBenefitEvidenceLink,
  type RoiBenefitEvidenceLinkRow,
  type RoiBenefitLine,
  type RoiBenefitLineRow,
  type RoiCalculationPolicy,
  type RoiCalculationPolicyRow,
  type RoiCalculationRun,
  type RoiCalculationRunRow,
  type RoiCostLine,
  type RoiCostLineRow,
  type RoiScenario,
  type RoiScenarioOverride,
  type RoiScenarioOverrideRow,
  type RoiScenarioRow,
} from './roiEconomicModelTypes.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function queryRows<T extends QueryResultRow>(client: PoolClient, sql: string, values: unknown[]): Promise<T[]> {
  const result = await client.query<T>(sql, values);
  return result.rows;
}

interface CaseScopedParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

/** Shared shape every list/get below uses: visibility-scoped via the
 * CASE's own `resource_id` (never a per-table resource_type), `::text` cast
 * on the UUID join column, `organization_id` AND `case_id` both bound as
 * plain equality filters after the CTE's own params. */
async function caseScopedRows<TRow extends QueryResultRow>(
  params: CaseScopedParams,
  tableAlias: string,
  tableName: string,
  extraWhere: string,
  orderBy: string
): Promise<TRow[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT ${tableAlias}.*
      FROM ${tableName} ${tableAlias}
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = ${tableAlias}.case_id::text
     WHERE ${tableAlias}.organization_id = $1
       AND ${tableAlias}.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       ${extraWhere}
     ORDER BY ${orderBy}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, caseId];
  return withReadClient((client) => queryRows<TRow>(client, wrapped.sql, values));
}

/** Shared single-row-by-id lookup, same visibility-scoped shape as
 * `caseScopedRows` — used by the `GET .../<collection>/:id` single-item
 * routes (design §7's `[/:id]` bracket notation covers both the list and
 * single-item GET). */
async function getSingleCaseScopedRow<TRow extends QueryResultRow>(
  params: CaseScopedParams,
  tableAlias: string,
  tableName: string,
  idColumn: string,
  idValue: string
): Promise<TRow | null> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT ${tableAlias}.*
      FROM ${tableName} ${tableAlias}
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = ${tableAlias}.case_id::text
     WHERE ${tableAlias}.organization_id = $1
       AND ${tableAlias}.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND ${tableAlias}.${idColumn} = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, caseId, idValue];
  const rows = await withReadClient((client) => queryRows<TRow>(client, wrapped.sql, values));
  return rows[0] ?? null;
}

// ==========================================
// getCalculationPolicy
// ==========================================

export async function getCalculationPolicy(params: CaseScopedParams): Promise<RoiCalculationPolicy | null> {
  const rows = await caseScopedRows<RoiCalculationPolicyRow>(params, 'p', 'rvn_roi_calculation_policy', '', 'p.case_id');
  const row = rows[0];
  return row ? toRoiCalculationPolicy(row) : null;
}

// ==========================================
// listAssumptions
// ==========================================

export interface ListAssumptionsParams extends CaseScopedParams {
  includeDeleted?: boolean;
}

export async function listAssumptions(params: ListAssumptionsParams): Promise<RoiAssumption[]> {
  const extraWhere = params.includeDeleted ? '' : 'AND a.deleted_at IS NULL';
  const rows = await caseScopedRows<RoiAssumptionRow>(params, 'a', 'rvn_roi_assumptions', extraWhere, 'a.created_at, a.assumption_id');
  return rows.map(toRoiAssumption);
}

export interface GetAssumptionParams extends CaseScopedParams {
  assumptionId: string;
}

export async function getAssumption(params: GetAssumptionParams): Promise<RoiAssumption | null> {
  const row = await getSingleCaseScopedRow<RoiAssumptionRow>(
    params,
    'a',
    'rvn_roi_assumptions',
    'assumption_id',
    params.assumptionId
  );
  return row ? toRoiAssumption(row) : null;
}

// ==========================================
// listCostLines
// ==========================================

export interface ListCostLinesParams extends CaseScopedParams {
  includeDeleted?: boolean;
}

export async function listCostLines(params: ListCostLinesParams): Promise<RoiCostLine[]> {
  const extraWhere = params.includeDeleted ? '' : 'AND cl.deleted_at IS NULL';
  const rows = await caseScopedRows<RoiCostLineRow>(params, 'cl', 'rvn_roi_cost_lines', extraWhere, 'cl.created_at, cl.cost_line_id');
  return rows.map(toRoiCostLine);
}

export interface GetCostLineParams extends CaseScopedParams {
  costLineId: string;
}

export async function getCostLine(params: GetCostLineParams): Promise<RoiCostLine | null> {
  const row = await getSingleCaseScopedRow<RoiCostLineRow>(params, 'cl', 'rvn_roi_cost_lines', 'cost_line_id', params.costLineId);
  return row ? toRoiCostLine(row) : null;
}

// ==========================================
// listBenefitLines
// ==========================================

export interface ListBenefitLinesParams extends CaseScopedParams {
  includeDeleted?: boolean;
}

export async function listBenefitLines(params: ListBenefitLinesParams): Promise<RoiBenefitLine[]> {
  const extraWhere = params.includeDeleted ? '' : 'AND bl.deleted_at IS NULL';
  const rows = await caseScopedRows<RoiBenefitLineRow>(
    params,
    'bl',
    'rvn_roi_benefit_lines',
    extraWhere,
    'bl.created_at, bl.benefit_line_id'
  );
  return rows.map(toRoiBenefitLine);
}

export interface GetBenefitLineParams extends CaseScopedParams {
  benefitLineId: string;
}

export async function getBenefitLine(params: GetBenefitLineParams): Promise<RoiBenefitLine | null> {
  const row = await getSingleCaseScopedRow<RoiBenefitLineRow>(
    params,
    'bl',
    'rvn_roi_benefit_lines',
    'benefit_line_id',
    params.benefitLineId
  );
  return row ? toRoiBenefitLine(row) : null;
}

// ==========================================
// listBenefitEvidenceLinks (Decision D14 hydration)
// ==========================================

export interface ListBenefitEvidenceLinksParams extends CaseScopedParams {
  benefitLineId: string;
  /** Decision D14: when true, additionally resolves each link's KPI
   * name/status/current-value through KPI's OWN visibility scope — a
   * viewer without `kpi.view` access on that specific KPI gets
   * `kpiDetails: null` for that link, never the KPI's content, even though
   * the link's own metadata (pinned id/version/purpose) is always visible
   * once the caller can see the CASE at all. */
  hydrateKpiDetails?: boolean;
}

export interface RoiBenefitEvidenceLinkWithKpiDetails extends RoiBenefitEvidenceLink {
  kpiDetails: { kpiId: string; kpiCode: string; status: string } | null;
}

export async function listBenefitEvidenceLinks(
  params: ListBenefitEvidenceLinksParams
): Promise<RoiBenefitEvidenceLinkWithKpiDetails[]> {
  const { userId, organizationId, caseId, benefitLineId, hydrateKpiDetails = false } = params;

  const baseQuerySql = `
    SELECT bel.*
      FROM rvn_roi_benefit_evidence_links bel
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = bel.case_id::text
     WHERE bel.organization_id = $1
       AND bel.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND bel.benefit_line_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
     ORDER BY bel.linked_at, bel.link_id
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, caseId, benefitLineId];
  const rows = await withReadClient((client) => queryRows<RoiBenefitEvidenceLinkRow>(client, wrapped.sql, values));

  if (!hydrateKpiDetails || rows.length === 0) {
    return rows.map((row) => ({ ...toRoiBenefitEvidenceLink(row), kpiDetails: null }));
  }

  // KPI's own visibility-scoped CTE, joined against rvn_kpi_definitions —
  // a link whose kpi_id is not in this set gets kpiDetails: null, never a
  // raw unscoped SELECT against rvn_kpi_definitions.
  const kpiCte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const kpiIds = rows.map((r) => r.kpi_id);
  const kpiQuerySql = `
    ${kpiCte.sql}
    SELECT kd.kpi_id, kd.kpi_code, kd.status
      FROM rvn_kpi_definitions kd
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
     WHERE kd.organization_id = $1
       AND kd.kpi_id = ANY($${VISIBILITY_CTE_PARAM_COUNT + 1}::uuid[])
  `;
  const kpiValues = [...kpiCte.values, kpiIds];
  const kpiRows = await withReadClient((client) =>
    queryRows<{ kpi_id: string; kpi_code: string; status: string }>(client, kpiQuerySql, kpiValues)
  );
  const kpiDetailsById = new Map(kpiRows.map((k) => [k.kpi_id, { kpiId: k.kpi_id, kpiCode: k.kpi_code, status: k.status }]));

  return rows.map((row) => ({
    ...toRoiBenefitEvidenceLink(row),
    kpiDetails: kpiDetailsById.get(row.kpi_id) ?? null,
  }));
}

// ==========================================
// listScenarios
// ==========================================

export interface ListScenariosParams extends CaseScopedParams {
  includeDeleted?: boolean;
}

export async function listScenarios(params: ListScenariosParams): Promise<RoiScenario[]> {
  const extraWhere = params.includeDeleted ? '' : 'AND s.deleted_at IS NULL';
  const rows = await caseScopedRows<RoiScenarioRow>(params, 's', 'rvn_roi_scenarios', extraWhere, 's.created_at, s.scenario_id');
  return rows.map(toRoiScenario);
}

export interface GetScenarioParams extends CaseScopedParams {
  scenarioId: string;
}

export async function getScenario(params: GetScenarioParams): Promise<RoiScenario | null> {
  const { userId, organizationId, caseId, scenarioId } = params;
  const baseQuerySql = `
    SELECT s.*
      FROM rvn_roi_scenarios s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = s.case_id::text
     WHERE s.organization_id = $1
       AND s.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND s.scenario_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, scenarioId];
  const rows = await withReadClient((client) => queryRows<RoiScenarioRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiScenario(row) : null;
}

export interface ListScenarioOverridesParams extends CaseScopedParams {
  scenarioId: string;
}

export async function listScenarioOverrides(params: ListScenarioOverridesParams): Promise<RoiScenarioOverride[]> {
  const { userId, organizationId, caseId, scenarioId } = params;
  // Overrides have no case_id column of their own — visibility inherits via
  // their parent scenario, joined explicitly here rather than by adding a
  // redundant case_id column to rvn_roi_scenario_overrides.
  const baseQuerySql = `
    SELECT ov.*
      FROM rvn_roi_scenario_overrides ov
      INNER JOIN rvn_roi_scenarios s ON s.scenario_id = ov.scenario_id
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = s.case_id::text
     WHERE ov.organization_id = $1
       AND s.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND ov.scenario_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
     ORDER BY ov.created_at, ov.override_id
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, scenarioId];
  const rows = await withReadClient((client) => queryRows<RoiScenarioOverrideRow>(client, wrapped.sql, values));
  return rows.map(toRoiScenarioOverride);
}

// ==========================================
// listCalculationRuns / getCalculationRun
// ==========================================

export interface ListCalculationRunsParams extends CaseScopedParams {
  limit?: number;
  offset?: number;
}

export async function listCalculationRuns(params: ListCalculationRunsParams): Promise<RoiCalculationRun[]> {
  const { userId, organizationId, caseId, limit = 50, offset = 0 } = params;
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values: unknown[] = [...cte.values, caseId, limit, offset];
  const baseQuerySql = `
    SELECT r.*
      FROM rvn_roi_calculation_runs r
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = r.case_id::text
     WHERE r.organization_id = $1
       AND r.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY r.created_at DESC
     LIMIT $${VISIBILITY_CTE_PARAM_COUNT + 2} OFFSET $${VISIBILITY_CTE_PARAM_COUNT + 3}
  `;
  const rows = await withReadClient((client) => queryRows<RoiCalculationRunRow>(client, `${cte.sql}\n${baseQuerySql}`, values));
  return rows.map(toRoiCalculationRun);
}

export interface GetCalculationRunParams extends CaseScopedParams {
  runId: string;
}

export async function getCalculationRun(params: GetCalculationRunParams): Promise<RoiCalculationRun | null> {
  const { userId, organizationId, caseId, runId } = params;
  const baseQuerySql = `
    SELECT r.*
      FROM rvn_roi_calculation_runs r
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = r.case_id::text
     WHERE r.organization_id = $1
       AND r.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND r.run_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, runId];
  const rows = await withReadClient((client) => queryRows<RoiCalculationRunRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiCalculationRun(row) : null;
}
