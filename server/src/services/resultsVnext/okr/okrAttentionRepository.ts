/**
 * OKR-E006 — Manager attention queue read-model (OKR-F-020-AC-01).
 *
 * Design: docs/product/results-vnext/OKR_E006_DESIGN.md §9. Direct
 * structural copy of `kpiPerspectivesRepository.ts`'s
 * `listOrganizationKpiAttention`/`buildScopedKpisBase` (KPI-E003's manager
 * attention-queue precedent) — same shape, OKR's own signal set substituted
 * in: N independently-scoped sub-queries run in parallel, each filtered
 * through a shared `buildScopedOkrSetsBase(managerId, organizationId)`
 * helper that resolves the manager's scoped Set set before joining
 * check-ins/support-requests/key-results onto it.
 *
 * A read-model, not a new aggregate (confirmed twice independently: plan
 * §8.3's explicit "named organizational view, not content of one Set tool"
 * language, and the ledger's own "Aggregate/owner: Manager attention read
 * model" cell, no schema entry beyond the index added by
 * `20260826_rvn_okr_support.sql`).
 *
 * ACKNOWLEDGED, UNFIXED GAP (mirrors `kpiPerspectivesRepository.ts`'s own
 * `buildScopedKpisBase`, confirmed by direct grep): no real
 * `getManagementChain(userId)` function exists anywhere in the platform
 * (`managementChainMaintenance.ts` only comments about it) — the
 * `chain_members` CTE below queries `rvn_platform_management_chain_closure`
 * directly (union with the manager's own id), which is the intended
 * traversal mechanism, but nothing currently populates that closure table
 * beyond whatever `managementChainMaintenance.ts` maintains today. This
 * epic does not build the missing piece, same posture OKR-E002 D13 took
 * toward a different, adjacent platform gap: name it, don't silently work
 * around it, don't fix it outside your own file ownership.
 *
 * `::text` cast on the visibility join — `rvn_visible_resources.resource_id`
 * is TEXT, `okr_vnext_sets.set_id` is UUID. This program's single
 * most-repeated real bug — `okrAttentionQueue.realdb.test.ts` proves it
 * executes against real rows.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { buildVisibilityScopedCte } from '../platform/visibilityScopedQuery.js';

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

interface ScopedBase {
  sql: string;
  values: unknown[];
}

/** Positional index of `managerId` within `values` — the CTE's own 3 params
 * (organizationId, resourceType, userId=managerId) plus this repeated
 * `managerId` reference for the `chain_members` CTE (mirrors
 * `buildScopedKpisBase`'s own `$4` placeholder exactly). */
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
   WHERE s.organization_id = $1
     AND s.owner_user_id IN (SELECT user_id FROM chain_members)
)`;
  return { sql, values };
}

// ==========================================
// Result DTOs
// ==========================================

export interface OkrAttentionStaleCheckinSet {
  setId: string;
  title: string;
  nextCheckinDueAt: string;
}

export interface OkrAttentionLowConfidenceObjective {
  keyResultId: string;
  objectiveId: string;
  setId: string;
  title: string;
  confidence: string;
}

export interface OkrAttentionOpenSupportRequest {
  requestId: string;
  setId: string;
  objectiveId: string;
  keyResultId: string | null;
  assignedToUserId: string | null;
  status: string;
}

export interface OkrAttentionOpenBlocker {
  checkInId: string;
  keyResultId: string;
  objectiveId: string;
  setId: string;
  blocker: string;
}

export interface OkrAttentionEscalatedSet {
  setId: string;
  title: string;
  attentionState: string;
}

export interface OrganizationOkrAttention {
  staleCheckins: OkrAttentionStaleCheckinSet[];
  lowConfidenceObjectives: OkrAttentionLowConfidenceObjective[];
  openSupportRequests: OkrAttentionOpenSupportRequest[];
  openBlockers: OkrAttentionOpenBlocker[];
  escalatedSets: OkrAttentionEscalatedSet[];
}

// ==========================================
// Sub-queries
// ==========================================

async function listStaleCheckinSets(managerId: string, organizationId: string): Promise<OkrAttentionStaleCheckinSet[]> {
  const base = await buildScopedOkrSetsBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT set_id, title, next_checkin_due_at
  FROM scoped_okr_sets
 WHERE next_checkin_due_at IS NOT NULL AND next_checkin_due_at < now()`;
  const rows = await withReadClient((client) =>
    queryRows<{ set_id: string; title: string; next_checkin_due_at: string }>(client, sql, base.values)
  );
  return rows.map((r) => ({ setId: r.set_id, title: r.title, nextCheckinDueAt: r.next_checkin_due_at }));
}

/** Plan §5.4's own worked example, verbatim: "progress 45% / expected 40% /
 * confidence low -> attention required despite acceptable progress" — low
 * confidence is a signal REGARDLESS of progress, so this query does not
 * filter on progress/status at all. */
