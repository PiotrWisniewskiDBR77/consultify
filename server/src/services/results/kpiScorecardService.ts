/**
 * kpiScorecardService — RES-10 canonical Results scorecard owner.
 *
 * A "scorecard" groups existing `initiative_kpis` rows into a named card
 * (department × period). Per Piotr's spec (see the KARTY KPI / D-04 comment
 * on the routes that consume this service): an organization has MANY cards —
 * different departments, different periods (styczeń/luty/marzec) — and the
 * same KPI can sit on more than one card (e.g. margin appears on both the
 * Finance card and the Board card), hence a join table (`kpi_scorecard_items`)
 * rather than a column on `initiative_kpis`.
 *
 * `kpi_scorecards` is the canonical scorecard object; `kpi_scorecard_items` is
 * the many-to-many join to `initiative_kpis`. This module is the ONLY writer
 * for both tables — `v8/results.routes.ts` delegates here instead of running
 * its own SQL, mirroring the single-writer canon established by
 * `kpiDefinitionService` (RES-02).
 *
 * OWNERSHIP (RES-10): this is the Results-owned scorecard contract, distinct
 * from Initiatives' `goals` table (`initiativeGovernanceService.ts`). Never
 * read/write `goals` / `goal_initiative_links` from here, and the routes that
 * expose this service must never fall back to the Initiatives goals API.
 *
 * SCHEMA OWNER: `server/migrations/20260803_res010_kpi_scorecards.sql` is the
 * ONLY place these two tables are created (additive migration, FK/unique/
 * indexes, organization_id NOT NULL on both). This module does NOT create or
 * alter schema in the request path — no lazy DDL, no CREATE/ALTER/DROP here.
 * If the migration has not run, every query below rejects with the real
 * Postgres "relation does not exist" error (all calls use `{ fallback: false
 * }`, so DbPromise never swallows that into a silent empty success) — that
 * surfaces as a loud 500, correctly read as an environment/deploy problem,
 * not as "no scorecards yet".
 *
 * PLACEHOLDER STYLE: `?` positional, like every other DbPromise caller in
 * this file's sibling routes (`v8/results.routes.ts`, `resultsStrategic.routes.ts`)
 * — `PostgresDatabase.replacePositionalPlaceholders` rewrites `?` to `$N`
 * before hitting `pg`. Do not mix in literal `$N` here.
 *
 * `initiative_kpis.is_on_target` is INTEGER (0/1), not BOOLEAN — matches the
 * real column added by `565_kpi_time_series_roi_attribution_finance.sql` /
 * `20260719_baseline_gap.sql`. Compare against `1`, never against `true`.
 *
 * FAIL-CLOSED TENANCY: every read and write is scoped by organizationId in
 * the query itself, never filtered in JS after an unscoped read.
 * `kpi_scorecard_items` also carries its OWN `organization_id` column
 * (redundant with the scorecard/kpi it joins) so that a future query written
 * directly against it cannot repeat the class of leak the RES-10 tenant-leak
 * postmortem found in `goal_initiative_links` — that join table has no
 * organization_id at all, which is exactly what let an unscoped read leak
 * cross-tenant rows. Belt-and-suspenders here: the join columns are also
 * always validated against the caller's org before a write.
 *
 * VISIBILITY (RES-11): `listScorecards`/`getScorecardKpis` apply
 * `kpiVisibilitySql` to the `initiative_kpis` join — a card's kpi_count/
 * on_target_count and its KPI list only ever include KPIs the viewer may
 * see. The visibility predicate lives in the JOIN's ON clause (not a
 * trailing WHERE) so an invisible KPI makes the joined row NULL and is
 * excluded from COUNT(k.id) too, not just hidden from the returned list —
 * no double standard between "shown" and "counted".
 */
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { type KpiVisibilityContext, kpiVisibilitySql } from './kpiVisibilityService.js';

export const RESULTS_SCORECARD_OWNER_DOMAIN = 'results' as const;

