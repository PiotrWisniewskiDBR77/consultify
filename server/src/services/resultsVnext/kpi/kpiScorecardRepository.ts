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
 *   (b) THIS FILE additionally re-filters the stored `snapshot_payload.items`
 *       to items the REQUESTING READER can currently see (decision #6b, the
 *       Integration Owner's own addition over both draft passes) — computed
 *       and applied at response time, NEVER persisted, NEVER changing
 *       `content_hash` (the hash validates the full *stored* row; what
 *       changes is what is *served* to an under-privileged caller). Without
 *       (b), a snapshot published by an authorized user who could see a
 *       restricted KPI would leak that KPI's frozen values to any other
 *       viewer who merely has scorecard-level visibility — exactly the
 *       design doc's own named P0 risk ("Restricted KPI leaks in Scorecard
 *       totals").
 *
 * P0-C (docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md §OQ-UI-B,
 * closed): layer (b) originally lived ONLY in `getPublishedSnapshot`.
 * `listReviewSnapshots` returned the same `snapshot_payload` shape
 * (published/superseded rows both carry a materialized payload) completely
 * unfiltered — a reader who lost visibility to a KPI after publication, or
 * an org member who only ever had scorecard-level (not per-item) access,
 * could read that KPI's frozen values straight out of the history list even
 * though the "published" detail read correctly hid them. `content_hash` of
 * the STORED row never changed either way (proven by the P0-C test suite),
 * which is exactly why this was invisible to a hash-equality check and had
 * to be found by reading every read path by hand. Fixed by factoring layer
 * (b)'s mechanism into `resolveVisibleKpiIdSet`/
 * `redactSnapshotPayloadForReader` below and applying it in BOTH
 * `getPublishedSnapshot` and `listReviewSnapshots` — one shared mechanism,
 * so a future third read path cannot add payload exposure without reusing
 * (or conspicuously skipping) the same redaction call.
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
  type KpiPerformanceStatus,
  type ScorecardPeriodCell,
  type ScorecardPeriodDefinition,
  type ScorecardPeriodMatrix,
  type ScorecardPeriodMatrixItem,
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
// P0-C (OQ-UI-B close-out) — ONE shared read-time redaction mechanism for
// `snapshot_payload`, used by BOTH `getPublishedSnapshot` (decision #6b,
// pre-existing) AND `listReviewSnapshots` (this fix — previously returned
// the stored payload verbatim, unfiltered by the REQUESTING READER's
// CURRENT visibility, exactly the leak
// docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md §OQ-UI-B names).
// Deliberately factored out here rather than left duplicated inline in each
// function — a single mechanism is the whole point (§B decision #6b's own
// header note: "not a third divergent visibility check").
//
// The stored row (and its `content_hash`) is NEVER mutated by this — it
// only shapes what is *returned* to a given caller. `content_hash` on the
// returned DTO is passed through byte-for-byte from the stored row even
// when items are redacted out of `snapshotPayload`, so a caller can still
// verify the artifact's identity without that value ever depending on who
// is asking.
// ==========================================

/** Re-derive the READER's visible `kpi_id` set — same query shape
 * `getPublishedSnapshot` already used, factored out so every caller shares
 * one round trip instead of repeating the CTE per row. */
async function resolveVisibleKpiIdSet(
  client: PoolClient,
  params: { userId: string; organizationId: string }
): Promise<Set<string>> {
  const cte = await buildVisibilityScopedCte({ ...params, resourceType: 'kpi' });
  const rows = await queryRows<{ resource_id: string }>(
    client,
    `${cte.sql}\nSELECT resource_id FROM rvn_visible_resources WHERE resource_type = 'kpi'`,
    cte.values
  );
  return new Set(rows.map((r) => r.resource_id));
}

/** Filters a stored snapshot row's `snapshot_payload.items` down to
 * `visibleKpiIds` and recomputes `statusCounts` from ONLY the filtered set
 * (AC #3 — a counter must never be able to imply the existence of an item
 * the reader cannot see). Returns a new row object; never mutates `row` and
 * never touches `row.content_hash`. */
function redactSnapshotPayloadForReader(
  row: KpiScorecardReviewSnapshotRow,
  visibleKpiIds: Set<string>
): KpiScorecardReviewSnapshotRow {
  if (!row.snapshot_payload) return row;
  const filteredItems: ScorecardSnapshotItemFact[] = row.snapshot_payload.items.filter((item) =>
    visibleKpiIds.has(item.kpiId)
  );
  const filteredCounts: ScorecardStatusCounts = { safe: 0, warning: 0, critical: 0, missing: 0 };
  for (const item of filteredItems) {
    if (item.performanceStatus === 'on_target') filteredCounts.safe += 1;
    else if (item.performanceStatus === 'warning') filteredCounts.warning += 1;
    else if (item.performanceStatus === 'critical') filteredCounts.critical += 1;
    else filteredCounts.missing += 1;
  }
  return { ...row, snapshot_payload: { items: filteredItems, statusCounts: filteredCounts } };
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
    SELECT sc.*,
           NULLIF(TRIM(CONCAT_WS(' ', owner.first_name, owner.last_name)), '') AS owner_name
      FROM rvn_kpi_scorecards sc
      LEFT JOIN users owner ON owner.id = sc.owner_user_id AND owner.organization_id = sc.organization_id
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
  /**
   * P7K — pozycja raportu niesie teraz PEŁNY KONTRAKT MIERNIKA (SSOT §2):
   * obszar i właściciel nadrzędny z kolumn pozycji (z fallbackiem na zapis
   * seeda w `display_config`, patrz `toKpiScorecardItem`), a jednostka,
   * kierunek, częstotliwość, definicja, metoda liczenia i ODPOWIEDZIALNY —
   * z bieżącej wersji definicji, JOINEM. Bez tego joinu poziom 2 musiałby
   * wystrzelić 138 osobnych zapytań o wersję, po jednym na miernik.
   *
   * `kpi_owner_name` idzie z `users`, nie jako UUID — kanon „nazwiska, nie
   * identyfikatory". Gdy join nie trafi, front pokazuje „Nieznany
   * użytkownik" przez `memberNameOrUnknown`, nigdy surowy identyfikator.
   */
  const baseQuerySql = `
    SELECT si.*,
           dv.name AS kpi_name,
           dv.unit AS kpi_unit,
           dv.target_geometry AS kpi_target_geometry,
           dv.measurement_frequency_days AS kpi_measurement_frequency_days,
           dv.description AS kpi_description,
           dv.formula_text AS kpi_formula_text,
           kd.owner_user_id AS kpi_owner_user_id,
           NULLIF(TRIM(CONCAT_WS(' ', kpi_owner.first_name, kpi_owner.last_name)), '') AS kpi_owner_name,
           NULLIF(TRIM(CONCAT_WS(' ', added.first_name, added.last_name)), '') AS added_by_name
      FROM rvn_kpi_scorecard_items si
      LEFT JOIN rvn_kpi_definitions kd
             ON kd.kpi_id = si.kpi_id AND kd.organization_id = si.organization_id
      LEFT JOIN rvn_kpi_definition_versions dv
             ON dv.definition_version_id = kd.current_definition_version_id
            AND dv.organization_id = kd.organization_id
      LEFT JOIN users kpi_owner ON kpi_owner.id = kd.owner_user_id AND kpi_owner.organization_id = si.organization_id
      LEFT JOIN users added ON added.id = si.added_by AND added.organization_id = si.organization_id
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

export interface ScorecardAreaStatusDistribution extends ScorecardStatusCounts {
  /** `null` = pozycja bez zadeklarowanego obszaru („Bez obszaru" w UI). */
  areaName: string | null;
  totalVisible: number;
}

export interface ScorecardStatusDistribution extends ScorecardStatusCounts {
  totalVisible: number;
  /** Otwarte karty działania w całym raporcie (SSOT §6, kolumna L1). */
  openDeviationCases: number;
  /** Rozkład stanu per OBSZAR — podgląd raportu KPI (SSOT §6 / paczka §14). */
  byArea: ScorecardAreaStatusDistribution[];
}

export async function getScorecardStatusDistribution(
  params: GetScorecardStatusDistributionParams
): Promise<ScorecardStatusDistribution> {
  const { userId, organizationId, scorecardId, asOf } = params;
  const asOfTimestamp = asOf ?? new Date().toISOString();
  /**
   * P7K — do rozkładu dochodzą DWIE rzeczy, obie potrzebne na poziomie 1
   * (SSOT §6: kolumna OTWARTE DZIAŁANIA; podgląd raportu KPI ma „rozkład
   * stanu PER OBSZAR"):
   *   · `open_deviation_cases` — liczba otwartych kart działania w raporcie,
   *   · `by_area` — ten sam rozkład w rozbiciu na obszary.
   * Obie liczone w TYM SAMYM zapytaniu i za TYM SAMYM filtrem widoczności,
   * żeby poziom 1 nie musiał ściągać całej matrycy okresów tylko po to, by
   * narysować podgląd.
   *
   * `by_area` bierze obszar tak samo jak `toKpiScorecardItem`: kolumna
   * `area_name`, a gdy pusta — zapis seeda w `display_config->>'obszar'`.
   * Pozycja bez obszaru trafia do klucza NULL i UI opisuje ją „Bez obszaru",
   * zamiast być cicho doliczona do cudzej grupy.
   */
  const baseQuerySql = `
    , scoped_items AS (
      SELECT si.kpi_id,
             COALESCE(si.area_name, NULLIF(TRIM(si.display_config->>'obszar'), '')) AS area_name,
             latest.performance_status,
             (
               SELECT COUNT(*) FROM rvn_kpi_deviation_cases dc
                WHERE dc.kpi_id = si.kpi_id
                  AND dc.organization_id = si.organization_id
                  AND dc.status <> 'closed'
             ) AS open_cases
        FROM rvn_kpi_scorecard_items si
        INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id::text
        LEFT JOIN LATERAL (
          SELECT m.performance_status FROM rvn_kpi_measurements m
           WHERE m.kpi_id = si.kpi_id AND m.period_end <= $${VISIBILITY_CTE_PARAM_COUNT + 2}
             AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
           ORDER BY m.period_end DESC, m.recorded_at DESC LIMIT 1
        ) latest ON true
       WHERE si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1} AND si.organization_id = $1
    )
    SELECT
        COUNT(*) FILTER (WHERE performance_status = 'on_target') AS safe_count,
        COUNT(*) FILTER (WHERE performance_status = 'warning')   AS warning_count,
        COUNT(*) FILTER (WHERE performance_status = 'critical')  AS critical_count,
        COUNT(*) FILTER (WHERE performance_status IS NULL OR performance_status = 'neutral') AS missing_count,
        COUNT(*) AS total_count,
        COALESCE(SUM(open_cases), 0) AS open_deviation_cases,
        COALESCE(
          (
            SELECT json_agg(area ORDER BY area.area_name NULLS LAST)
              FROM (
                SELECT area_name,
                       COUNT(*) FILTER (WHERE performance_status = 'on_target') AS safe,
                       COUNT(*) FILTER (WHERE performance_status = 'warning')   AS warning,
                       COUNT(*) FILTER (WHERE performance_status = 'critical')  AS critical,
                       COUNT(*) FILTER (WHERE performance_status IS NULL OR performance_status = 'neutral') AS missing,
                       COUNT(*) AS total
                  FROM scoped_items
                 GROUP BY area_name
              ) area
          ),
          '[]'::json
        ) AS by_area
      FROM scoped_items`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi' });
  const values = [...wrapped.values, scorecardId, asOfTimestamp];
  const rows = await withReadClient((c) =>
    queryRows<{
      safe_count: string;
      warning_count: string;
      critical_count: string;
      missing_count: string;
      total_count: string;
      open_deviation_cases: string;
      by_area:
        | {
            area_name: string | null;
            safe: string | number;
            warning: string | number;
            critical: string | number;
            missing: string | number;
            total: string | number;
          }[]
        | null;
    }>(c, wrapped.sql, values)
  );
  const row = rows[0];
  if (!row)
    return {
      safe: 0,
      warning: 0,
      critical: 0,
      missing: 0,
      totalVisible: 0,
      openDeviationCases: 0,
      byArea: [],
    };
  return {
    safe: Number(row.safe_count),
    warning: Number(row.warning_count),
    critical: Number(row.critical_count),
    missing: Number(row.missing_count),
    totalVisible: Number(row.total_count),
    openDeviationCases: Number(row.open_deviation_cases),
    byArea: (row.by_area ?? []).map((area) => ({
      areaName: area.area_name,
      safe: Number(area.safe),
      warning: Number(area.warning),
      critical: Number(area.critical),
      missing: Number(area.missing),
      totalVisible: Number(area.total),
    })),
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
    SELECT rs.*,
           NULLIF(TRIM(CONCAT_WS(' ', creator.first_name, creator.last_name)), '') AS created_by_name,
           NULLIF(TRIM(CONCAT_WS(' ', publisher.first_name, publisher.last_name)), '') AS published_by_name
      FROM rvn_kpi_scorecard_review_snapshots rs
      LEFT JOIN users creator ON creator.id = rs.created_by AND creator.organization_id = rs.organization_id
      LEFT JOIN users publisher ON publisher.id = rs.published_by AND publisher.organization_id = rs.organization_id
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
  // separately never to change) is never touched. Shared with
  // `listReviewSnapshots` below via `resolveVisibleKpiIdSet`/
  // `redactSnapshotPayloadForReader` — ONE mechanism, not two.
  const visibleKpiIds = await withReadClient((c) => resolveVisibleKpiIdSet(c, { userId, organizationId }));
  return toKpiScorecardReviewSnapshot(redactSnapshotPayloadForReader(row, visibleKpiIds));
}

// ==========================================
// listReviewSnapshots — history, summary rows.
//
// P0-C (OQ-UI-B, closed): this function USED TO return each row's
// `snapshot_payload` exactly as stored, on the theory that decision #6b's
// redaction only applied to `getPublishedSnapshot`'s single-row detail read.
// That theory was wrong / incomplete — the whole reason UI-side code
// (`kpiScorecardPresenters.tsx`'s own header, pre-P0-C) had to declare "we
// simply never render `.snapshotPayload` from ANY response" as a permanent
// workaround: any `status='published'` or `'superseded'` row returned here
// carries the SAME materialized `snapshot_payload` (item facts +
// statusCounts) `getPublishedSnapshot` filters, and a reader who lost access
// to a KPI after publish (or never had it) would see it verbatim through
// this endpoint even though `getPublishedSnapshot` correctly hides it. Fixed
// by applying the exact same `resolveVisibleKpiIdSet`/
// `redactSnapshotPayloadForReader` mechanism `getPublishedSnapshot` uses —
// ONE shared redaction, not a second divergent one — computed ONCE per call
// (not once per row) since every row in a single `listReviewSnapshots`
// response is read by the same caller. Draft rows have `snapshot_payload =
// NULL` (materialized only at publish, `kpiScorecardCommands.ts`'s
// `createReviewSnapshot` header) so redaction is a no-op for them.
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
    SELECT rs.*,
           NULLIF(TRIM(CONCAT_WS(' ', creator.first_name, creator.last_name)), '') AS created_by_name,
           NULLIF(TRIM(CONCAT_WS(' ', publisher.first_name, publisher.last_name)), '') AS published_by_name
      FROM rvn_kpi_scorecard_review_snapshots rs
      LEFT JOIN users creator ON creator.id = rs.created_by AND creator.organization_id = rs.organization_id
      LEFT JOIN users publisher ON publisher.id = rs.published_by AND publisher.organization_id = rs.organization_id
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
  if (rows.length === 0) return [];

  // Only pay for the extra visibility-CTE round trip when at least one row
  // actually carries a materialized payload to redact (draft rows never
  // do). Computed ONCE for the whole page, same reader for every row.
  const hasAnyPayload = rows.some((r) => r.snapshot_payload !== null);
  if (!hasAnyPayload) return rows.map(toKpiScorecardReviewSnapshot);

  const visibleKpiIds = await withReadClient((c) => resolveVisibleKpiIdSet(c, { userId, organizationId }));
  return rows.map((row) => toKpiScorecardReviewSnapshot(redactSnapshotPayloadForReader(row, visibleKpiIds)));
}

