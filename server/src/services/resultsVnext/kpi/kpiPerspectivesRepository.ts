/**
 * KPI-E005 — Perspectives & Links read model (My KPIs / Organization view).
 *
 * Design: docs/product/results-vnext/KPI_E005_DESIGN.md §A (My KPIs), §B
 * (Organization/manager view). Frozen — the SQL below is copied verbatim
 * from the design doc except where a decision changes it (decision #5's
 * 1-day grace period, already baked into the design's own §A.4 text).
 *
 * §A `listMyKpis`: ONE SQL string, `UNION ALL` of six branches, all filtered
 * through the same `rvn_visible_resources` CTE (`resourceType:'kpi'`) built
 * once via `buildVisibilityScopedCte` — built as one query (not composed
 * TS-level) per the design's own "Implementation note", because
 * `branch_update_due_heuristic` legitimately references
 * `branch_update_due_governed` within the same `WITH`.
 *
 * §B `listOrganizationKpiAttention`: an ORCHESTRATOR over several
 * INDEPENDENT queries (same style `kpiScorecardRepository.ts`'s
 * `getScorecardStatusDistribution` vs `listScorecardItems` already uses) —
 * each query calls `buildVisibilityScopedCte` again for itself (T3: filter
 * BEFORE aggregate, no single "already filtered" intermediate view the rest
 * quietly trusts). `missing ownership` (decision #2) deliberately bypasses
 * `chain_members` — it reads raw `rvn_kpi_definitions` + the visibility CTE
 * only, since a NULL owner can never match a chain member; T3 non-leak still
 * applies (only OPEN_ORG/RBAC-override-visible unowned KPIs surface there),
 * an accepted, documented limitation per decision #2, not a bug.
 *
 * Every `vr.resource_id = <uuid column>` join below carries the `::text`
 * cast — the exact bug class fixed program-wide in EXECUTION_LEDGER.md §24;
 * do not drop it when touching this file.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { buildVisibilityScopedCte } from '../platform/visibilityScopedQuery.js';

// ==========================================
// Shared read-client helpers (same pinned-client-per-call shape as
// kpiRepository.ts / kpiScorecardRepository.ts).
// ==========================================

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
// A) My KPIs read model — design §A.
// ==========================================

export type MyKpiAttentionType =
  | 'update_due'
  | 'explanation_or_plan_obligation'
  | 'owned_corrective_action'
  | 'manager_decision_waiting'
  | 'upcoming_review'
  | 'other_obligation'; // catch-all for any obligation_type not yet in the known taxonomy

export type MyKpiAttentionSource = 'governed' | 'derived_heuristic';

export interface MyKpiAttentionItemRow {
  attention_type: MyKpiAttentionType;
  attention_source: MyKpiAttentionSource;
  priority_rank: number;
  kpi_id: string | null;
  kpi_code: string | null;
  kpi_status: string | null;
  due_at: string | null;
  related_type: 'obligation' | 'deviation_case' | 'corrective_action' | 'scorecard' | null;
  related_id: string | null;
  detail: Record<string, unknown>;
}

export interface MyKpiAttentionItem {
  attentionType: MyKpiAttentionType;
  attentionSource: MyKpiAttentionSource;
  priorityRank: number; // 1 (most urgent) .. 6
  kpiId: string | null; // null only for branch 5 (scorecard-level, no single kpi_id)
  kpiCode: string | null;
  kpiStatus: string | null;
  dueAt: string | null;
  relatedType: 'obligation' | 'deviation_case' | 'corrective_action' | 'scorecard' | null;
  relatedId: string | null;
  detail: Record<string, unknown>;
}

export function toMyKpiAttentionItem(row: MyKpiAttentionItemRow): MyKpiAttentionItem {
  return {
    attentionType: row.attention_type,
    attentionSource: row.attention_source,
    priorityRank: row.priority_rank,
    kpiId: row.kpi_id,
    kpiCode: row.kpi_code,
    kpiStatus: row.kpi_status,
    dueAt: row.due_at,
    relatedType: row.related_type,
    relatedId: row.related_id,
    detail: row.detail ?? {},
  };
}

export interface ListMyKpisParams {
  userId: string;
  organizationId: string;
  now?: string;
  limit?: number;
  offset?: number;
}

/**
 * Design §A.4, copied verbatim (six branches, `UNION ALL`, one query).
 * `$1`=organizationId `$2`='kpi' `$3`=userId (CTE params, reused across
 * branches) `$4`=now() `$5`=limit `$6`=offset.
 */