export interface KpiScorecardRow {
  id: string;
  organizationId: string;
  name: string;
  department: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  kpiCount: number;
  onTargetCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KpiScorecardItemRow {
  id: string;
  name: string;
  baselineValue: number | null;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  direction: string | null;
  progressPercentage: number | null;
  isOnTarget: boolean | null;
  category: string | null;
  initiativeId: string | null;
  sortOrder: number;
}

function toScorecardRow(r: any): KpiScorecardRow {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    department: r.department ?? null,
    periodLabel: r.period_label ?? null,
    periodStart: r.period_start ?? null,
    periodEnd: r.period_end ?? null,
    status: r.status || 'active',
    kpiCount: Number(r.kpi_count ?? 0),
    onTargetCount: Number(r.on_target_count ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function scorecardCountsSql(visibility: { sql: string; params: unknown[] }): string {
  return `
  SELECT COUNT(k.id) AS kpi_count,
         COUNT(*) FILTER (WHERE COALESCE(k.is_on_target, 0) = 1) AS on_target_count
    FROM kpi_scorecard_items i
    LEFT JOIN initiative_kpis k
      ON k.id = i.kpi_id AND k.organization_id = i.organization_id AND ${visibility.sql}
   WHERE i.scorecard_id = ? AND i.organization_id = ?
`;
}

/**
 * All scorecards for the org, with KPI/on-target counts. Fail-closed:
 * org-scoped in the query; counts exclude KPIs the viewer cannot see.
 */
export async function listScorecards(
  organizationId: string,
  viewer: KpiVisibilityContext
): Promise<KpiScorecardRow[]> {
  const visibility = kpiVisibilitySql('k', viewer);
  const rows = await dbAll<any>(
    `SELECT s.id, s.organization_id, s.name, s.department, s.period_label, s.period_start,
            s.period_end, s.status, s.created_at, s.updated_at,
            COUNT(k.id) AS kpi_count,
            COUNT(*) FILTER (WHERE COALESCE(k.is_on_target, 0) = 1) AS on_target_count
       FROM kpi_scorecards s
       LEFT JOIN kpi_scorecard_items i ON i.scorecard_id = s.id AND i.organization_id = s.organization_id
       LEFT JOIN initiative_kpis k
         ON k.id = i.kpi_id AND k.organization_id = s.organization_id AND ${visibility.sql}
      WHERE s.organization_id = ?
      GROUP BY s.id, s.organization_id, s.name, s.department, s.period_label, s.period_start,
               s.period_end, s.status, s.created_at, s.updated_at
      ORDER BY s.department NULLS LAST, s.period_start DESC NULLS LAST`,
    [...visibility.params, organizationId],
    { fallback: false }
  );
  return (rows || []).map(toScorecardRow);
}

/** Ownership lookup: null if the scorecard doesn't exist OR belongs to another org. */
export async function getScorecard(
  organizationId: string,
  scorecardId: string
): Promise<{ id: string; name: string } | null> {
  const row = await dbGet<{ id: string; name: string }>(
    `SELECT id, name FROM kpi_scorecards WHERE id = ? AND organization_id = ?`,
    [scorecardId, organizationId],
    { fallback: false }
  );
  return row ?? null;
}

/**
 * KPIs on one card. Fail-closed: the ownership lookup (getScorecard) MUST run
 * first and short-circuit on null — same guard shape as
 * initiativeGovernanceService.getGoalRollup post RES-10 tenant-leak fix.
 * Visibility (RES-11): the JOIN itself excludes KPIs the viewer cannot see —
 * a hidden KPI never appears in the list, not even as a placeholder row.
 */
export async function getScorecardKpis(
  organizationId: string,
  scorecardId: string,
  viewer: KpiVisibilityContext
): Promise<{ scorecard: { id: string; name: string }; kpis: KpiScorecardItemRow[] } | null> {
  const card = await getScorecard(organizationId, scorecardId);
  if (!card) return null;

  const visibility = kpiVisibilitySql('k', viewer);
  const rows = await dbAll<any>(
    `SELECT k.id, k.name, k.baseline_value, k.current_value, k.target_value, k.unit,
            k.direction, k.progress_percentage, k.is_on_target, k.category, k.initiative_id,
            i.sort_order
       FROM kpi_scorecard_items i
       JOIN initiative_kpis k
         ON k.id = i.kpi_id AND k.organization_id = i.organization_id AND ${visibility.sql}
      WHERE i.scorecard_id = ? AND i.organization_id = ?
      ORDER BY i.sort_order ASC, k.name ASC`,
    [...visibility.params, scorecardId, organizationId],
    { fallback: false }
  );

  return {
    scorecard: card,
    kpis: (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      baselineValue: r.baseline_value,
      currentValue: r.current_value,
      targetValue: r.target_value,
      unit: r.unit,
      direction: r.direction,
      progressPercentage: r.progress_percentage,
      isOnTarget: r.is_on_target == null ? null : Number(r.is_on_target) === 1,
      category: r.category,
      initiativeId: r.initiative_id,
      sortOrder: Number(r.sort_order ?? 0),
    })),
  };
}

export interface CreateScorecardInput {
  name: string;
  department?: string | null;
  periodLabel?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdBy?: string | null;
}

export async function createScorecard(
  organizationId: string,
  data: CreateScorecardInput
): Promise<KpiScorecardRow> {
  const rows = await dbAll<any>(
    `INSERT INTO kpi_scorecards
       (organization_id, name, department, period_label, period_start, period_end, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id, organization_id, name, department, period_label, period_start, period_end,
               status, created_at, updated_at`,
    [
      organizationId,
      data.name,
      data.department ?? null,
      data.periodLabel ?? null,
      data.periodStart ?? null,
      data.periodEnd ?? null,
      data.createdBy ?? null,
    ],
    { fallback: false }
  );
  return toScorecardRow({ ...rows[0], kpi_count: 0, on_target_count: 0 });
}

export interface UpdateScorecardInput {
  name?: string;
  department?: string | null;
  periodLabel?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: string;
}

const UPDATABLE_SCORECARD_COLUMNS: Record<keyof UpdateScorecardInput, string> = {
  name: 'name',
  department: 'department',
  periodLabel: 'period_label',
  periodStart: 'period_start',
  periodEnd: 'period_end',
  status: 'status',
};

/** Returns null if the scorecard doesn't exist in this org (fail-closed, no cross-tenant write). */
export async function updateScorecard(
  organizationId: string,
  scorecardId: string,
  data: UpdateScorecardInput,
  viewer: KpiVisibilityContext
): Promise<KpiScorecardRow | null> {
  const existing = await getScorecard(organizationId, scorecardId);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(UPDATABLE_SCORECARD_COLUMNS) as Array<keyof UpdateScorecardInput>) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    sets.push(`${UPDATABLE_SCORECARD_COLUMNS[key]} = ?`);
    params.push(data[key] ?? null);
  }
  sets.push('updated_at = now()');

  const rows = await dbAll<any>(
    `UPDATE kpi_scorecards SET ${sets.join(', ')}
      WHERE id = ? AND organization_id = ?
      RETURNING id, organization_id, name, department, period_label, period_start, period_end,
                status, created_at, updated_at`,
    [...params, scorecardId, organizationId],
    { fallback: false }
  );
  if (!rows[0]) return null;

  const visibility = kpiVisibilitySql('k', viewer);
  const counts = await dbGet<{ kpi_count: number; on_target_count: number }>(
    scorecardCountsSql(visibility),
    [...visibility.params, scorecardId, organizationId],
    { fallback: false }
  );
  return toScorecardRow({ ...rows[0], ...(counts || { kpi_count: 0, on_target_count: 0 }) });
}

