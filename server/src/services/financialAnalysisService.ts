import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StatementLine {
  code: string;
  name: string;
  values: Record<string, number>;
}

export interface StatementData {
  pl?: StatementLine[];
  bs?: StatementLine[];
  cf?: StatementLine[];
}

export interface AnalysisResult {
  vertical: VerticalAnalysis;
  horizontal: HorizontalAnalysis;
  ratios: RatioResult[];
  trends: TrendResult[];
  insights: FinancialInsight[];
}

export interface VerticalAnalysis {
  pl: Record<string, Record<string, number>>;
  bs: Record<string, Record<string, number>>;
}

export interface HorizontalAnalysis {
  pl: Record<string, Record<string, { change: number; pct: number }>>;
  bs: Record<string, Record<string, { change: number; pct: number }>>;
}

export interface RatioResult {
  category: string;
  code: string;
  name: string;
  value: number | null;
  benchmark?: number;
  interpretation?: string;
}

export interface TrendResult {
  lineCode: string;
  lineName: string;
  cagr: number | null;
  values: Record<string, number>;
}

export interface FinancialInsight {
  type: 'driver' | 'risk' | 'action' | 'quality_note' | 'narrative';
  title: string;
  description: string;
  priority: number;
}

export interface FinancialAnalysis {
  id: string;
  organizationId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: string;
  analysisType: string;
  periods: string[];
  statementData: StatementData;
  currency: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function safeDiv(numerator: number, denominator: number): number | null {
  if (!denominator || denominator === 0) return null;
  return numerator / denominator;
}

function safeJsonParse(raw: string | null | undefined, fallback: any = {}): any {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function mapRow(row: any): FinancialAnalysis {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    analysisType: row.analysis_type,
    periods: safeJsonParse(row.periods, []),
    statementData: safeJsonParse(row.statement_data, {}),
    currency: row.currency,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function lineVal(lines: StatementLine[] | undefined, code: string, period: string): number {
  if (!lines) return 0;
  const line = lines.find((l) => l.code === code);
  return line?.values?.[period] ?? 0;
}

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

export async function createAnalysis(
  orgId: string,
  data: { title: string; description?: string; projectId?: string; analysisType?: string; periods?: string[]; statementData?: StatementData; currency?: string },
  userId?: string
): Promise<FinancialAnalysis> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO financial_analyses (id, organization_id, project_id, title, description, status, analysis_type, periods, statement_data, currency, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, orgId, data.projectId || null, data.title, data.description || null,
      data.analysisType || 'comprehensive',
      JSON.stringify(data.periods || []),
      JSON.stringify(data.statementData || {}),
      data.currency || 'PLN',
      userId || null, now, now,
    ]
  );
  return { id, organizationId: orgId, projectId: data.projectId, title: data.title, description: data.description, status: 'DRAFT', analysisType: data.analysisType || 'comprehensive', periods: data.periods || [], statementData: data.statementData || {}, currency: data.currency || 'PLN', createdBy: userId, createdAt: now, updatedAt: now };
}

export async function getAnalysis(orgId: string, id: string): Promise<FinancialAnalysis | null> {
  const row = await dbGet<any>(
    `SELECT * FROM financial_analyses WHERE id = ? AND organization_id = ?`,
    [id, orgId]
  );
  return row ? mapRow(row) : null;
}

export async function listAnalyses(orgId: string, filters?: { status?: string; projectId?: string }): Promise<FinancialAnalysis[]> {
  let sql = `SELECT * FROM financial_analyses WHERE organization_id = ?`;
  const params: any[] = [orgId];
  if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters?.projectId) { sql += ' AND project_id = ?'; params.push(filters.projectId); }
  sql += ' ORDER BY created_at DESC';
  const rows = await dbAll<any>(sql, params);
  return rows.map(mapRow);
}

