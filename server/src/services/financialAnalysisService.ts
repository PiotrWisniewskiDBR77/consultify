import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

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

function safeDiv(n: number, d: number): number | null {
  if (!d || d === 0) return null;
  return n / d;
}
function safeJsonParse(raw: string | null | undefined, fb: any = {}): any {
  if (!raw) return fb;
  try {
    return JSON.parse(raw);
  } catch {
    return fb;
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
  const l = lines.find((x) => x.code === code);
  return l?.values?.[period] ?? 0;
}

export async function createAnalysis(
  orgId: string,
  data: {
    title: string;
    description?: string;
    projectId?: string;
    analysisType?: string;
    periods?: string[];
    statementData?: StatementData;
    currency?: string;
  },
  userId?: string
): Promise<FinancialAnalysis> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO financial_analyses (id,organization_id,project_id,title,description,status,analysis_type,periods,statement_data,currency,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?)`,
    [
      id,
      orgId,
      data.projectId || null,
      data.title,
      data.description || null,
      data.analysisType || 'comprehensive',
      JSON.stringify(data.periods || []),
      JSON.stringify(data.statementData || {}),
      data.currency || 'PLN',
      userId || null,
      now,
      now,
    ]
  );
  return {
    id,
    organizationId: orgId,
    projectId: data.projectId,
    title: data.title,
    description: data.description,
    status: 'DRAFT',
    analysisType: data.analysisType || 'comprehensive',
    periods: data.periods || [],
    statementData: data.statementData || {},
    currency: data.currency || 'PLN',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
}
export async function getAnalysis(orgId: string, id: string): Promise<FinancialAnalysis | null> {
  const row = await dbGet<any>(
    `SELECT * FROM financial_analyses WHERE id=? AND organization_id=?`,
    [id, orgId]
  );
  return row ? mapRow(row) : null;
}
export async function listAnalyses(
  orgId: string,
  filters?: { status?: string; projectId?: string }
): Promise<FinancialAnalysis[]> {
  let sql = `SELECT * FROM financial_analyses WHERE organization_id=?`;
  const p: any[] = [orgId];
  if (filters?.status) {
    sql += ' AND status=?';
    p.push(filters.status);
  }
  if (filters?.projectId) {
    sql += ' AND project_id=?';
    p.push(filters.projectId);
  }
  sql += ' ORDER BY created_at DESC';
  return (await dbAll<any>(sql, p)).map(mapRow);
}
export async function updateAnalysis(
  orgId: string,
  id: string,
  data: Partial<{
    title: string;
    description: string;
    periods: string[];
    statementData: StatementData;
    currency: string;
  }>
): Promise<void> {
  const s: string[] = [];
  const p: any[] = [];
  if (data.title !== undefined) {
    s.push('title=?');
    p.push(data.title);
  }
  if (data.description !== undefined) {
    s.push('description=?');
    p.push(data.description);
  }
  if (data.periods !== undefined) {
    s.push('periods=?');
    p.push(JSON.stringify(data.periods));
  }
  if (data.statementData !== undefined) {
    s.push('statement_data=?');
    p.push(JSON.stringify(data.statementData));
  }
  if (data.currency !== undefined) {
    s.push('currency=?');
    p.push(data.currency);
  }
  s.push('updated_at=?');
  p.push(new Date().toISOString());
  p.push(id, orgId);
  await dbRun(`UPDATE financial_analyses SET ${s.join(',')} WHERE id=? AND organization_id=?`, p);
}
export async function approveAnalysis(orgId: string, id: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE financial_analyses SET status='APPROVED',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND organization_id=?`,
    [userId, now, now, id, orgId]
  );
}

