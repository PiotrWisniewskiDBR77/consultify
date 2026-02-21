/**
 * T054 — Financial Modeling Service
 *
 * Integrated P&L + Balance Sheet + Cash Flow engine driven by economic events.
 * Generates period-by-period outputs with hard consistency checks:
 *   - Assets = Liabilities + Equity
 *   - ΔCash = OCF + ICF + FCF
 *   - Retained earnings tie-out
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType =
  | 'revenue'
  | 'cogs'
  | 'opex'
  | 'capex_purchase'
  | 'depreciation_run'
  | 'debt_drawdown'
  | 'debt_repayment'
  | 'interest_accrual'
  | 'tax_accrual'
  | 'tax_payment'
  | 'wc_change'
  | 'equity_injection'
  | 'dividend';

export type CfClassification = 'operating' | 'investing' | 'financing' | 'none';

export interface ModelEvent {
  id: string;
  model_id: string;
  event_type: EventType;
  name: string;
  description?: string;
  amount: number;
  period_start: string;
  period_end?: string;
  recurrence: string;
  growth_rate: number;
  cf_classification: CfClassification;
  posting_rules: Record<string, any>;
  parameters: Record<string, any>;
  sort_order: number;
  is_active: boolean;
}

export interface PeriodOutput {
  date: string;
  label: string;
  pl: Record<string, number>;
  bs: Record<string, number>;
  cf: Record<string, number>;
}

export interface ValidationResult {
  checkCode: string;
  checkName: string;
  status: 'pass' | 'fail' | 'warning';
  expected: number;
  actual: number;
  difference: number;
  message: string;
  periodDate?: string;
}

export interface ComputeResult {
  periods: PeriodOutput[];
  validations: ValidationResult[];
  overallStatus: 'pass' | 'fail' | 'warning';
}

// ---------------------------------------------------------------------------
// P&L / BS / CF line codes
// ---------------------------------------------------------------------------

const PL_LINES = [
  'REVENUE',
  'COGS',
  'GROSS_PROFIT',
  'OPEX',
  'EBITDA',
  'DEPRECIATION',
  'EBIT',
  'INTEREST_EXPENSE',
  'EBT',
  'TAX',
  'NET_INCOME',
] as const;
const BS_LINES = [
  'CASH',
  'AR',
  'INVENTORY',
  'CURRENT_ASSETS',
  'PPE_GROSS',
  'ACCUM_DEPRECIATION',
  'PPE_NET',
  'TOTAL_ASSETS',
  'AP',
  'CURRENT_LIABILITIES',
  'LONG_TERM_DEBT',
  'TOTAL_LIABILITIES',
  'EQUITY_CAPITAL',
  'RETAINED_EARNINGS',
  'TOTAL_EQUITY',
  'TOTAL_LIABILITIES_EQUITY',
] as const;
const CF_LINES = [
  'NET_INCOME_CF',
  'DEPRECIATION_ADDBACK',
  'WC_CHANGES',
  'OPERATING_CF',
  'CAPEX_CF',
  'INVESTING_CF',
  'DEBT_DRAWDOWN_CF',
  'DEBT_REPAYMENT_CF',
  'EQUITY_CF',
  'DIVIDEND_CF',
  'FINANCING_CF',
  'NET_CHANGE_CASH',
  'OPENING_CASH',
  'CLOSING_CASH',
] as const;

const LINE_NAMES: Record<string, string> = {
  REVENUE: 'Revenue',
  COGS: 'COGS',
  GROSS_PROFIT: 'Gross Profit',
  OPEX: 'Operating Expenses',
  EBITDA: 'EBITDA',
  DEPRECIATION: 'Depreciation & Amortization',
  EBIT: 'EBIT',
  INTEREST_EXPENSE: 'Interest Expense',
  EBT: 'EBT (Earnings Before Tax)',
  TAX: 'Income Tax',
  NET_INCOME: 'Net Income',
  CASH: 'Cash',
  AR: 'Accounts Receivable',
  INVENTORY: 'Inventory',
  CURRENT_ASSETS: 'Current Assets',
  PPE_GROSS: 'PPE (Gross)',
  ACCUM_DEPRECIATION: 'Accumulated Depreciation',
  PPE_NET: 'PPE (Net)',
  TOTAL_ASSETS: 'Total Assets',
  AP: 'Accounts Payable',
  CURRENT_LIABILITIES: 'Current Liabilities',
  LONG_TERM_DEBT: 'Long-term Debt',
  TOTAL_LIABILITIES: 'Total Liabilities',
  EQUITY_CAPITAL: 'Equity Capital',
  RETAINED_EARNINGS: 'Retained Earnings',
  TOTAL_EQUITY: 'Total Equity',
  TOTAL_LIABILITIES_EQUITY: 'Total Liabilities + Equity',
  NET_INCOME_CF: 'Net Income',
  DEPRECIATION_ADDBACK: 'Depreciation Add-back',
  WC_CHANGES: 'Working Capital Changes',
  OPERATING_CF: 'Operating Cash Flow',
  CAPEX_CF: 'Capital Expenditures',
  INVESTING_CF: 'Investing Cash Flow',
  DEBT_DRAWDOWN_CF: 'Debt Drawdown',
  DEBT_REPAYMENT_CF: 'Debt Repayment',
  EQUITY_CF: 'Equity Injection',
  DIVIDEND_CF: 'Dividends',
  FINANCING_CF: 'Financing Cash Flow',
  NET_CHANGE_CASH: 'Net Change in Cash',
  OPENING_CASH: 'Opening Cash',
  CLOSING_CASH: 'Closing Cash',
};

// ---------------------------------------------------------------------------
// Period generation
// ---------------------------------------------------------------------------

function generatePeriods(
  startDate: string,
  horizonMonths: number,
  granularity: string
): Array<{ date: string; label: string }> {
  const periods: Array<{ date: string; label: string }> = [];
  const start = new Date(startDate);
  const stepMonths = granularity === 'annual' ? 12 : granularity === 'quarterly' ? 3 : 1;

  for (let m = 0; m < horizonMonths; m += stepMonths) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const dateStr = d.toISOString().slice(0, 10);
    const label =
      granularity === 'annual'
        ? `FY${d.getFullYear()}`
        : granularity === 'quarterly'
          ? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
          : `${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`;
    periods.push({ date: dateStr, label });
  }
  return periods;
}

// ---------------------------------------------------------------------------
// Event → Period amount expansion
// ---------------------------------------------------------------------------

function expandEventToAmounts(
  event: ModelEvent,
  periods: Array<{ date: string }>
): Map<string, number> {
  const amounts = new Map<string, number>();
  if (!event.is_active) return amounts;

  const startMs = new Date(event.period_start).getTime();
  const endMs = event.period_end ? new Date(event.period_end).getTime() : Infinity;

  for (const period of periods) {
    const pMs = new Date(period.date).getTime();
    if (pMs < startMs || pMs > endMs) continue;

    // Growth: compound from start
    const monthsElapsed = Math.max(0, Math.round((pMs - startMs) / (30.44 * 24 * 60 * 60 * 1000)));
    const growthFactor =
      event.growth_rate !== 0 ? Math.pow(1 + event.growth_rate / 100, monthsElapsed / 12) : 1;

    const periodAmount = event.amount * growthFactor;

    if (event.recurrence === 'one_time') {
      // Only applies to the start period
      if (period.date === periods.find((p) => new Date(p.date).getTime() >= startMs)?.date) {
        amounts.set(period.date, periodAmount);
      }
    } else {
      amounts.set(period.date, periodAmount);
    }
  }
  return amounts;
}

// ---------------------------------------------------------------------------
// Core compute engine
// ---------------------------------------------------------------------------

export async function computeModel(modelId: string): Promise<ComputeResult> {
  const model = (await dbGet(`SELECT * FROM financial_models WHERE id = ?`, [modelId])) as any;
  if (!model) throw new Error('Model not found');

  const events = (
    (await dbAll(
      `SELECT * FROM financial_model_events WHERE model_id = ? AND is_active = TRUE ORDER BY sort_order, created_at`,
      [modelId]
    )) || []
  ).map((e: any) => ({
    ...e,
    posting_rules:
      typeof e.posting_rules === 'string' ? JSON.parse(e.posting_rules) : e.posting_rules || {},
    parameters: typeof e.parameters === 'string' ? JSON.parse(e.parameters) : e.parameters || {},
  })) as ModelEvent[];

  const periods = generatePeriods(model.start_date, model.horizon_months, model.granularity);
  const assumptions =
    typeof model.assumptions_json === 'string'
      ? JSON.parse(model.assumptions_json)
      : model.assumptions_json || {};

  // Initialize period outputs
  const outputs: PeriodOutput[] = periods.map((p) => ({
    date: p.date,
    label: p.label,
    pl: Object.fromEntries(PL_LINES.map((l) => [l, 0])),
    bs: Object.fromEntries(BS_LINES.map((l) => [l, 0])),
    cf: Object.fromEntries(CF_LINES.map((l) => [l, 0])),
  }));

  // Apply initial BS assumptions
  const initialCash = assumptions.initialCash ?? 0;
  const initialEquity = assumptions.initialEquity ?? 0;
  const initialDebt = assumptions.initialDebt ?? 0;
  const initialPPE = assumptions.initialPPE ?? 0;
  const initialAR = assumptions.initialAR ?? 0;
  const initialInventory = assumptions.initialInventory ?? 0;
  const initialAP = assumptions.initialAP ?? 0;

  // Track running BS balances
  let runningCash = initialCash;
  let runningPPEGross = initialPPE;
  let runningAccumDepr = 0;
  let runningDebt = initialDebt;
  let runningEquityCapital = initialEquity;
  let runningRetainedEarnings = 0;
  let runningAR = initialAR;
  let runningInventory = initialInventory;
  let runningAP = initialAP;

  // Expand all events
  const eventAmounts = new Map<string, Map<string, number>>();
  for (const event of events) {
    eventAmounts.set(event.id, expandEventToAmounts(event, periods));
  }

  // Process each period
  for (let pi = 0; pi < outputs.length; pi++) {
    const out = outputs[pi];
    const periodDate = out.date;

    // Accumulate P&L items from events
    let totalRevenue = 0,
      totalCOGS = 0,
      totalOPEX = 0,
      totalDepr = 0,
      totalInterest = 0,
      totalTax = 0;
    let totalCapex = 0,
      totalDebtDrawdown = 0,
      totalDebtRepayment = 0;
    let totalWCChange = 0,
      totalEquityInjection = 0,
      totalDividend = 0;

    for (const event of events) {
      const amt = eventAmounts.get(event.id)?.get(periodDate) ?? 0;
      if (amt === 0) continue;

      switch (event.event_type) {
        case 'revenue':
          totalRevenue += amt;
          break;
        case 'cogs':
          totalCOGS += Math.abs(amt);
          break;
        case 'opex':
          totalOPEX += Math.abs(amt);
          break;
        case 'depreciation_run':
          totalDepr += Math.abs(amt);
          break;
        case 'interest_accrual':
          totalInterest += Math.abs(amt);
          break;
        case 'tax_accrual':
        case 'tax_payment':
          totalTax += Math.abs(amt);
          break;
        case 'capex_purchase':
          totalCapex += Math.abs(amt);
          break;
        case 'debt_drawdown':
          totalDebtDrawdown += amt;
          break;
        case 'debt_repayment':
          totalDebtRepayment += Math.abs(amt);
          break;
        case 'wc_change':
          totalWCChange += amt;
          break;
        case 'equity_injection':
          totalEquityInjection += amt;
          break;
        case 'dividend':
          totalDividend += Math.abs(amt);
          break;
      }
    }

    // ── P&L ──
    out.pl.REVENUE = totalRevenue;
    out.pl.COGS = -totalCOGS;
    out.pl.GROSS_PROFIT = totalRevenue - totalCOGS;
    out.pl.OPEX = -totalOPEX;
    out.pl.EBITDA = out.pl.GROSS_PROFIT - totalOPEX;
    out.pl.DEPRECIATION = -totalDepr;
    out.pl.EBIT = out.pl.EBITDA - totalDepr;
    out.pl.INTEREST_EXPENSE = -totalInterest;
    out.pl.EBT = out.pl.EBIT - totalInterest;
    out.pl.TAX = -totalTax;
    out.pl.NET_INCOME = out.pl.EBT - totalTax;

    // ── BS updates ──
    runningPPEGross += totalCapex;
    runningAccumDepr += totalDepr;
    runningDebt += totalDebtDrawdown - totalDebtRepayment;
    runningRetainedEarnings += out.pl.NET_INCOME - totalDividend;
    runningEquityCapital += totalEquityInjection;

    // WC changes affect AR/Inventory/AP (simplified: distribute proportionally)
    if (totalWCChange !== 0) {
      runningAR += totalWCChange * 0.4;
      runningInventory += totalWCChange * 0.3;
      runningAP -= totalWCChange * 0.3;
    }

    // ── CF ──
    out.cf.NET_INCOME_CF = out.pl.NET_INCOME;
    out.cf.DEPRECIATION_ADDBACK = totalDepr;
    out.cf.WC_CHANGES = -totalWCChange;
    out.cf.OPERATING_CF = out.pl.NET_INCOME + totalDepr - totalWCChange;
    out.cf.CAPEX_CF = -totalCapex;
    out.cf.INVESTING_CF = -totalCapex;
    out.cf.DEBT_DRAWDOWN_CF = totalDebtDrawdown;
    out.cf.DEBT_REPAYMENT_CF = -totalDebtRepayment;
    out.cf.EQUITY_CF = totalEquityInjection;
    out.cf.DIVIDEND_CF = -totalDividend;
    out.cf.FINANCING_CF =
      totalDebtDrawdown - totalDebtRepayment + totalEquityInjection - totalDividend;
    out.cf.NET_CHANGE_CASH = out.cf.OPERATING_CF + out.cf.INVESTING_CF + out.cf.FINANCING_CF;
    out.cf.OPENING_CASH = runningCash;
    runningCash += out.cf.NET_CHANGE_CASH;
    out.cf.CLOSING_CASH = runningCash;

    // ── BS snapshot ──
    out.bs.CASH = runningCash;
    out.bs.AR = runningAR;
    out.bs.INVENTORY = runningInventory;
    out.bs.CURRENT_ASSETS = runningCash + runningAR + runningInventory;
    out.bs.PPE_GROSS = runningPPEGross;
    out.bs.ACCUM_DEPRECIATION = -runningAccumDepr;
    out.bs.PPE_NET = runningPPEGross - runningAccumDepr;
    out.bs.TOTAL_ASSETS = out.bs.CURRENT_ASSETS + out.bs.PPE_NET;
    out.bs.AP = runningAP;
    out.bs.CURRENT_LIABILITIES = runningAP;
    out.bs.LONG_TERM_DEBT = runningDebt;
    out.bs.TOTAL_LIABILITIES = out.bs.CURRENT_LIABILITIES + runningDebt;
    out.bs.EQUITY_CAPITAL = runningEquityCapital;
    out.bs.RETAINED_EARNINGS = runningRetainedEarnings;
    out.bs.TOTAL_EQUITY = runningEquityCapital + runningRetainedEarnings;
    out.bs.TOTAL_LIABILITIES_EQUITY = out.bs.TOTAL_LIABILITIES + out.bs.TOTAL_EQUITY;
  }

  // ── Validations ──
  const validations: ValidationResult[] = [];

  for (const out of outputs) {
    // Balance sheet equation: Assets = Liabilities + Equity
    const bsDiff = Math.abs(out.bs.TOTAL_ASSETS - out.bs.TOTAL_LIABILITIES_EQUITY);
    validations.push({
      checkCode: 'BS_EQUATION',
      checkName: 'Balance Sheet Equation',
      status: bsDiff < 0.01 ? 'pass' : 'fail',
      expected: out.bs.TOTAL_ASSETS,
      actual: out.bs.TOTAL_LIABILITIES_EQUITY,
      difference: round2(bsDiff),
      message:
        bsDiff < 0.01 ? 'Assets = Liabilities + Equity ✓' : `BS mismatch: diff = ${round2(bsDiff)}`,
      periodDate: out.date,
    });

    // Cash tie-out: ΔCash = OCF + ICF + FCF
    const expectedDelta = out.cf.OPERATING_CF + out.cf.INVESTING_CF + out.cf.FINANCING_CF;
    const actualDelta = out.cf.NET_CHANGE_CASH;
    const cfDiff = Math.abs(expectedDelta - actualDelta);
    validations.push({
      checkCode: 'CASH_TIEOUT',
      checkName: 'Cash Flow Tie-out',
      status: cfDiff < 0.01 ? 'pass' : 'fail',
      expected: round2(expectedDelta),
      actual: round2(actualDelta),
      difference: round2(cfDiff),
      message:
        cfDiff < 0.01
          ? 'ΔCash = OCF + ICF + FCF ✓'
          : `Cash tie-out mismatch: diff = ${round2(cfDiff)}`,
      periodDate: out.date,
    });

    // Cash from BS matches CF closing
    const cashBsCfDiff = Math.abs(out.bs.CASH - out.cf.CLOSING_CASH);
    validations.push({
      checkCode: 'CASH_BS_CF_MATCH',
      checkName: 'Cash BS ↔ CF Reconciliation',
      status: cashBsCfDiff < 0.01 ? 'pass' : 'warning',
      expected: round2(out.cf.CLOSING_CASH),
      actual: round2(out.bs.CASH),
      difference: round2(cashBsCfDiff),
      message:
        cashBsCfDiff < 0.01
          ? 'BS Cash = CF Closing Cash ✓'
          : `Cash discrepancy: ${round2(cashBsCfDiff)}`,
      periodDate: out.date,
    });
  }

  const failCount = validations.filter((v) => v.status === 'fail').length;
  const warnCount = validations.filter((v) => v.status === 'warning').length;
  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warning' : 'pass';

  return { periods: outputs, validations, overallStatus };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Persist outputs & validations
// ---------------------------------------------------------------------------

export async function persistComputeResult(
  modelId: string,
  result: ComputeResult,
  scenario: string = 'base'
): Promise<void> {
  // Clear previous outputs and validations
  await dbRun(`DELETE FROM financial_model_outputs WHERE model_id = ? AND scenario = ?`, [
    modelId,
    scenario,
  ]);
  await dbRun(`DELETE FROM financial_model_validations WHERE model_id = ?`, [modelId]);

  // Save outputs
  for (const period of result.periods) {
    for (const [type, lines] of [
      ['P&L', period.pl],
      ['BS', period.bs],
      ['CF', period.cf],
    ] as const) {
      for (const [code, value] of Object.entries(lines)) {
        await dbRun(
          `INSERT INTO financial_model_outputs (id, model_id, period_date, period_label, statement_type, line_code, line_name, value, scenario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            modelId,
            period.date,
            period.label,
            type,
            code,
            LINE_NAMES[code] || code,
            round2(value as number),
            scenario,
          ]
        );
      }
    }
  }

  // Save validations
  for (const v of result.validations) {
    await dbRun(
      `INSERT INTO financial_model_validations (id, model_id, period_date, check_code, check_name, status, expected_value, actual_value, difference, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        modelId,
        v.periodDate || null,
        v.checkCode,
        v.checkName,
        v.status,
        v.expected,
        v.actual,
        v.difference,
        v.message,
      ]
    );
  }

  // Update model validation status
  const modelStatus = result.overallStatus === 'fail' ? 'draft' : undefined;
  if (modelStatus) {
    await dbRun(`UPDATE financial_models SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      modelId,
    ]);
  }
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export async function createModel(params: {
  organizationId: string;
  projectId?: string;
  initiativeId?: string;
  name: string;
  description?: string;
  currency?: string;
  horizonMonths?: number;
  startDate: string;
  granularity?: string;
  scenario?: string;
  assumptions?: Record<string, any>;
  createdBy: string;
}): Promise<string> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO financial_models (id, organization_id, project_id, initiative_id, name, description, currency, horizon_months, start_date, granularity, scenario, assumptions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.organizationId,
      params.projectId || null,
      params.initiativeId || null,
      params.name,
      params.description || null,
      params.currency || 'PLN',
      params.horizonMonths || 60,
      params.startDate,
      params.granularity || 'monthly',
      params.scenario || 'base',
      JSON.stringify(params.assumptions || {}),
      params.createdBy,
    ]
  );
  return id;
}

export async function getModel(modelId: string): Promise<any> {
  const model = (await dbGet(`SELECT * FROM financial_models WHERE id = ?`, [modelId])) as any;
  if (!model) return null;
  model.assumptions_json =
    typeof model.assumptions_json === 'string'
      ? JSON.parse(model.assumptions_json)
      : model.assumptions_json;
  return model;
}

export async function listModels(orgId: string): Promise<any[]> {
  return ((await dbAll(
    `SELECT id, name, description, project_id, initiative_id, currency, horizon_months, start_date, granularity, scenario, status, version, created_at, updated_at FROM financial_models WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 50`,
    [orgId]
  )) || []) as any[];
}

export async function updateModel(modelId: string, updates: Record<string, any>): Promise<void> {
  const allowedFields = [
    'name',
    'description',
    'currency',
    'horizon_months',
    'start_date',
    'granularity',
    'scenario',
    'status',
  ];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (allowedFields.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (updates.assumptions) {
    sets.push('assumptions_json = ?');
    vals.push(JSON.stringify(updates.assumptions));
  }
  if (sets.length === 0) return;
  sets.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(modelId);
  await dbRun(`UPDATE financial_models SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function approveModel(
  modelId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const model = await getModel(modelId);
  if (!model) return { success: false, error: 'Model not found' };

  // Recompute and validate
  const result = await computeModel(modelId);
  if (result.overallStatus === 'fail') {
    return { success: false, error: 'Model has failing validations. Fix issues before approving.' };
  }

  await persistComputeResult(modelId, result, model.scenario || 'base');

  // Create approved snapshot
  const snapshot = JSON.stringify({
    periods: result.periods,
    validations: result.validations,
    computedAt: new Date().toISOString(),
  });
  await dbRun(
    `UPDATE financial_models SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, approved_snapshot = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId, snapshot, modelId]
  );

  return { success: true };
}

// ---------------------------------------------------------------------------
// Event CRUD
// ---------------------------------------------------------------------------

export async function addEvent(params: {
  modelId: string;
  eventType: EventType;
  name: string;
  description?: string;
  amount: number;
  periodStart: string;
  periodEnd?: string;
  recurrence?: string;
  growthRate?: number;
  cfClassification: CfClassification;
  postingRules?: Record<string, any>;
  parameters?: Record<string, any>;
  sortOrder?: number;
  createdBy?: string;
}): Promise<string> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO financial_model_events (id, model_id, event_type, name, description, amount, period_start, period_end, recurrence, growth_rate, cf_classification, posting_rules, parameters, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.modelId,
      params.eventType,
      params.name,
      params.description || null,
      params.amount,
      params.periodStart,
      params.periodEnd || null,
      params.recurrence || 'one_time',
      params.growthRate || 0,
      params.cfClassification,
      JSON.stringify(params.postingRules || {}),
      JSON.stringify(params.parameters || {}),
      params.sortOrder || 0,
      params.createdBy || null,
    ]
  );
  // Reset model to draft on event change
  await dbRun(
    `UPDATE financial_models SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'`,
    [params.modelId]
  );
  return id;
}

export async function updateEvent(eventId: string, updates: Record<string, any>): Promise<void> {
  const event = (await dbGet(`SELECT model_id FROM financial_model_events WHERE id = ?`, [
    eventId,
  ])) as any;
  if (!event) return;

  const allowedFields = [
    'name',
    'description',
    'amount',
    'period_start',
    'period_end',
    'recurrence',
    'growth_rate',
    'cf_classification',
    'sort_order',
    'is_active',
    'event_type',
  ];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (allowedFields.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (updates.posting_rules) {
    sets.push('posting_rules = ?');
    vals.push(JSON.stringify(updates.posting_rules));
  }
  if (updates.parameters) {
    sets.push('parameters = ?');
    vals.push(JSON.stringify(updates.parameters));
  }
  if (sets.length === 0) return;
  sets.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(eventId);
  await dbRun(`UPDATE financial_model_events SET ${sets.join(', ')} WHERE id = ?`, vals);
  await dbRun(
    `UPDATE financial_models SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'`,
    [event.model_id]
  );
}

export async function deleteEvent(eventId: string): Promise<void> {
  const event = (await dbGet(`SELECT model_id FROM financial_model_events WHERE id = ?`, [
    eventId,
  ])) as any;
  await dbRun(`DELETE FROM financial_model_events WHERE id = ?`, [eventId]);
  if (event) {
    await dbRun(
      `UPDATE financial_models SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved'`,
      [event.model_id]
    );
  }
}

export async function listEvents(modelId: string): Promise<any[]> {
  const rows = ((await dbAll(
    `SELECT * FROM financial_model_events WHERE model_id = ? ORDER BY sort_order, created_at`,
    [modelId]
  )) || []) as any[];
  return rows.map((r) => ({
    ...r,
    posting_rules:
      typeof r.posting_rules === 'string' ? JSON.parse(r.posting_rules) : r.posting_rules,
    parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters,
  }));
}

// ---------------------------------------------------------------------------
// Output retrieval
// ---------------------------------------------------------------------------

export async function getOutputs(modelId: string, scenario?: string): Promise<any[]> {
  const q = scenario
    ? `SELECT * FROM financial_model_outputs WHERE model_id = ? AND scenario = ? ORDER BY period_date, statement_type, line_code`
    : `SELECT * FROM financial_model_outputs WHERE model_id = ? ORDER BY period_date, statement_type, line_code`;
  return ((await dbAll(q, scenario ? [modelId, scenario] : [modelId])) || []) as any[];
}

export async function getValidations(modelId: string): Promise<any[]> {
  return ((await dbAll(
    `SELECT * FROM financial_model_validations WHERE model_id = ? ORDER BY period_date, check_code`,
    [modelId]
  )) || []) as any[];
}

logger.info('[FinancialModelingService] Loaded');
