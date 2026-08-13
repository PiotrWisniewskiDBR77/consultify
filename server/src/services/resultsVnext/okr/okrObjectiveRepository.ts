/**
 * OKR-E003 — Objective/KeyResult read repository.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §13.
 *
 * No new `resource_type` (§-IO item 10's re-verification confirmed
 * `getOkrSet`, E002, `okrSetRepository.ts`, returns a FLAT `OkrSet` with no
 * nested Objectives/KRs — so this file's `listObjectivesForSet` is
 * ADDITIVE, not duplicative). Objectives/KeyResults are NOT independently
 * ABAC'd resources — they inherit visibility entirely through the parent
 * Set's own `'okr_set'` visibility row, joined on `set_id`.
 *
 * `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `okr_vnext_objectives.set_id`/`okr_vnext_key_results.set_id` are UUID —
 * every join below casts `::text`. This exact cast has already been missed
 * 7 times in one KPI epic (this program's single most-repeated real bug) —
 * `okrObjectiveVisibilityJoin.realdb.test.ts` exists specifically to catch
 * a regression here.
 *
 * Two-query-then-group-in-JS for `listObjectivesForSet` (query all visible
 * Objectives, then one batch query for all their KRs) rather than a
 * `json_agg`/`LATERAL` single round trip — simpler to reason about and to
 * test correctly; `roiOrgPerspectiveRepository.ts`'s own header states this
 * exact tradeoff is a legitimate per-repository choice, not a fixed
 * convention.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import {
  toOkrKeyResult,
  type OkrKeyResult,
  type OkrKeyResultRow,
} from './okrKeyResultTypes.js';
import { toOkrObjective, type OkrObjective, type OkrObjectiveRow } from './okrObjectiveTypes.js';
import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';

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

export interface OkrObjectiveWithKeyResults extends OkrObjective {
  keyResults: OkrKeyResult[];
}

/** Batch-loads non-cancelled KRs for a set of Objective ids and groups them
 * — used by `listObjectivesForSet`/`getObjective` so a single Objective
 * detail fetch and a full-Set list fetch share one grouping helper. */
async function loadKeyResultsByObjectiveIds(
  client: PoolClient,
  objectiveIds: string[],
  organizationId: string
): Promise<Map<string, OkrKeyResult[]>> {
  const grouped = new Map<string, OkrKeyResult[]>();
  if (objectiveIds.length === 0) return grouped;

  const rows = await queryRows<OkrKeyResultRow>(
    client,
    `SELECT * FROM okr_vnext_key_results
      WHERE organization_id = $1 AND objective_id = ANY($2::uuid[])
      ORDER BY created_at ASC`,
    [organizationId, objectiveIds]
  );
  for (const row of rows) {
    const keyResult = toOkrKeyResult(row);
    const bucket = grouped.get(keyResult.objectiveId);
    if (bucket) {
      bucket.push(keyResult);
    } else {
      grouped.set(keyResult.objectiveId, [keyResult]);
    }
  }
  return grouped;
}

// ==========================================
// listObjectivesForSet
// ==========================================

export interface ListObjectivesForSetParams {
  userId: string;
  organizationId: string;
  setId: string;
}

/**
 * ABAC via the parent Set's `'okr_set'` visibility row — the query
 * authorizes on the SET's visibility, then joins DOWN to Objectives
 * (`o.set_id::text`, the mandatory cast). A caller who lacks visibility on
 * the Set gets an empty array, same "not found, not forbidden" posture
 * `okrSetRepository.ts`'s own routes rely on.
 */
export async function listObjectivesForSet(params: ListObjectivesForSetParams): Promise<OkrObjectiveWithKeyResults[]> {
  const { userId, organizationId, setId } = params;
  const baseQuerySql = `
    SELECT o.*
      FROM okr_vnext_objectives o
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = o.set_id::text
     WHERE o.organization_id = $1
       AND o.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY o.sort_order ASC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, setId];

  return withReadClient(async (client) => {
    const objectiveRows = await queryRows<OkrObjectiveRow>(client, wrapped.sql, values);
    const objectives = objectiveRows.map(toOkrObjective);
    const krByObjective = await loadKeyResultsByObjectiveIds(
      client,
      objectives.map((o) => o.objectiveId),
      organizationId
    );
    return objectives.map((objective) => ({
      ...objective,
      keyResults: krByObjective.get(objective.objectiveId) ?? [],
    }));
  });
}

// ==========================================
// getObjective
// ==========================================

export interface GetObjectiveParams {
  userId: string;
  organizationId: string;
  objectiveId: string;
}

export async function getObjective(params: GetObjectiveParams): Promise<OkrObjectiveWithKeyResults | null> {
  const { userId, organizationId, objectiveId } = params;
  const baseQuerySql = `
    SELECT o.*
      FROM okr_vnext_objectives o
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = o.set_id::text
     WHERE o.organization_id = $1
       AND o.objective_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, objectiveId];

  return withReadClient(async (client) => {
    const rows = await queryRows<OkrObjectiveRow>(client, wrapped.sql, values);
    const row = rows[0];
    if (!row) return null;
    const objective = toOkrObjective(row);
    const krByObjective = await loadKeyResultsByObjectiveIds(client, [objective.objectiveId], organizationId);
    return { ...objective, keyResults: krByObjective.get(objective.objectiveId) ?? [] };
  });
}

// ==========================================
// getKeyResult
// ==========================================

export interface GetKeyResultParams {
  userId: string;
  organizationId: string;
  keyResultId: string;
}

/** Visibility inherited through the KR's own denormalized `set_id` column
 * (mirrors Objectives — both authorize on the Set, never independently). */
export async function getKeyResult(params: GetKeyResultParams): Promise<OkrKeyResult | null> {
  const { userId, organizationId, keyResultId } = params;
  const baseQuerySql = `
    SELECT kr.*
      FROM okr_vnext_key_results kr
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = kr.set_id::text
     WHERE kr.organization_id = $1
       AND kr.key_result_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, keyResultId];

  const rows = await withReadClient((client) => queryRows<OkrKeyResultRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toOkrKeyResult(row) : null;
}
