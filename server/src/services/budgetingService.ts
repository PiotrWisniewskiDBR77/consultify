import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import _logger from '../utils/Logger.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function safeJsonParse(raw: string | null | undefined, fallback: any = {}): any {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function mapBudget(row: any): Budget {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    granularity: row.granularity,
    currency: row.currency,
    baselineSource: row.baseline_source,
    assumptions: safeJsonParse(row.assumptions, []),
    version: row.version,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLine(row: any): BudgetLine {
  return {
    id: row.id,
    budgetId: row.budget_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    statementType: row.statement_type,
    source: row.source,
    driverKpiId: row.driver_kpi_id,
    driverFormula: row.driver_formula,
    baselineValue: row.baseline_value ?? 0,
    isLocked: !!row.is_locked,
    displayOrder: row.display_order ?? 0,
  };
}

function mapScenario(row: any): BudgetScenario {
  return {
    id: row.id,
    budgetId: row.budget_id,
    scenarioType: row.scenario_type,
    name: row.name,
    description: row.description,
    adjustments: safeJsonParse(row.adjustments, {}),
    projections: safeJsonParse(row.projections, {}),
    summaryMetrics: safeJsonParse(row.summary_metrics, {}),
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DEFAULT_PL_LINES: { code: string; name: string; order: number }[] = [
  { code: 'REVENUE', name: 'Revenue', order: 1 },
  { code: 'COGS', name: 'Cost of Goods Sold', order: 2 },
  { code: 'GROSS_PROFIT', name: 'Gross Profit', order: 3 },
  { code: 'OPEX', name: 'Operating Expenses', order: 4 },
  { code: 'EBITDA', name: 'EBITDA', order: 5 },
  { code: 'DEPRECIATION', name: 'Depreciation & Amortization', order: 6 },
  { code: 'EBIT', name: 'EBIT', order: 7 },
  { code: 'INTEREST_EXPENSE', name: 'Interest Expense', order: 8 },
  { code: 'TAX', name: 'Income Tax', order: 9 },
  { code: 'NET_INCOME', name: 'Net Income', order: 10 },
];

const DEFAULT_CF_LINES: { code: string; name: string; order: number }[] = [
  { code: 'OPERATING_CF', name: 'Operating Cash Flow', order: 11 },
  { code: 'CAPEX', name: 'Capital Expenditure', order: 12 },
  { code: 'FCF', name: 'Free Cash Flow', order: 13 },
  { code: 'FINANCING_CF', name: 'Financing Cash Flow', order: 14 },
  { code: 'NET_CF', name: 'Net Cash Flow', order: 15 },
];

const SCENARIO_DEFAULTS = [
  { type: 'base', name: 'Base Case', active: true },
  { type: 'optimistic', name: 'Optimistic', active: false },
  { type: 'conservative', name: 'Conservative', active: false },
];

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

export async function createBudget(
  orgId: string,
  data: { title: string; description?: string; projectId?: string; periodStart: string; periodEnd: string; granularity?: string; currency?: string },
  userId?: string
): Promise<Budget> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO budgets (id, organization_id, project_id, title, description, status, period_start, period_end, granularity, currency, assumptions, version, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, '[]', 1, ?, ?, ?)`,
    [id, orgId, data.projectId || null, data.title, data.description || null, data.periodStart, data.periodEnd, data.granularity || 'monthly', data.currency || 'PLN', userId || null, now, now]
  );

  for (const l of DEFAULT_PL_LINES) {
    await dbRun(
      `INSERT INTO budget_lines (id, budget_id, line_code, line_name, statement_type, source, baseline_value, is_locked, display_order, created_at)
       VALUES (?, ?, ?, ?, 'P&L', 'manual', 0, FALSE, ?, ?)`,
      [uuidv4(), id, l.code, l.name, l.order, now]
    );
  }

  for (const l of DEFAULT_CF_LINES) {
    await dbRun(
      `INSERT INTO budget_lines (id, budget_id, line_code, line_name, statement_type, source, baseline_value, is_locked, display_order, created_at)
       VALUES (?, ?, ?, ?, 'CF', 'manual', 0, FALSE, ?, ?)`,
      [uuidv4(), id, l.code, l.name, l.order, now]
    );
  }

  for (const s of SCENARIO_DEFAULTS) {
    await dbRun(
      `INSERT INTO budget_scenarios (id, budget_id, scenario_type, name, adjustments, projections, summary_metrics, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, '{}', '{}', '{}', ?, ?, ?)`,
      [uuidv4(), id, s.type, s.name, s.active ? 1 : 0, now, now]
    );
  }

  return { id, organizationId: orgId, projectId: data.projectId, title: data.title, description: data.description, status: 'DRAFT', periodStart: data.periodStart, periodEnd: data.periodEnd, granularity: data.granularity || 'monthly', currency: data.currency || 'PLN', baselineSource: undefined, assumptions: [], version: 1, createdBy: userId, createdAt: now, updatedAt: now };
}

export async function getBudget(orgId: string, id: string): Promise<Budget | null> {
  const row = await dbGet<any>(`SELECT * FROM budgets WHERE id = ? AND organization_id = ?`, [id, orgId]);
  return row ? mapBudget(row) : null;
}

export async function listBudgets(orgId: string): Promise<Budget[]> {
  const rows = await dbAll<any>(`SELECT * FROM budgets WHERE organization_id = ? ORDER BY created_at DESC`, [orgId]);
  return rows.map(mapBudget);
}

export async function getBudgetLines(budgetId: string): Promise<BudgetLine[]> {
  const rows = await dbAll<any>(`SELECT * FROM budget_lines WHERE budget_id = ? ORDER BY display_order`, [budgetId]);
  return rows.map(mapLine);
}

export async function updateBudgetLine(budgetId: string, lineId: string, data: Partial<{ baselineValue: number; source: string; driverKpiId: string; driverFormula: string; isLocked: boolean }>): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.baselineValue !== undefined) { sets.push('baseline_value = ?'); params.push(data.baselineValue); }
  if (data.source !== undefined) { sets.push('source = ?'); params.push(data.source); }
  if (data.driverKpiId !== undefined) { sets.push('driver_kpi_id = ?'); params.push(data.driverKpiId); }
  if (data.driverFormula !== undefined) { sets.push('driver_formula = ?'); params.push(data.driverFormula); }
  if (data.isLocked !== undefined) { sets.push('is_locked = ?'); params.push(data.isLocked ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(lineId, budgetId);
  await dbRun(`UPDATE budget_lines SET ${sets.join(', ')} WHERE id = ? AND budget_id = ?`, params);
}

/* ------------------------------------------------------------------ */
/*  Projection Computation                                             */
/* ------------------------------------------------------------------ */

export function generateProjectionPeriods(start: string, end: string, granularity: string): string[] {
  const periods: string[] = [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);

  if (granularity === 'annual') {
    for (let y = sy; y <= ey; y++) periods.push(String(y));
  } else if (granularity === 'quarterly') {
    let y = sy, q = Math.ceil((sm || 1) / 3);
    while (y < ey || (y === ey && q <= Math.ceil((em || 12) / 3))) {
      periods.push(`${y}-Q${q}`);
      q++;
      if (q > 4) { q = 1; y++; }
    }
  } else {
    let y = sy, m = sm || 1;
    while (y < ey || (y === ey && m <= (em || 12))) {
      periods.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  return periods;
}

export function computeProjections(
  lines: BudgetLine[],
  periods: string[],
  adjustments: ScenarioAdjustment,
  scenarioType: string
): ProjectionData {
  const multiplier = scenarioType === 'optimistic' ? 1.15 : scenarioType === 'conservative' ? 0.85 : 1.0;
  const growthRate = (adjustments.revenueGrowth ?? 0) / 100;
  const result: Record<string, Record<string, number>> = {};

  for (const line of lines) {
    result[line.lineCode] = {};
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const growthFactor = Math.pow(1 + growthRate, i);
      result[line.lineCode][period] = line.baselineValue * multiplier * growthFactor;
    }
  }

  for (const period of periods) {
    const rev = result['REVENUE']?.[period] ?? 0;
    const cogs = result['COGS']?.[period] ?? 0;
    if (result['GROSS_PROFIT']) result['GROSS_PROFIT'][period] = rev - cogs;
    const grossProfit = result['GROSS_PROFIT']?.[period] ?? 0;
    const opex = result['OPEX']?.[period] ?? 0;
    if (result['EBITDA']) result['EBITDA'][period] = grossProfit - opex;
    const ebitda = result['EBITDA']?.[period] ?? 0;
    const depr = result['DEPRECIATION']?.[period] ?? 0;
    if (result['EBIT']) result['EBIT'][period] = ebitda - depr;
    const ebit = result['EBIT']?.[period] ?? 0;
    const interest = result['INTEREST_EXPENSE']?.[period] ?? 0;
    const tax = result['TAX']?.[period] ?? 0;
    if (result['NET_INCOME']) result['NET_INCOME'][period] = ebit - interest - tax;

    const opCF = result['OPERATING_CF']?.[period] ?? 0;
    const capex = result['CAPEX']?.[period] ?? 0;
    if (result['FCF']) result['FCF'][period] = opCF - capex;
    const fcf = result['FCF']?.[period] ?? 0;
    const finCF = result['FINANCING_CF']?.[period] ?? 0;
    if (result['NET_CF']) result['NET_CF'][period] = fcf + finCF;
  }

  return { periods, lines: result };
}

export function computeSummaryMetrics(projections: ProjectionData): SummaryMetrics {
  const sum = (lineCode: string) => {
    const vals = projections.lines[lineCode];
    if (!vals) return 0;
    return Object.values(vals).reduce((a, b) => a + b, 0);
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

export async function generateScenarioProjections(orgId: string, budgetId: string, scenarioId: string): Promise<BudgetScenario> {
  const budget = await getBudget(orgId, budgetId);
  if (!budget) throw new Error('Budget not found');
  const lines = await getBudgetLines(budgetId);
  const scenarioRow = await dbGet<any>(`SELECT * FROM budget_scenarios WHERE id = ? AND budget_id = ?`, [scenarioId, budgetId]);
  if (!scenarioRow) throw new Error('Scenario not found');
  const scenario = mapScenario(scenarioRow);

  const periods = generateProjectionPeriods(budget.periodStart, budget.periodEnd, budget.granularity);
  const projections = computeProjections(lines, periods, scenario.adjustments, scenario.scenarioType);
  const summary = computeSummaryMetrics(projections);

  await dbRun(
    `UPDATE budget_scenarios SET projections = ?, summary_metrics = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(projections), JSON.stringify(summary), new Date().toISOString(), scenarioId]
  );

  return { ...scenario, projections, summaryMetrics: summary };
}

