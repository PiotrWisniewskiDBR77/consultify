/**
 * OKR-E002 — Set read repository.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §5.
 *
 * Deliberately NOT an extension of OKR-E001's `okrRepository.ts` — that
 * file's own header states it uses plain `organization_id` scoping with no
 * visibility CTE (Program/Cycle are RBAC, Decision P2). Sets need real ABAC
 * (Decision D1) — every read here goes through
 * `buildVisibilityScopedCte`/`wrapWithVisibilityScope({resourceType:'okr_set'})`,
 * never a raw `WHERE organization_id=?`. Mirrors the `roiRepository.ts` vs
 * `roiEconomicModelRepository.ts` split.
 *
 * `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `okr_vnext_sets.set_id`/`okr_vnext_approved_snapshots.set_id` are UUID —
 * every join below casts `::text`. This exact cast has already been missed
 * 7 times in one KPI epic (the single most-repeated real bug in this
 * program) — `okrSetVisibilityJoin.realdb.test.ts` exists specifically to
 * catch a regression here.
 *
 * `okr_vnext_approved_snapshots`/`okr_vnext_set_versions` carry no
 * visibility row of their own — both inherit via `set_id`, same `::text`
 * requirement on those joins.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';
import { resultsTextMatchPattern, resultsTextMatchSql } from '../platform/textMatch.js';

import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';
import {
  toOkrSetApprovedSnapshot,
  toOkrSetApprovedSnapshotSummary,
  type OkrSetApprovedSnapshot,
  type OkrSetApprovedSnapshotRow,
  type OkrSetApprovedSnapshotSummary,
} from './okrSetApprovedSnapshotTypes.js';
import {
  toOkrSet,
  type OkrSet,
  type OkrSetAttentionState,
  type OkrSetRow,
  type OkrSetScopeType,
  type OkrSetStatus,
} from './okrSetTypes.js';

/** Same pinned-client-per-call shape as `okrRepository.ts`'s
 * `withReadClient` / `roiRepository.ts`'s own helper — no BEGIN/COMMIT
 * needed for a read. */
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
// listOkrSets
// ==========================================

export interface ListOkrSetsParams {
  userId: string;
  organizationId: string;
  cycleId?: string;
  scopeType?: OkrSetScopeType;
  status?: OkrSetStatus;
  attentionState?: OkrSetAttentionState;
  q?: string;
  limit?: number;
  offset?: number;
}

/**
 * Design §5's query params note `{perspective?, cycle?, scope?, status?,
 * attention?}` — `perspective` maps to the `/my`/`/team-health`/`/attention`/
 * `/advisor/*` read models the design doc explicitly places OUT of scope for
 * this epic (§0); no `perspective` filter is implemented here. `cycle`/
 * `scope`/`status`/`attention` map to `cycleId`/`scopeType`/`status`/
 * `attentionState` below — all real, queryable columns.
 */
export async function listOkrSets(params: ListOkrSetsParams): Promise<OkrSet[]> {
  const {
    userId,
    organizationId,
    cycleId,
    scopeType,
    status,
    attentionState,
    q,
    limit = 100,
    offset = 0,
  } = params;

  const cte = await buildVisibilityScopedCte({
    userId,
    organizationId,
    resourceType: OKR_SET_RESOURCE_TYPE,
  });
  const values: unknown[] = [...cte.values];
  const filters: string[] = [];
  if (cycleId) {
    values.push(cycleId);
    filters.push(`s.cycle_id = $${values.length}`);
  }
  if (scopeType) {
    values.push(scopeType);
    filters.push(`s.scope_type = $${values.length}`);
  }
  if (status) {
    values.push(status);
    filters.push(`s.status = $${values.length}`);
  }
  if (attentionState) {
    values.push(attentionState);
    filters.push(`s.attention_state = $${values.length}`);
  }
  if (q) {
    values.push(resultsTextMatchPattern(q));
    filters.push(resultsTextMatchSql(['s.title'], `$${values.length}`));
  }
  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const baseQuerySql = `
    SELECT s.*
      FROM okr_vnext_sets s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = s.set_id::text
     WHERE s.organization_id = $1
       ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY s.updated_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;
  const sql = `${cte.sql}\n${baseQuerySql}`;
  const rows = await withReadClient((client) => queryRows<OkrSetRow>(client, sql, values));
  return rows.map(toOkrSet);
}

// ==========================================
// getOkrSet
// ==========================================

export interface GetOkrSetParams {
  userId: string;
  organizationId: string;
  setId: string;
}

export async function getOkrSet(params: GetOkrSetParams): Promise<OkrSet | null> {
  const { userId, organizationId, setId } = params;
  const baseQuerySql = `
    SELECT s.*
      FROM okr_vnext_sets s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = s.set_id::text
     WHERE s.organization_id = $1
       AND s.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: OKR_SET_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, setId];
  const rows = await withReadClient((client) => queryRows<OkrSetRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toOkrSet(row) : null;
}

// ==========================================
// listOkrSetApprovedSnapshots
// ==========================================

export interface ListOkrSetApprovedSnapshotsParams {
  userId: string;
  organizationId: string;
  setId: string;
}

export async function listOkrSetApprovedSnapshots(
  params: ListOkrSetApprovedSnapshotsParams
): Promise<OkrSetApprovedSnapshotSummary[]> {
  const { userId, organizationId, setId } = params;
  const baseQuerySql = `
    SELECT snap.*
      FROM okr_vnext_approved_snapshots snap
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = snap.set_id::text
     WHERE snap.organization_id = $1
       AND snap.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY snap.sequence_number DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: OKR_SET_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, setId];
  const rows = await withReadClient((client) =>
    queryRows<OkrSetApprovedSnapshotRow>(client, wrapped.sql, values)
  );
  return rows.map(toOkrSetApprovedSnapshotSummary);
}

// ==========================================
// getOkrSetApprovedSnapshot
// ==========================================

export interface GetOkrSetApprovedSnapshotParams {
  userId: string;
  organizationId: string;
  setId: string;
  snapshotId: string;
}

/**
 * D8: no read-time redaction layer is needed here (unlike
 * `roiApprovalSnapshotRepository.ts`'s `getRoiApprovalSnapshot`) — the
 * frozen payload is `{set, objectives: []}`, no evidence-link/KPI reference
 * exists yet to redact.
 */
export async function getOkrSetApprovedSnapshot(
  params: GetOkrSetApprovedSnapshotParams
): Promise<OkrSetApprovedSnapshot | null> {
  const { userId, organizationId, setId, snapshotId } = params;
  const baseQuerySql = `
    SELECT snap.*
      FROM okr_vnext_approved_snapshots snap
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = snap.set_id::text
     WHERE snap.organization_id = $1
       AND snap.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND snap.snapshot_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: OKR_SET_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, setId, snapshotId];
  const rows = await withReadClient((client) =>
    queryRows<OkrSetApprovedSnapshotRow>(client, wrapped.sql, values)
  );
  const row = rows[0];
  return row ? toOkrSetApprovedSnapshot(row) : null;
}
