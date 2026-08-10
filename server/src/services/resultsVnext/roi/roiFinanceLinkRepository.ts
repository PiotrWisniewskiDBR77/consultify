/**
 * ROI-E007 — `RoiFinanceLink`/`RoiFinanceReconciliation` read repository.
 *
 * Design: docs/product/results-vnext/ROI_E007_DESIGN.md §4/§5.
 *
 * Both new tables inherit visibility via `case_id` only, `resource_type='roi_case'`
 * (Decision D6 — no new visibility mode) — same shape `roiVarianceRepository.ts`
 * (ROI-E004) already uses: `INNER JOIN rvn_visible_resources` on the case's own
 * `resource_id`, mandatory `::text` cast on the UUID join column.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import {
  toRoiFinanceLink,
  toRoiFinanceReconciliation,
  type RoiFinanceLink,
  type RoiFinanceLinkRow,
  type RoiFinanceReconciliation,
  type RoiFinanceReconciliationRow,
} from './roiFinanceSeamTypes.js';

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

// ==========================================
// rvn_roi_finance_links
// ==========================================

export interface ListRoiFinanceLinksParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function listRoiFinanceLinks(params: ListRoiFinanceLinksParams): Promise<RoiFinanceLink[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT fl.*
      FROM rvn_roi_finance_links fl
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = fl.case_id::text
     WHERE fl.organization_id = $1
       AND fl.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY fl.linked_at, fl.link_id
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiFinanceLinkRow>(client, wrapped.sql, values));
  return rows.map(toRoiFinanceLink);
}

export interface GetRoiFinanceLinkParams {
  userId: string;
  organizationId: string;
  caseId: string;
  linkId: string;
}

export async function getRoiFinanceLink(params: GetRoiFinanceLinkParams): Promise<RoiFinanceLink | null> {
  const { userId, organizationId, caseId, linkId } = params;
  const baseQuerySql = `
    SELECT fl.*
      FROM rvn_roi_finance_links fl
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = fl.case_id::text
     WHERE fl.organization_id = $1
       AND fl.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND fl.link_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, linkId];
  const rows = await withReadClient((client) => queryRows<RoiFinanceLinkRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiFinanceLink(row) : null;
}

// ==========================================
// rvn_roi_finance_reconciliations
// ==========================================

export interface ListRoiFinanceReconciliationsParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function listRoiFinanceReconciliations(
  params: ListRoiFinanceReconciliationsParams
): Promise<RoiFinanceReconciliation[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT r.*
      FROM rvn_roi_finance_reconciliations r
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = r.case_id::text
     WHERE r.organization_id = $1
       AND r.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY r.opened_at DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiFinanceReconciliationRow>(client, wrapped.sql, values));
  return rows.map(toRoiFinanceReconciliation);
}

export interface GetRoiFinanceReconciliationParams {
  userId: string;
  organizationId: string;
  caseId: string;
  reconciliationId: string;
}

export async function getRoiFinanceReconciliation(
  params: GetRoiFinanceReconciliationParams
): Promise<RoiFinanceReconciliation | null> {
  const { userId, organizationId, caseId, reconciliationId } = params;
  const baseQuerySql = `
    SELECT r.*
      FROM rvn_roi_finance_reconciliations r
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = r.case_id::text
     WHERE r.organization_id = $1
       AND r.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND r.reconciliation_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, reconciliationId];
  const rows = await withReadClient((client) => queryRows<RoiFinanceReconciliationRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiFinanceReconciliation(row) : null;
}