export async function getScenarios(budgetId: string): Promise<BudgetScenario[]> {
  const rows = await dbAll<any>(`SELECT * FROM budget_scenarios WHERE budget_id = ? ORDER BY scenario_type`, [budgetId]);
  return rows.map(mapScenario);
}

export async function updateScenarioAdjustments(budgetId: string, scenarioId: string, adjustments: ScenarioAdjustment): Promise<void> {
  await dbRun(
    `UPDATE budget_scenarios SET adjustments = ?, updated_at = ? WHERE id = ? AND budget_id = ?`,
    [JSON.stringify(adjustments), new Date().toISOString(), scenarioId, budgetId]
  );
}

export async function approveBudget(orgId: string, budgetId: string, userId: string): Promise<void> {
  const budget = await getBudget(orgId, budgetId);
  if (!budget) throw new Error('Budget not found');
  const now = new Date().toISOString();

  const lines = await getBudgetLines(budgetId);
  const scenarios = await getScenarios(budgetId);
  await dbRun(
    `INSERT INTO budget_snapshots (id, budget_id, version, snapshot_data, approved_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), budgetId, budget.version, JSON.stringify({ lines, scenarios }), userId, now]
  );

  await dbRun(
    `UPDATE budgets SET status = 'APPROVED', approved_by = ?, approved_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND organization_id = ?`,
    [userId, now, now, budgetId, orgId]
  );
}
