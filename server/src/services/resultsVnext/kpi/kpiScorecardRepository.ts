/**
 * KPI-E004 — Scorecards read repository.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md §C (frozen — read
 * queries via `buildVisibilityScopedCte`/`wrapWithVisibilityScope`, NOT a
 * raw `WHERE`, same discipline `kpiDeviationRepository.ts` documents in its
 * own header).
 *
 * DUAL-LAYER NON-LEAK (decision #6, P0 close — the whole reason this file's
 * `getPublishedSnapshot` looks different from a plain "SELECT the row" read):
 *   (a) `publishReviewSnapshot` (kpiScorecardCommands.ts) already filters
 *       the materialized payload to items the PUBLISHER could see at
 *       publish time (decision #6a).
 *   (b) THIS FILE's `getPublishedSnapshot` additionally re-filters the
 *       stored `snapshot_payload.items` to items the REQUESTING READER can
 *       currently see (decision #6b, the Integration Owner's own addition
 *       over both draft passes) — computed and applied at response time,
 *       NEVER persisted, NEVER changing `content_hash` (the hash validates
 *       the full *stored* row; what changes is what is *served* to an
 *       under-privileged caller). Without (b), a snapshot published by an
 *       authorized user who could see a restricted KPI would leak that
 *       KPI's frozen values to any other viewer who merely has
 *       scorecard-level visibility — exactly the design doc's own named P0
 *       risk ("Restricted KPI leaks in Scorecard totals").
 *
 * `listScorecards`/`getPublishedSnapshot`/`listReviewSnapshots` resolve
 * visibility against `resourceType: 'kpi_scorecard'` (scorecards DO carry
 * their own `rvn_platform_resource_visibility` row — `createScorecard`
 * writes one, unlike KPI-E003's deviation cases). `listScorecardItems`/
 * `getScorecardStatusDistribution` resolve against `resourceType: 'kpi'`
 * instead — AC #4 ("non-leak aggregation"): scorecard-level visibility must
 * never broaden a more restrictive per-KPI policy, so item-level reads
 * always re-check the KPI's own visibility, never the scorecard's.
 *
 * -- DEVIATION FROM DESIGN (found on a real Postgres 16, not guessed):
 * `rvn_platform_resource_visibility.resource_id` is TEXT, but
 * `rvn_kpi_scorecards.scorecard_id`/`rvn_kpi_scorecard_items.kpi_id` are
 * UUID -- `vr.resource_id = sc.scorecard_id` (or `= si.kpi_id`) fails with
 * Postgres 42883 "operator does not exist: text = uuid", no implicit cast.
 * Every `INNER JOIN rvn_visible_resources vr ON ...` below casts the UUID
 * side with `::text` -- scoped to this file's own queries, not touching the
 * shared `visibilityScopedQuery.ts` contract other domains already depend
 * on (see kpiScorecardCommands.ts's own copy of this same fix/comment for
 * `publishReviewSnapshot`'s equivalent join).
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

import {
  toKpiScorecard,
  toKpiScorecardItem,
  toKpiScorecardReviewSnapshot,
  type KpiScorecard,
  type KpiScorecardItem,
  type KpiScorecardItemRow,
  type KpiScorecardLifecycleStatus,
  type KpiScorecardReviewSnapshot,
  type KpiScorecardReviewSnapshotRow,
  type KpiScorecardRow,
  type ScorecardSnapshotItemFact,
  type ScorecardStatusCounts,
} from './kpiScorecardTypes.js';

/** Same pinned-client-per-call shape as `kpiDeviationRepository.ts`'s
 * `withReadClient` — kept local rather than shared, same rationale that
 * file's own comment gives. */
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
// listScorecards
// ==========================================

export interface ListScorecardsParams {
  userId: string;
  organizationId: string;
  lifecycleStatus?: KpiScorecardLifecycleStatus;
  ownerUserId?: string;
  limit?: number;
  offset?: number;
}

