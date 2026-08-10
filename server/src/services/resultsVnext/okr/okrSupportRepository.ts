/**
 * OKR-E006 — Support request / comment / recognition read repository.
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §12/§14.
 *
 * Visibility inherits via `set_id` only — NO new `resource_type`, matching
 * OKR-E002 §5's own stated pattern for `okr_vnext_approved_snapshots`/
 * `okr_vnext_set_versions` and OKR-E004's own posture for
 * `okr_vnext_checkins` (D14). `rvn_platform_resource_visibility.resource_id`
 * is TEXT; `okr_vnext_support_requests.set_id` is UUID — every join below
 * casts `::text`. This exact cast has already been missed 7 times in one
 * KPI epic (this program's single most-repeated real bug) —
 * `okrSupportRequestVisibilityJoin.realdb.test.ts` exists specifically to
 * catch a regression here.
 *
 * `getSupportRequest` hydrates `decisionLinkId`-bearing rows with a live
 * JOIN to `decisions` (design §10.5) — deliberately NOT a cached/stale-flag
 * column, since `decisions` lives in the exact same Postgres database.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';
import {
  toOkrDecisionLink,
  toOkrSupportRequest,
  type OkrDecisionLinkRow,
  type OkrDecisionLinkWithLiveStatus,
  type OkrSupportRequest,
  type OkrSupportRequestKind,
  type OkrSupportRequestRow,
} from './okrSupportTypes.js';

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
// listSupportRequestsForSet
// ==========================================

export interface ListSupportRequestsForSetParams {
  userId: string;
  organizationId: string;
  setId: string;
  kind?: OkrSupportRequestKind;
}

export async function listSupportRequestsForSet(
  params: ListSupportRequestsForSetParams
): Promise<OkrSupportRequest[]> {
  const { userId, organizationId, setId, kind } = params;

  const kindClause = kind ? `AND sr.kind = $${VISIBILITY_CTE_PARAM_COUNT + 2}` : '';

  const baseQuerySql = `
    SELECT sr.*
      FROM okr_vnext_support_requests sr
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = sr.set_id::text
     WHERE sr.organization_id = $1
       AND sr.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       ${kindClause}
     ORDER BY sr.created_at DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = kind ? [...wrapped.values, setId, kind] : [...wrapped.values, setId];
  const rows = await withReadClient((client) => queryRows<OkrSupportRequestRow>(client, wrapped.sql, values));
  return rows.map(toOkrSupportRequest);
}

// ==========================================
// getSupportRequest
// ==========================================

export interface GetSupportRequestParams {
  userId: string;
  organizationId: string;
  requestId: string;
}

export async function getSupportRequest(params: GetSupportRequestParams): Promise<OkrSupportRequest | null> {
  const { userId, organizationId, requestId } = params;
  const baseQuerySql = `
    SELECT sr.*
      FROM okr_vnext_support_requests sr
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = sr.set_id::text
     WHERE sr.organization_id = $1
       AND sr.request_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, requestId];
  const rows = await withReadClient((client) => queryRows<OkrSupportRequestRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toOkrSupportRequest(row) : null;
}

// ==========================================
// getDecisionLink — design §10.5: live JOIN to `decisions`, never a cached/
// stale-flag column. `decisions` lives in the exact same Postgres database
// as `okr_vnext_*`, so a live read-time JOIN carries none of ROI-E007's
// cross-system-latency risk and is strictly more accurate than any cache.
// Visibility inherits via the link's own denormalized `set_id` (design §12
// — avoids a join-through-support-request just for visibility scoping,
// mirrors `rvn_roi_finance_links`' own denormalized `case_id`).
// ==========================================

export interface GetDecisionLinkParams {
  userId: string;
  organizationId: string;
  linkId: string;
}

export async function getDecisionLink(params: GetDecisionLinkParams): Promise<OkrDecisionLinkWithLiveStatus | null> {
  const { userId, organizationId, linkId } = params;
  const baseQuerySql = `
    SELECT dl.*, d.status AS decision_status, d.decision_rationale AS decision_rationale, d.decided_at AS decision_decided_at
      FROM okr_vnext_decision_links dl
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = dl.set_id::text
      LEFT JOIN decisions d
             ON d.id = dl.decision_id AND d.organization_id = dl.organization_id
     WHERE dl.organization_id = $1
       AND dl.link_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, linkId];
  const rows = await withReadClient((client) =>
    queryRows<OkrDecisionLinkRow & { decision_status: string | null; decision_rationale: string | null; decision_decided_at: string | null }>(
      client,
      wrapped.sql,
      values
    )
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...toOkrDecisionLink(row),
    decisionStatus: row.decision_status,
    decisionRationale: row.decision_rationale,
    decisionDecidedAt: row.decision_decided_at,
  };
}

// ==========================================
// getDecisionLinkForSupportRequest — convenience lookup used by the route
// layer (GET /support-requests/:requestId/decision-link takes a
// requestId, not a linkId).
// ==========================================

export interface GetDecisionLinkForSupportRequestParams {
  userId: string;
  organizationId: string;
  requestId: string;
}

export async function getDecisionLinkForSupportRequest(
  params: GetDecisionLinkForSupportRequestParams
): Promise<OkrDecisionLinkWithLiveStatus | null> {
  const { userId, organizationId, requestId } = params;
  const baseQuerySql = `
    SELECT dl.*, d.status AS decision_status, d.decision_rationale AS decision_rationale, d.decided_at AS decision_decided_at
      FROM okr_vnext_decision_links dl
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = dl.set_id::text
      LEFT JOIN decisions d
             ON d.id = dl.decision_id AND d.organization_id = dl.organization_id
     WHERE dl.organization_id = $1
       AND dl.support_request_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, requestId];
  const rows = await withReadClient((client) =>
    queryRows<OkrDecisionLinkRow & { decision_status: string | null; decision_rationale: string | null; decision_decided_at: string | null }>(
      client,
      wrapped.sql,
      values
    )
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...toOkrDecisionLink(row),
    decisionStatus: row.decision_status,
    decisionRationale: row.decision_rationale,
    decisionDecidedAt: row.decision_decided_at,
  };
}
