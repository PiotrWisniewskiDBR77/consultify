/**
 * ROI-E004 — `ActualEntry` read repository.
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4/§5.
 *
 * "Current" view defaults to `includeSuperseded=false` using the exact `NOT
 * EXISTS (SELECT 1 FROM rvn_roi_actual_entries newer WHERE
 * newer.correction_of_actual_entry_id = e.actual_entry_id)` pattern already
 * established in `kpiRepository.ts`'s `listMeasurements` — a row is dropped
 * once some newer row in its own chain points back at it via
 * `correction_of_actual_entry_id`, leaving only each chain's leaf (its most
 * recent record/correct/verify/dispute) visible by default.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import { toRoiActualEntry, type RoiActualEntry, type RoiActualEntryRow } from './roiForecastActualTypes.js';

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

export interface ListActualEntriesParams {
  userId: string;
  organizationId: string;
  caseId: string;
  /** When `false` (default), only "current" rows are returned — the leaf of
   * each correction/verify/dispute chain. When `true`, the full append-only
   * history (every row ever inserted) is returned. */
  includeSuperseded?: boolean;
  limit?: number;
  offset?: number;
}

export async function listActualEntries(params: ListActualEntriesParams): Promise<RoiActualEntry[]> {
  const { userId, organizationId, caseId, includeSuperseded = false, limit = 200, offset = 0 } = params;

  const currentOnlyClause = includeSuperseded
    ? ''
    : `AND NOT EXISTS (
         SELECT 1 FROM rvn_roi_actual_entries newer
          WHERE newer.correction_of_actual_entry_id = e.actual_entry_id
       )`;

  const baseQuerySql = `
    SELECT e.*
      FROM rvn_roi_actual_entries e
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = e.case_id::text
     WHERE e.organization_id = $1
       AND e.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       ${currentOnlyClause}
     ORDER BY e.period_start DESC, e.recorded_at DESC
     LIMIT $${VISIBILITY_CTE_PARAM_COUNT + 2} OFFSET $${VISIBILITY_CTE_PARAM_COUNT + 3}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, limit, offset];
  const rows = await withReadClient((client) => queryRows<RoiActualEntryRow>(client, wrapped.sql, values));
  return rows.map(toRoiActualEntry);
}

export interface GetActualEntryParams {
  userId: string;
  organizationId: string;
  caseId: string;
  actualEntryId: string;
}

export async function getActualEntry(params: GetActualEntryParams): Promise<RoiActualEntry | null> {
  const { userId, organizationId, caseId, actualEntryId } = params;
  const baseQuerySql = `
    SELECT e.*
      FROM rvn_roi_actual_entries e
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = e.case_id::text
     WHERE e.organization_id = $1
       AND e.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND e.actual_entry_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, actualEntryId];
  const rows = await withReadClient((client) => queryRows<RoiActualEntryRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiActualEntry(row) : null;
}
