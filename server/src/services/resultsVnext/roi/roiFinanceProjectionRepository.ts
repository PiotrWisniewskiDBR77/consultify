/**
 * RN-G6 — `finance_projection` read repository.
 *
 * Design: docs/product/results-vnext/RN_G6_FINANCE_PROJECTION_DESIGN.md
 * §2/§9. Schema: server/migrations/20260830_rvn_roi_finance_projections.sql.
 *
 * Same case-scoped visibility-join shape `roiFinanceLinkRepository.ts`
 * (ROI-E007) already uses — `rvn_roi_finance_projections` inherits
 * visibility via `case_id`, `resource_type='roi_case'` (§2 — no new
 * resource type), mandatory `::text` cast on the UUID join column.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';

export type RoiFinanceProjectionSourceKind = 'approval_snapshot' | 'forecast_version' | 'actual_snapshot';

export interface RoiFinanceProjectionRow {
  finance_link_id: string;
  case_id: string;
  organization_id: string;
  case_status: string;
  is_link_active: boolean;
  tracked_metric: string | null;
  roi_value: string | null;
  roi_value_currency: string | null;
  source_kind: RoiFinanceProjectionSourceKind | null;
  source_id: string | null;
  source_sequence_number: number | null;
  reconciliation_status: string | null;
  last_reconciliation_id: string | null;
  projected_at: string;
  updated_at: string;
}

export interface RoiFinanceProjection {
  financeLinkId: string;
  caseId: string;
  organizationId: string;
  caseStatus: string;
  isLinkActive: boolean;
  trackedMetric: string | null;
  roiValue: number | null;
  roiValueCurrency: string | null;
  sourceKind: RoiFinanceProjectionSourceKind | null;
  sourceId: string | null;
  sourceSequenceNumber: number | null;
  reconciliationStatus: string | null;
  lastReconciliationId: string | null;
  projectedAt: string;
  updatedAt: string;
}

export function toRoiFinanceProjection(row: RoiFinanceProjectionRow): RoiFinanceProjection {
  return {
    financeLinkId: row.finance_link_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    caseStatus: row.case_status,
    isLinkActive: row.is_link_active,
    trackedMetric: row.tracked_metric,
    roiValue: row.roi_value === null ? null : Number(row.roi_value),
    roiValueCurrency: row.roi_value_currency,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    sourceSequenceNumber: row.source_sequence_number,
    reconciliationStatus: row.reconciliation_status,
    lastReconciliationId: row.last_reconciliation_id,
    projectedAt: row.projected_at,
    updatedAt: row.updated_at,
  };
}

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

export interface ListRoiFinanceProjectionsParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function listRoiFinanceProjections(
  params: ListRoiFinanceProjectionsParams
): Promise<RoiFinanceProjection[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT p.*
      FROM rvn_roi_finance_projections p
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = p.case_id::text
     WHERE p.organization_id = $1
       AND p.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY p.projected_at, p.finance_link_id
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiFinanceProjectionRow>(client, wrapped.sql, values));
  return rows.map(toRoiFinanceProjection);
}
