/**
 * ROI-E004 — `Variance`/`VarianceCause` read repository.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4/§5.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import {
  toRoiVariance,
  toRoiVarianceCause,
  type RoiVariance,
  type RoiVarianceCause,
  type RoiVarianceCauseRow,
  type RoiVarianceRow,
} from './roiForecastActualTypes.js';

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

export interface ListVariancesParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function listVariances(params: ListVariancesParams): Promise<RoiVariance[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT v.*
      FROM rvn_roi_variances v
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = v.case_id::text
     WHERE v.organization_id = $1
       AND v.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY v.created_at DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiVarianceRow>(client, wrapped.sql, values));
  return rows.map(toRoiVariance);
}

export interface GetVarianceParams {
  userId: string;
  organizationId: string;
  caseId: string;
  varianceId: string;
}

export interface RoiVarianceWithCauses extends RoiVariance {
  causes: RoiVarianceCause[];
}

export async function getVariance(params: GetVarianceParams): Promise<RoiVarianceWithCauses | null> {
  const { userId, organizationId, caseId, varianceId } = params;
  const baseQuerySql = `
    SELECT v.*
      FROM rvn_roi_variances v
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = v.case_id::text
     WHERE v.organization_id = $1
       AND v.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND v.variance_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, varianceId];
  const rows = await withReadClient((client) => queryRows<RoiVarianceRow>(client, wrapped.sql, values));
  const row = rows[0];
  if (!row) return null;

  const causesResult = await withReadClient((client) =>
    queryRows<RoiVarianceCauseRow>(
      client,
      `SELECT * FROM rvn_roi_variance_causes WHERE variance_id = $1 AND organization_id = $2 ORDER BY created_at`,
      [varianceId, organizationId]
    )
  );

  return { ...toRoiVariance(row), causes: causesResult.map(toRoiVarianceCause) };
}
