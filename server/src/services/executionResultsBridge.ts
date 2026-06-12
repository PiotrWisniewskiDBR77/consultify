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

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

import { getInitiativeBudgetSummary } from './executionBudgetService.js';
import { createKpiSignal } from './v8/resultsROIService.js';

const LOG_PREFIX = '[ExecutionResultsBridge]';

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
