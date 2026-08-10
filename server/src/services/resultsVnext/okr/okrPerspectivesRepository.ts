/**
 * OKR-E008 — Half B (Perspectives), OKR-F-028.
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §4.
 *
 * IO-1 re-verification (done before writing this, since §4 was drafted
 * against zero landed OKR-E002 code): re-read `okrSetRepository.ts`
 * (landed) directly. Real facts that differ from the design draft's guess:
 *   - There is no `OkrSetSummary` DTO anywhere in the codebase — the design
 *     invented one. `listOkrSets`/`getOkrSet` (OKR-E002, landed) both
 *     return the full `OkrSet` DTO (`okrSetTypes.ts`). This file reuses
 *     that exact DTO/row/mapper (`OkrSet`/`OkrSetRow`/`toOkrSet`) rather
 *     than inventing a second, narrower shape with no real caller need.
 *   - `okr_vnext_sets.attention_state`/`last_checkin_at`/
 *     `next_checkin_due_at` were "reserved, NOT populated" ONLY at OKR-E002
 *     time. OKR-E004's `applySetRollupUpdate` (okrCheckInCommands.ts,
 *     landed) NOW writes all three on every check-in. D-OKR8-14's own
 *     "honest null/'none' passthrough" framing is therefore stale — this
 *     file returns the REAL, now-populated values, not a placeholder.
 *
 * Mirrors `kpiPerspectivesRepository.ts`'s §B `listOrganizationKpiAttention`
 * shape and `okrAttentionRepository.ts`'s own (OKR-E006, landed)
 * `buildScopedOkrSetsBase` — same two-layer `chain_members` (management
 * chain closure) + `scoped_okr_sets` (ABAC visibility) CTE composition,
 * re-declared locally here (not imported — `okrAttentionRepository.ts`
 * does not export its own copy, same "no shared helper across file
 * boundaries" convention `okrObjectiveRepository.ts`'s own header already
 * states for this domain).
 *
 * `::text` cast on every `vr.resource_id = <uuid column>` join — the
 * single most-repeated real bug in this program (EXECUTION_LEDGER.md §24).
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { buildVisibilityScopedCte } from '../platform/visibilityScopedQuery.js';

import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';
import { toOkrSet, type OkrSet, type OkrSetRow } from './okrSetTypes.js';

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
// /okr/my — listMyOkrSets (D-OKR8-11, D-OKR8-12)
// ==========================================

export interface ListMyOkrSetsParams {
  userId: string;
  organizationId: string;
  limit?: number;
  offset?: number;
}

/**
 * D-OKR8-12: Set-level ownership only (`owner_user_id` OR
 * `reviewer_user_id`), scoped through the standard `okr_set` visibility
 * CTE — same "not found, not forbidden" posture every other read in this
 * domain uses (a Set outside the caller's visibility never appears, even if
 * they are its `owner_user_id`, e.g. after a visibility-narrowing change).
 * No Objective/KR-level ownership join — OKR-E003 never registered its own
 * ABAC resource_type (confirmed again here, same finding OKR-E007's own
 * migration header recorded), so there is nothing besides the Set's own
 * `owner_user_id`/`reviewer_user_id` this epic can honestly join against
 * without fabricating scope OKR-E003 never specified.
 */
