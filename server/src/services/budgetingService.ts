import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import _logger from '../utils/Logger.js';

export interface Budget {
  id: string;
  organizationId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  granularity: string;
  currency: string;
  baselineSource?: string;
  assumptions: BudgetAssumption[];
  version: number;
  approvedBy?: string;
  approvedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
export interface BudgetAssumption {
  key: string;
  value: string;
  note?: string;
}
export interface BudgetLine {
  id: string;
  budgetId: string;
  lineCode: string;
  lineName: string;
  statementType: string;
  source: string;
  driverKpiId?: string;
  driverFormula?: string;
  baselineValue: number;
  isLocked: boolean;
  displayOrder: number;
}
export interface BudgetScenario {
  id: string;
  budgetId: string;
  scenarioType: string;
  name: string;
  description?: string;
  adjustments: ScenarioAdjustment;
  projections: ProjectionData;
  summaryMetrics: SummaryMetrics;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ScenarioAdjustment {
  revenueGrowth?: number;
  costReduction?: number;
  [key: string]: number | undefined;
}
export interface ProjectionData {
  periods: string[];
  lines: Record<string, Record<string, number>>;
}
export interface SummaryMetrics {
  totalRevenue?: number;
  totalCogs?: number;
  grossProfit?: number;
  totalOpex?: number;
  ebitda?: number;
  netIncome?: number;
  operatingCF?: number;
  fcf?: number;
}

function safeJsonParse(r: string | null | undefined, fb: any = {}): any {
  if (!r) return fb;
  try {
    return JSON.parse(r);
  } catch {
    return fb;
  }
}
function mapBudget(r: any): Budget {
  return {
    id: r.id,
    organizationId: r.organization_id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    status: r.status,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    granularity: r.granularity,
    currency: r.currency,
    baselineSource: r.baseline_source,
    assumptions: safeJsonParse(r.assumptions, []),
    version: r.version,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function mapLine(r: any): BudgetLine {
  return {
    id: r.id,
    budgetId: r.budget_id,
    lineCode: r.line_code,
    lineName: r.line_name,
    statementType: r.statement_type,
    source: r.source,
    driverKpiId: r.driver_kpi_id,
    driverFormula: r.driver_formula,
    baselineValue: r.baseline_value ?? 0,
    isLocked: !!r.is_locked,
    displayOrder: r.display_order ?? 0,
  };
}
function mapScenario(r: any): BudgetScenario {
  return {
    id: r.id,
    budgetId: r.budget_id,
    scenarioType: r.scenario_type,
    name: r.name,
    description: r.description,
    adjustments: safeJsonParse(r.adjustments, {}),
    projections: safeJsonParse(r.projections, {}),
    summaryMetrics: safeJsonParse(r.summary_metrics, {}),
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const PL_LINES = [
  { code: 'REVENUE', name: 'Revenue', o: 1 },
  { code: 'COGS', name: 'Cost of Goods Sold', o: 2 },
  { code: 'GROSS_PROFIT', name: 'Gross Profit', o: 3 },
  { code: 'OPEX', name: 'Operating Expenses', o: 4 },
  { code: 'EBITDA', name: 'EBITDA', o: 5 },
  { code: 'DEPRECIATION', name: 'Depreciation & Amortization', o: 6 },
  { code: 'EBIT', name: 'EBIT', o: 7 },
  { code: 'INTEREST_EXPENSE', name: 'Interest Expense', o: 8 },
  { code: 'TAX', name: 'Income Tax', o: 9 },
  { code: 'NET_INCOME', name: 'Net Income', o: 10 },
];
const CF_LINES = [
  { code: 'OPERATING_CF', name: 'Operating Cash Flow', o: 11 },
  { code: 'CAPEX', name: 'Capital Expenditure', o: 12 },
  { code: 'FCF', name: 'Free Cash Flow', o: 13 },
  { code: 'FINANCING_CF', name: 'Financing Cash Flow', o: 14 },
  { code: 'NET_CF', name: 'Net Cash Flow', o: 15 },
];
const SCENARIOS = [
  { type: 'base', name: 'Base Case', active: true },
  { type: 'optimistic', name: 'Optimistic', active: false },
  { type: 'conservative', name: 'Conservative', active: false },
];

export async function createBudget(
  orgId: string,
  data: {
    title: string;
    description?: string;
    projectId?: string;
    periodStart: string;
    periodEnd: string;
    granularity?: string;
    currency?: string;
  },
  userId?: string
): Promise<Budget> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO budgets (id,organization_id,project_id,title,description,status,period_start,period_end,granularity,currency,assumptions,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'DRAFT',?,?,?,?,'[]',1,?,?,?)`,
    [
      id,
      orgId,
      data.projectId || null,
      data.title,
      data.description || null,
      data.periodStart,
      data.periodEnd,
      data.granularity || 'monthly',
      data.currency || 'PLN',
      userId || null,
      now,
      now,
    ]
  );
  for (const l of PL_LINES)
    await dbRun(
      `INSERT INTO budget_lines (id,budget_id,line_code,line_name,statement_type,source,baseline_value,is_locked,display_order,created_at) VALUES (?,?,?,?,'P&L','manual',0,FALSE,?,?)`,
      [uuidv4(), id, l.code, l.name, l.o, now]
    );
  for (const l of CF_LINES)
    await dbRun(
      `INSERT INTO budget_lines (id,budget_id,line_code,line_name,statement_type,source,baseline_value,is_locked,display_order,created_at) VALUES (?,?,?,?,'CF','manual',0,FALSE,?,?)`,
      [uuidv4(), id, l.code, l.name, l.o, now]
    );
  for (const s of SCENARIOS)
    await dbRun(
      `INSERT INTO budget_scenarios (id,budget_id,scenario_type,name,adjustments,projections,summary_metrics,is_active,created_at,updated_at) VALUES (?,?,?,?,'{}','{}','{}',?,?,?)`,
      [uuidv4(), id, s.type, s.name, s.active ? 1 : 0, now, now]
    );
  return {
    id,
    organizationId: orgId,
    projectId: data.projectId,
    title: data.title,
    description: data.description,
    status: 'DRAFT',
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    granularity: data.granularity || 'monthly',
    currency: data.currency || 'PLN',
    baselineSource: undefined,
    assumptions: [],
    version: 1,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
}
export async function getBudget(orgId: string, id: string): Promise<Budget | null> {
  const r = await dbGet<any>(
    `SELECT * FROM budgets WHERE id=? AND organization_id=? AND status<>'ARCHIVED'`,
    [id, orgId]
  );
  return r ? mapBudget(r) : null;
}
export async function listBudgets(orgId: string): Promise<Budget[]> {
  return (
    await dbAll<any>(
      `SELECT * FROM budgets WHERE organization_id=? AND status<>'ARCHIVED' ORDER BY created_at DESC`,
      [orgId]
    )
  ).map(mapBudget);
}
export async function getBudgetLines(budgetId: string): Promise<BudgetLine[]> {
  return (
    await dbAll<any>(`SELECT * FROM budget_lines WHERE budget_id=? ORDER BY display_order`, [
      budgetId,
    ])
  ).map(mapLine);
}
export async function updateBudgetLine(
  budgetId: string,
  lineId: string,
  data: Partial<{
    baselineValue: number;
    source: string;
    driverKpiId: string;
    driverFormula: string;
    isLocked: boolean;
  }>
): Promise<void> {
  const s: string[] = [];
  const p: any[] = [];
  if (data.baselineValue !== undefined) {
    s.push('baseline_value=?');
    p.push(data.baselineValue);
  }
  if (data.source !== undefined) {
    s.push('source=?');
    p.push(data.source);
  }
  if (data.driverKpiId !== undefined) {
    s.push('driver_kpi_id=?');
    p.push(data.driverKpiId);
  }
  if (data.driverFormula !== undefined) {
    s.push('driver_formula=?');
    p.push(data.driverFormula);
  }
  if (data.isLocked !== undefined) {
    s.push('is_locked=?');
    p.push(data.isLocked ? 1 : 0);
  }
  if (!s.length) return;
  p.push(lineId, budgetId);
  await dbRun(`UPDATE budget_lines SET ${s.join(',')} WHERE id=? AND budget_id=?`, p);
}

export function generateProjectionPeriods(start: string, end: string, gran: string): string[] {
  const ps: string[] = [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  if (gran === 'annual') {
    for (let y = sy; y <= ey; y++) ps.push(String(y));
  } else if (gran === 'quarterly') {
    let y = sy,
      q = Math.ceil((sm || 1) / 3);
    while (y < ey || (y === ey && q <= Math.ceil((em || 12) / 3))) {
      ps.push(`${y}-Q${q}`);
      q++;
      if (q > 4) {
        q = 1;
        y++;
      }
    }
  } else {
    let y = sy,
      m = sm || 1;
    while (y < ey || (y === ey && m <= (em || 12))) {
      ps.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return ps;
}
export function computeProjections(
  lines: BudgetLine[],
  periods: string[],
  adj: ScenarioAdjustment,
  st: string
): ProjectionData {
  const mult = st === 'optimistic' ? 1.15 : st === 'conservative' ? 0.85 : 1.0;
  const gr = (adj.revenueGrowth ?? 0) / 100;
  const r: Record<string, Record<string, number>> = {};
  for (const l of lines) {
    r[l.lineCode] = {};
    for (let i = 0; i < periods.length; i++) {
      r[l.lineCode][periods[i]] = l.baselineValue * mult * Math.pow(1 + gr, i);
    }
  }
  for (const p of periods) {
    const rev = r['REVENUE']?.[p] ?? 0;
    const cogs = r['COGS']?.[p] ?? 0;
    if (r['GROSS_PROFIT']) r['GROSS_PROFIT'][p] = rev - cogs;
    const gp = r['GROSS_PROFIT']?.[p] ?? 0;
    const opex = r['OPEX']?.[p] ?? 0;
    if (r['EBITDA']) r['EBITDA'][p] = gp - opex;
    const ebitda = r['EBITDA']?.[p] ?? 0;
    const depr = r['DEPRECIATION']?.[p] ?? 0;
    if (r['EBIT']) r['EBIT'][p] = ebitda - depr;
    const ebit = r['EBIT']?.[p] ?? 0;
    const int = r['INTEREST_EXPENSE']?.[p] ?? 0;
    const tax = r['TAX']?.[p] ?? 0;
    if (r['NET_INCOME']) r['NET_INCOME'][p] = ebit - int - tax;
    const ocf = r['OPERATING_CF']?.[p] ?? 0;
    const capex = r['CAPEX']?.[p] ?? 0;
    if (r['FCF']) r['FCF'][p] = ocf - capex;
    const fcf = r['FCF']?.[p] ?? 0;
    const fin = r['FINANCING_CF']?.[p] ?? 0;
    if (r['NET_CF']) r['NET_CF'][p] = fcf + fin;
  }
  return { periods, lines: r };
}
export function computeSummaryMetrics(proj: ProjectionData): SummaryMetrics {
  const sum = (lc: string) => {
    const v = proj.lines[lc];
    if (!v) return 0;
    return Object.values(v).reduce((a, b) => a + b, 0);
  };
  return {
    totalRevenue: sum('REVENUE'),
    totalCogs: sum('COGS'),
    grossProfit: sum('GROSS_PROFIT'),
    totalOpex: sum('OPEX'),
    ebitda: sum('EBITDA'),
    netIncome: sum('NET_INCOME'),
    operatingCF: sum('OPERATING_CF'),
    fcf: sum('FCF'),
  };
}
export async function generateScenarioProjections(
  orgId: string,
  budgetId: string,
  scenarioId: string
): Promise<BudgetScenario> {
  const b = await getBudget(orgId, budgetId);
  if (!b) throw new Error('Budget not found');
  const ls = await getBudgetLines(budgetId);
  const sr = await dbGet<any>(`SELECT * FROM budget_scenarios WHERE id=? AND budget_id=?`, [
    scenarioId,
    budgetId,
  ]);
  if (!sr) throw new Error('Scenario not found');
  const sc = mapScenario(sr);
  const ps = generateProjectionPeriods(b.periodStart, b.periodEnd, b.granularity);
  const proj = computeProjections(ls, ps, sc.adjustments, sc.scenarioType);
  const sm = computeSummaryMetrics(proj);
  await dbRun(
    `UPDATE budget_scenarios SET projections=?,summary_metrics=?,updated_at=? WHERE id=?`,
    [JSON.stringify(proj), JSON.stringify(sm), new Date().toISOString(), scenarioId]
  );
  return { ...sc, projections: proj, summaryMetrics: sm };
}
export async function getScenarios(budgetId: string): Promise<BudgetScenario[]> {
  return (
    await dbAll<any>(`SELECT * FROM budget_scenarios WHERE budget_id=? ORDER BY scenario_type`, [
      budgetId,
    ])
  ).map(mapScenario);
}
export async function updateScenarioAdjustments(
  budgetId: string,
  scenarioId: string,
  adj: ScenarioAdjustment
): Promise<void> {
  await dbRun(`UPDATE budget_scenarios SET adjustments=?,updated_at=? WHERE id=? AND budget_id=?`, [
    JSON.stringify(adj),
    new Date().toISOString(),
    scenarioId,
    budgetId,
  ]);
}
export async function approveBudget(
  orgId: string,
  budgetId: string,
  userId: string
): Promise<void> {
  const b = await getBudget(orgId, budgetId);
  if (!b) throw new Error('Budget not found');
  const now = new Date().toISOString();
  const ls = await getBudgetLines(budgetId);
  const scs = await getScenarios(budgetId);

  const hasCapex = ls.some(
    (l) =>
      l.lineCode?.toLowerCase().includes('capex') ||
      l.lineName?.toLowerCase().includes('capex') ||
      l.statementType?.toLowerCase() === 'capex'
  );
  if (!hasCapex) {
    throw new Error('CAPEX line is required before approval. Add at least one CAPEX budget line.');
  }
  await dbRun(
    `INSERT INTO budget_snapshots (id,budget_id,version,snapshot_data,approved_by,created_at) VALUES (?,?,?,?,?,?)`,
    [uuidv4(), budgetId, b.version, JSON.stringify({ lines: ls, scenarios: scs }), userId, now]
  );
  await dbRun(
    `UPDATE budgets SET status='APPROVED',approved_by=?,approved_at=?,version=version+1,updated_at=? WHERE id=? AND organization_id=?`,
    [userId, now, now, budgetId, orgId]
  );
}
