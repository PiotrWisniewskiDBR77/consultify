/**
 * M16 / 2.6 + 2.8 — Benefit Profile Service.
 *
 * 2.6 Benefit Profile S-curve: per-period planned vs actual cumulative benefit
 *     realization points, persisted in `benefit_profile_points` (org-scoped),
 *     plus a pure `buildSCurve` that turns those points into plan/actual lines
 *     and a slip figure (plan − actual at the latest period).
 *
 * 2.8 Category Taxonomy: `isReconciliationEligible` decides whether a benefit
 *     may flow into finance reconciliation / banking. Only HARD + RUN_RATE
 *     benefits are eligible — soft or one-time benefits are excluded.
 *
 * DB access goes through DbPromise (sqlite/postgres-agnostic). The curve math
 * and the eligibility check are pure functions so they unit-test without a DB.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const LOG_PREFIX = '[BenefitProfile]';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BenefitHardness = 'hard' | 'soft';
export type BenefitValueType =
  | 'cost_out'
  | 'revenue_up'
  | 'working_capital'
  | 'cost_avoidance';
export type BenefitRecurrence = 'run_rate' | 'one_time';

/** A single S-curve sample for a benefit/initiative at a given period. */
export interface BenefitProfilePoint {
  id: string;
  organizationId: string;
  initiativeId: string;
  benefitId: string | null;
  period: string;
  plannedCumulative: number | null;
  actualCumulative: number | null;
  createdAt: string;
}

/** Input to upsert a profile point (id/createdAt are generated if absent). */
export interface UpsertProfilePointInput {
  id?: string;
  initiativeId: string;
  benefitId?: string | null;
  period: string;
  plannedCumulative?: number | null;
  actualCumulative?: number | null;
}

/** Output of buildSCurve — plan/actual lines + slip at the latest period. */
export interface SCurve {
  plan: Array<{ t: string; cum: number }>;
  actual: Array<{ t: string; cum: number }>;
  slipAtLatest: number;
}

/** Minimal benefit shape needed to judge reconciliation eligibility. */
export interface BenefitTaxonomyView {
  hardness?: BenefitHardness | string | null;
  recurrence?: BenefitRecurrence | string | null;
}

interface ProfilePointRow {
  id: string;
  organization_id: string;
  initiative_id: string;
  benefit_id: string | null;
  period: string;
  planned_cumulative: number | string | null;
  actual_cumulative: number | string | null;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Pure: S-curve construction
// ---------------------------------------------------------------------------

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a plan-vs-actual S-curve from a set of profile points.
 *
 * Points are sorted by period (lexicographically, which is correct for
 * ISO-ish period labels like `2026-01`, `2026-Q1`, `2026`). The plan and
 * actual lines each carry only the points that have a cumulative value.
 *
 * `slipAtLatest` = planned − actual at the latest period that has BOTH a
 * planned and an actual value. Positive slip = behind plan (realized less
 * than planned); negative = ahead of plan. If no period has both, slip is 0.
 *
 * Pure: no DB, no side effects.
 */
export function buildSCurve(points: BenefitProfilePoint[]): SCurve {
  const sorted = [...points].sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0
  );

  const plan: Array<{ t: string; cum: number }> = [];
  const actual: Array<{ t: string; cum: number }> = [];

  for (const p of sorted) {
    const planned = toNum(p.plannedCumulative);
    const act = toNum(p.actualCumulative);
    if (planned !== null) plan.push({ t: p.period, cum: planned });
    if (act !== null) actual.push({ t: p.period, cum: act });
  }

  // Slip at the latest period that has both a planned and an actual value.
  let slipAtLatest = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const planned = toNum(sorted[i].plannedCumulative);
    const act = toNum(sorted[i].actualCumulative);
    if (planned !== null && act !== null) {
      slipAtLatest = planned - act;
      break;
    }
  }

  return { plan, actual, slipAtLatest };
}

