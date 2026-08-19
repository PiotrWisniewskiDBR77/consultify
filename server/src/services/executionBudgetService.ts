/**
 * Execution Budget Service (T042)
 *
 * Budget planning and financial control for initiatives and projects.
 * Provides plan vs actual comparison, variance calculation, burn rate,
 * forecast to period end, and overspend risk detection.
 */
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { getCurrentPgTransactionClient } from '../utils/queryHelpers.js';
import { observeWriter } from './results/resultsWriterObservationService.js';

// ── Types ──────────────────────────────────────────────────────

export interface BudgetEntry {
  id: string;
  initiativeId: string;
  entryType: 'ACTUAL' | 'FORECAST' | 'ADJUSTMENT';
  costType: 'CAPEX' | 'OPEX';
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  periodMonth: number | null;
  periodYear: number | null;
  source: string;
  createdBy: string | null;
  createdAt: string;
  version: number;
}

export interface InitiativeBudgetSummary {
  initiativeId: string;
  initiativeName: string;
  currency: string;
  planned: { total: number; capex: number; opex: number };
  actual: { total: number; capex: number; opex: number };
  variance: { total: number; percent: number };
  burnRate: number;
  forecast: { total: number; isOverBudget: boolean };
  status: 'GREEN' | 'AMBER' | 'RED';
}

export interface PortfolioBudgetSummary {
  totalPlanned: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  currency: string;
  initiativeSummaries: InitiativeBudgetSummary[];
  overspendCount: number;
  topOverspenders: { initiativeId: string; name: string; variancePercent: number }[];
}

export interface OverspendSignal {
  id: string;
  initiativeId: string | null;
  initiativeName: string;
  signalType:
    | 'THRESHOLD_WARNING'
    | 'THRESHOLD_CRITICAL'
    | 'THRESHOLD_EXCEEDED'
    | 'BURN_RATE_HIGH'
    | 'FORECAST_OVERSPEND';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  plannedAmount: number;
  actualAmount: number;
  variancePercent: number;
  message: string;
}

interface BudgetItemRow {
  initiative_id: string;
  initiative_name: string;
  cost_type: string;
  amount: number;
  currency: string;
}

interface ActualRow {
  initiative_id: string;
  cost_type: string;
  total_amount: number;
}

// ── Budget Entries CRUD ────────────────────────────────────────

export async function createBudgetEntry(
  organizationId: string,
  data: {
    initiativeId: string;
    entryType: 'ACTUAL' | 'FORECAST' | 'ADJUSTMENT';
    costType: 'CAPEX' | 'OPEX';
    category?: string;
    amount: number;
    currency?: string;
    description?: string;
    periodMonth?: number;
    periodYear?: number;
    source?: string;
    createdBy?: string;
  }
): Promise<string> {
  const id = `be-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await dbRun(
    `INSERT INTO budget_entries
       (id, organization_id, initiative_id, entry_type, cost_type, category,
        amount, currency, description, period_month, period_year, source, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      data.initiativeId,
      data.entryType,
      data.costType,
      data.category || 'General',
      data.amount,
      data.currency || 'PLN',
      data.description || null,
      data.periodMonth || null,
      data.periodYear || null,
      data.source || 'manual',
      data.createdBy || null,
    ]
  );

  // Update cached total on initiative
  await recalcInitiativeActualTotal(organizationId, data.initiativeId);

  // M14→M15 feed-forward: surface budget health in Results (non-blocking)
  if (data.entryType === 'ACTUAL') {
    const { fireBudgetHealthExport } = await import('./executionResultsBridge.js');
    fireBudgetHealthExport(organizationId, data.initiativeId);
    // Writer observability for Execution -> Results (side-channel; never gates
    // or alters this write). Instrumented at the business call site, not inside
    // executionResultsBridge, so health-probe traffic is never counted — see
    // closureDeliveryReceiptService.ts's call site for the full rationale.
    // Correlation identity is the budget entry just written, so a retry of the
    // same entry dedupes.
    observeWriter({
      organizationId,
      actorUserId: data.createdBy || null,
      writerFamily: 'execution_results',
      operation: 'budgetHealthExport',
      endpoint: 'service:executionBudgetService.createBudgetEntry',
      correlationId: id,
    });
  }
  return id;
}

