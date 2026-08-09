import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { normalizeCanonicalLineCode } from './financeCanonicalResolver.js';
import { getVerifiedPackSeed } from './financialStatementPackService.js';
import { loadLatestStatementVersionSnapshot } from './financialStatementService.js';

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
  sourceStatementIds?: string[];
  sourceStatementPackId?: string;
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

function safePct(n: number, d: number): number | null {
  const ratio = safeDiv(n, d);
  return ratio == null ? null : ratio * 100;
}

type BenchmarkDirection = 'higher' | 'lower';

function describeAgainstBenchmark(
  value: number | null,
  benchmark: number | undefined,
  direction: BenchmarkDirection,
  message: string
): string | undefined {
  if (value == null) return `${message} Insufficient source data to compute this KPI.`;
  if (benchmark == null) return message;

  const strong = direction === 'higher' ? value >= benchmark : value <= benchmark;
  const watch = direction === 'higher' ? value >= benchmark * 0.85 : value <= benchmark * 1.15;

  const suffix = strong
    ? 'Currently within a healthy operating range.'
    : watch
      ? 'Close to the reference range but worth monitoring.'
      : 'Outside the typical reference range and should be reviewed.';

  return `${message} ${suffix}`;
}

function buildRatio(
  category: string,
  code: string,
  name: string,
  value: number | null,
  benchmark: number | undefined,
  direction: BenchmarkDirection,
  message: string
): RatioResult {
  return {
    category,
    code,
    name,
    value,
    benchmark,
    interpretation: describeAgainstBenchmark(value, benchmark, direction, message),
  };
}

function toPersistedRatioCategory(category: string): string {
  switch (category) {
    case 'profitability':
      return 'profitability';
    case 'cost_control':
      return 'efficiency';
    case 'cash_liquidity':
      return 'liquidity';
    case 'working_capital':
      return 'efficiency';
    case 'leverage':
      return 'leverage';
    case 'investment':
      return 'growth';
    default:
      return 'efficiency';
  }
}

function safeJsonParse(raw: unknown, fb: any = {}): any {
  if (!raw) return fb;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fb;
  }
}