export function computeVerticalAnalysis(data: StatementData, periods: string[]): VerticalAnalysis {
  const r: VerticalAnalysis = { pl: {}, bs: {} };
  for (const p of periods) {
    const rev = lineVal(data.pl, 'REVENUE', p);
    const ta = lineVal(data.bs, 'TOTAL_ASSETS', p);
    if (data.pl) {
      r.pl[p] = {};
      for (const l of data.pl) {
        r.pl[p][l.code] = rev ? ((l.values?.[p] ?? 0) / rev) * 100 : 0;
      }
    }
    if (data.bs) {
      r.bs[p] = {};
      for (const l of data.bs) {
        r.bs[p][l.code] = ta ? ((l.values?.[p] ?? 0) / ta) * 100 : 0;
      }
    }
  }
  return r;
}
export function computeHorizontalAnalysis(
  data: StatementData,
  periods: string[]
): HorizontalAnalysis {
  const r: HorizontalAnalysis = { pl: {}, bs: {} };
  for (let i = 1; i < periods.length; i++) {
    const c = periods[i];
    const prev = periods[i - 1];
    const k = `${prev}_to_${c}`;
    if (data.pl) {
      r.pl[k] = {};
      for (const l of data.pl) {
        const cv = l.values?.[c] ?? 0;
        const pv = l.values?.[prev] ?? 0;
        r.pl[k][l.code] = { change: cv - pv, pct: pv ? ((cv - pv) / Math.abs(pv)) * 100 : 0 };
      }
    }
    if (data.bs) {
      r.bs[k] = {};
      for (const l of data.bs) {
        const cv = l.values?.[c] ?? 0;
        const pv = l.values?.[prev] ?? 0;
        r.bs[k][l.code] = { change: cv - pv, pct: pv ? ((cv - pv) / Math.abs(pv)) * 100 : 0 };
      }
    }
  }
  return r;
}
export function computeRatios(data: StatementData, period: string): RatioResult[] {
  const pl = (c: string) => lineVal(data.pl, c, period);
  const bs = (c: string) => lineVal(data.bs, c, period);
  const ca = bs('CURRENT_ASSETS');
  const cl = bs('CURRENT_LIABILITIES');
  const inv = bs('INVENTORY');
  const cash = bs('CASH');
  const ta = bs('TOTAL_ASSETS');
  const te = bs('TOTAL_EQUITY');
  const td = bs('TOTAL_DEBT');
  const rec = bs('RECEIVABLES');
  const rev = pl('REVENUE');
  const cogs = pl('COGS');
  const gp = pl('GROSS_PROFIT');
  const oi = pl('OPERATING_INCOME');
  const ni = pl('NET_INCOME');
  const ie = pl('INTEREST_EXPENSE');
  return [
    { category: 'liquidity', code: 'current_ratio', name: 'Current Ratio', value: safeDiv(ca, cl) },
    {
      category: 'liquidity',
      code: 'quick_ratio',
      name: 'Quick Ratio',
      value: safeDiv(ca - inv, cl),
    },
    { category: 'liquidity', code: 'cash_ratio', name: 'Cash Ratio', value: safeDiv(cash, cl) },
    {
      category: 'profitability',
      code: 'gross_margin_pct',
      name: 'Gross Margin %',
      value: safeDiv(gp, rev) !== null ? safeDiv(gp, rev)! * 100 : null,
    },
    {
      category: 'profitability',
      code: 'operating_margin_pct',
      name: 'Operating Margin %',
      value: safeDiv(oi, rev) !== null ? safeDiv(oi, rev)! * 100 : null,
    },
    {
      category: 'profitability',
      code: 'net_margin_pct',
      name: 'Net Margin %',
      value: safeDiv(ni, rev) !== null ? safeDiv(ni, rev)! * 100 : null,
    },
    {
      category: 'profitability',
      code: 'roa_pct',
      name: 'ROA %',
      value: safeDiv(ni, ta) !== null ? safeDiv(ni, ta)! * 100 : null,
    },
    {
      category: 'profitability',
      code: 'roe_pct',
      name: 'ROE %',
      value: safeDiv(ni, te) !== null ? safeDiv(ni, te)! * 100 : null,
    },
    {
      category: 'efficiency',
      code: 'asset_turnover',
      name: 'Asset Turnover',
      value: safeDiv(rev, ta),
    },
    {
      category: 'efficiency',
      code: 'inventory_turnover',
      name: 'Inventory Turnover',
      value: safeDiv(cogs, inv),
    },
    {
      category: 'efficiency',
      code: 'dso',
      name: 'Days Sales Outstanding',
      value: safeDiv(rec, rev) !== null ? safeDiv(rec, rev)! * 365 : null,
    },
    {
      category: 'leverage',
      code: 'debt_to_equity',
      name: 'Debt-to-Equity',
      value: safeDiv(td, te),
    },
    { category: 'leverage', code: 'debt_ratio', name: 'Debt Ratio', value: safeDiv(td, ta) },
    {
      category: 'leverage',
      code: 'interest_coverage',
      name: 'Interest Coverage',
      value: safeDiv(oi, ie),
    },
    { category: 'growth', code: 'revenue_growth', name: 'Revenue Growth', value: null },
  ];
}
export function computeTrends(data: StatementData, periods: string[]): TrendResult[] {
  const codes = [
    'REVENUE',
    'GROSS_PROFIT',
    'OPERATING_INCOME',
    'NET_INCOME',
    'TOTAL_ASSETS',
    'TOTAL_EQUITY',
  ];
  const res: TrendResult[] = [];
  for (const code of codes) {
    const all = [...(data.pl || []), ...(data.bs || [])];
    const l = all.find((x) => x.code === code);
    if (!l) continue;
    const v: Record<string, number> = {};
    for (const p of periods) v[p] = l.values?.[p] ?? 0;
    const f = v[periods[0]];
    const la = v[periods[periods.length - 1]];
    const n = periods.length - 1;
    let cagr: number | null = null;
    if (f > 0 && la > 0 && n > 0) cagr = (Math.pow(la / f, 1 / n) - 1) * 100;
    res.push({ lineCode: code, lineName: l.name, cagr, values: v });
  }
  return res;
}
export function generateInsights(
  _v: VerticalAnalysis,
  h: HorizontalAnalysis,
  ratios: RatioResult[],
  _t: TrendResult[]
): FinancialInsight[] {
  const ins: FinancialInsight[] = [];
  for (const k of Object.keys(h.pl)) {
    for (const [code, d] of Object.entries(h.pl[k])) {
      if (Math.abs(d.pct) > 5)
        ins.push({
          type: 'driver',
          title: `${code} changed ${d.pct > 0 ? '+' : ''}${d.pct.toFixed(1)}%`,
          description: `${code} moved by ${d.change.toFixed(0)} (${d.pct.toFixed(1)}%) in ${k.replace('_to_', ' → ')}`,
          priority: Math.abs(d.pct) > 20 ? 2 : 1,
        });
    }
  }
  const cr = ratios.find((r) => r.code === 'current_ratio');
  if (cr?.value != null && cr.value < 1)
    ins.push({
      type: 'risk',
      title: 'Low liquidity risk',
      description: `Current ratio (${cr.value.toFixed(2)}) below 1.0`,
      priority: 3,
    });
  const de = ratios.find((r) => r.code === 'debt_to_equity');
  if (de?.value != null && de.value > 3)
    ins.push({
      type: 'risk',
      title: 'High leverage risk',
      description: `Debt-to-equity (${de.value.toFixed(2)}) exceeds 3.0`,
      priority: 3,
    });
  const nm = ratios.find((r) => r.code === 'net_margin_pct');
  if (nm?.value != null && nm.value < 2)
    ins.push({
      type: 'risk',
      title: 'Thin margins',
      description: `Net margin (${nm.value.toFixed(1)}%) below 2%`,
      priority: 2,
    });
  const dso = ratios.find((r) => r.code === 'dso');
  if (dso?.value != null && dso.value > 60)
    ins.push({
      type: 'action',
      title: 'Reduce DSO',
      description: `DSO (${dso.value.toFixed(0)}) exceeds 60 days`,
      priority: 2,
    });
  const cc = ratios.filter((r) => r.value !== null).length;
  if (cc < 10)
    ins.push({
      type: 'quality_note',
      title: 'Limited data coverage',
      description: `Only ${cc} of ${ratios.length} ratios computed`,
      priority: 0,
    });
  return ins;
}

