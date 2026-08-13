/**
 * OKR-E004 — Check-in read repository.
 *
 * Design: docs/product/results-vnext/OKR_E004_DESIGN.md §10.
 *
 * D14: `okr_vnext_checkins` carries NO own `rvn_platform_resource_visibility`
 * row — visibility inherits transitively via `key_result_id -> objective_id
 * -> okr_vnext_sets`, matching OKR-E002's own established posture for
 * `okr_vnext_approved_snapshots`/`okr_vnext_set_versions` ("carry no
 * visibility row of their own — inherit via set_id"). The join path used
 * below goes straight from `okr_vnext_checkins.set_id` (denormalized, D1) to
 * `rvn_platform_resource_visibility.resource_id` — avoiding an extra hop
 * through `objective_id`/`key_result_id` for this specific query shape,
 * exactly as design §10 states (set_id is stored redundantly on the checkin
 * row precisely for this).
 *
 * `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `okr_vnext_checkins.set_id` is UUID — every join below casts `::text`.
 * This exact cast has already been missed 7 times in one KPI epic (this
 * program's single most-repeated real bug) —
 * `okrCheckInVisibilityJoin.realdb.test.ts` exists specifically to catch a
 * regression here.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';
import { toOkrCheckIn, type OkrCheckIn, type OkrCheckInRow } from './okrCheckInTypes.js';

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
// listCheckIns
// ==========================================

export interface ListCheckInsParams {
  userId: string;
  organizationId: string;
  keyResultId: string;
  /**
   * Design §9's "current" view discipline (mirrors `kpiRepository.ts`'s
   * `listMeasurements` NOT-EXISTS rule, §4.2) — when true (the default),
   * rows that have been superseded by a later correction
   * (`correction_of_checkin_id` pointing AT them) are excluded. Set to
   * `false` to fetch the FULL append-only history including superseded
   * rows (used by `okrCheckInAppendOnly.realdb.test.ts`'s own chain-depth
   * assertions and by any future audit view).
   */
  currentOnly?: boolean;
}

/**
 * "Current" resolution: a row is current iff no later row corrects it
 * (`NOT EXISTS (... newer WHERE newer.correction_of_checkin_id = c.checkin_id)`)
 * — the same simpler-than-fully-general rule `kpiRepository.ts` uses for
 * KPI measurements (design §4.2/§9's open question #5: OKR check-in
 * correction chains are not expected to need ROI-E004's heavier
 * `WITH RECURSIVE` walk, since this epic has no self-verification check to
 * resolve a TRUE ROOT for — a materially different question than "what's
 * current").
 */
export async function listCheckIns(params: ListCheckInsParams): Promise<OkrCheckIn[]> {
  const { userId, organizationId, keyResultId, currentOnly = true } = params;

  const currentOnlyClause = currentOnly
    ? `AND NOT EXISTS (SELECT 1 FROM okr_vnext_checkins newer WHERE newer.correction_of_checkin_id = c.checkin_id)`
    : '';

  const baseQuerySql = `
    SELECT c.*
      FROM okr_vnext_checkins c
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = c.set_id::text
     WHERE c.organization_id = $1
       AND c.key_result_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       ${currentOnlyClause}
     ORDER BY c.submitted_at DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, keyResultId];
  const rows = await withReadClient((client) => queryRows<OkrCheckInRow>(client, wrapped.sql, values));
  return rows.map(toOkrCheckIn);
}

// ==========================================
// getCheckIn
// ==========================================

export interface GetCheckInParams {
  userId: string;
  organizationId: string;
  checkInId: string;
}

export async function getCheckIn(params: GetCheckInParams): Promise<OkrCheckIn | null> {
  const { userId, organizationId, checkInId } = params;
  const baseQuerySql = `
    SELECT c.*
      FROM okr_vnext_checkins c
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = c.set_id::text
     WHERE c.organization_id = $1
       AND c.checkin_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, checkInId];
  const rows = await withReadClient((client) => queryRows<OkrCheckInRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toOkrCheckIn(row) : null;
}