export async function listScorecards(params: ListScorecardsParams): Promise<KpiScorecard[]> {
  const { userId, organizationId, lifecycleStatus, ownerUserId, limit = 100, offset = 0 } = params;
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi_scorecard' });
  const values: unknown[] = [...cte.values];
  const filters: string[] = [];
  if (lifecycleStatus) {
    values.push(lifecycleStatus);
    filters.push(`sc.lifecycle_status = $${values.length}`);
  }
  if (ownerUserId) {
    values.push(ownerUserId);
    filters.push(`sc.owner_user_id = $${values.length}`);
  }
  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const baseQuerySql = `
    SELECT sc.* FROM rvn_kpi_scorecards sc
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id::text
     WHERE sc.organization_id = $1 ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY sc.updated_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  const rows = await withReadClient((c) => queryRows<KpiScorecardRow>(c, `${cte.sql}\n${baseQuerySql}`, values));
  return rows.map(toKpiScorecard);
}

// ==========================================
// listScorecardItems — AC #4: item-level visibility check on resourceType
// 'kpi', NOT 'kpi_scorecard' — scorecard-level visibility never implies
// per-item KPI visibility.
// ==========================================

export interface ListScorecardItemsParams {
  userId: string;
  organizationId: string;
  scorecardId: string;
}

export async function listScorecardItems(params: ListScorecardItemsParams): Promise<KpiScorecardItem[]> {
  const { userId, organizationId, scorecardId } = params;
  const baseQuerySql = `
    SELECT si.* FROM rvn_kpi_scorecard_items si
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id::text
     WHERE si.organization_id = $1 AND si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY si.sort_order ASC`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi' });
  const values = [...wrapped.values, scorecardId];
  const rows = await withReadClient((c) => queryRows<KpiScorecardItemRow>(c, wrapped.sql, values));
  return rows.map(toKpiScorecardItem);
}

// ==========================================
// getScorecardStatusDistribution — AC #4 non-leak status distribution:
// filter BEFORE aggregate (decision #6a's own pattern applied to the
// live/unpublished view).
// ==========================================

export interface GetScorecardStatusDistributionParams {
  userId: string;
  organizationId: string;
  scorecardId: string;
  asOf?: string;
}

export interface ScorecardStatusDistribution extends ScorecardStatusCounts {
  totalVisible: number;
}

export async function getScorecardStatusDistribution(
  params: GetScorecardStatusDistributionParams
): Promise<ScorecardStatusDistribution> {
  const { userId, organizationId, scorecardId, asOf } = params;
  const asOfTimestamp = asOf ?? new Date().toISOString();
  const baseQuerySql = `
    SELECT
        COUNT(*) FILTER (WHERE latest.performance_status = 'on_target') AS safe_count,
        COUNT(*) FILTER (WHERE latest.performance_status = 'warning')   AS warning_count,
        COUNT(*) FILTER (WHERE latest.performance_status = 'critical')  AS critical_count,
        COUNT(*) FILTER (WHERE latest.performance_status IS NULL OR latest.performance_status = 'neutral') AS missing_count,
        COUNT(*) AS total_count
      FROM rvn_kpi_scorecard_items si
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id::text
      LEFT JOIN LATERAL (
        SELECT m.performance_status FROM rvn_kpi_measurements m
         WHERE m.kpi_id = si.kpi_id AND m.period_end <= $${VISIBILITY_CTE_PARAM_COUNT + 2}
           AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
         ORDER BY m.period_end DESC, m.recorded_at DESC LIMIT 1
      ) latest ON true
     WHERE si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1} AND si.organization_id = $1`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi' });
  const values = [...wrapped.values, scorecardId, asOfTimestamp];
  const rows = await withReadClient((c) =>
    queryRows<{
      safe_count: string;
      warning_count: string;
      critical_count: string;
      missing_count: string;
      total_count: string;
    }>(c, wrapped.sql, values)
  );
  const row = rows[0];
  if (!row) return { safe: 0, warning: 0, critical: 0, missing: 0, totalVisible: 0 };
  return {
    safe: Number(row.safe_count),
    warning: Number(row.warning_count),
    critical: Number(row.critical_count),
    missing: Number(row.missing_count),
    totalVisible: Number(row.total_count),
  };
}

// ==========================================
// getPublishedSnapshot — DECISION #6b (Integration Owner resolution, THE
// critical correctness addition over both draft passes). See file header.
// ==========================================

export interface GetPublishedSnapshotParams {
  userId: string;
  organizationId: string;
  scorecardId: string;
}

export async function getPublishedSnapshot(
  params: GetPublishedSnapshotParams
): Promise<KpiScorecardReviewSnapshot | null> {
  const { userId, organizationId, scorecardId } = params;
  const baseQuerySql = `
    SELECT rs.* FROM rvn_kpi_scorecard_review_snapshots rs
      INNER JOIN rvn_kpi_scorecards sc ON sc.scorecard_id = rs.scorecard_id
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id::text
     WHERE rs.organization_id = $1 AND rs.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1} AND rs.status = 'published'`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: 'kpi_scorecard',
  });
  const values = [...wrapped.values, scorecardId];
  const rows = await withReadClient((c) => queryRows<KpiScorecardReviewSnapshotRow>(c, wrapped.sql, values));
  const row = rows[0];
  if (!row) return null;
  if (!row.snapshot_payload) return toKpiScorecardReviewSnapshot(row);

  // Decision #6b: re-derive the READER's visible kpi_id set (a completely
  // separate resolution from the scorecard-level CTE above — the whole
  // point is that scorecard-level visibility must NOT stand in for
  // per-item KPI visibility, AC #4's item-level rule applied to a frozen
  // payload instead of a live join), filter, recompute statusCounts for the
  // RESPONSE ONLY — the stored row (and its content_hash, verified
  // separately never to change) is never touched.
  const visibleItemsCte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const visibleIdsResult = await withReadClient((c) =>
    queryRows<{ resource_id: string }>(
      c,
      `${visibleItemsCte.sql}\nSELECT resource_id FROM rvn_visible_resources WHERE resource_type = 'kpi'`,
      visibleItemsCte.values
    )
  );
  const visibleKpiIds = new Set(visibleIdsResult.map((r) => r.resource_id));
  const filteredItems: ScorecardSnapshotItemFact[] = (row.snapshot_payload.items ?? []).filter((item) =>
    visibleKpiIds.has(item.kpiId)
  );
  const filteredCounts: ScorecardStatusCounts = { safe: 0, warning: 0, critical: 0, missing: 0 };
  for (const item of filteredItems) {
    if (item.performanceStatus === 'on_target') filteredCounts.safe += 1;
    else if (item.performanceStatus === 'warning') filteredCounts.warning += 1;
    else if (item.performanceStatus === 'critical') filteredCounts.critical += 1;
    else filteredCounts.missing += 1;
  }

  return toKpiScorecardReviewSnapshot({
    ...row,
    snapshot_payload: { items: filteredItems, statusCounts: filteredCounts },
  });
}

// ==========================================
// listReviewSnapshots — history, summary rows (payload included as stored;
// decision #6b's redaction does not apply to a bare listing the same way it
// does to getPublishedSnapshot's single-row detail read — see design §C's
// trailing comment. A caller rendering `snapshot_payload.items` from a
// listReviewSnapshots row for a NON-publisher reader must still route
// through getPublishedSnapshot for the currently-published one; superseded/
// draft rows are not exposed as a standalone item-level detail surface by
// this package).
// ==========================================

export interface ListReviewSnapshotsParams {
  userId: string;
  organizationId: string;
  scorecardId: string;
  status?: KpiScorecardReviewSnapshotRow['status'];
  limit?: number;
  offset?: number;
}

export async function listReviewSnapshots(
  params: ListReviewSnapshotsParams
): Promise<KpiScorecardReviewSnapshot[]> {
  const { userId, organizationId, scorecardId, status, limit = 50, offset = 0 } = params;
  const baseFilters: string[] = [`rs.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}`];
  const trailingValues: unknown[] = [scorecardId];
  if (status) {
    trailingValues.push(status);
    baseFilters.push(`rs.status = $${VISIBILITY_CTE_PARAM_COUNT + trailingValues.length}`);
  }
  trailingValues.push(limit);
  const limitParamIndex = VISIBILITY_CTE_PARAM_COUNT + trailingValues.length;
  trailingValues.push(offset);
  const offsetParamIndex = VISIBILITY_CTE_PARAM_COUNT + trailingValues.length;

  const baseQuerySql = `
    SELECT rs.* FROM rvn_kpi_scorecard_review_snapshots rs
      INNER JOIN rvn_kpi_scorecards sc ON sc.scorecard_id = rs.scorecard_id
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id::text
     WHERE rs.organization_id = $1 AND ${baseFilters.join(' AND ')}
     ORDER BY rs.review_period_end DESC, rs.created_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: 'kpi_scorecard',
  });
  const values = [...wrapped.values, ...trailingValues];
  const rows = await withReadClient((c) => queryRows<KpiScorecardReviewSnapshotRow>(c, wrapped.sql, values));
  return rows.map(toKpiScorecardReviewSnapshot);
}