export async function runFullAnalysis(orgId: string, analysisId: string): Promise<AnalysisResult> {
  const a = await getAnalysis(orgId, analysisId);
  if (!a) throw new Error('Analysis not found');
  const { statementData: sd, periods: ps } = a;
  const v = computeVerticalAnalysis(sd, ps);
  const h = computeHorizontalAnalysis(sd, ps);
  const lr = ps.length > 0 ? computeRatios(sd, ps[ps.length - 1]) : [];
  const tr = computeTrends(sd, ps);
  const ins = generateInsights(v, h, lr, tr);
  await dbRun(`DELETE FROM financial_analysis_ratios WHERE analysis_id=?`, [analysisId]);
  for (const p of ps) {
    for (const r of computeRatios(sd, p)) {
      if (r.value === null) continue;
      await dbRun(
        `INSERT INTO financial_analysis_ratios (id,analysis_id,period,category,ratio_code,ratio_name,value,benchmark_value,interpretation,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          uuidv4(),
          analysisId,
          p,
          r.category,
          r.code,
          r.name,
          r.value,
          r.benchmark ?? null,
          r.interpretation ?? null,
          new Date().toISOString(),
        ]
      );
    }
  }
  await dbRun(`DELETE FROM financial_analysis_insights WHERE analysis_id=?`, [analysisId]);
  for (const i of ins) {
    await dbRun(
      `INSERT INTO financial_analysis_insights (id,analysis_id,insight_type,title,description,priority,status,created_at) VALUES (?,?,?,?,?,?,'DRAFT',?)`,
      [uuidv4(), analysisId, i.type, i.title, i.description, i.priority, new Date().toISOString()]
    );
  }
  await dbRun(`UPDATE financial_analyses SET status='REVIEW',updated_at=? WHERE id=?`, [
    new Date().toISOString(),
    analysisId,
  ]);
  return { vertical: v, horizontal: h, ratios: lr, trends: tr, insights: ins };
}
export async function getAnalysisRatios(analysisId: string): Promise<any[]> {
  return dbAll<any>(
    `SELECT * FROM financial_analysis_ratios WHERE analysis_id=? ORDER BY category,ratio_code`,
    [analysisId]
  );
}
export async function getAnalysisInsights(analysisId: string): Promise<any[]> {
  return dbAll<any>(
    `SELECT * FROM financial_analysis_insights WHERE analysis_id=? ORDER BY priority DESC,created_at`,
    [analysisId]
  );
}
