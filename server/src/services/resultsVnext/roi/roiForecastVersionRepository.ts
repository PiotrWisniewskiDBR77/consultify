/**
 * ROI-E004 — `ForecastVersion` read repository.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4/§5.
 *
 * Every new table inherits visibility via `case_id` only (Decision D13) —
 * same `INNER JOIN rvn_visible_resources ON resource_type='roi_case' AND
 * resource_id = <table>.case_id::text` shape every prior ROI epic's
 * repository uses. The `::text` cast applies to this join, no exceptions.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import { toRoiForecastVersion, type RoiForecastVersion, type RoiForecastVersionRow } from './roiForecastActualTypes.js';

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

export interface ListRoiForecastVersionsParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function listRoiForecastVersions(
  params: ListRoiForecastVersionsParams
): Promise<RoiForecastVersion[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT fv.*
      FROM rvn_roi_forecast_versions fv
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = fv.case_id::text
     WHERE fv.organization_id = $1
       AND fv.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY fv.sequence_number DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiForecastVersionRow>(client, wrapped.sql, values));
  return rows.map(toRoiForecastVersion);
}

export interface GetRoiForecastVersionParams {
  userId: string;
  organizationId: string;
  caseId: string;
  forecastVersionId: string;
}

export async function getRoiForecastVersion(
  params: GetRoiForecastVersionParams
): Promise<RoiForecastVersion | null> {
  const { userId, organizationId, caseId, forecastVersionId } = params;
  const baseQuerySql = `
    SELECT fv.*
      FROM rvn_roi_forecast_versions fv
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = fv.case_id::text
     WHERE fv.organization_id = $1
       AND fv.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND fv.forecast_version_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, forecastVersionId];
  const rows = await withReadClient((client) => queryRows<RoiForecastVersionRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiForecastVersion(row) : null;
}