// ==========================================
// P7K — getScorecardPeriodMatrix
//
// Poziom 2 raportu KPI (SSOT §6): dla KAŻDEGO miernika raportu para
// CEL / Rezultat w każdym okresie roku, YTD, stan ostatniego okresu i liczba
// otwartych kart działania.
//
// Widoczność: dokładnie ta sama reguła co `listScorecardItems` i
// `getScorecardStatusDistribution` (AC #4) — filtr po `resource_type = 'kpi'`
// NA POZYCJI, przed jakąkolwiek agregacją. Widoczność raportu NIE implikuje
// widoczności miernika, więc czytelnik bez dostępu do miernika nie zobaczy
// ani jego komórek, ani jego wkładu w YTD.
//
// Dwa zapytania zamiast N+1: jedno po pomiarach wszystkich mierników raportu
// w zakresie roku, drugie po liczbie otwartych spraw odchylenia. Przy 138
// miernikach ścieżka „po jednym GET na miernik" oznaczałaby 138 przelotów.
// ==========================================

export interface GetScorecardPeriodMatrixParams {
  userId: string;
  organizationId: string;
  scorecardId: string;
  /** Rok raportu. Domyślnie rok bieżący. */
  year: number;
  /** Ziarno okresu; domyślnie wyprowadzone z `review_frequency` raportu. */
  granularity: 'month' | 'quarter' | 'year';
  /** „Teraz" dla wyznaczenia okresu bieżącego — wstrzykiwalne dla testów. */
  now?: Date;
}

