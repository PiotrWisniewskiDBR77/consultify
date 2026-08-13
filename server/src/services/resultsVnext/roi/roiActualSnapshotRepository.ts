/**
 * ROI-E004 — `ActualSnapshot` read repository.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4/§5.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import { toRoiActualSnapshot, type RoiActualSnapshot, type RoiActualSnapshotRow } from './roiForecastActualTypes.js';

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

export interface ListRoiActualSnapshotsParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function listRoiActualSnapshots(params: ListRoiActualSnapshotsParams): Promise<RoiActualSnapshot[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT s.*
      FROM rvn_roi_actual_snapshots s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = s.case_id::text
     WHERE s.organization_id = $1
       AND s.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY s.sequence_number DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiActualSnapshotRow>(client, wrapped.sql, values));
  return rows.map(toRoiActualSnapshot);
}

export interface GetRoiActualSnapshotParams {
  userId: string;
  organizationId: string;
  caseId: string;
  actualSnapshotId: string;
}

export async function getRoiActualSnapshot(params: GetRoiActualSnapshotParams): Promise<RoiActualSnapshot | null> {
  const { userId, organizationId, caseId, actualSnapshotId } = params;
  const baseQuerySql = `
    SELECT s.*
      FROM rvn_roi_actual_snapshots s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = s.case_id::text
     WHERE s.organization_id = $1
       AND s.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND s.actual_snapshot_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, actualSnapshotId];
  const rows = await withReadClient((client) => queryRows<RoiActualSnapshotRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiActualSnapshot(row) : null;
}
