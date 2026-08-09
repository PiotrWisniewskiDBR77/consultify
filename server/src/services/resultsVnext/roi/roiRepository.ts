/**
 * ROI-E001 — read repository.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §5. Structural
 * template: `kpi/kpiRepository.ts` (first real caller of
 * `buildVisibilityScopedCte`/`wrapWithVisibilityScope` — this file is the
 * second).
 *
 * `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `rvn_roi_cases.case_id` is UUID — every join casts `::text` on the UUID
 * side (`vr.resource_id = rc.case_id::text`). This exact cast was missed in
 * 7 places across 3 files in the KPI domain and only caught by a dedicated
 * realDB join-regression test after the fact (EXECUTION_LEDGER §24) — get it
 * right here from the start; `roiVisibilityJoin.realdb.test.ts` proves it
 * against a real Postgres.
 *
 * `rvn_roi_baselines` carries no visibility row of its own — it inherits via
 * `case_id`, same `::text` cast requirement applies to that join.
 *
 * `listRoiCases`/`getRoiCase` both filter out `archived_at IS NOT NULL` rows
 * by default (Decision D4); an explicit `includeArchived=true` is required
 * to see them.
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
  toRoiBaseline,
  toRoiCase,
  type RoiBaseline,
  type RoiBaselineRow,
  type RoiCase,
  type RoiCaseRow,
  type RoiCaseStatus,
} from './roiTypes.js';

/** Same pinned-client-per-call shape as `kpiRepository.ts`'s
 * `withReadClient` — no BEGIN/COMMIT needed for a read, kept for
 * consistency with the rest of this module family. */
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

// ==========================================
// listRoiCases
// ==========================================

export interface ListRoiCasesParams {
  userId: string;
  organizationId: string;
  status?: RoiCaseStatus;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export async function listRoiCases(params: ListRoiCasesParams): Promise<RoiCase[]> {
  const { userId, organizationId, status, includeArchived = false, limit = 100, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values: unknown[] = [...cte.values];
  const filters: string[] = [];

  if (status) {
    values.push(status);
    filters.push(`rc.status = $${values.length}`);
  }
  if (!includeArchived) {
    filters.push(`rc.archived_at IS NULL`);
  }

  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const baseQuerySql = `
    SELECT rc.*
      FROM rvn_roi_cases rc
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = rc.case_id::text
     WHERE rc.organization_id = $1
       ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY rc.updated_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) =>
    queryRows<RoiCaseRow>(client, `${cte.sql}\n${baseQuerySql}`, values)
  );
  return rows.map(toRoiCase);
}

// ==========================================
// getRoiCase
// ==========================================

export interface GetRoiCaseParams {
  userId: string;
  organizationId: string;
  caseId: string;
  includeArchived?: boolean;
}

export async function getRoiCase(params: GetRoiCaseParams): Promise<RoiCase | null> {
  const { userId, organizationId, caseId, includeArchived = false } = params;

  const baseQuerySql = `
    SELECT rc.*
      FROM rvn_roi_cases rc
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = rc.case_id::text
     WHERE rc.organization_id = $1
       AND rc.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       ${includeArchived ? '' : 'AND rc.archived_at IS NULL'}
  `;

  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, caseId];

  const rows = await withReadClient((client) =>
    queryRows<RoiCaseRow>(client, wrapped.sql, values)
  );
  const row = rows[0];
  return row ? toRoiCase(row) : null;
}

// ==========================================
// getRoiBaseline
// ==========================================

export interface GetRoiBaselineParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

/** Inherits visibility via `case_id` — the mandatory `INNER JOIN
 * rvn_visible_resources` still joins against the CASE's own `resource_id`
 * (`rb.case_id::text`), never a `rvn_roi_baselines`-scoped visibility row
 * (there isn't one, per design §5). */
export async function getRoiBaseline(params: GetRoiBaselineParams): Promise<RoiBaseline | null> {
  const { userId, organizationId, caseId } = params;

  const baseQuerySql = `
    SELECT rb.*
      FROM rvn_roi_baselines rb
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = rb.case_id::text
     WHERE rb.organization_id = $1
       AND rb.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;

  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, caseId];

  const rows = await withReadClient((client) =>
    queryRows<RoiBaselineRow>(client, wrapped.sql, values)
  );
  const row = rows[0];
  return row ? toRoiBaseline(row) : null;
}
