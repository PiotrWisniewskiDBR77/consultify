/**
 * KPI-E005 — InitiativeKPIImpact read repository.
 *
 * Design: docs/product/results-vnext/KPI_E005_DESIGN.md §C.3 ("standard
 * pattern: buildVisibilityScopedCte({resourceType:'kpi'}), join on
 * kpi_id::text (cast required, same bug class as EXECUTION_LEDGER.md §24)").
 *
 * Visibility inherits from the KPI (`resourceType:'kpi'`), never its own
 * `resourceType:'kpi_initiative_impact'` — this table has no
 * `rvn_platform_resource_visibility` row of its own (design §C).
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

import {
  toInitiativeKpiImpact,
  type InitiativeKpiImpact,
  type InitiativeKpiImpactRow,
  type InitiativeKpiImpactStatus,
} from './kpiInitiativeImpactTypes.js';

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
// listInitiativeImpactsForKpi
// ==========================================

export interface ListInitiativeImpactsForKpiParams {
  userId: string;
  organizationId: string;
  kpiId: string;
  status?: InitiativeKpiImpactStatus;
  limit?: number;
  offset?: number;
}

export async function listInitiativeImpactsForKpi(
  params: ListInitiativeImpactsForKpiParams
): Promise<InitiativeKpiImpact[]> {
  const { userId, organizationId, kpiId, status, limit = 100, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const values: unknown[] = [...cte.values, kpiId];
  const kpiParamIndex = values.length;
  const filters: string[] = [`ii.kpi_id = $${kpiParamIndex}`];

  if (status) {
    values.push(status);
    filters.push(`ii.status = $${values.length}`);
  }
  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const baseQuerySql = `
    SELECT ii.*
      FROM rvn_kpi_initiative_impacts ii
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = ii.kpi_id::text
     WHERE ii.organization_id = $1 AND ${filters.join(' AND ')}
     ORDER BY ii.proposed_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) =>
    queryRows<InitiativeKpiImpactRow>(client, `${cte.sql}\n${baseQuerySql}`, values)
  );
  return rows.map(toInitiativeKpiImpact);
}

// ==========================================
// listKpiImpactsForInitiative
// ==========================================

export interface ListKpiImpactsForInitiativeParams {
  userId: string;
  organizationId: string;
  initiativeId: string;
  status?: InitiativeKpiImpactStatus;
  limit?: number;
  offset?: number;
}

/**
 * Visibility still resolves against `resourceType:'kpi'` — the KPI is what
 * gates whether a given impact row is visible, even when the caller is
 * browsing FROM the initiative side. `initiative_id` itself is not an RVN
 * ABAC resource (design §C.3: "Initiative (legacy module) does not
 * participate in RVN ABAC") — this function only narrows by
 * `ii.initiative_id`, it never widens what a caller can see.
 */
export async function listKpiImpactsForInitiative(
  params: ListKpiImpactsForInitiativeParams
): Promise<InitiativeKpiImpact[]> {
  const { userId, organizationId, initiativeId, status, limit = 100, offset = 0 } = params;

  const filters: string[] = [`ii.initiative_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}`];
  const trailingValues: unknown[] = [initiativeId];

  if (status) {
    trailingValues.push(status);
    filters.push(`ii.status = $${VISIBILITY_CTE_PARAM_COUNT + trailingValues.length}`);
  }
  trailingValues.push(limit);
  const limitParamIndex = VISIBILITY_CTE_PARAM_COUNT + trailingValues.length;
  trailingValues.push(offset);
  const offsetParamIndex = VISIBILITY_CTE_PARAM_COUNT + trailingValues.length;

  const baseQuerySql = `
    SELECT ii.*
      FROM rvn_kpi_initiative_impacts ii
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = ii.kpi_id::text
     WHERE ii.organization_id = $1 AND ${filters.join(' AND ')}
     ORDER BY ii.proposed_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi' });
  const values = [...wrapped.values, ...trailingValues];

  const rows = await withReadClient((client) =>
    queryRows<InitiativeKpiImpactRow>(client, wrapped.sql, values)
  );
  return rows.map(toInitiativeKpiImpact);
}