export async function updateAnalysis(orgId: string, id: string, data: Partial<{ title: string; description: string; periods: string[]; statementData: StatementData; currency: string }>): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.periods !== undefined) { sets.push('periods = ?'); params.push(JSON.stringify(data.periods)); }
  if (data.statementData !== undefined) { sets.push('statement_data = ?'); params.push(JSON.stringify(data.statementData)); }
  if (data.currency !== undefined) { sets.push('currency = ?'); params.push(data.currency); }
  sets.push('updated_at = ?'); params.push(new Date().toISOString());
  params.push(id, orgId);
  await dbRun(`UPDATE financial_analyses SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`, params);
}

export async function approveAnalysis(orgId: string, id: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE financial_analyses SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
    [userId, now, now, id, orgId]
  );
}

/* ------------------------------------------------------------------ */
/*  Computation                                                        */
/* ------------------------------------------------------------------ */

export function computeVerticalAnalysis(data: StatementData, periods: string[]): VerticalAnalysis {
  const result: VerticalAnalysis = { pl: {}, bs: {} };
  for (const period of periods) {
    const revenue = lineVal(data.pl, 'REVENUE', period);
    const totalAssets = lineVal(data.bs, 'TOTAL_ASSETS', period);
    if (data.pl) {
      result.pl[period] = {};
      for (const line of data.pl) {
        const val = line.values?.[period] ?? 0;
        result.pl[period][line.code] = revenue ? (val / revenue) * 100 : 0;
      }
    }
    if (data.bs) {
      result.bs[period] = {};
      for (const line of data.bs) {
        const val = line.values?.[period] ?? 0;
        result.bs[period][line.code] = totalAssets ? (val / totalAssets) * 100 : 0;
      }
    }
  }
  return result;
}

export function computeHorizontalAnalysis(data: StatementData, periods: string[]): HorizontalAnalysis {
  const result: HorizontalAnalysis = { pl: {}, bs: {} };
  for (let i = 1; i < periods.length; i++) {
    const curr = periods[i];
    const prev = periods[i - 1];
    const key = `${prev}_to_${curr}`;
    if (data.pl) {
      result.pl[key] = {};
      for (const line of data.pl) {
        const c = line.values?.[curr] ?? 0;
        const p = line.values?.[prev] ?? 0;
        result.pl[key][line.code] = { change: c - p, pct: p ? ((c - p) / Math.abs(p)) * 100 : 0 };
      }
    }
    if (data.bs) {
      result.bs[key] = {};
      for (const line of data.bs) {
        const c = line.values?.[curr] ?? 0;
        const p = line.values?.[prev] ?? 0;
        result.bs[key][line.code] = { change: c - p, pct: p ? ((c - p) / Math.abs(p)) * 100 : 0 };
      }
    }
  }
  return result;
}