interface PeriodMeasurementRow {
  kpi_id: string;
  item_id: string;
  unit: string | null;
  measurement_id: string | null;
  period_start: string | null;
  period_end: string | null;
  actual_value: string | number | null;
  period_target_value: string | number | null;
  evidence_refs: unknown;
  performance_status: KpiPerformanceStatus | null;
  data_quality_status: string | null;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Siatka okresów roku. Generowana z ziarna, a NIE z tego, co akurat jest
 * w pomiarach: miesiąc bez pomiaru ma istnieć jako kolumna z „—" (SSOT:
 * „brak danych = »—«, nigdy 0"), a nie znikać z raportu.
 */
export function buildScorecardPeriodGrid(
  year: number,
  granularity: 'month' | 'quarter' | 'year',
  now: Date
): ScorecardPeriodDefinition[] {
  const inRange = (start: Date, end: Date): boolean => now >= start && now <= end;
  if (granularity === 'year') {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return [
      {
        key: String(year),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        isCurrent: inRange(start, end),
      },
    ];
  }
  if (granularity === 'quarter') {
    return [0, 1, 2, 3].map((q) => {
      const start = new Date(Date.UTC(year, q * 3, 1));
      const end = new Date(Date.UTC(year, q * 3 + 3, 0, 23, 59, 59, 999));
      return {
        key: `${year}-Q${q + 1}`,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        isCurrent: inRange(start, end),
      };
    });
  }
  return Array.from({ length: 12 }, (_unused, month) => {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    return {
      key: `${year}-${pad2(month + 1)}`,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      isCurrent: inRange(start, end),
    };
  });
}

/** Klucz siatki dla daty początku pomiaru — po nim wpadamy do właściwej kolumny. */
function periodKeyFor(
  isoDate: string,
  granularity: 'month' | 'quarter' | 'year'
): string | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (granularity === 'year') return String(year);
  if (granularity === 'quarter') return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  return `${year}-${pad2(date.getUTCMonth() + 1)}`;
}

function numeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * CEL okresu: kolumna `period_target_value` (migracja
 * `20261124_rvn_kpi_report_contract_fields.sql`), a gdy jest pusta — zapis
 * seeda DBR77 w `evidence_refs` (`{"kind":"seed_period_target"}`). Kolumna
 * zawsze wygrywa. Żadnego innego źródła NIE podstawiamy: roczny
 * `target_value` wersji definicji to cel ROKU, nie cel miesiąca, i wpisanie
 * go w komórkę miesiąca byłoby wymyśloną liczbą.
 */
export function resolvePeriodTarget(
  columnValue: string | number | null | undefined,
  evidenceRefs: unknown
): number | null {
  const fromColumn = numeric(columnValue);
  if (fromColumn !== null) return fromColumn;
  if (!Array.isArray(evidenceRefs)) return null;
  for (const ref of evidenceRefs) {
    if (!ref || typeof ref !== 'object') continue;
    const entry = ref as { kind?: unknown; targetValue?: unknown };
    if (entry.kind !== 'seed_period_target') continue;
    const parsed = numeric(entry.targetValue as string | number | null);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Reguła agregacji YTD wyprowadzana z JEDNOSTKI, nie z oka:
 *  · `%` (i inne jednostki udziału) — okresy się UŚREDNIAJĄ; suma dwunastu
 *    procentów nie jest wielkością, którą ktokolwiek chciałby zobaczyć;
 *  · pozostałe jednostki (sztuki, złote, godziny, LC/1000…) — SUMUJĄ się;
 *  · brak jednostki — reguły nie da się wyprowadzić, więc YTD zostaje puste.
 *    To jest świadome „nie wiem" zamiast liczby wziętej z sufitu.
 */
export function resolveYtdAggregation(unit: string | null): 'sum' | 'average' | 'unknown' {
  if (unit === null) return 'unknown';
  const normalized = unit.trim().toLowerCase();
  if (normalized === '') return 'unknown';
  if (normalized === '%' || normalized === 'proc.' || normalized === 'procent') return 'average';
  return 'sum';
}

export async function getScorecardPeriodMatrix(
  params: GetScorecardPeriodMatrixParams
): Promise<ScorecardPeriodMatrix> {
  const { userId, organizationId, scorecardId, year, granularity } = params;
  const now = params.now ?? new Date();
  const periods = buildScorecardPeriodGrid(year, granularity, now);
  const rangeStart = periods[0]?.periodStart ?? new Date(Date.UTC(year, 0, 1)).toISOString();
  const rangeEnd =
    periods[periods.length - 1]?.periodEnd ??
    new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();

  const measurementSql = `
    SELECT si.kpi_id,
           si.item_id,
           dv.unit,
           m.measurement_id,
           m.period_start,
           m.period_end,
           m.actual_value,
           m.period_target_value,
           m.evidence_refs,
           m.performance_status,
           m.data_quality_status
      FROM rvn_kpi_scorecard_items si
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id::text
      LEFT JOIN rvn_kpi_definitions kd
             ON kd.kpi_id = si.kpi_id AND kd.organization_id = si.organization_id
      LEFT JOIN rvn_kpi_definition_versions dv
             ON dv.definition_version_id = kd.current_definition_version_id
            AND dv.organization_id = kd.organization_id
      LEFT JOIN rvn_kpi_measurements m
             ON m.kpi_id = si.kpi_id
            AND m.organization_id = si.organization_id
            AND m.period_start >= $${VISIBILITY_CTE_PARAM_COUNT + 2}
            AND m.period_start <= $${VISIBILITY_CTE_PARAM_COUNT + 3}
            AND NOT EXISTS (
              SELECT 1 FROM rvn_kpi_measurements newer
               WHERE newer.correction_of_measurement_id = m.measurement_id
            )
     WHERE si.organization_id = $1 AND si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY si.sort_order ASC, m.period_start ASC, m.recorded_at ASC`;
  const wrappedMeasurements = await wrapWithVisibilityScope(measurementSql, {
    userId,
    organizationId,
    resourceType: 'kpi',
  });
  const measurementRows = await withReadClient((c) =>
    queryRows<PeriodMeasurementRow>(c, wrappedMeasurements.sql, [
      ...wrappedMeasurements.values,
      scorecardId,
      rangeStart,
      rangeEnd,
    ])
  );

  // Otwarte karty działania (sprawy odchylenia) — `closed` jest jedynym
  // stanem zamkniętym w cyklu życia sprawy (20260811_rvn_kpi_deviation_loop).
  const deviationSql = `
    SELECT si.kpi_id, COUNT(dc.case_id) AS open_count
      FROM rvn_kpi_scorecard_items si
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id::text
      LEFT JOIN rvn_kpi_deviation_cases dc
             ON dc.kpi_id = si.kpi_id
            AND dc.organization_id = si.organization_id
            AND dc.status <> 'closed'
     WHERE si.organization_id = $1 AND si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     GROUP BY si.kpi_id`;
  const wrappedDeviations = await wrapWithVisibilityScope(deviationSql, {
    userId,
    organizationId,
    resourceType: 'kpi',
  });
  const deviationRows = await withReadClient((c) =>
    queryRows<{ kpi_id: string; open_count: string }>(c, wrappedDeviations.sql, [
      ...wrappedDeviations.values,
      scorecardId,
    ])
  );
  const openCases = new Map(deviationRows.map((r) => [r.kpi_id, Number(r.open_count)]));

  const byItem = new Map<string, { kpiId: string; itemId: string; unit: string | null; rows: PeriodMeasurementRow[] }>();
  for (const row of measurementRows) {
    const bucket = byItem.get(row.item_id);
    if (bucket) bucket.rows.push(row);
    else byItem.set(row.item_id, { kpiId: row.kpi_id, itemId: row.item_id, unit: row.unit, rows: [row] });
  }

  const items: ScorecardPeriodMatrixItem[] = [...byItem.values()].map((bucket) => {
    const cellByKey = new Map<string, ScorecardPeriodCell>();
    for (const row of bucket.rows) {
      if (!row.measurement_id || !row.period_start) continue;
      const key = periodKeyFor(row.period_start, granularity);
      if (!key) continue;
      // Ostatni wpis okresu wygrywa — zapytanie sortuje po `recorded_at`,
      // a korekty pomiaru są odfiltrowane po stronie SQL.
      cellByKey.set(key, {
        periodKey: key,
        measurementId: row.measurement_id,
        targetValue: resolvePeriodTarget(row.period_target_value, row.evidence_refs),
        actualValue: numeric(row.actual_value),
        performanceStatus: row.performance_status,
        dataQualityStatus: row.data_quality_status,
      });
    }

    const cells = periods.map(
      (period) =>
        cellByKey.get(period.key) ?? {
          periodKey: period.key,
          measurementId: null,
          targetValue: null,
          actualValue: null,
          performanceStatus: null,
          dataQualityStatus: null,
        }
    );

    const aggregation = resolveYtdAggregation(bucket.unit);
    const closedCells = cells.filter(
      (cell, index) => cell.measurementId !== null && new Date(periods[index]!.periodEnd) <= now
    );
    const targets = closedCells.map((c) => c.targetValue).filter((v): v is number => v !== null);
    const actuals = closedCells.map((c) => c.actualValue).filter((v): v is number => v !== null);
    const aggregate = (values: number[]): number | null => {
      if (aggregation === 'unknown' || values.length === 0) return null;
      const sum = values.reduce((total, value) => total + value, 0);
      const result = aggregation === 'average' ? sum / values.length : sum;
      return Math.round(result * 100) / 100;
    };

    const latest = [...closedCells].reverse().find((cell) => cell.performanceStatus !== null);

    return {
      kpiId: bucket.kpiId,
      itemId: bucket.itemId,
      cells,
      ytdTargetValue: aggregate(targets),
      ytdActualValue: aggregate(actuals),
      /* Stan YTD celowo NIE jest liczony w repozytorium: wymaga kierunku
         miernika i dopuszczalnego limitu [%] z kontraktu POZYCJI raportu.
         Składa go warstwa, która ma oba (`resultsVnext/kpi` — patrz
         `evaluateAgainstPeriodTarget`), żeby nie było dwóch prawd o stanie. */
      ytdPerformanceStatus: null,
      ytdAggregation: aggregation,
      latestPerformanceStatus: latest?.performanceStatus ?? null,
      openDeviationCaseCount: openCases.get(bucket.kpiId) ?? 0,
    };
  });

  return { scorecardId, year, granularity, periods, items };
}