export async function getBudgetEntries(
  organizationId: string,
  initiativeId: string
): Promise<BudgetEntry[]> {
  const rows = ((await dbAll(
    `SELECT id, initiative_id, entry_type, cost_type, category, amount, currency,
            description, period_month, period_year, source, created_by, created_at, version
     FROM budget_entries
     WHERE organization_id = ? AND initiative_id = ?
     ORDER BY period_year DESC NULLS LAST, period_month DESC NULLS LAST, created_at DESC`,
    [organizationId, initiativeId]
  )) || []) as Array<{
    id: string;
    initiative_id: string;
    entry_type: string;
    cost_type: string;
    category: string;
    amount: number;
    currency: string;
    description: string | null;
    period_month: number | null;
    period_year: number | null;
    source: string;
    created_by: string | null;
    created_at: string;
    version: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    initiativeId: r.initiative_id,
    entryType: r.entry_type as BudgetEntry['entryType'],
    costType: r.cost_type as BudgetEntry['costType'],
    category: r.category,
    amount: Number(r.amount),
    currency: r.currency,
    description: r.description,
    periodMonth: r.period_month,
    periodYear: r.period_year,
    source: r.source,
    createdBy: r.created_by,
    createdAt: r.created_at,
    version: Number(r.version),
  }));
}

export async function deleteBudgetEntry(
  organizationId: string,
  entryId: string,
  initiativeId: string,
  expectedVersion?: number,
  options?: { deferSideEffects?: boolean }
): Promise<boolean> {
  const transactionClient = getCurrentPgTransactionClient();
  let deletedCount = 0;
  if (transactionClient) {
    const deleted =
      expectedVersion === undefined
        ? await transactionClient.query(
            `DELETE FROM budget_entries WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
            [entryId, organizationId, initiativeId]
          )
        : await transactionClient.query(
            `DELETE FROM budget_entries WHERE id = ? AND organization_id = ? AND initiative_id = ? AND version = ?`,
            [entryId, organizationId, initiativeId, expectedVersion]
          );
    deletedCount = deleted.rowCount;
  } else {
    const deleted =
      expectedVersion === undefined
        ? await dbRun(
            `DELETE FROM budget_entries
           WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
            [entryId, organizationId, initiativeId],
            { fallback: false }
          )
        : await dbRun(
            `DELETE FROM budget_entries
           WHERE id = ? AND organization_id = ? AND initiative_id = ? AND version = ?`,
            [entryId, organizationId, initiativeId, expectedVersion],
            { fallback: false }
          );
    deletedCount = deleted.changes ?? 0;
  }
  if (!deletedCount) return false;
  if (transactionClient) {
    const result = await transactionClient.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM budget_entries
       WHERE initiative_id = ? AND organization_id = ? AND entry_type = 'ACTUAL'`,
      [initiativeId, organizationId]
    );
    await transactionClient.query(
      `UPDATE initiatives SET actual_budget_total = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [result.rows[0]?.total || 0, initiativeId, organizationId]
    );
  } else {
    await recalcInitiativeActualTotal(organizationId, initiativeId);
  }

  if (!options?.deferSideEffects) {
    await emitBudgetDeleteSideEffects(organizationId, initiativeId, entryId, null);
  }
  return true;
}

export async function emitBudgetDeleteSideEffects(
  organizationId: string,
  initiativeId: string,
  entryId: string,
  actorUserId: string | null
): Promise<void> {
  // M14→M15 feed-forward: budget composition changed after the owning
  // transaction committed. A failed receipt insert can therefore never emit
  // a false downstream success signal.
  const { fireBudgetHealthExport } = await import('./executionResultsBridge.js');
  fireBudgetHealthExport(organizationId, initiativeId);
  // Writer observability for Execution -> Results (side-channel). Same call-site
  // rationale as createBudgetEntry above. No interactive actor is available on
  // this path, so actor is honestly null rather than a guessed identity.
  observeWriter({
    organizationId,
    actorUserId,
    writerFamily: 'execution_results',
    operation: 'budgetHealthExport',
    endpoint: 'service:executionBudgetService.deleteBudgetEntry',
    correlationId: entryId,
  });
}

// ── Budget Summary (Initiative Level) ──────────────────────────