// ---------------------------------------------------------------------------
// Pure: reconciliation eligibility (taxonomy gate)
// ---------------------------------------------------------------------------

/**
 * A benefit may enter finance reconciliation / banking only when it is HARD
 * and recurs at RUN_RATE. Soft benefits and one-time benefits are excluded.
 *
 * Pure: no DB, no side effects.
 */
export function isReconciliationEligible(benefit: BenefitTaxonomyView): boolean {
  if (!benefit) return false;
  return benefit.hardness === 'hard' && benefit.recurrence === 'run_rate';
}

// ---------------------------------------------------------------------------
// Persistence (org-scoped)
// ---------------------------------------------------------------------------

function rowToPoint(row: ProfilePointRow): BenefitProfilePoint {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    benefitId: row.benefit_id ?? null,
    period: row.period,
    plannedCumulative: toNum(row.planned_cumulative),
    actualCumulative: toNum(row.actual_cumulative),
    createdAt: row.created_at ?? '',
  };
}

/**
 * List all profile points for an initiative, scoped to the organization,
 * ordered by period ascending.
 */
export async function listProfilePoints(
  organizationId: string,
  initiativeId: string
): Promise<BenefitProfilePoint[]> {
  const rows = await dbAll<ProfilePointRow>(
    `SELECT * FROM benefit_profile_points
     WHERE organization_id = ? AND initiative_id = ?
     ORDER BY period ASC`,
    [organizationId, initiativeId],
    { fallback: true }
  );
  return rows.map(rowToPoint);
}

/**
 * Upsert a profile point. Identity is (organization_id, initiative_id,
 * benefit_id, period): if a point already exists for that key its cumulative
 * values are updated, otherwise a new row is inserted. Org-scoped on every
 * write so a caller can never touch another org's data.
 */
export async function upsertProfilePoint(
  organizationId: string,
  data: UpsertProfilePointInput
): Promise<BenefitProfilePoint> {
  const benefitId = data.benefitId ?? null;
  const planned = data.plannedCumulative ?? null;
  const actual = data.actualCumulative ?? null;

  // Match on the natural key (benefit_id may be NULL → use IS NOT DISTINCT-style
  // compare via OR to stay sqlite/postgres-agnostic).
  const existing = await dbAll<ProfilePointRow>(
    `SELECT * FROM benefit_profile_points
     WHERE organization_id = ? AND initiative_id = ? AND period = ?
       AND ((benefit_id IS NULL AND ? IS NULL) OR benefit_id = ?)
     LIMIT 1`,
    [organizationId, data.initiativeId, data.period, benefitId, benefitId],
    { fallback: true }
  );

  if (existing.length > 0) {
    const row = existing[0];
    await dbRun(
      `UPDATE benefit_profile_points
       SET planned_cumulative = ?, actual_cumulative = ?
       WHERE id = ? AND organization_id = ?`,
      [planned, actual, row.id, organizationId]
    );
    logger.info(
      `${LOG_PREFIX} Updated point ${row.id} (org ${organizationId}, ${data.period})`
    );
    return rowToPoint({
      ...row,
      planned_cumulative: planned,
      actual_cumulative: actual,
    });
  }

  const id = data.id || uuidv4();
  const createdAt = new Date().toISOString();
  await dbRun(
    `INSERT INTO benefit_profile_points (
      id, organization_id, initiative_id, benefit_id, period,
      planned_cumulative, actual_cumulative, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      data.initiativeId,
      benefitId,
      data.period,
      planned,
      actual,
      createdAt,
    ]
  );
  logger.info(
    `${LOG_PREFIX} Inserted point ${id} (org ${organizationId}, ${data.period})`
  );

  return {
    id,
    organizationId,
    initiativeId: data.initiativeId,
    benefitId,
    period: data.period,
    plannedCumulative: toNum(planned),
    actualCumulative: toNum(actual),
    createdAt,
  };
}