export function computeRatios(data: StatementData, period: string): RatioResult[] {
  const pl = (code: string) => lineVal(data.pl, code, period);
  const bs = (code: string) => lineVal(data.bs, code, period);

  const currentAssets = bs('CURRENT_ASSETS');
  const currentLiabilities = bs('CURRENT_LIABILITIES');
  const inventory = bs('INVENTORY');
  const cash = bs('CASH');
  const totalAssets = bs('TOTAL_ASSETS');
  const totalEquity = bs('TOTAL_EQUITY');
  const totalDebt = bs('TOTAL_DEBT');
  const receivables = bs('RECEIVABLES');
  const revenue = pl('REVENUE');
  const cogs = pl('COGS');
  const grossProfit = pl('GROSS_PROFIT');
  const operatingIncome = pl('OPERATING_INCOME');
  const netIncome = pl('NET_INCOME');
  const interestExpense = pl('INTEREST_EXPENSE');

  return [
    { category: 'liquidity', code: 'current_ratio', name: 'Current Ratio', value: safeDiv(currentAssets, currentLiabilities) },
    { category: 'liquidity', code: 'quick_ratio', name: 'Quick Ratio', value: safeDiv(currentAssets - inventory, currentLiabilities) },
    { category: 'liquidity', code: 'cash_ratio', name: 'Cash Ratio', value: safeDiv(cash, currentLiabilities) },
    { category: 'profitability', code: 'gross_margin_pct', name: 'Gross Margin %', value: safeDiv(grossProfit, revenue) !== null ? (safeDiv(grossProfit, revenue)! * 100) : null },
    { category: 'profitability', code: 'operating_margin_pct', name: 'Operating Margin %', value: safeDiv(operatingIncome, revenue) !== null ? (safeDiv(operatingIncome, revenue)! * 100) : null },
    { category: 'profitability', code: 'net_margin_pct', name: 'Net Margin %', value: safeDiv(netIncome, revenue) !== null ? (safeDiv(netIncome, revenue)! * 100) : null },
    { category: 'profitability', code: 'roa_pct', name: 'ROA %', value: safeDiv(netIncome, totalAssets) !== null ? (safeDiv(netIncome, totalAssets)! * 100) : null },
    { category: 'profitability', code: 'roe_pct', name: 'ROE %', value: safeDiv(netIncome, totalEquity) !== null ? (safeDiv(netIncome, totalEquity)! * 100) : null },
    { category: 'efficiency', code: 'asset_turnover', name: 'Asset Turnover', value: safeDiv(revenue, totalAssets) },
    { category: 'efficiency', code: 'inventory_turnover', name: 'Inventory Turnover', value: safeDiv(cogs, inventory) },
    { category: 'efficiency', code: 'dso', name: 'Days Sales Outstanding', value: safeDiv(receivables, revenue) !== null ? (safeDiv(receivables, revenue)! * 365) : null },
    { category: 'leverage', code: 'debt_to_equity', name: 'Debt-to-Equity', value: safeDiv(totalDebt, totalEquity) },
    { category: 'leverage', code: 'debt_ratio', name: 'Debt Ratio', value: safeDiv(totalDebt, totalAssets) },
    { category: 'leverage', code: 'interest_coverage', name: 'Interest Coverage', value: safeDiv(operatingIncome, interestExpense) },
    { category: 'growth', code: 'revenue_growth', name: 'Revenue Growth', value: null },
  ];
}

export function computeTrends(data: StatementData, periods: string[]): TrendResult[] {
  const keyCodes = ['REVENUE', 'GROSS_PROFIT', 'OPERATING_INCOME', 'NET_INCOME', 'TOTAL_ASSETS', 'TOTAL_EQUITY'];
  const results: TrendResult[] = [];
  for (const code of keyCodes) {
    const allLines = [...(data.pl || []), ...(data.bs || [])];
    const line = allLines.find((l) => l.code === code);
    if (!line) continue;
    const values: Record<string, number> = {};
    for (const p of periods) { values[p] = line.values?.[p] ?? 0; }
    const first = values[periods[0]];
    const last = values[periods[periods.length - 1]];
    const n = periods.length - 1;
    let cagr: number | null = null;
    if (first > 0 && last > 0 && n > 0) {
      cagr = (Math.pow(last / first, 1 / n) - 1) * 100;
    }
    results.push({ lineCode: code, lineName: line.name, cagr, values });
  }
  return results;
}