function analysisPeriodLabel(value: Record<string, any>): string | null {
  const evidence = safeJsonParse(value.evidenceJson ?? value.evidence_json, {});
  const label = value.periodLabel ?? value.period_label ?? evidence.periodLabel ?? evidence.period_label;
  return label == null || String(label).trim() === '' ? null : String(label);
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
    sourceStatementIds: safeJsonParse(row.source_statement_ids, []),
    sourceStatementPackId: row.source_statement_pack_id || undefined,
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

function lineValAny(lines: StatementLine[] | undefined, codes: string[], period: string): number {
  for (const code of codes) {
    const value = lineVal(lines, code, period);
    if (value !== 0) return value;
  }
  return 0;
}

function isInvestmentAnalysisType(value: unknown): boolean {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return (
    normalized === 'investment_case' ||
    normalized === 'investment' ||
    normalized === 'financial' ||
    normalized === 'capex' ||
    normalized.includes('investment') ||
    normalized.includes('capex')
  );
}

async function loadAnalysisStatementRows(statementIds: string[]): Promise<
  Array<{
    statement_id: string;
    value: number;
    line_code: string;
    line_name: string;
    statement_type: string;
    period_label: string | null;
  }>
> {
  const rowsFromSnapshots: Array<{
    statement_id: string;
    value: number;
    line_code: string;
    line_name: string;
    statement_type: string;
    period_label: string | null;
  }> = [];
  let snapshotCoverage = 0;

  for (const statementId of statementIds) {
    const snapshotVersion = await loadLatestStatementVersionSnapshot(statementId);
    const snapshotValues = Array.isArray(snapshotVersion?.snapshot?.values)
      ? snapshotVersion?.snapshot?.values
      : [];
    if (snapshotValues.length === 0) continue;
    const statementRows: typeof rowsFromSnapshots = [];
    for (const value of snapshotValues) {
      const lineCode = normalizeCanonicalLineCode(String(value?.lineCode || ''));
      if (!lineCode) continue;
      statementRows.push({
        statement_id: statementId,
        value: Number(value?.value || 0),
        line_code: lineCode,
        line_name: String(value?.lineName || lineCode),
        statement_type: String(value?.statementType || ''),
        period_label: analysisPeriodLabel(value),
      });
    }
    if (statementRows.length > 0 && statementRows.every((row) => row.period_label)) {
      snapshotCoverage += 1;
      rowsFromSnapshots.push(...statementRows);
    }
  }

  if (snapshotCoverage === statementIds.length && rowsFromSnapshots.length > 0) {
    return rowsFromSnapshots;
  }

  const placeholders = statementIds.map(() => '?').join(',');
  const rows = (await dbAll<any>(
    `SELECT fsv.statement_id, fsv.value, fsv.period_label, fsv.evidence_json,
            fsl.line_code, fsl.line_name, fsl.statement_type
     FROM financial_statement_values fsv
     LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
     WHERE fsv.statement_id IN (${placeholders})`,
    [...statementIds]
  )) as Array<{
    statement_id: string;
    value: number;
    line_code: string;
    line_name: string;
    statement_type: string;
    period_label: string | null;
    evidence_json?: unknown;
  }>;
  return rows.map((row) => ({
    ...row,
    line_code: normalizeCanonicalLineCode(row.line_code),
    period_label: analysisPeriodLabel(row),
  }));
}

function computeInvestmentRatios(data: StatementData, periods: string[]): RatioResult[] {
  if (!periods.length) return [];
  const cashFlows = periods.map((period) => {
    const direct = lineValAny(data.cf, ['FCF', 'FREE_CASH_FLOW', 'NET_CHANGE_CASH'], period);
    if (direct !== 0) return direct;
    const operating = lineValAny(data.cf, ['OPERATING_CF', 'OPERATING_CASH_FLOW'], period);
    const capexRaw = lineValAny(data.cf, ['CAPEX_CF', 'CAPEX'], period);
    const capex = capexRaw > 0 ? -capexRaw : capexRaw;
    return operating + capex;
  });

  if (cashFlows.every((value) => value === 0)) return [];

  const initialInvestment =
    Math.abs(cashFlows.find((value) => value < 0) || 0) ||
    Math.abs(lineValAny(data.cf, ['CAPEX_CF', 'CAPEX'], periods[0]) || 0);
  if (!initialInvestment) return [];

  const npvAt = (rate: number): number =>
    cashFlows.reduce((acc, cashFlow, index) => acc + cashFlow / Math.pow(1 + rate, index), 0);

  const npv = npvAt(0.1);

  let irr: number | null = null;
  let low = -0.99;
  let high = 10;
  let lowNpv = npvAt(low);
  const highNpv = npvAt(high);
  if (Number.isFinite(lowNpv) && Number.isFinite(highNpv) && lowNpv * highNpv < 0) {
    for (let i = 0; i < 80; i += 1) {
      const mid = (low + high) / 2;
      const npvMid = npvAt(mid);
      if (Math.abs(npvMid) < 0.0001) {
        irr = mid;
        break;
      }
      if (lowNpv * npvMid < 0) {
        high = mid;
      } else {
        low = mid;
        lowNpv = npvMid;
      }
    }
    irr = irr ?? (low + high) / 2;
  }

  let paybackPeriods: number | null = null;
  let cumulative = 0;
  for (let index = 0; index < cashFlows.length; index += 1) {
    const prev = cumulative;
    cumulative += cashFlows[index];
    if (cumulative >= 0) {
      const delta = cumulative - prev;
      const fraction = delta !== 0 ? (0 - prev) / delta : 0;
      paybackPeriods = index + Math.max(0, fraction);
      break;
    }
  }

  const roi = (cashFlows.reduce((acc, value) => acc + value, 0) / initialInvestment) * 100;

  return [
    { category: 'investment', code: 'npv', name: 'NPV', value: npv },
    {
      category: 'investment',
      code: 'irr_pct',
      name: 'IRR %',
      value: irr == null ? null : irr * 100,
    },
    {
      category: 'investment',
      code: 'payback_periods',
      name: 'Payback (periods)',
      value: paybackPeriods,
    },
    { category: 'investment', code: 'roi_pct', name: 'ROI %', value: roi },
  ];
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
    sourceStatementIds?: string[];
    sourceStatementPackId?: string;
  },
  userId?: string
): Promise<FinancialAnalysis> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const packSeed = data.sourceStatementPackId
    ? await getVerifiedPackSeed({ organizationId: orgId, packId: data.sourceStatementPackId })
    : null;
  const sourceStatementIds = Array.isArray(data.sourceStatementIds)
    ? data.sourceStatementIds
    : packSeed?.statementIds || [];

  const resolved =
    sourceStatementIds.length > 0 &&
    (!data.statementData || Object.keys(data.statementData).length === 0)
      ? await buildStatementDataFromStatements(orgId, sourceStatementIds)
      : {
          periods: data.periods || [],
          statementData: data.statementData || {},
          currency: data.currency || packSeed?.currency || 'PLN',
        };

  if (sourceStatementIds.length > 0 && (resolved.periods || []).length === 0) {
    throw new Error('Only statement-ready statements can seed a financial analysis');
  }

  await dbRun(
    `INSERT INTO financial_analyses (id,organization_id,project_id,title,description,status,analysis_type,periods,statement_data,currency,source_statement_ids,source_statement_pack_id,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?,?,?)`,
    [
      id,
      orgId,
      data.projectId || null,
      data.title,
      data.description || null,
      data.analysisType || 'comprehensive',
      JSON.stringify(resolved.periods || []),
      JSON.stringify(resolved.statementData || {}),
      resolved.currency || 'PLN',
      JSON.stringify(sourceStatementIds),
      data.sourceStatementPackId || null,
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
    periods: resolved.periods || [],
    statementData: resolved.statementData || {},
    currency: resolved.currency || 'PLN',
    sourceStatementIds,
    sourceStatementPackId: data.sourceStatementPackId || undefined,
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
  } else {
    sql += ` AND UPPER(COALESCE(status, '')) <> 'ARCHIVED'
             AND LOWER(COALESCE(analysis_type, '')) <> 'archived'`;
  }
  if (filters?.projectId) {
    sql += ' AND project_id=?';
    p.push(filters.projectId);
  }
  sql += ' ORDER BY created_at DESC';
  return (await dbAll<any>(sql, p)).map(mapRow);
}