export class ScorecardKpiNotFoundError extends Error {
  constructor(kpiId: string) {
    super(`KPI ${kpiId} not found in this organization`);
    this.name = 'ScorecardKpiNotFoundError';
  }
}

/**
 * Attaches an existing `initiative_kpis` row to a card. Fail-closed on both
 * sides of the join: the scorecard must belong to the caller's org (checked
 * by the caller via getScorecard) and the KPI must belong to the caller's org
 * (checked here) — a KPI from another org can never be attached, even if its
 * id is guessed.
 */
export async function addKpiToScorecard(
  organizationId: string,
  scorecardId: string,
  kpiId: string,
  sortOrder = 0
): Promise<void> {
  const kpi = await dbGet<{ id: string }>(
    `SELECT id FROM initiative_kpis WHERE id = ? AND organization_id = ?`,
    [kpiId, organizationId],
    { fallback: false }
  );
  if (!kpi?.id) throw new ScorecardKpiNotFoundError(kpiId);

  await dbRun(
    `INSERT INTO kpi_scorecard_items (scorecard_id, organization_id, kpi_id, sort_order)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (scorecard_id, kpi_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
    [scorecardId, organizationId, kpiId, sortOrder],
    { fallback: false }
  );
}

export async function removeKpiFromScorecard(
  organizationId: string,
  scorecardId: string,
  kpiId: string
): Promise<void> {
  await dbRun(
    `DELETE FROM kpi_scorecard_items WHERE scorecard_id = ? AND organization_id = ? AND kpi_id = ?`,
    [scorecardId, organizationId, kpiId],
    { fallback: false }
  );
}
