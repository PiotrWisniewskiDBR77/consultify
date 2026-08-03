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
 * LAZY DDL: tables are provisioned on first hit (`CREATE TABLE IF NOT EXISTS`)
 * rather than through a migration file, mirroring the D10 OKR tables in
 * `resultsStrategic.routes.ts` — this repo's precedent for exactly this
 * situation (staging/demo/prod all provision on first hit, no separate
 * migration deploy to coordinate).
 *
 * PLACEHOLDER STYLE: `?` positional, like every other DbPromise caller in
 * this file's sibling routes (`v8/results.routes.ts`, `resultsStrategic.routes.ts`)
 * — `PostgresDatabase.replacePositionalPlaceholders` rewrites `?` to `$N`
 * before hitting `pg`. Do not mix in literal `$N` here.
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
 */
import { all as dbAll, exec as dbExec, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

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

let scorecardTablesReady = false;

async function ensureScorecardTables(): Promise<void> {
  if (scorecardTablesReady) return;
  await dbExec(`
    CREATE TABLE IF NOT EXISTS kpi_scorecards (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      period_label TEXT,
      period_start DATE,
      period_end DATE,
      status TEXT NOT NULL DEFAULT 'active',
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS kpi_scorecard_items (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      scorecard_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      kpi_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (scorecard_id, kpi_id)
    );
  `);
  scorecardTablesReady = true;
}

/** Test-only: forces the next call to re-run ensureScorecardTables(). */
export function __resetScorecardTablesReadyForTests(): void {
  scorecardTablesReady = false;
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

const SCORECARD_COUNTS_SQL = `
  SELECT COUNT(i.id) AS kpi_count,
         COUNT(*) FILTER (WHERE COALESCE(k.is_on_target, false) = true) AS on_target_count
    FROM kpi_scorecard_items i
    LEFT JOIN initiative_kpis k ON k.id = i.kpi_id AND k.organization_id = i.organization_id
   WHERE i.scorecard_id = ? AND i.organization_id = ?
`;

/** All scorecards for the org, with KPI/on-target counts. Fail-closed: org-scoped in the query. */
export async function listScorecards(organizationId: string): Promise<KpiScorecardRow[]> {
  await ensureScorecardTables();
  const rows = await dbAll<any>(
    `SELECT s.id, s.organization_id, s.name, s.department, s.period_label, s.period_start,
            s.period_end, s.status, s.created_at, s.updated_at,
            COUNT(i.id) AS kpi_count,
            COUNT(*) FILTER (WHERE COALESCE(k.is_on_target, false) = true) AS on_target_count
       FROM kpi_scorecards s
       LEFT JOIN kpi_scorecard_items i ON i.scorecard_id = s.id AND i.organization_id = s.organization_id
       LEFT JOIN initiative_kpis k ON k.id = i.kpi_id AND k.organization_id = s.organization_id
      WHERE s.organization_id = ?
      GROUP BY s.id, s.organization_id, s.name, s.department, s.period_label, s.period_start,
               s.period_end, s.status, s.created_at, s.updated_at
      ORDER BY s.department NULLS LAST, s.period_start DESC NULLS LAST`,
    [organizationId],
    { fallback: false }
  );
  return (rows || []).map(toScorecardRow);
}

/** Ownership lookup: null if the scorecard doesn't exist OR belongs to another org. */
export async function getScorecard(
  organizationId: string,
  scorecardId: string
): Promise<{ id: string; name: string } | null> {
  await ensureScorecardTables();
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
 */
export async function getScorecardKpis(
  organizationId: string,
  scorecardId: string
): Promise<{ scorecard: { id: string; name: string }; kpis: KpiScorecardItemRow[] } | null> {
  await ensureScorecardTables();
  const card = await getScorecard(organizationId, scorecardId);
  if (!card) return null;

  const rows = await dbAll<any>(
    `SELECT k.id, k.name, k.baseline_value, k.current_value, k.target_value, k.unit,
            k.direction, k.progress_percentage, k.is_on_target, k.category, k.initiative_id,
            i.sort_order
       FROM kpi_scorecard_items i
       JOIN initiative_kpis k ON k.id = i.kpi_id AND k.organization_id = i.organization_id
      WHERE i.scorecard_id = ? AND i.organization_id = ?
      ORDER BY i.sort_order ASC, k.name ASC`,
    [scorecardId, organizationId],
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
      isOnTarget: r.is_on_target,
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
  await ensureScorecardTables();
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
  data: UpdateScorecardInput
): Promise<KpiScorecardRow | null> {
  await ensureScorecardTables();
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

  const counts = await dbGet<{ kpi_count: number; on_target_count: number }>(
    SCORECARD_COUNTS_SQL,
    [scorecardId, organizationId],
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
  await ensureScorecardTables();
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
  await ensureScorecardTables();
  await dbRun(
    `DELETE FROM kpi_scorecard_items WHERE scorecard_id = ? AND organization_id = ? AND kpi_id = ?`,
    [scorecardId, organizationId, kpiId],
    { fallback: false }
  );
}
