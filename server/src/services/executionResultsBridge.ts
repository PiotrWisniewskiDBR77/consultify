/**
 * Execution → Results bridge (M14 → M15 feed-forward)
 *
 * Closes the broken spine link found in the Harvard audit (INTEGRACJE.md §C poz.5):
 * Execution computes budget/health but never fed Results. This bridge exports a
 * `budget_health` KPI signal to the Results runtime whenever an initiative's
 * budget summary turns AMBER/RED, attached to KPIs linked to that initiative.
 *
 * Fire-and-forget by design: callers must not block budget writes on this.
 */

import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

import { getInitiativeBudgetSummary } from './executionBudgetService.js';
import { createKpiSignal } from './v8/resultsROIService.js';

const LOG_PREFIX = '[ExecutionResultsBridge]';

/**
 * Source tag written to `initiative_benefits.source_tag` for benefits created by
 * the M14 closure handoff. M15 (Results/Benefits) reads this to distinguish
 * auto-materialized closure benefits from manually-authored ones, and it is the
 * dedup key (see migration 783 partial unique index).
 */
export const CLOSURE_HANDOFF_SOURCE = 'M14_CLOSURE_HANDOFF';

interface PlannedKpiRow {
  id: string;
  name: string;
  unit: string | null;
  target_value: number | null;
  description: string | null;
}

export interface ClosureHandoffResult {
  /** Benefit rows newly inserted this call. */
  created: number;
  /** KPIs skipped because a closure benefit already existed (idempotency). */
  skipped: number;
  /** Planned KPIs considered (had a target_value). */
  considered: number;
}

/**
 * M14 → M15 closure handoff (Decision B1b).
 *
 * When an initiative closes (status → DONE), materialize its planned KPIs
 * (`initiative_kpis`) into the M15-readable benefits register
 * (`initiative_benefits`), tagged `source_tag = 'M14_CLOSURE_HANDOFF'`.
 *
 * Contract:
 * - Source of benefit definitions = the initiative's planned KPIs that carry a
 *   `target_value` (KPIs without a target can't seed a measurable benefit).
 * - Idempotent: a KPI that already has a closure benefit is skipped, so a repeat
 *   DONE — or a DONE → revert → DONE cycle — never produces duplicates. The
 *   partial unique index (migration 783) is the backstop; this pre-check avoids
 *   relying on DB error semantics that differ across sqlite/pg.
 * - No KPIs (or none with a target) → zero benefits, no error.
 *
 * Callers MUST wrap this in try/catch (or use the fire-and-forget wrapper): a
 * handoff failure must never block the initiative status change.
 */
export async function handoffFromClosure(
  organizationId: string,
  initiativeId: string,
  actorId: string | null
): Promise<ClosureHandoffResult> {
  const result: ClosureHandoffResult = { created: 0, skipped: 0, considered: 0 };

  // Planned KPIs for the initiative. `initiative_kpis` is initiative-scoped
  // (FK to initiatives), no organization_id column — mirror the existing
  // controller queries.
  const kpis = (await dbAll<PlannedKpiRow>(
    `SELECT id, name, unit, target_value, description
       FROM initiative_kpis
      WHERE initiative_id = ?
        AND target_value IS NOT NULL`,
    [initiativeId],
    { fallback: true }
  )) as PlannedKpiRow[] | undefined;

  if (!kpis || kpis.length === 0) {
    logger.info(
      `${LOG_PREFIX} closure handoff: initiative ${initiativeId} has no planned KPIs with targets — nothing to hand off`
    );
    return result;
  }

  result.considered = kpis.length;
  const now = new Date().toISOString();

  for (const kpi of kpis) {
    // Dedup: skip if a closure benefit already exists for this KPI.
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM initiative_benefits
        WHERE initiative_id = ? AND kpi_id = ? AND source_tag = ?
        LIMIT 1`,
      [initiativeId, kpi.id, CLOSURE_HANDOFF_SOURCE],
      { fallback: true }
    );
    if (existing) {
      result.skipped += 1;
      continue;
    }

    await dbRun(
      `INSERT INTO initiative_benefits (
         id, initiative_id, organization_id, name, description,
         benefit_type, kpi_id, target_value, status, source_tag,
         created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'quantitative', ?, ?, 'tracking', ?, ?, ?, ?)`,
      [
        randomUUID(),
        initiativeId,
        organizationId,
        kpi.name,
        kpi.description ?? null,
        kpi.id,
        kpi.target_value ?? 0,
        CLOSURE_HANDOFF_SOURCE,
        actorId,
        now,
        now,
      ]
    );
    result.created += 1;
  }

  logger.info(
    `${LOG_PREFIX} closure handoff for initiative ${initiativeId}: ` +
      `created ${result.created}, skipped ${result.skipped} of ${result.considered} planned KPIs`
  );
  return result;
}

/**
 * Export the initiative's budget health to Results as KPI signals.
 *
 * - GREEN → no signal (nothing actionable).
 * - AMBER → 'medium' severity, RED → 'critical'.
 * - Attaches to every KPI linked to the initiative (`v8_kpi_definitions.initiative_id`).
 * - Deduplicates: skips a KPI that already has a pending `budget_health` signal,
 *   so repeated budget writes do not spam the Results queue.
 * - Initiatives without linked KPIs are skipped (the signal table requires a KPI).
 */
export async function exportBudgetHealthToResults(
  organizationId: string,
  initiativeId: string
): Promise<void> {
  const summary = await getInitiativeBudgetSummary(organizationId, initiativeId);
  if (!summary) return;
  if (summary.status === 'GREEN') return;

  const linkedKpis = (await dbAll<{ kpi_id: string; name: string }>(
    `SELECT kpi_id, name FROM v8_kpi_definitions
     WHERE organization_id = ? AND initiative_id = ?`,
    [organizationId, initiativeId],
    { fallback: true }
  )) as Array<{ kpi_id: string; name: string }> | undefined;

  if (!linkedKpis || linkedKpis.length === 0) {
    logger.debug(
      `${LOG_PREFIX} Initiative ${initiativeId} has no linked KPIs — budget_health signal skipped`
    );
    return;
  }

  const severity = summary.status === 'RED' ? 'critical' : 'medium';
  const description =
    `Budget ${summary.status} on initiative "${summary.initiativeName}": ` +
    `actual ${summary.actual.total} / planned ${summary.planned.total} ${summary.currency} ` +
    `(${summary.variance.percent}% of plan, burn rate ${summary.burnRate}%).`;

  for (const kpi of linkedKpis) {
    const existing = await dbGet<{ signal_id: string }>(
      `SELECT signal_id FROM v8_kpi_signals
       WHERE organization_id = ? AND kpi_id = ?
         AND signal_type = 'budget_health' AND next_action_status = 'pending'
       LIMIT 1`,
      [organizationId, kpi.kpi_id],
      { fallback: true }
    );
    if (existing) continue;

    await createKpiSignal({
      organizationId,
      kpiId: kpi.kpi_id,
      signalType: 'budget_health',
      severity,
      description,
      evidencePointers: [`execution:budget-summary:${initiativeId}`],
    });
  }
}

/**
 * Non-blocking wrapper for write paths (budget entry create/delete).
 */
export function fireBudgetHealthExport(organizationId: string, initiativeId: string): void {
  void exportBudgetHealthToResults(organizationId, initiativeId).catch((err) => {
    logger.warn(
      `${LOG_PREFIX} budget_health export failed for initiative ${initiativeId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  });
}