export async function archiveAnalysis(orgId: string, id: string): Promise<boolean> {
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM financial_analyses WHERE id = ? AND organization_id = ?`,
    [id, orgId]
  );
  if (!existing) return false;
  await dbRun(
    `UPDATE financial_analyses
     SET analysis_type = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [id, orgId]
  );
  return true;
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
    sourceStatementIds: string[];
    sourceStatementPackId: string;
    rebuildFromStatements: boolean;
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
  if (data.sourceStatementIds !== undefined) {
    s.push('source_statement_ids=?');
    p.push(JSON.stringify(Array.isArray(data.sourceStatementIds) ? data.sourceStatementIds : []));
  }
  if (data.sourceStatementPackId !== undefined) {
    s.push('source_statement_pack_id=?');
    p.push(data.sourceStatementPackId || null);
  }
  if (
    data.rebuildFromStatements &&
    Array.isArray(data.sourceStatementIds) &&
    data.sourceStatementIds.length > 0
  ) {
    const rebuilt = await buildStatementDataFromStatements(orgId, data.sourceStatementIds);
    s.push('periods=?');
    p.push(JSON.stringify(rebuilt.periods || []));
    s.push('statement_data=?');
    p.push(JSON.stringify(rebuilt.statementData || {}));
    s.push('currency=?');
    p.push(rebuilt.currency || 'PLN');
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
  const cf = (c: string) => lineVal(data.cf, c, period);
  const bsAny = (...codes: string[]) => {
    for (const c of codes) {
      const v = bs(c);
      if (v !== 0) return v;
    }
    return 0;
  };
  const plAny = (...codes: string[]) => {
    for (const c of codes) {
      const v = pl(c);
      if (v !== 0) return v;
    }
    return 0;
  };
  const cfAny = (...codes: string[]) => {
    for (const c of codes) {
      const v = cf(c);
      if (v !== 0) return v;
    }
    return 0;
  };
  const ca = bs('CURRENT_ASSETS');
  const cl = bs('CURRENT_LIABILITIES');
  const inv = bs('INVENTORY');
  const cash = bs('CASH');
  const ta = bs('TOTAL_ASSETS');
  const te = bsAny('TOTAL_EQUITY', 'EQUITY');
  const td = bsAny('TOTAL_DEBT', 'LONG_TERM_DEBT', 'SHORT_TERM_DEBT', 'TOTAL_LIABILITIES');
  const rec = bsAny('AR', 'TRADE_RECEIVABLES', 'RECEIVABLES');
  const payables = bsAny('AP', 'TRADE_PAYABLES', 'CURRENT_LIABILITIES');
  const rev = plAny('REVENUE', 'SALES');
  const cogs = pl('COGS');
  const gpDirect = plAny('GROSS_PROFIT', 'GROSS_MARGIN');
  const gp = gpDirect !== 0 ? gpDirect : rev - cogs;
  const ebitda = plAny('EBITDA', 'OPERATING_INCOME', 'EBIT');
  const ebit = plAny('EBIT', 'OPERATING_INCOME', 'EBITDA');
  const ni = pl('NET_INCOME');
  const ie = plAny('INTEREST_EXPENSE', 'FINANCIAL_EXPENSE');
  const directLabor =
    plAny('DIRECT_LABOR_COGS', 'PRODUCTION_PAYROLL_COGS', 'PRODUCTION_COSTS', 'PAYROLL_COST') +
    plAny('GNA_PAYROLL', 'SOCIAL_SECURITY');
  const energy = plAny('MATERIALS_AND_ENERGY', 'ENERGY_COST', 'UTILITIES_EXPENSE') || 0;
  const operatingCf = cfAny('OPERATING_CF', 'CF_GENERATED', 'OPERATING_CASH_FLOW');
  const capex = Math.abs(cfAny('CAPEX', 'CAPEX_CF', 'CAPITAL_EXPENDITURES'));
  const freeCashFlow = cfAny('FREE_CASH_FLOW', 'FCF') || operatingCf - capex;
  const contributionBaseCosts =
    cogs || plAny('MATERIALS_COGS', 'RAW_MATERIALS_COGS') + directLabor + energy;
  const contributionMargin = safePct(rev - contributionBaseCosts, rev);
  const grossMargin = safePct(gp, rev);
  const ebitdaMargin = safePct(ebitda, rev);
  const netMargin = safePct(ni, rev);
  const cogsRatio = safePct(cogs, rev);
  const laborCostRatio = safePct(directLabor, rev);
  const energyCostRatio = safePct(energy, rev);
  const currentRatio = safeDiv(ca, cl);
  const quickRatio = safeDiv(ca - inv, cl);
  const inventoryDays = safeDiv(inv, cogs) != null ? safeDiv(inv, cogs)! * 365 : null;
  const dso = safeDiv(rec, rev) != null ? safeDiv(rec, rev)! * 365 : null;
  const dpo = safeDiv(payables, cogs) != null ? safeDiv(payables, cogs)! * 365 : null;
  const cashConversionCycle =
    inventoryDays != null && dso != null && dpo != null ? inventoryDays + dso - dpo : null;
  const operatingCashFlowToEbitda = safeDiv(operatingCf, ebitda);
  const inventoryTurnover = safeDiv(cogs, inv);
  const debtToEbitda = safeDiv(td, ebitda);
  const interestCoverage = safeDiv(ebit, ie);

  return [
    buildRatio(
      'profitability',
      'gross_margin_pct',
      'Gross Margin (%)',
      grossMargin,
      30,
      'higher',
      'Shows how much revenue remains after direct production costs.'
    ),
    buildRatio(
      'profitability',
      'ebitda_margin_pct',
      'EBITDA Margin (%)',
      ebitdaMargin,
      15,
      'higher',
      'Measures core operating profitability before depreciation, financing, and tax.'
    ),
    buildRatio(
      'profitability',
      'net_profit_margin_pct',
      'Net Profit Margin (%)',
      netMargin,
      8,
      'higher',
      'Shows what portion of revenue is retained as bottom-line profit.'
    ),
    buildRatio(
      'profitability',
      'contribution_margin_pct',
      'Contribution Margin (%)',
      contributionMargin,
      20,
      'higher',
      'Shows how much revenue is available to cover fixed costs after variable cost absorption.'
    ),
    buildRatio(
      'cost_control',
      'cogs_to_revenue_pct',
      'COGS / Revenue (%)',
      cogsRatio,
      65,
      'lower',
      'Tracks whether manufacturing and delivery costs are under control.'
    ),
    buildRatio(
      'cost_control',
      'labor_cost_ratio_pct',
      'Labor Cost Ratio (%)',
      laborCostRatio,
      18,
      'lower',
      'Shows how much of revenue is consumed by payroll and labor-heavy operations.'
    ),
    buildRatio(
      'cost_control',
      'energy_cost_ratio_pct',
      'Energy Cost Ratio (%)',
      energyCostRatio,
      8,
      'lower',
      'Highlights exposure to energy and utilities intensity in operations.'
    ),
    buildRatio(
      'cash_liquidity',
      'current_ratio',
      'Current Ratio',
      currentRatio,
      1.5,
      'higher',
      'Tests short-term liquidity using all current assets against current liabilities.'
    ),
    buildRatio(
      'cash_liquidity',
      'quick_ratio',
      'Quick Ratio',
      quickRatio,
      1,
      'higher',
      'Tests hard liquidity without relying on inventory conversion.'
    ),
    buildRatio(
      'cash_liquidity',
      'cash_conversion_cycle',
      'Cash Conversion Cycle (CCC)',
      cashConversionCycle,
      45,
      'lower',
      'Shows how many days cash is tied up in receivables and inventory net of payables.'
    ),
    buildRatio(
      'cash_liquidity',
      'operating_cf_to_ebitda',
      'Operating Cash Flow / EBITDA',
      operatingCashFlowToEbitda,
      0.8,
      'higher',
      'Checks whether accounting profit is converting into operating cash.'
    ),
    buildRatio(
      'cash_liquidity',
      'free_cash_flow',
      'Free Cash Flow (FCF)',
      freeCashFlow,
      0,
      'higher',
      'Shows how much cash remains after operating needs and capital expenditures.'
    ),
    buildRatio(
      'working_capital',
      'inventory_days',
      'Inventory Days',
      inventoryDays,
      75,
      'lower',
      'Shows how long inventory stays on hand before it is sold.'
    ),
    buildRatio(
      'working_capital',
      'dso',
      'DSO (Days Sales Outstanding)',
      dso,
      45,
      'lower',
      'Measures how long the company waits to collect cash from customers.'
    ),
    buildRatio(
      'working_capital',
      'dpo',
      'DPO (Days Payables Outstanding)',
      dpo,
      60,
      'lower',
      'Shows supplier payment timing and working-capital financing discipline.'
    ),
    buildRatio(
      'working_capital',
      'inventory_turnover',
      'Inventory Turnover',
      inventoryTurnover,
      5,
      'higher',
      'Measures how quickly inventory is converted into revenue.'
    ),
    buildRatio(
      'leverage',
      'debt_to_ebitda',
      'Debt / EBITDA',
      debtToEbitda,
      3,
      'lower',
      'Measures debt load relative to operating cash earnings capacity.'
    ),
    buildRatio(
      'leverage',
      'interest_coverage',
      'Interest Coverage Ratio (EBIT / Interest)',
      interestCoverage,
      4,
      'higher',
      'Shows how comfortably operating profit covers interest burden.'
    ),
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
  const de = ratios.find((r) => r.code === 'debt_to_ebitda');
  if (de?.value != null && de.value > 3)
    ins.push({
      type: 'risk',
      title: 'High leverage risk',
      description: `Debt / EBITDA (${de.value.toFixed(2)}) exceeds 3.0`,
      priority: 3,
    });
  const nm = ratios.find((r) => r.code === 'net_profit_margin_pct');
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
  const investmentRatios = isInvestmentAnalysisType(a.analysisType)
    ? computeInvestmentRatios(sd, ps)
    : [];
  const lr = ps.length > 0 ? [...computeRatios(sd, ps[ps.length - 1]), ...investmentRatios] : [];
  const tr = computeTrends(sd, ps);
  const ins = generateInsights(v, h, lr, tr);
  await dbRun(`DELETE FROM financial_analysis_ratios WHERE analysis_id=?`, [analysisId]);
  for (const p of ps) {
    const ratiosForPeriod = [
      ...computeRatios(sd, p),
      ...(p === ps[ps.length - 1] ? investmentRatios : []),
    ];
    for (const r of ratiosForPeriod) {
      if (r.value === null) continue;
      await dbRun(
        `INSERT INTO financial_analysis_ratios (id,analysis_id,period,category,ratio_code,ratio_name,value,benchmark_value,interpretation,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          uuidv4(),
          analysisId,
          p,
          toPersistedRatioCategory(r.category),
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

export async function computeLivePreview(orgId: string): Promise<any[]> {
  const latestModel = await dbGet<any>(
    `SELECT id FROM financial_models WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [orgId]
  );
  if (!latestModel) throw new Error('No financial model found');

  const outputs = await dbAll<any>(
    // Postgres schema (T054): period_date + period_label (not "period").
    `SELECT statement_type, line_code, line_name, period_label as period, value FROM financial_model_outputs WHERE model_id = ? ORDER BY period_date, statement_type, line_code`,
    [latestModel.id]
  );
  if (!outputs?.length) throw new Error('Model has no computed outputs');

  const periods = [...new Set(outputs.map((o: any) => o.period))].sort();
  const sd: StatementData = { pl: [], bs: [], cf: [] };
  const lineMap = new Map<string, StatementLine>();
  for (const o of outputs) {
    const key = `${o.statement_type}:${o.line_code}`;
    let line = lineMap.get(key);
    if (!line) {
      line = { code: o.line_code, name: o.line_name || o.line_code, values: {} };
      lineMap.set(key, line);
      const st = (o.statement_type || '').toUpperCase();
      if (st.includes('PL') || st.includes('P&L')) sd.pl!.push(line);
      else if (st.includes('BS')) sd.bs!.push(line);
      else if (st.includes('CF')) sd.cf!.push(line);
      else sd.pl!.push(line);
    }
    line.values[o.period] = Number(o.value || 0);
  }

  const result: any[] = [];
  for (const p of periods) {
    const ratios = computeRatios(sd, p);
    for (const r of ratios) {
      if (r.value == null) continue;
      result.push({
        id: `live-${r.code}-${p}`,
        category: r.category,
        ratio_code: r.code,
        ratio_name: r.name,
        value: r.value,
        period: p,
        benchmark_value: r.benchmark ?? null,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// T052: statement_data builder from T050 financial_statements
// ---------------------------------------------------------------------------

async function buildStatementDataFromStatements(
  organizationId: string,
  statementIds: string[]
): Promise<{ periods: string[]; statementData: StatementData; currency: string }> {
  const ids = statementIds.filter(Boolean).slice(0, 50);
  if (ids.length === 0) return { periods: [], statementData: {}, currency: 'PLN' };

  const placeholders = ids.map(() => '?').join(',');
  let stmts: any[];
  try {
    stmts = await dbAll<any>(
      `SELECT id, statement_type, period_label, period_end, currency
       FROM financial_statements
       WHERE organization_id = ? AND id IN (${placeholders}) AND readiness_status = 'ready'
       ORDER BY period_end DESC`,
      [organizationId, ...ids]
    );
  } catch {
    stmts = await dbAll<any>(
      `SELECT id, statement_type, period_label, period_end, currency
       FROM financial_statements
       WHERE organization_id = ? AND id IN (${placeholders}) AND status IN ('confirmed', 'mapped')
       ORDER BY period_end DESC`,
      [organizationId, ...ids]
    );
  }

  const currency = String(stmts?.find((s: any) => s.currency)?.currency || 'PLN');
  const periodKey = (s: any) =>
    String(s.period_label || '').trim() ||
    String(s.period_end || '').slice(0, 10) ||
    String(s.id).slice(0, 8);

  const valueRows = await loadAnalysisStatementRows(ids);
  const periodsFromValues = valueRows
    .map((row) => String(row.period_label || '').trim())
    .filter(Boolean);
  const periods = Array.from(
    new Set(periodsFromValues.length > 0 ? periodsFromValues : (stmts || []).map(periodKey))
  ).sort();

  const stmtById = new Map<string, any>();
  for (const s of stmts || []) stmtById.set(String(s.id), s);

  const makeLineMap = () => new Map<string, StatementLine>();
  const plMap = makeLineMap();
  const bsMap = makeLineMap();
  const cfMap = makeLineMap();

  const pushVal = (
    map: Map<string, StatementLine>,
    code: string,
    name: string,
    period: string,
    v: number
  ) => {
    if (!code) return;
    const key = String(code);
    const line = map.get(key) || { code: key, name: name || key, values: {} };
    line.values[period] = (line.values[period] || 0) + (Number(v) || 0);
    map.set(key, line);
  };

  for (const r of valueRows || []) {
    const stmtId = String(r.statement_id);
    const stmt = stmtById.get(stmtId);
    if (!stmt) continue;
    const p = String(r.period_label || '').trim() || periodKey(stmt);
    const st = String(r.statement_type || stmt.statement_type || '').toUpperCase();
    const code = String(r.line_code || '').toUpperCase();
    const name = String(r.line_name || code);
    if (!code) continue;
    if (st === 'P&L' || st.includes('PL')) pushVal(plMap, code, name, p, r.value);
    else if (st === 'BS') pushVal(bsMap, code, name, p, r.value);
    else if (st === 'CF') pushVal(cfMap, code, name, p, r.value);
  }

  const statementData: StatementData = {
    pl: Array.from(plMap.values()),
    bs: Array.from(bsMap.values()),
    cf: Array.from(cfMap.values()),
  };

  return { periods, statementData, currency };
}