async function listLowConfidenceObjectives(
  managerId: string,
  organizationId: string
): Promise<OkrAttentionLowConfidenceObjective[]> {
  const base = await buildScopedOkrSetsBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT kr.key_result_id, kr.objective_id, kr.set_id, kr.title, kr.confidence
  FROM okr_vnext_key_results kr
  INNER JOIN scoped_okr_sets s ON s.set_id = kr.set_id
 WHERE kr.confidence = 'low' AND kr.status <> 'cancelled'`;
  const rows = await withReadClient((client) =>
    queryRows<{ key_result_id: string; objective_id: string; set_id: string; title: string; confidence: string }>(
      client,
      sql,
      base.values
    )
  );
  return rows.map((r) => ({
    keyResultId: r.key_result_id,
    objectiveId: r.objective_id,
    setId: r.set_id,
    title: r.title,
    confidence: r.confidence,
  }));
}

async function listOpenSupportRequests(managerId: string, organizationId: string): Promise<OkrAttentionOpenSupportRequest[]> {
  const base = await buildScopedOkrSetsBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT sr.request_id, sr.set_id, sr.objective_id, sr.key_result_id, sr.assigned_to_user_id, sr.status
  FROM okr_vnext_support_requests sr
  INNER JOIN scoped_okr_sets s ON s.set_id = sr.set_id
 WHERE sr.kind = 'support_request' AND sr.status IN ('open','acknowledged')`;
  const rows = await withReadClient((client) =>
    queryRows<{
      request_id: string;
      set_id: string;
      objective_id: string;
      key_result_id: string | null;
      assigned_to_user_id: string | null;
      status: string;
    }>(client, sql, base.values)
  );
  return rows.map((r) => ({
    requestId: r.request_id,
    setId: r.set_id,
    objectiveId: r.objective_id,
    keyResultId: r.key_result_id,
    assignedToUserId: r.assigned_to_user_id,
    status: r.status,
  }));
}

/** "latest check-in per KR where blocker IS NOT NULL and no linked
 * support_request yet exists" (design §9.1, literal) — "latest" resolved
 * the same way `okrCheckInRepository.ts`'s own `currentOnly` does (NOT
 * EXISTS a later correction), "no linked support_request yet" resolved via
 * NOT EXISTS an `okr_vnext_support_requests` row whose `origin_checkin_id`
 * points at this check-in. */
async function listOpenBlockers(managerId: string, organizationId: string): Promise<OkrAttentionOpenBlocker[]> {
  const base = await buildScopedOkrSetsBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT c.checkin_id, c.key_result_id, c.objective_id, c.set_id, c.blocker
  FROM okr_vnext_checkins c
  INNER JOIN scoped_okr_sets s ON s.set_id = c.set_id
 WHERE c.blocker IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM okr_vnext_checkins newer WHERE newer.correction_of_checkin_id = c.checkin_id)
   AND NOT EXISTS (SELECT 1 FROM okr_vnext_support_requests sr WHERE sr.origin_checkin_id = c.checkin_id)`;
  const rows = await withReadClient((client) =>
    queryRows<{ checkin_id: string; key_result_id: string; objective_id: string; set_id: string; blocker: string }>(
      client,
      sql,
      base.values
    )
  );
  return rows.map((r) => ({
    checkInId: r.checkin_id,
    keyResultId: r.key_result_id,
    objectiveId: r.objective_id,
    setId: r.set_id,
    blocker: r.blocker,
  }));
}

async function listEscalatedSets(managerId: string, organizationId: string): Promise<OkrAttentionEscalatedSet[]> {
  const base = await buildScopedOkrSetsBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT set_id, title, attention_state
  FROM scoped_okr_sets
 WHERE attention_state = 'escalated'`;
  const rows = await withReadClient((client) =>
    queryRows<{ set_id: string; title: string; attention_state: string }>(client, sql, base.values)
  );
  return rows.map((r) => ({ setId: r.set_id, title: r.title, attentionState: r.attention_state }));
}

// ==========================================
// listOrganizationOkrAttention (design §9.1)
// ==========================================

export interface ListOrganizationOkrAttentionParams {
  managerId: string;
  organizationId: string;
}

export async function listOrganizationOkrAttention(
  params: ListOrganizationOkrAttentionParams
): Promise<OrganizationOkrAttention> {
  const { managerId, organizationId } = params;
  const [staleCheckins, lowConfidenceObjectives, openSupportRequests, openBlockers, escalatedSets] = await Promise.all([
    listStaleCheckinSets(managerId, organizationId),
    listLowConfidenceObjectives(managerId, organizationId),
    listOpenSupportRequests(managerId, organizationId),
    listOpenBlockers(managerId, organizationId),
    listEscalatedSets(managerId, organizationId),
  ]);
  return { staleCheckins, lowConfidenceObjectives, openSupportRequests, openBlockers, escalatedSets };
}