export async function listMyOkrSets(params: ListMyOkrSetsParams): Promise<OkrSet[]> {
  const { userId, organizationId, limit = 100, offset = 0 } = params;
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values: unknown[] = [...cte.values, limit, offset];
  const limitParamIndex = values.length - 1;
  const offsetParamIndex = values.length;

  const sql = `${cte.sql}
SELECT s.*
  FROM okr_vnext_sets s
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = s.set_id::text
 WHERE s.organization_id = $1
   AND (s.owner_user_id = $3 OR s.reviewer_user_id = $3)
 ORDER BY s.updated_at DESC
 LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  // $3 = userId — already present in cte.values per buildVisibilityScopedCte's
  // own convention (organizationId, resourceType, userId).

  const rows = await withReadClient((client) => queryRows<OkrSetRow>(client, sql, values));
  return rows.map(toOkrSet);
}

// ==========================================
// /okr/team-health — listOrganizationOkrTeamHealth (D-OKR8-11, D-OKR8-13, D-OKR8-14)
// ==========================================

interface ScopedBase {
  sql: string;
  values: unknown[];
}

/**
 * D-OKR8-13: two-layer `chain_members` + `scoped_okr_sets`, verbatim
 * pattern source: `okrAttentionRepository.ts`'s own (OKR-E006, landed,
 * already-proven-against-real-Postgres) `buildScopedOkrSetsBase` —
 * `kpiPerspectivesRepository.ts`'s `buildScopedKpisBase` /
 * `roiOrgPerspectiveRepository.ts`'s `buildScopedRoiCasesBase` generalize
 * to a third domain unchanged. T3: both layers required, ABAC visibility
 * NEVER substitutes for the management-chain filter or vice versa.
 *
 * ACKNOWLEDGED, UNFIXED GAP (mirrors `okrAttentionRepository.ts`'s own
 * documented gap, restated here rather than silently duplicated-and-hidden):
 * no real `getManagementChain(userId)` function exists anywhere in the
 * platform — `chain_members` queries `rvn_platform_management_chain_closure`
 * directly (union with the manager's own id). This epic does not build the
 * missing maintenance piece; naming the gap again here, not fixing it
 * outside this file's own ownership.
 */
async function buildScopedOkrSetsBase(managerId: string, organizationId: string): Promise<ScopedBase> {
  const cte = await buildVisibilityScopedCte({ userId: managerId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values: unknown[] = [...cte.values, managerId];
  const sql = `${cte.sql},
chain_members AS (
  SELECT descendant_user_id AS user_id
    FROM rvn_platform_management_chain_closure
   WHERE organization_id = $1 AND ancestor_user_id = $4
  UNION
  SELECT $4
),
scoped_okr_sets AS (
  SELECT s.*
    FROM okr_vnext_sets s
    INNER JOIN rvn_visible_resources vr
            ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = s.set_id::text
    INNER JOIN chain_members cm ON cm.user_id = s.owner_user_id
   WHERE s.organization_id = $1
)`;
  return { sql, values };
}

export interface OrganizationOkrTeamHealth {
  countsByStatus: Array<{ status: string; count: number }>;
  countsByScopeType: Array<{ scopeType: string; count: number }>;
  /** D-OKR8-14, UPDATED at implementation time (see file header): OKR-E004
   * has landed and `applySetRollupUpdate` now populates `attention_state`
   * on every check-in — this is REAL, current data, not a reserved-but-
   * unpopulated passthrough as the original design draft assumed. */
  attentionBreakdown: Array<{ attentionState: string; count: number }>;
}

export interface ListOrganizationOkrTeamHealthParams {
  managerId: string;
  organizationId: string;
}

/**
 * D-OKR8-14: honest reporting of whatever OKR-E002/E004's real, landed
 * schema populates — counts by `status`, by `scope_type`, by
 * `attention_state` (now real, see above). An orchestrator over 3
 * independent queries (`Promise.all`), same style
 * `listOrganizationKpiAttention`/`listOrganizationOkrAttention` both use —
 * each query resolves its own scope from scratch via `buildScopedOkrSetsBase`
 * (T3: filter before aggregate, no shared "already filtered" intermediate).
 */
export async function listOrganizationOkrTeamHealth(
  params: ListOrganizationOkrTeamHealthParams
): Promise<OrganizationOkrTeamHealth> {
  const { managerId, organizationId } = params;
  const [byStatus, byScope, byAttention] = await Promise.all([
    (async () => {
      const base = await buildScopedOkrSetsBase(managerId, organizationId);
      const sql = `${base.sql}
SELECT status, COUNT(*)::int AS count FROM scoped_okr_sets GROUP BY status`;
      return withReadClient((client) => queryRows<{ status: string; count: number }>(client, sql, base.values));
    })(),
    (async () => {
      const base = await buildScopedOkrSetsBase(managerId, organizationId);
      const sql = `${base.sql}
SELECT scope_type, COUNT(*)::int AS count FROM scoped_okr_sets GROUP BY scope_type`;
      return withReadClient((client) => queryRows<{ scope_type: string; count: number }>(client, sql, base.values));
    })(),
    (async () => {
      const base = await buildScopedOkrSetsBase(managerId, organizationId);
      const sql = `${base.sql}
SELECT attention_state, COUNT(*)::int AS count FROM scoped_okr_sets GROUP BY attention_state`;
      return withReadClient((client) => queryRows<{ attention_state: string; count: number }>(client, sql, base.values));
    })(),
  ]);

  return {
    countsByStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    countsByScopeType: byScope.map((r) => ({ scopeType: r.scope_type, count: Number(r.count) })),
    attentionBreakdown: byAttention.map((r) => ({ attentionState: r.attention_state, count: Number(r.count) })),
  };
}

// ==========================================
// /okr/company — NOT redefined here (D-OKR8-4).
//
// `okr.routes.ts`'s existing `GET /company` route already calls
// `okrSetRepository.ts::listOkrSets({..., scopeType: 'company'})` directly —
// OKR-E002's own landed code, reused as-is (F-004-AC-02: "the company view
// is a projection, not a separate model"). This file does NOT re-declare a
// `listCompanyOkrSets` wrapper — the design draft's own placeholder for one
// literally threw `new Error('delegates to okrSetRepository.listOkrSets')`;
// building a real wrapper that does nothing but forward to an already-public
// function would only add an indirection layer with no behavior of its own.
// ==========================================