export async function getInitiativeBudgetSummary(
  organizationId: string,
  initiativeId: string
): Promise<InitiativeBudgetSummary | null> {
  // Planned budget from initiative_budget_items (ResourcesSection)
  const planned = ((await dbAll(
    `SELECT cost_type, SUM(amount) as total_amount, currency
     FROM initiative_budget_items
     WHERE initiative_id = ? AND organization_id = ?
     GROUP BY cost_type, currency`,
    [initiativeId, organizationId]
  )) || []) as Array<{ cost_type: string; total_amount: number; currency: string }>;

  const initRow = ((await dbAll(
    `SELECT id, name, budget_currency FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  )) || []) as Array<{ id: string; name: string; budget_currency: string }>;

  if (!initRow.length) return null;

  const currency = planned[0]?.currency || initRow[0]?.budget_currency || 'PLN';
  const plannedCapex = planned
    .filter((p) => p.cost_type === 'CAPEX')
    .reduce((s, p) => s + Number(p.total_amount), 0);
  const plannedOpex = planned
    .filter((p) => p.cost_type === 'OPEX')
    .reduce((s, p) => s + Number(p.total_amount), 0);
  const plannedTotal = plannedCapex + plannedOpex;

  // Actual budget from budget_entries
  const actuals = ((await dbAll(
    `SELECT cost_type, SUM(amount) as total_amount
     FROM budget_entries
     WHERE initiative_id = ? AND organization_id = ? AND entry_type = 'ACTUAL'
     GROUP BY cost_type`,
    [initiativeId, organizationId]
  )) || []) as ActualRow[];

  const actualCapex = actuals
    .filter((a) => a.cost_type === 'CAPEX')
    .reduce((s, a) => s + Number(a.total_amount), 0);
  const actualOpex = actuals
    .filter((a) => a.cost_type === 'OPEX')
    .reduce((s, a) => s + Number(a.total_amount), 0);
  const actualTotal = actualCapex + actualOpex;

  const varianceTotal = actualTotal - plannedTotal;
  const variancePercent = plannedTotal > 0 ? Math.round((actualTotal / plannedTotal) * 100) : 0;
  const burnRate = plannedTotal > 0 ? Math.round((actualTotal / plannedTotal) * 100) : 0;

  // Simple forecast: extrapolate from current burn rate
  const forecastTotal =
    plannedTotal > 0 && burnRate > 0
      ? Math.round(actualTotal * (100 / Math.max(burnRate, 1)))
      : actualTotal;

  let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
  if (variancePercent >= 100) status = 'RED';
  else if (variancePercent >= 80) status = 'AMBER';

  return {
    initiativeId,
    initiativeName: initRow[0].name,
    currency,
    planned: { total: plannedTotal, capex: plannedCapex, opex: plannedOpex },
    actual: { total: actualTotal, capex: actualCapex, opex: actualOpex },
    variance: { total: varianceTotal, percent: variancePercent },
    burnRate,
    forecast: { total: forecastTotal, isOverBudget: forecastTotal > plannedTotal },
    status,
  };
}

/**
 * M14/F2 — actual cost (entry_type='ACTUAL') per initiative in ONE query, for the
 * portfolio EVM roll-up (avoids N+1 getInitiativeBudgetSummary calls). Returns a
 * Map<initiativeId, actualTotal>; missing initiatives simply absent.
 */
export async function getActualCostByInitiative(
  organizationId: string,
  initiativeIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!initiativeIds.length) return map;
  const placeholders = initiativeIds.map(() => '?').join(', ');
  const rows = ((await dbAll(
    `SELECT initiative_id, SUM(amount) as actual_total
     FROM budget_entries
     WHERE organization_id = ? AND entry_type = 'ACTUAL'
       AND initiative_id IN (${placeholders})
     GROUP BY initiative_id`,
    [organizationId, ...initiativeIds]
  )) || []) as Array<Record<string, unknown>>;
  for (const r of rows) {
    const id = r.initiative_id != null ? String(r.initiative_id) : '';
    const total = Number(r.actual_total) || 0;
    if (id) map.set(id, total);
  }
  return map;
}

// ── Portfolio-Level Budget Dashboard ───────────────────────────

export async function getPortfolioBudgetSummary(
  organizationId: string,
  projectId?: string
): Promise<PortfolioBudgetSummary> {
  let initQuery = `
    SELECT i.id, i.name, i.budget_currency,
           COALESCE(SUM(bi.amount), 0) as planned_total
    FROM initiatives i
    LEFT JOIN initiative_budget_items bi ON bi.initiative_id = i.id AND bi.organization_id = i.organization_id
    WHERE i.organization_id = ?
      AND i.status NOT IN ('DRAFT', 'CANCELLED', 'ARCHIVED')
  `;
  const params: unknown[] = [organizationId];
  if (projectId) {
    initQuery += ' AND i.project_id = ?';
    params.push(projectId);
  }
  initQuery += ' GROUP BY i.id, i.name, i.budget_currency';

  const initRows = ((await dbAll(initQuery, params)) || []) as Array<{
    id: string;
    name: string;
    budget_currency: string;
    planned_total: number;
  }>;

  const summaries: InitiativeBudgetSummary[] = [];
  let totalPlanned = 0;
  let totalActual = 0;

  for (const row of initRows) {
    const summary = await getInitiativeBudgetSummary(organizationId, row.id);
    if (summary) {
      summaries.push(summary);
      totalPlanned += summary.planned.total;
      totalActual += summary.actual.total;
    }
  }

  const totalVariance = totalActual - totalPlanned;
  const variancePercent = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  const overspenders = summaries
    .filter((s) => s.variance.percent > 80)
    .sort((a, b) => b.variance.percent - a.variance.percent);

  return {
    totalPlanned,
    totalActual,
    totalVariance,
    variancePercent,
    currency: initRows[0]?.budget_currency || 'PLN',
    initiativeSummaries: summaries,
    overspendCount: overspenders.length,
    topOverspenders: overspenders.slice(0, 5).map((s) => ({
      initiativeId: s.initiativeId,
      name: s.initiativeName,
      variancePercent: s.variance.percent,
    })),
  };
}

// ── Overspend Signal Detection ─────────────────────────────────

export async function detectOverspendSignals(
  organizationId: string,
  projectId?: string
): Promise<OverspendSignal[]> {
  const signals: OverspendSignal[] = [];
  const portfolio = await getPortfolioBudgetSummary(organizationId, projectId);

  for (const summary of portfolio.initiativeSummaries) {
    if (summary.planned.total <= 0) continue;

    const pct = summary.variance.percent;

    if (pct >= 100) {
      signals.push({
        id: `overspend-exceeded-${summary.initiativeId}`,
        initiativeId: summary.initiativeId,
        initiativeName: summary.initiativeName,
        signalType: 'THRESHOLD_EXCEEDED',
        severity: 'CRITICAL',
        plannedAmount: summary.planned.total,
        actualAmount: summary.actual.total,
        variancePercent: pct,
        message: `Budget exceeded: ${pct}% of planned (${summary.currency} ${summary.actual.total.toLocaleString()} / ${summary.planned.total.toLocaleString()})`,
      });
    } else if (pct >= 90) {
      signals.push({
        id: `overspend-critical-${summary.initiativeId}`,
        initiativeId: summary.initiativeId,
        initiativeName: summary.initiativeName,
        signalType: 'THRESHOLD_CRITICAL',
        severity: 'HIGH',
        plannedAmount: summary.planned.total,
        actualAmount: summary.actual.total,
        variancePercent: pct,
        message: `Budget at ${pct}% — critical threshold reached`,
      });
    } else if (pct >= 80) {
      signals.push({
        id: `overspend-warning-${summary.initiativeId}`,
        initiativeId: summary.initiativeId,
        initiativeName: summary.initiativeName,
        signalType: 'THRESHOLD_WARNING',
        severity: 'MEDIUM',
        plannedAmount: summary.planned.total,
        actualAmount: summary.actual.total,
        variancePercent: pct,
        message: `Budget at ${pct}% — warning threshold reached`,
      });
    }

    if (summary.forecast.isOverBudget && pct < 100) {
      signals.push({
        id: `forecast-overspend-${summary.initiativeId}`,
        initiativeId: summary.initiativeId,
        initiativeName: summary.initiativeName,
        signalType: 'FORECAST_OVERSPEND',
        severity: pct >= 90 ? 'HIGH' : 'MEDIUM',
        plannedAmount: summary.planned.total,
        actualAmount: summary.actual.total,
        variancePercent: pct,
        message: `Forecasted overspend: burn rate projects ${summary.currency} ${summary.forecast.total.toLocaleString()} vs planned ${summary.planned.total.toLocaleString()}`,
      });
    }
  }

  signals.sort((a, b) => {
    const sev = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (sev[b.severity] || 0) - (sev[a.severity] || 0);
  });

  return signals;
}

// ── Helpers ────────────────────────────────────────────────────

async function recalcInitiativeActualTotal(
  organizationId: string,
  initiativeId: string
): Promise<void> {
  try {
    const result = ((await dbAll(
      `SELECT COALESCE(SUM(amount), 0) as total FROM budget_entries
       WHERE initiative_id = ? AND organization_id = ? AND entry_type = 'ACTUAL'`,
      [initiativeId, organizationId]
    )) || []) as Array<{ total: number }>;

    const total = result[0]?.total || 0;
    await dbRun(
      `UPDATE initiatives SET actual_budget_total = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [total, initiativeId, organizationId]
    );
  } catch (err) {
    logger.error(`Failed to recalc actual budget total for ${initiativeId}`, err);
  }
}
