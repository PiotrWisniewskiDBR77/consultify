import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';

type BreakdownRow = {
  key: string;
  cost_usd: number | null;
  requests: number | null;
  avg_latency_ms: number | null;
};

export type FinOpsOverview = {
  period: { from: string; to: string };
  budgetUsd: number;
  mtdSpendUsd: number;
  projectedMonthEndSpendUsd: number;
  budgetUtilizationPct: number;
  burnRateMultiplier: number;
  snapshotCoveragePct: number;
  vendorConcentrationPct: number;
  topVendor: string | null;
  vendorScorecards: Array<{
    provider: string;
    costUsd: number;
    requests: number;
    avgLatencyMs: number;
    sharePct: number;
  }>;
  anomalies: Array<{
    scope: string;
    key: string;
    currentSpendUsd: number;
    baselineSpendUsd: number;
    deltaPct: number;
    severity: 'warning' | 'critical';
  }>;
  chargeback: {
    byPurpose: Array<{ key: string; costUsd: number; requests: number }>;
    byUser: Array<{ key: string; costUsd: number; requests: number }>;
  };
};

function round(value: number, digits = 2) {
  const factor = Math.pow(10, digits);
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

async function getMonthlyBudget(orgId: string): Promise<number> {
  try {
    const row = await dbGet<{
      monthly_budget_usd?: number | null;
      monthly_ai_budget?: number | null;
    }>(
      `SELECT monthly_budget_usd, monthly_ai_budget FROM organizations WHERE id = ? LIMIT 1`,
      [orgId],
      { fallback: true } as any
    );
    return Number(row?.monthly_budget_usd ?? row?.monthly_ai_budget ?? 0) || 0;
  } catch {
    return 0;
  }
}

async function getBreakdown(
  orgId: string,
  groupBy: 'provider' | 'purpose' | 'user_id',
  fromSql: string,
  toSql = "datetime('now')"
): Promise<BreakdownRow[]> {
  const rows = await dbAll<BreakdownRow>(
    `SELECT
       COALESCE(${groupBy}, 'unknown') as key,
       COALESCE(SUM(estimated_cost_usd), 0) as cost_usd,
       COUNT(*) as requests,
       COALESCE(AVG(latency_ms), 0) as avg_latency_ms
     FROM ai_usage_logs
     WHERE organization_id = ?
       AND status = 'success'
       AND created_at >= ${fromSql}
       AND created_at < ${toSql}
     GROUP BY ${groupBy}
     ORDER BY cost_usd DESC`,
    [orgId],
    { fallback: true } as any
  ).catch(() => []);
  return rows || [];
}

async function getSnapshotCoverage(orgId: string): Promise<number> {
  try {
    const row = await dbGet<{ total?: number | null; covered?: number | null }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN price_snapshot_id IS NOT NULL THEN 1 ELSE 0 END) as covered
       FROM ai_usage_logs
       WHERE organization_id = ?
         AND status = 'success'
         AND created_at >= date('now', 'start of month')`,
      [orgId],
      { fallback: true } as any
    );
    const total = Number(row?.total || 0);
    const covered = Number(row?.covered || 0);
    return total > 0 ? round((covered / total) * 100, 1) : 0;
  } catch {
    return 0;
  }
}

async function getAnomalies(orgId: string) {
  const scopes: Array<'provider' | 'purpose'> = ['provider', 'purpose'];
  const results: FinOpsOverview['anomalies'] = [];

  for (const scope of scopes) {
    const current = await getBreakdown(orgId, scope, "datetime('now', '-7 days')");
    const baseline = await getBreakdown(
      orgId,
      scope,
      "datetime('now', '-14 days')",
      "datetime('now', '-7 days')"
    );
    const baselineMap = new Map(
      baseline.map((row) => [String(row.key || 'unknown'), Number(row.cost_usd || 0)])
    );
    for (const row of current) {
      const currentSpend = Number(row.cost_usd || 0);
      const baselineSpend = Number(baselineMap.get(String(row.key || 'unknown')) || 0);
      if (currentSpend < 10) continue;
      if (baselineSpend <= 0 && currentSpend >= 25) {
        results.push({
          scope,
          key: String(row.key || 'unknown'),
          currentSpendUsd: round(currentSpend),
          baselineSpendUsd: round(baselineSpend),
          deltaPct: 100,
          severity: currentSpend >= 100 ? 'critical' : 'warning',
        });
        continue;
      }
      const deltaPct =
        baselineSpend > 0 ? ((currentSpend - baselineSpend) / baselineSpend) * 100 : 0;
      if (deltaPct >= 50 && currentSpend - baselineSpend >= 15) {
        results.push({
          scope,
          key: String(row.key || 'unknown'),
          currentSpendUsd: round(currentSpend),
          baselineSpendUsd: round(baselineSpend),
          deltaPct: round(deltaPct, 1),
          severity: deltaPct >= 100 ? 'critical' : 'warning',
        });
      }
    }
  }

  return results.sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 8);
}

export async function getFinOpsOverview(orgId: string): Promise<FinOpsOverview> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = now.toISOString();
  const budgetUsd = await getMonthlyBudget(orgId);

  const spendRow = await dbGet<{ cost?: number | null }>(
    `SELECT COALESCE(SUM(estimated_cost_usd), 0) as cost
     FROM ai_usage_logs
     WHERE organization_id = ?
       AND status = 'success'
       AND created_at >= date('now', 'start of month')`,
    [orgId],
    { fallback: true } as any
  ).catch(() => ({ cost: 0 }));
  const mtdSpendUsd = round(Number(spendRow?.cost || 0));
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyRunRate = mtdSpendUsd / dayOfMonth;
  const projectedMonthEndSpendUsd = round(dailyRunRate * daysInMonth);
  const budgetUtilizationPct = budgetUsd > 0 ? round((mtdSpendUsd / budgetUsd) * 100, 1) : 0;
  const burnRateMultiplier = budgetUsd > 0 ? round(projectedMonthEndSpendUsd / budgetUsd, 2) : 0;

  const vendorRows = await getBreakdown(orgId, 'provider', "date('now', 'start of month')");
  const vendorScorecards = vendorRows.map((row) => ({
    provider: String(row.key || 'unknown'),
    costUsd: round(Number(row.cost_usd || 0)),
    requests: Number(row.requests || 0),
    avgLatencyMs: round(Number(row.avg_latency_ms || 0), 0),
    sharePct: mtdSpendUsd > 0 ? round((Number(row.cost_usd || 0) / mtdSpendUsd) * 100, 1) : 0,
  }));
  const topVendor = vendorScorecards[0]?.provider || null;
  const vendorConcentrationPct = vendorScorecards[0]?.sharePct || 0;

  const byPurposeRows = await getBreakdown(orgId, 'purpose', "date('now', 'start of month')");
  const byUserRows = await getBreakdown(orgId, 'user_id', "date('now', 'start of month')");

  return {
    period: { from, to },
    budgetUsd,
    mtdSpendUsd,
    projectedMonthEndSpendUsd,
    budgetUtilizationPct,
    burnRateMultiplier,
    snapshotCoveragePct: await getSnapshotCoverage(orgId),
    vendorConcentrationPct,
    topVendor,
    vendorScorecards,
    anomalies: await getAnomalies(orgId),
    chargeback: {
      byPurpose: byPurposeRows.slice(0, 8).map((row) => ({
        key: String(row.key || 'unknown'),
        costUsd: round(Number(row.cost_usd || 0)),
        requests: Number(row.requests || 0),
      })),
      byUser: byUserRows.slice(0, 8).map((row) => ({
        key: String(row.key || 'unknown'),
        costUsd: round(Number(row.cost_usd || 0)),
        requests: Number(row.requests || 0),
      })),
    },
  };
}

export default {
  getFinOpsOverview,
};