export async function listMyKpis(params: ListMyKpisParams): Promise<MyKpiAttentionItem[]> {
  const { userId, organizationId, now = new Date().toISOString(), limit = 100, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const values: unknown[] = [...cte.values, now, limit, offset];

  const querySql = `
${cte.sql},

branch_update_due_governed AS (
  SELECT
    'update_due'::text AS attention_type, 'governed'::text AS attention_source, 1 AS priority_rank,
    kd.kpi_id, kd.kpi_code, kd.status AS kpi_status,
    o.due_at,
    'obligation'::text AS related_type, o.obligation_id::text AS related_id,
    jsonb_build_object('obligationType', o.obligation_type) AS detail
  FROM rvn_kpi_definitions kd
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  INNER JOIN rvn_platform_obligations o
          ON o.organization_id = kd.organization_id
         AND o.reference_type = 'kpi'
         AND o.reference_id = kd.kpi_id
         AND o.obligation_type IN ('enter_kpi_value', 'perform_periodic_kpi_review', 'reassess_observation_baseline')
         AND o.status = 'open'
  WHERE kd.organization_id = $1
    AND o.assignee_user_id = $3
),
branch_update_due_heuristic AS (
  SELECT
    'update_due'::text, 'derived_heuristic'::text, 1,
    kd.kpi_id, kd.kpi_code, kd.status,
    (COALESCE(latest.period_end, kd.created_at) + make_interval(days => kdv.measurement_frequency_days))::timestamptz,
    'obligation'::text, NULL::text,
    jsonb_build_object('lastMeasurementId', latest.measurement_id, 'lastPeriodEnd', latest.period_end)
  FROM rvn_kpi_definitions kd
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  INNER JOIN rvn_kpi_definition_versions kdv
          ON kdv.definition_version_id = kd.current_definition_version_id
  LEFT JOIN LATERAL (
    SELECT m.measurement_id, m.period_end
      FROM rvn_kpi_measurements m
     WHERE m.kpi_id = kd.kpi_id
       AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
     ORDER BY m.period_end DESC LIMIT 1
  ) latest ON true
  WHERE kd.organization_id = $1
    AND kd.owner_user_id = $3
    AND kd.status = 'active'
    AND kdv.measurement_frequency_days IS NOT NULL
    -- Decision #5: 1-day grace period applied here.
    -- DEVIATION FROM DESIGN (found on a real Postgres 16, not guessed): the
    -- design doc's literal predicate is "< $4 - interval '1 day'" with no
    -- cast on $4. Verified empirically that Postgres's parameter-type
    -- inference resolves the "-" operator's LHS ($4, type 'unknown' from the
    -- driver) against interval-minus-interval (=> interval) in preference
    -- to timestamptz-minus-interval (=> timestamptz), so the whole RHS
    -- types as interval and the outer "<" then fails with 42883 ("operator
    -- does not exist: timestamp with time zone < interval") -- $4 is bound
    -- as an ISO string (now), never actually an interval. Nearest safe
    -- equivalent: an explicit ::timestamptz cast on $4 pins its type before
    -- the "-" is resolved; semantics are identical to the design's intent
    -- (now() minus one day of grace).
    AND (COALESCE(latest.period_end, kd.created_at) + make_interval(days => kdv.measurement_frequency_days))
        < $4::timestamptz - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM branch_update_due_governed g WHERE g.kpi_id = kd.kpi_id)
),

branch_explanation_plan AS (
  SELECT
    'explanation_or_plan_obligation'::text, 'governed'::text, 2,
    kd.kpi_id, kd.kpi_code, kd.status,
    o.due_at,
    'obligation'::text, o.obligation_id::text,
    jsonb_build_object('obligationType', o.obligation_type, 'referenceType', o.reference_type)
  FROM rvn_platform_obligations o
  LEFT JOIN rvn_kpi_deviation_cases dc ON o.reference_type = 'deviation_case' AND dc.case_id = o.reference_id
  INNER JOIN rvn_kpi_definitions kd
          ON kd.kpi_id = COALESCE(CASE WHEN o.reference_type = 'kpi' THEN o.reference_id END, dc.kpi_id)
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  WHERE kd.organization_id = $1
    AND o.organization_id = $1
    AND o.assignee_user_id = $3
    AND o.status = 'open'
    AND o.obligation_type IN (
      'explain_warning_critical_deviation', 'prepare_submit_corrective_plan',
      'resolve_disputed_measurement', 'verify_imported_value', 'resolve_missing_data'
    )
),

branch_corrective_actions AS (
  SELECT
    'owned_corrective_action'::text, 'governed'::text, 3,
    dc.kpi_id, kd.kpi_code, kd.status,
    ca.due_date::timestamptz,
    'corrective_action'::text, ca.action_id::text,
    jsonb_build_object('caseId', dc.case_id, 'actionStatus', ca.status, 'caseSeverity', dc.severity)
  FROM rvn_kpi_corrective_actions ca
  INNER JOIN rvn_kpi_deviation_cases dc ON dc.case_id = ca.deviation_case_id
  INNER JOIN rvn_kpi_definitions kd ON kd.kpi_id = dc.kpi_id
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id::text
  WHERE ca.organization_id = $1
    AND ca.owner_user_id = $3
    AND ca.status IN ('planned', 'active', 'blocked')
),

branch_manager_decision_waiting AS (
  SELECT
    'manager_decision_waiting'::text, 'governed'::text, 4,
    dc.kpi_id, kd.kpi_code, kd.status,
    NULL::timestamptz,
    'deviation_case'::text, dc.case_id::text,
    jsonb_build_object('planSubmittedAt', dc.plan_submitted_at, 'planSubmittedBy', dc.plan_submitted_by)
  FROM rvn_kpi_deviation_cases dc
  INNER JOIN rvn_kpi_definitions kd ON kd.kpi_id = dc.kpi_id
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id::text
  WHERE dc.organization_id = $1
    AND dc.status = 'plan_submitted'
    AND (dc.owner_user_id = $3 OR dc.plan_submitted_by = $3)
),

branch_upcoming_review AS (
  SELECT DISTINCT ON (sc.scorecard_id)
    'upcoming_review'::text, 'derived_heuristic'::text, 5,
    NULL::uuid, NULL::text, NULL::text,
    (COALESCE(last_pub.published_at, sc.created_at)
      + make_interval(days => CASE sc.review_frequency
          WHEN 'weekly' THEN 7 WHEN 'monthly' THEN 30
          WHEN 'quarterly' THEN 91 WHEN 'annual' THEN 365 ELSE NULL END))::timestamptz,
    'scorecard'::text, sc.scorecard_id::text,
    jsonb_build_object('scorecardName', sc.name, 'reviewFrequency', sc.review_frequency)
  FROM rvn_kpi_scorecards sc
  LEFT JOIN LATERAL (
    SELECT rs.published_at FROM rvn_kpi_scorecard_review_snapshots rs
     WHERE rs.scorecard_id = sc.scorecard_id AND rs.status IN ('published','superseded')
     ORDER BY rs.published_at DESC NULLS LAST LIMIT 1
  ) last_pub ON true
  WHERE sc.organization_id = $1
    AND sc.lifecycle_status = 'active'
    AND sc.review_frequency != 'custom'
    AND (
      sc.owner_user_id = $3
      OR EXISTS (
        SELECT 1 FROM rvn_kpi_scorecard_items si
        INNER JOIN rvn_kpi_definitions kd2 ON kd2.kpi_id = si.kpi_id
        WHERE si.scorecard_id = sc.scorecard_id AND kd2.owner_user_id = $3
      )
    )
),

branch_other_obligation AS (
  SELECT
    'other_obligation'::text, 'governed'::text, 6,
    kd.kpi_id, kd.kpi_code, kd.status,
    o.due_at, 'obligation'::text, o.obligation_id::text,
    jsonb_build_object('obligationType', o.obligation_type)
  FROM rvn_platform_obligations o
  LEFT JOIN rvn_kpi_deviation_cases dc ON o.reference_type = 'deviation_case' AND dc.case_id = o.reference_id
  INNER JOIN rvn_kpi_definitions kd
          ON kd.kpi_id = COALESCE(CASE WHEN o.reference_type = 'kpi' THEN o.reference_id END, dc.kpi_id)
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
  WHERE kd.organization_id = $1 AND o.organization_id = $1
    AND o.assignee_user_id = $3 AND o.status = 'open'
    AND o.obligation_type NOT IN (
      'enter_kpi_value','perform_periodic_kpi_review','reassess_observation_baseline',
      'explain_warning_critical_deviation','prepare_submit_corrective_plan',
      'resolve_disputed_measurement','verify_imported_value','resolve_missing_data'
    )
)

SELECT * FROM (
  SELECT * FROM branch_update_due_governed
  UNION ALL SELECT * FROM branch_update_due_heuristic
  UNION ALL SELECT * FROM branch_explanation_plan
  UNION ALL SELECT * FROM branch_corrective_actions
  UNION ALL SELECT * FROM branch_manager_decision_waiting
  UNION ALL SELECT * FROM branch_upcoming_review
  UNION ALL SELECT * FROM branch_other_obligation
) all_items
ORDER BY priority_rank ASC, due_at ASC NULLS LAST
LIMIT $5 OFFSET $6;
`;

  const rows = await withReadClient((client) =>
    queryRows<MyKpiAttentionItemRow>(client, querySql, values)
  );
  return rows.map(toMyKpiAttentionItem);
}

// ==========================================
// B) Organization/manager view — design §B.
// ==========================================

export interface OrganizationKpiAttention {
  processCoverage: Array<{ primaryProcessId: string | null; totalKpis: number; activeKpis: number }>;
  ownerLoad: Array<{ ownerUserId: string; activeKpiCount: number; openDeviationCaseCount: number }>;
  missingOwnership: Array<{ kpiId: string; kpiCode: string }>;
  performanceDistribution: { onTarget: number; warning: number; critical: number; neutralOrMissing: number };
  overdueObligations: Array<{ obligationId: string; kpiId: string; assigneeUserId: string; obligationType: string; dueAt: string }>;
  repeatedDeviations: Array<{ kpiId: string; kpiCode: string; caseCountLast180Days: number; anySelfReportedRecurrence: boolean }>;
  ineffectiveCorrectiveActions: Array<{ caseId: string; kpiId: string; verificationId: string; status: 'ineffective' | 'partially_effective' }>;
}

export interface ListOrganizationKpiAttentionParams {
  managerId: string;
  organizationId: string;
  includeSelf?: boolean;
  recurrenceWindowDays?: number;
}

/**
 * §B.2 "shared base" (`chain_members`/`scoped_kpis`) is NOT a single
 * pre-computed CTE reused across every metric below — it is this helper,
 * called independently by each metric function that needs it, each with its
 * OWN fresh `buildVisibilityScopedCte()` call (T3: every query filters
 * before it aggregates, no shared "already filtered" view the rest quietly
 * trusts). `$1`=organizationId `$2`='kpi' `$3`=managerId (visibility CTE
 * params) `$4`=managerId (chain params, deliberately separate placeholder,
 * per design §B.2).
 */
async function buildScopedKpisBase(
  managerId: string,
  organizationId: string
): Promise<{ sql: string; values: unknown[] }> {
  const cte = await buildVisibilityScopedCte({
    userId: managerId,
    organizationId,
    resourceType: 'kpi',
  });
  const values: unknown[] = [...cte.values, managerId];
  const sql = `${cte.sql},
chain_members AS (
  SELECT descendant_user_id AS user_id
    FROM rvn_platform_management_chain_closure
   WHERE organization_id = $1 AND ancestor_user_id = $4
  UNION
  SELECT $4
),
scoped_kpis AS (
  SELECT kd.*
    FROM rvn_kpi_definitions kd
    INNER JOIN rvn_visible_resources vr
            ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
    INNER JOIN chain_members cm ON cm.user_id = kd.owner_user_id
   WHERE kd.organization_id = $1
)`;
  return { sql, values };
}

async function listProcessCoverage(
  managerId: string,
  organizationId: string
): Promise<OrganizationKpiAttention['processCoverage']> {
  const base = await buildScopedKpisBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT primary_process_id,
       COUNT(*) AS total_kpis,
       COUNT(*) FILTER (WHERE status = 'active') AS active_kpis
  FROM scoped_kpis
 GROUP BY primary_process_id`;
  const rows = await withReadClient((client) =>
    queryRows<{ primary_process_id: string | null; total_kpis: string; active_kpis: string }>(
      client,
      sql,
      base.values
    )
  );
  return rows.map((row) => ({
    primaryProcessId: row.primary_process_id,
    totalKpis: Number(row.total_kpis),
    activeKpis: Number(row.active_kpis),
  }));
}

async function listOwnerLoad(
  managerId: string,
  organizationId: string
): Promise<OrganizationKpiAttention['ownerLoad']> {
  const base = await buildScopedKpisBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT
    kd.owner_user_id,
    COUNT(DISTINCT kd.kpi_id) FILTER (WHERE kd.status = 'active') AS active_kpi_count,
    COUNT(DISTINCT dc.case_id) FILTER (WHERE dc.status NOT IN ('closed')) AS open_deviation_case_count
  FROM scoped_kpis kd
  LEFT JOIN rvn_kpi_deviation_cases dc ON dc.kpi_id = kd.kpi_id AND dc.organization_id = $1
 WHERE kd.owner_user_id IS NOT NULL
 GROUP BY kd.owner_user_id`;
  const rows = await withReadClient((client) =>
    queryRows<{ owner_user_id: string; active_kpi_count: string; open_deviation_case_count: string }>(
      client,
      sql,
      base.values
    )
  );
  return rows.map((row) => ({
    ownerUserId: row.owner_user_id,
    activeKpiCount: Number(row.active_kpi_count),
    openDeviationCaseCount: Number(row.open_deviation_case_count),
  }));
}

/**
 * Decision #2: deliberately bypasses `chain_members`/`scoped_kpis` — a NULL
 * owner can never match a chain member, so it would never appear via
 * `scoped_kpis` anyway. Reads raw `rvn_kpi_definitions` + its OWN visibility
 * CTE only. T3 non-leak still applies (only OPEN_ORG/RBAC-override-visible
 * unowned KPIs surface here) — an accepted, documented limitation, not a bug
 * to "fix" by widening visibility.
 */
async function listMissingOwnership(
  managerId: string,
  organizationId: string
): Promise<OrganizationKpiAttention['missingOwnership']> {
  const cte = await buildVisibilityScopedCte({
    userId: managerId,
    organizationId,
    resourceType: 'kpi',
  });
  const sql = `${cte.sql}
SELECT kd.kpi_id, kd.kpi_code
  FROM rvn_kpi_definitions kd
  INNER JOIN rvn_visible_resources vr ON vr.resource_type='kpi' AND vr.resource_id = kd.kpi_id::text
 WHERE kd.organization_id = $1 AND kd.owner_user_id IS NULL`;
  const rows = await withReadClient((client) =>
    queryRows<{ kpi_id: string; kpi_code: string }>(client, sql, cte.values)
  );
  return rows.map((row) => ({ kpiId: row.kpi_id, kpiCode: row.kpi_code }));
}

async function getPerformanceDistribution(
  managerId: string,
  organizationId: string
): Promise<OrganizationKpiAttention['performanceDistribution']> {
  const base = await buildScopedKpisBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT
    COUNT(*) FILTER (WHERE latest.performance_status = 'on_target') AS on_target,
    COUNT(*) FILTER (WHERE latest.performance_status = 'warning')   AS warning,
    COUNT(*) FILTER (WHERE latest.performance_status = 'critical')  AS critical,
    COUNT(*) FILTER (WHERE latest.performance_status IS NULL OR latest.performance_status = 'neutral') AS neutral_or_missing
  FROM scoped_kpis kd
  LEFT JOIN LATERAL (
    SELECT m.performance_status FROM rvn_kpi_measurements m
     WHERE m.kpi_id = kd.kpi_id
       AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
     ORDER BY m.period_end DESC, m.recorded_at DESC LIMIT 1
  ) latest ON true
 WHERE kd.status = 'active'`;
  const rows = await withReadClient((client) =>
    queryRows<{ on_target: string; warning: string; critical: string; neutral_or_missing: string }>(
      client,
      sql,
      base.values
    )
  );
  const row = rows[0];
  if (!row) return { onTarget: 0, warning: 0, critical: 0, neutralOrMissing: 0 };
  return {
    onTarget: Number(row.on_target),
    warning: Number(row.warning),
    critical: Number(row.critical),
    neutralOrMissing: Number(row.neutral_or_missing),
  };
}

async function listOverdueObligations(
  managerId: string,
  organizationId: string
): Promise<OrganizationKpiAttention['overdueObligations']> {
  const base = await buildScopedKpisBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT o.obligation_id, kd.kpi_id, o.assignee_user_id, o.obligation_type, o.due_at
  FROM rvn_platform_obligations o
  INNER JOIN rvn_kpi_deviation_cases dc ON o.reference_type = 'deviation_case' AND dc.case_id = o.reference_id
  INNER JOIN scoped_kpis kd ON kd.kpi_id = dc.kpi_id
 WHERE o.organization_id = $1 AND o.status = 'open' AND o.due_at < now()
UNION ALL
SELECT o.obligation_id, kd.kpi_id, o.assignee_user_id, o.obligation_type, o.due_at
  FROM rvn_platform_obligations o
  INNER JOIN scoped_kpis kd ON kd.kpi_id = o.reference_id AND o.reference_type = 'kpi'
 WHERE o.organization_id = $1 AND o.status = 'open' AND o.due_at < now()`;
  const rows = await withReadClient((client) =>
    queryRows<{
      obligation_id: string;
      kpi_id: string;
      assignee_user_id: string;
      obligation_type: string;
      due_at: string;
    }>(client, sql, base.values)
  );
  return rows.map((row) => ({
    obligationId: row.obligation_id,
    kpiId: row.kpi_id,
    assigneeUserId: row.assignee_user_id,
    obligationType: row.obligation_type,
    dueAt: row.due_at,
  }));
}

async function listRepeatedDeviations(
  managerId: string,
  organizationId: string,
  recurrenceWindowDays: number
): Promise<OrganizationKpiAttention['repeatedDeviations']> {
  const base = await buildScopedKpisBase(managerId, organizationId);
  const values = [...base.values, recurrenceWindowDays];
  const windowParamIndex = values.length;
  const sql = `${base.sql}
SELECT
    kd.kpi_id, kd.kpi_code,
    COUNT(dc.case_id) FILTER (WHERE dc.detected_at > now() - make_interval(days => $${windowParamIndex})) AS case_count_last_window,
    BOOL_OR(dc.recurrence_flag) AS any_self_reported_recurrence
  FROM scoped_kpis kd
  INNER JOIN rvn_kpi_deviation_cases dc ON dc.kpi_id = kd.kpi_id
 GROUP BY kd.kpi_id, kd.kpi_code
HAVING COUNT(dc.case_id) FILTER (WHERE dc.detected_at > now() - make_interval(days => $${windowParamIndex})) > 1
    OR BOOL_OR(dc.recurrence_flag)`;
  const rows = await withReadClient((client) =>
    queryRows<{
      kpi_id: string;
      kpi_code: string;
      case_count_last_window: string;
      any_self_reported_recurrence: boolean | null;
    }>(client, sql, values)
  );
  return rows.map((row) => ({
    kpiId: row.kpi_id,
    kpiCode: row.kpi_code,
    caseCountLast180Days: Number(row.case_count_last_window),
    anySelfReportedRecurrence: Boolean(row.any_self_reported_recurrence),
  }));
}

async function listIneffectiveCorrectiveActions(
  managerId: string,
  organizationId: string
): Promise<OrganizationKpiAttention['ineffectiveCorrectiveActions']> {
  const base = await buildScopedKpisBase(managerId, organizationId);
  const sql = `${base.sql}
SELECT ev.deviation_case_id AS case_id, dc.kpi_id, ev.verification_id, ev.status
  FROM rvn_kpi_effectiveness_verifications ev
  INNER JOIN rvn_kpi_deviation_cases dc ON dc.case_id = ev.deviation_case_id
  INNER JOIN scoped_kpis kd ON kd.kpi_id = dc.kpi_id
 WHERE ev.status IN ('ineffective', 'partially_effective')`;
  const rows = await withReadClient((client) =>
    queryRows<{ case_id: string; kpi_id: string; verification_id: string; status: 'ineffective' | 'partially_effective' }>(
      client,
      sql,
      base.values
    )
  );
  return rows.map((row) => ({
    caseId: row.case_id,
    kpiId: row.kpi_id,
    verificationId: row.verification_id,
    status: row.status,
  }));
}

/**
 * Design §B: an orchestrator over the seven independent queries above. Each
 * one resolves its own visibility/chain scope from scratch — none of them
 * shares a pre-filtered intermediate result with the others.
 */
export async function listOrganizationKpiAttention(
  params: ListOrganizationKpiAttentionParams
): Promise<OrganizationKpiAttention> {
  const { managerId, organizationId, recurrenceWindowDays = 180 } = params;

  const [
    processCoverage,
    ownerLoad,
    missingOwnership,
    performanceDistribution,
    overdueObligations,
    repeatedDeviations,
    ineffectiveCorrectiveActions,
  ] = await Promise.all([
    listProcessCoverage(managerId, organizationId),
    listOwnerLoad(managerId, organizationId),
    listMissingOwnership(managerId, organizationId),
    getPerformanceDistribution(managerId, organizationId),
    listOverdueObligations(managerId, organizationId),
    listRepeatedDeviations(managerId, organizationId, recurrenceWindowDays),
    listIneffectiveCorrectiveActions(managerId, organizationId),
  ]);

  return {
    processCoverage,
    ownerLoad,
    missingOwnership,
    performanceDistribution,
    overdueObligations,
    repeatedDeviations,
    ineffectiveCorrectiveActions,
  };
}