export function generateInsights(
  vertical: VerticalAnalysis,
  horizontal: HorizontalAnalysis,
  ratios: RatioResult[],
  _trends: TrendResult[]
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];

  for (const key of Object.keys(horizontal.pl)) {
    for (const [code, data] of Object.entries(horizontal.pl[key])) {
      if (Math.abs(data.pct) > 5) {
        insights.push({
          type: 'driver',
          title: `${code} changed ${data.pct > 0 ? '+' : ''}${data.pct.toFixed(1)}%`,
          description: `${code} moved by ${data.change.toFixed(0)} (${data.pct.toFixed(1)}%) in ${key.replace('_to_', ' → ')}`,
          priority: Math.abs(data.pct) > 20 ? 2 : 1,
        });
      }
    }
  }

  const currentRatio = ratios.find((r) => r.code === 'current_ratio');
  if (currentRatio?.value !== null && currentRatio?.value !== undefined && currentRatio.value < 1.0) {
    insights.push({ type: 'risk', title: 'Low liquidity risk', description: `Current ratio (${currentRatio.value.toFixed(2)}) is below 1.0, indicating potential liquidity issues.`, priority: 3 });
  }
  const debtToEquity = ratios.find((r) => r.code === 'debt_to_equity');
  if (debtToEquity?.value !== null && debtToEquity?.value !== undefined && debtToEquity.value > 3.0) {
    insights.push({ type: 'risk', title: 'High leverage risk', description: `Debt-to-equity (${debtToEquity.value.toFixed(2)}) exceeds 3.0, suggesting heavy reliance on debt financing.`, priority: 3 });
  }
  const netMargin = ratios.find((r) => r.code === 'net_margin_pct');
  if (netMargin?.value !== null && netMargin?.value !== undefined && netMargin.value < 2) {
    insights.push({ type: 'risk', title: 'Thin margins', description: `Net margin (${netMargin.value.toFixed(1)}%) is below 2%, leaving little buffer for downturns.`, priority: 2 });
  }

  const dso = ratios.find((r) => r.code === 'dso');
  if (dso?.value !== null && dso?.value !== undefined && dso.value > 60) {
    insights.push({ type: 'action', title: 'Reduce DSO', description: `Days Sales Outstanding (${dso.value.toFixed(0)}) exceeds 60 days. Consider tightening credit terms.`, priority: 2 });
  }

  const computedCount = ratios.filter((r) => r.value !== null).length;
  if (computedCount < 10) {
    insights.push({ type: 'quality_note', title: 'Limited data coverage', description: `Only ${computedCount} of ${ratios.length} ratios could be computed. Import more statement data for a complete picture.`, priority: 0 });
  }

  return insights;
}

/* ------------------------------------------------------------------ */
/*  Orchestration                                                      */
/* ------------------------------------------------------------------ */

export async function runFullAnalysis(orgId: string, analysisId: string): Promise<AnalysisResult> {
  const analysis = await getAnalysis(orgId, analysisId);
  if (!analysis) throw new Error('Analysis not found');

  const { statementData, periods } = analysis;
  const vertical = computeVerticalAnalysis(statementData, periods);
  const horizontal = computeHorizontalAnalysis(statementData, periods);

  const latestRatios = periods.length > 0 ? computeRatios(statementData, periods[periods.length - 1]) : [];
  const trends = computeTrends(statementData, periods);
  const insights = generateInsights(vertical, horizontal, latestRatios, trends);

  await dbRun(`DELETE FROM financial_analysis_ratios WHERE analysis_id = ?`, [analysisId]);
  for (const period of periods) {
    const periodRatios = computeRatios(statementData, period);
    for (const r of periodRatios) {
      if (r.value === null) continue;
      await dbRun(
        `INSERT INTO financial_analysis_ratios (id, analysis_id, period, category, ratio_code, ratio_name, value, benchmark_value, interpretation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), analysisId, period, r.category, r.code, r.name, r.value, r.benchmark ?? null, r.interpretation ?? null, new Date().toISOString()]
      );
    }
  }

  await dbRun(`DELETE FROM financial_analysis_insights WHERE analysis_id = ?`, [analysisId]);
  for (const ins of insights) {
    await dbRun(
      `INSERT INTO financial_analysis_insights (id, analysis_id, insight_type, title, description, priority, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [uuidv4(), analysisId, ins.type, ins.title, ins.description, ins.priority, new Date().toISOString()]
    );
  }

  await dbRun(`UPDATE financial_analyses SET status = 'REVIEW', updated_at = ? WHERE id = ?`, [new Date().toISOString(), analysisId]);

  return { vertical, horizontal, ratios: latestRatios, trends, insights };
}

export async function getAnalysisRatios(analysisId: string): Promise<any[]> {
  return dbAll<any>(`SELECT * FROM financial_analysis_ratios WHERE analysis_id = ? ORDER BY category, ratio_code`, [analysisId]);
}

export async function getAnalysisInsights(analysisId: string): Promise<any[]> {
  return dbAll<any>(`SELECT * FROM financial_analysis_insights WHERE analysis_id = ? ORDER BY priority DESC, created_at`, [analysisId]);
}
