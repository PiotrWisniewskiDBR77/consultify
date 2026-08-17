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
import { normalizeCanonicalLineCode } from './financeCanonicalResolver.js';
import { toPeriodIsoDate } from './financePeriodFormat.js';
import { getVerifiedPackSeed } from './financialStatementPackService.js';
import { loadLatestStatementVersionSnapshot } from './financialStatementService.js';
import {
  type PeriodStatements,
  RECONCILE_ENFORCE,
  reconcileStatements,
  shouldBlockReady,
} from './reconciliationService.js';
import {
  FINANCIAL_MODEL_DRIVERS,
  financialModelToAssumptions,
} from './shared/assumptionsFinancialModelDrivers.js';
import { auditCoverage, listAssumptions } from './shared/assumptionsRegistry.js';

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
  'OTHER_ASSETS',
  'TOTAL_ASSETS',
  'AP',
  'CURRENT_LIABILITIES',
  'LONG_TERM_DEBT',
  'OTHER_LIABILITIES',
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

type StatementSeedResult = {
  assumptions: Record<string, any>;
  statementMeta: {
    id: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    currency: string;
    scaling: string;
    sourceFileName: string;
    status: string;
    readinessStatus: string;
  };
};

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function firstNonZero(map: Map<string, number>, codes: string[]): number {
  for (const code of codes) {
    const value = numberOrZero(map.get(code));
    if (value !== 0) return value;
  }
  return 0;
}

function sumAbsoluteCodes(map: Map<string, number>, codes: string[]): number {
  return codes.reduce((sum, code) => sum + Math.abs(numberOrZero(map.get(code))), 0);
}

function latestPeriodRows<T extends { period_label?: string | null }>(rows: T[]): T[] {
  const ranked = rows
    .map((row) => ({ row, year: Number(String(row.period_label || '').match(/(?:19|20)\d{2}/)?.[0] || 0) }))
    .filter((entry) => entry.year > 0);
  if (ranked.length === 0) return rows;
  const latestYear = Math.max(...ranked.map((entry) => entry.year));
  return ranked.filter((entry) => entry.year === latestYear).map((entry) => entry.row);
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function seedPeriodLabel(value: Record<string, any>): string | null {
  const evidence = parseJsonObject(value.evidenceJson ?? value.evidence_json);
  const label = value.periodLabel ?? value.period_label ?? evidence.periodLabel ?? evidence.period_label;
  return label == null || String(label).trim() === '' ? null : String(label);
}

function mergeAssumptions(
  seeded: Record<string, any>,
  incoming?: Record<string, any>
): Record<string, any> {
  if (!incoming) return seeded;
  return {
    ...seeded,
    ...incoming,
    baseline: {
      ...(seeded.baseline || {}),
      ...(incoming.baseline || {}),
    },
    seedSource: seeded.seedSource || incoming.seedSource,
    seedStatus: seeded.seedStatus || incoming.seedStatus,
  };
}

async function loadSeedValueRows(
  statementIds: string[]
): Promise<Array<{ line_code: string; value: number; period_label?: string | null }>> {
  const rowsFromSnapshots: Array<{ line_code: string; value: number; period_label?: string | null }> = [];
  let snapshotCoverage = 0;

  for (const statementId of statementIds) {
    const snapshotVersion = await loadLatestStatementVersionSnapshot(statementId);
    const snapshotValues = Array.isArray(snapshotVersion?.snapshot?.values)
      ? snapshotVersion?.snapshot?.values
      : [];
    if (snapshotValues.length === 0) continue;
    const statementRows: Array<{
      line_code: string;
      value: number;
      period_label?: string | null;
    }> = [];
    for (const value of snapshotValues) {
      const lineCode = normalizeCanonicalLineCode(String(value?.lineCode || ''));
      if (!lineCode) continue;
      statementRows.push({
        line_code: lineCode,
        value: numberOrZero(value?.value),
        period_label: seedPeriodLabel(value),
      });
    }
    // Older approved snapshots contain canonical totals but omit period lineage.
    // They cannot safely seed a multi-period model because duplicate line codes
    // would be summed. In that case use the value rows, where evidence_json keeps
    // the source period, instead of silently manufacturing a combined period.
    if (statementRows.length > 0 && statementRows.every((row) => row.period_label)) {
      snapshotCoverage += 1;
      rowsFromSnapshots.push(...statementRows);
    }
  }

  if (snapshotCoverage === statementIds.length && rowsFromSnapshots.length > 0) {
    return latestPeriodRows(rowsFromSnapshots);
  }

  const placeholders = statementIds.map(() => '?').join(',');
  const rows = (await dbAll<any>(
    `SELECT COALESCE(UPPER(fsl.line_code), '') AS line_code, fsv.value, fsv.period_label, fsv.evidence_json
     FROM financial_statement_values fsv
     LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
     WHERE fsv.statement_id IN (${placeholders})`,
    statementIds
  )) as Array<{
    line_code: string;
    value: number;
    period_label?: string | null;
    evidence_json?: unknown;
  }>;
  return latestPeriodRows(rows.map((row) => ({ ...row, period_label: seedPeriodLabel(row) })));
}

async function buildSeededAssumptionsFromStatement(
  organizationId: string,
  statementId: string
): Promise<StatementSeedResult> {
  let stmt: any;
  try {
    stmt = await dbGet<any>(
      `SELECT id, period_label, period_start, period_end, currency, scaling, source_file_name, status, readiness_status
       FROM financial_statements
       WHERE id = ? AND organization_id = ?`,
      [statementId, organizationId]
    );
  } catch {
    stmt = await dbGet<any>(
      `SELECT id, period_label, period_start, period_end, currency, scaling, source_file_name, status
       FROM financial_statements
       WHERE id = ? AND organization_id = ?`,
      [statementId, organizationId]
    );
  }
  if (!stmt) throw new Error('Source statement not found');

  const readinessStatus = String(
    stmt.readiness_status ||
      (['confirmed', 'mapped'].includes(String(stmt.status || '').toLowerCase())
        ? 'ready'
        : 'recoverable')
  ).toLowerCase();
  if (readinessStatus !== 'ready') {
    throw new Error('Statement must be statement-ready before it can seed a model');
  }

  const rows = await loadSeedValueRows([statementId]);

  const valuesByCode = new Map<string, number>();
  for (const row of rows || []) {
    const code = normalizeCanonicalLineCode(String(row.line_code || ''));
    if (!code) continue;
    valuesByCode.set(code, numberOrZero(valuesByCode.get(code)) + numberOrZero(row.value));
  }

  const cash = firstNonZero(valuesByCode, ['CASH']);
  const totalAssets = firstNonZero(valuesByCode, ['TOTAL_ASSETS']);
  const equity = firstNonZero(valuesByCode, ['TOTAL_EQUITY', 'EQUITY', 'EQUITY_CAPITAL']);
  const debt = firstNonZero(valuesByCode, ['LONG_TERM_DEBT', 'SHORT_TERM_DEBT']);
  const totalLiabilities = firstNonZero(valuesByCode, ['TOTAL_LIABILITIES']);
  const ppe = firstNonZero(valuesByCode, ['PPE_NET', 'PROPERTY_PLANT_EQUIPMENT', 'PPE_GROSS']);
  const ar = firstNonZero(valuesByCode, ['AR']);
  const inventory = firstNonZero(valuesByCode, ['INVENTORY']);
  const ap = firstNonZero(valuesByCode, ['AP', 'CURRENT_LIABILITIES']);

  const missingCritical: string[] = [];
  if (totalAssets === 0) missingCritical.push('TOTAL_ASSETS');
  if (equity === 0) missingCritical.push('EQUITY');
  if (cash === 0) missingCritical.push('CASH');
  if (missingCritical.length > 0) {
    throw new Error(`Statement missing critical lines: ${missingCritical.join(', ')}`);
  }

  const grossProfit = firstNonZero(valuesByCode, ['GROSS_PROFIT']);
  const ebit = firstNonZero(valuesByCode, ['EBIT']);
  const directOpex = firstNonZero(valuesByCode, ['OPEX']);
  const baselineOpex = directOpex || Math.abs(grossProfit - ebit) || sumAbsoluteCodes(valuesByCode, [
    'RND',
    'SGA',
    'SELLING_EXPENSES',
    'GENERAL_ADMIN_EXPENSES',
    'OTHER_OPEX',
  ]);
  const directDepreciation = firstNonZero(valuesByCode, ['DEPRECIATION']);
  const baselineDepreciation = directDepreciation || sumAbsoluteCodes(valuesByCode, [
    'DEPRECIATION_PPE_CF',
    'DEPRECIATION_ROU_CF',
    'DEPRECIATION_INTANGIBLES_CF',
    'DEPRECIATION_AMORTIZATION_CF',
  ]);
  const otherAssets = totalAssets - cash - ar - inventory - ppe;
  const openingBalanceResidual = totalAssets - totalLiabilities - equity;
  const otherLiabilities = totalAssets - equity - ap - debt;
  const baseline = {
    revenue: Math.abs(firstNonZero(valuesByCode, ['REVENUE'])),
    cogs: Math.abs(firstNonZero(valuesByCode, ['COGS'])),
    opex: Math.abs(baselineOpex),
    depreciation: Math.abs(baselineDepreciation),
    interest: Math.abs(firstNonZero(valuesByCode, ['INTEREST_EXPENSE'])),
    tax: Math.abs(firstNonZero(valuesByCode, ['TAX', 'TAX_EXPENSE'])),
    capex: Math.abs(firstNonZero(valuesByCode, ['CAPEX', 'CAPEX_CF', 'CFI'])),
  };

  const missingBaselineLines = Object.entries({
    revenue: baseline.revenue,
    cogs: baseline.cogs,
    opex: baseline.opex,
  })
    .filter(([, value]) => !numberOrZero(value))
    .map(([key]) => key);

  return {
    assumptions: {
      initialCash: cash,
      initialAR: ar,
      initialInventory: inventory,
      initialAP: ap,
      initialDebt: debt,
      initialEquity: equity,
      sourceEquity: equity,
      sourceTotalLiabilities: totalLiabilities,
      openingBalanceResidual,
      initialOtherAssets: otherAssets,
      initialOtherLiabilities: otherLiabilities,
      initialPPE: ppe,
      baseline,
      seedSource: {
        type: 'statement',
        statementId,
        statementStatus: String(stmt.status || ''),
        readinessStatus,
        periodLabel: String(stmt.period_label || ''),
        sourceFileName: String(stmt.source_file_name || ''),
      },
      seedStatus: {
        type: 'statement',
        state: 'seeded',
        missingBaselineLines,
      },
    },
    statementMeta: {
      id: String(stmt.id),
      periodLabel: String(stmt.period_label || ''),
      periodStart: String(stmt.period_start || ''),
      periodEnd: String(stmt.period_end || ''),
      currency: String(stmt.currency || 'PLN'),
      scaling: String(stmt.scaling || 'units'),
      sourceFileName: String(stmt.source_file_name || ''),
      status: String(stmt.status || ''),
      readinessStatus,
    },
  };
}

async function buildSeededAssumptionsFromPack(
  organizationId: string,
  packId: string
): Promise<StatementSeedResult> {
  const packSeed = await getVerifiedPackSeed({ organizationId, packId });
  const statementIds = packSeed.statementIds;
  const placeholders = statementIds.map(() => '?').join(',');

  const statements = await dbAll<any>(
    `SELECT id, statement_type, period_label, period_start, period_end, currency, scaling, source_file_name, status,
            readiness_status
     FROM financial_statements
     WHERE organization_id = ? AND id IN (${placeholders})`,
    [organizationId, ...statementIds]
  );
  if (!Array.isArray(statements) || statements.length === 0) {
    throw new Error('Source statement pack not found');
  }

  const rows = await loadSeedValueRows(statementIds);

  const valuesByCode = new Map<string, number>();
  for (const row of rows || []) {
    const code = normalizeCanonicalLineCode(String(row.line_code || ''));
    if (!code) continue;
    valuesByCode.set(code, numberOrZero(valuesByCode.get(code)) + numberOrZero(row.value));
  }

  const cash = firstNonZero(valuesByCode, ['CASH']);
  const totalAssets = firstNonZero(valuesByCode, ['TOTAL_ASSETS']);
  const equity = firstNonZero(valuesByCode, ['TOTAL_EQUITY', 'EQUITY', 'EQUITY_CAPITAL']);
  const debt = firstNonZero(valuesByCode, ['LONG_TERM_DEBT', 'SHORT_TERM_DEBT']);
  const totalLiabilities = firstNonZero(valuesByCode, ['TOTAL_LIABILITIES']);
  const ppe = firstNonZero(valuesByCode, ['PPE_NET', 'PROPERTY_PLANT_EQUIPMENT', 'PPE_GROSS']);
  const ar = firstNonZero(valuesByCode, ['AR']);
  const inventory = firstNonZero(valuesByCode, ['INVENTORY']);
  const ap = firstNonZero(valuesByCode, ['AP', 'CURRENT_LIABILITIES']);

  const missingCritical: string[] = [];
  if (totalAssets === 0) missingCritical.push('TOTAL_ASSETS');
  if (equity === 0) missingCritical.push('EQUITY');
  if (cash === 0) missingCritical.push('CASH');
  if (missingCritical.length > 0) {
    throw new Error(`Statement pack missing critical lines: ${missingCritical.join(', ')}`);
  }

  const grossProfit = firstNonZero(valuesByCode, ['GROSS_PROFIT']);
  const ebit = firstNonZero(valuesByCode, ['EBIT']);
  const directOpex = firstNonZero(valuesByCode, ['OPEX']);
  const baselineOpex = directOpex || Math.abs(grossProfit - ebit) || sumAbsoluteCodes(valuesByCode, [
    'RND',
    'SGA',
    'SELLING_EXPENSES',
    'GENERAL_ADMIN_EXPENSES',
    'OTHER_OPEX',
  ]);
  const directDepreciation = firstNonZero(valuesByCode, ['DEPRECIATION']);
  const baselineDepreciation = directDepreciation || sumAbsoluteCodes(valuesByCode, [
    'DEPRECIATION_PPE_CF',
    'DEPRECIATION_ROU_CF',
    'DEPRECIATION_INTANGIBLES_CF',
    'DEPRECIATION_AMORTIZATION_CF',
  ]);
  const otherAssets = totalAssets - cash - ar - inventory - ppe;
  const openingBalanceResidual = totalAssets - totalLiabilities - equity;
  const otherLiabilities = totalAssets - equity - ap - debt;
  const baseline = {
    revenue: Math.abs(firstNonZero(valuesByCode, ['REVENUE'])),
    cogs: Math.abs(firstNonZero(valuesByCode, ['COGS'])),
    opex: Math.abs(baselineOpex),
    depreciation: Math.abs(baselineDepreciation),
    interest: Math.abs(firstNonZero(valuesByCode, ['INTEREST_EXPENSE'])),
    tax: Math.abs(firstNonZero(valuesByCode, ['TAX', 'TAX_EXPENSE'])),
    capex: Math.abs(firstNonZero(valuesByCode, ['CAPEX', 'CAPEX_CF', 'CFI'])),
  };

  const missingBaselineLines = Object.entries({
    revenue: baseline.revenue,
    cogs: baseline.cogs,
    opex: baseline.opex,
  })
    .filter(([, value]) => !numberOrZero(value))
    .map(([key]) => key);

  const statementLabel =
    packSeed.periodLabel || String(statements[0]?.period_label || statements[0]?.period_end || '');

  return {
    assumptions: {
      initialCash: cash,
      initialAR: ar,
      initialInventory: inventory,
      initialAP: ap,
      initialDebt: debt,
      initialEquity: equity,
      sourceEquity: equity,
      sourceTotalLiabilities: totalLiabilities,
      openingBalanceResidual,
      initialOtherAssets: otherAssets,
      initialOtherLiabilities: otherLiabilities,
      initialPPE: ppe,
      baseline,
      seedSource: {
        type: 'statement_pack',
        statementPackId: packId,
        statementIds,
        periodLabel: statementLabel,
        currency: packSeed.currency,
      },
      seedStatus: {
        type: 'statement_pack',
        state: 'seeded',
        missingBaselineLines,
      },
    },
    statementMeta: {
      id: String(packId),
      periodLabel: statementLabel,
      periodStart: String(statements[0]?.period_start || ''),
      periodEnd: String(statements[0]?.period_end || ''),
      currency: String(packSeed.currency || statements[0]?.currency || 'PLN'),
      scaling: String(statements[0]?.scaling || 'units'),
      sourceFileName: String(
        (statements || [])
          .map((row) => row.source_file_name)
          .filter(Boolean)
          .join(', ')
      ),
      status: 'ready',
      readinessStatus: 'ready',
    },
  };
}

// ---------------------------------------------------------------------------
// Period generation (SSOT: internal compute resolution = monthly)
// ---------------------------------------------------------------------------

function generateMonthlyPeriods(
  startDate: string,
  horizonMonths: number
): Array<{ date: string; label: string }> {
  const periods: Array<{ date: string; label: string }> = [];
  // IMPORTANT:
  // Finance periods must be deterministic and timezone-safe.
  // Using `new Date(y, m, d).toISOString()` can shift the day in non-UTC timezones.
  const start = new Date(`${startDate}T00:00:00.000Z`);

  for (let m = 0; m < horizonMonths; m += 1) {
    const year = start.getUTCFullYear();
    const monthIndex = start.getUTCMonth() + m; // 0-based
    const d = new Date(Date.UTC(year, monthIndex, 1));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-01`;
    const label = `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
    periods.push({ date: dateStr, label });
  }
  return periods;
}

function monthDiffUtc(fromDate: string, toDate: string): number {
  // Dates are normalized as YYYY-MM-01
  const f = new Date(`${fromDate}T00:00:00.000Z`);
  const t = new Date(`${toDate}T00:00:00.000Z`);
  return (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + (t.getUTCMonth() - f.getUTCMonth());
}

function labelForPeriodEnd(granularity: string, periodEndDate: string): string {
  const d = new Date(`${periodEndDate}T00:00:00.000Z`);
  if (granularity === 'annual') return `FY${d.getUTCFullYear()}`;
  if (granularity === 'quarterly')
    return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  return `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

function aggregateMonthlyOutputs(monthly: PeriodOutput[], granularity: string): PeriodOutput[] {
  if (granularity === 'monthly') return monthly;
  const stepMonths = granularity === 'annual' ? 12 : 3;

  const buckets: Array<{ startIdx: number; endIdx: number }> = [];
  for (let i = 0; i < monthly.length; i += stepMonths) {
    buckets.push({ startIdx: i, endIdx: Math.min(i + stepMonths - 1, monthly.length - 1) });
  }

  const flowCfLines = new Set<string>([
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
  ]);

  const res: PeriodOutput[] = [];
  for (const b of buckets) {
    const first = monthly[b.startIdx];
    const last = monthly[b.endIdx];
    const agg: PeriodOutput = {
      date: last.date,
      label: labelForPeriodEnd(granularity, last.date),
      pl: Object.fromEntries(PL_LINES.map((l) => [l, 0])),
      bs: Object.fromEntries(BS_LINES.map((l) => [l, 0])),
      cf: Object.fromEntries(CF_LINES.map((l) => [l, 0])),
    };

    // Sum flows (P&L + CF flows)
    for (let i = b.startIdx; i <= b.endIdx; i++) {
      const m = monthly[i];
      for (const l of PL_LINES) agg.pl[l] += m.pl[l] || 0;
      for (const l of CF_LINES) {
        if (flowCfLines.has(l)) agg.cf[l] += m.cf[l] || 0;
      }
    }

    // BS is a snapshot at end of period
    for (const l of BS_LINES) agg.bs[l] = last.bs[l] || 0;

    // CF opening/closing cash are snapshots
    agg.cf.OPENING_CASH = first.cf.OPENING_CASH || 0;
    agg.cf.CLOSING_CASH = last.cf.CLOSING_CASH || 0;

    res.push(agg);
  }

  return res;
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

  const startMs = new Date(`${event.period_start}T00:00:00.000Z`).getTime();
  const endMs = event.period_end
    ? new Date(`${event.period_end}T00:00:00.000Z`).getTime()
    : Infinity;

  // Periods are anchored to YYYY-MM-01. If the event starts mid-month, the first applicable
  // period is the first period.date >= period_start. Recurrence and growth are anchored to
  // that first applicable period (not the raw day-level start date).
  let firstApplicablePeriodDate: string | null = null;
  for (const period of periods) {
    const pMs = new Date(`${period.date}T00:00:00.000Z`).getTime();
    if (pMs >= startMs && pMs <= endMs) {
      firstApplicablePeriodDate = period.date;
      break;
    }
  }
  if (!firstApplicablePeriodDate) return amounts;

  for (const period of periods) {
    const pMs = new Date(`${period.date}T00:00:00.000Z`).getTime();
    if (pMs < startMs || pMs > endMs) continue;

    const monthsElapsed = Math.max(0, monthDiffUtc(firstApplicablePeriodDate, period.date));
    const isActiveForRecurrence =
      event.recurrence === 'one_time'
        ? monthsElapsed === 0
        : event.recurrence === 'monthly'
          ? true
          : event.recurrence === 'quarterly'
            ? monthsElapsed % 3 === 0
            : event.recurrence === 'annual'
              ? monthsElapsed % 12 === 0
              : true;
    if (!isActiveForRecurrence) continue;

    // Growth: compound from start
    const growthFactor =
      event.growth_rate !== 0 ? Math.pow(1 + event.growth_rate / 100, monthsElapsed / 12) : 1;

    const periodAmount = event.amount * growthFactor;
    amounts.set(period.date, periodAmount);
  }
  return amounts;
}

// ---------------------------------------------------------------------------
// Core compute engine
// ---------------------------------------------------------------------------

export async function computeModel(modelId: string): Promise<ComputeResult> {
  const model = (await dbGet(`SELECT * FROM financial_models WHERE id = ?`, [modelId])) as any;
  if (!model) throw new Error('Model not found');

  // FINDING (pre-existing, unrelated to FIN-03/FIN-04's own scope, fixed here
  // as a small vertical-slice MVP_BLOCKER — see final report): `start_date`/
  // `period_start`/`period_end` are Postgres DATE columns. node-pg hands them
  // back as JS `Date` objects (no OID 1082 type parser registered — same root
  // cause documented in financePeriodFormat.ts's module doc, built for FIN-005
  // for exactly this class of bug). `generateMonthlyPeriods()` and the event
  // period-matching below (`${event.period_start}T00:00:00.000Z`) both assume
  // a `YYYY-MM-DD` STRING; template-literal-interpolating a `Date` object
  // produces garbage that parses to `Invalid Date`, silently zeroing every
  // period and event match. Reproduced live against a real local Postgres
  // while building this packet's own acceptance tests (every period came back
  // "Invalid Date NaN", cashflows all zero) — this blocks the golden flow's
  // own "compute NPV/IRR/payback" step for ANY model on real Postgres, not
  // just ones created via this packet's new case/scenario paths. Normalizing
  // once here, at the read boundary, with the existing canonical
  // `toPeriodIsoDate()` (already proven correct for the Postgres
  // local-midnight discriminator) is the same "owner-side fix at the read
  // boundary" pattern financePeriodFormat.ts's own doc comment prescribes.
  model.start_date = toPeriodIsoDate(model.start_date) || model.start_date;

  const events = (
    (await dbAll(
      `SELECT * FROM financial_model_events WHERE model_id = ? AND is_active = TRUE ORDER BY sort_order, created_at`,
      [modelId]
    )) || []
  ).map((e: any) => ({
    ...e,
    period_start: toPeriodIsoDate(e.period_start) || e.period_start,
    period_end: e.period_end ? toPeriodIsoDate(e.period_end) || e.period_end : e.period_end,
    posting_rules:
      typeof e.posting_rules === 'string' ? JSON.parse(e.posting_rules) : e.posting_rules || {},
    parameters: typeof e.parameters === 'string' ? JSON.parse(e.parameters) : e.parameters || {},
  })) as ModelEvent[];

  // SSOT: internal compute is monthly; rollups happen after compute.
  const monthlyPeriods = generateMonthlyPeriods(model.start_date, model.horizon_months);
  const assumptions =
    typeof model.assumptions_json === 'string'
      ? JSON.parse(model.assumptions_json)
      : model.assumptions_json || {};

  // Initialize period outputs
  const monthlyOutputs: PeriodOutput[] = monthlyPeriods.map((p) => ({
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
  const initialOtherAssets = assumptions.initialOtherAssets ?? 0;
  const initialOtherLiabilities = assumptions.initialOtherLiabilities ?? 0;

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

  // Zero-change baseline: if no events but baseline P&L ratios are in assumptions,
  // extrapolate each period using % of revenue structure from the base period.
  const baseline = assumptions.baseline || null;
  const baselineRevenue = baseline?.revenue ?? 0;
  const baselineRatios: Record<string, number> = {};
  if (baseline && baselineRevenue > 0) {
    baselineRatios.cogs = (baseline.cogs ?? 0) / baselineRevenue;
    baselineRatios.opex = (baseline.opex ?? 0) / baselineRevenue;
    baselineRatios.depreciation = (baseline.depreciation ?? 0) / baselineRevenue;
    baselineRatios.interest = (baseline.interest ?? 0) / baselineRevenue;
    baselineRatios.tax = (baseline.tax ?? 0) / baselineRevenue;
    baselineRatios.capex = (baseline.capex ?? 0) / baselineRevenue;
  }
  const useZeroChangeBaseline = events.length === 0 && baselineRevenue > 0;
  const forecastDrivers = assumptions.forecastDrivers || {};
  const hasForecastDrivers =
    useZeroChangeBaseline && Number.isFinite(Number(forecastDrivers.revenueGrowthPct));
  // Monthly compute resolution (always 12 periods/year internally)
  const baselinePerPeriod = baselineRevenue / 12;

  // Expand all events
  const eventAmounts = new Map<string, Map<string, number>>();
  for (const event of events) {
    eventAmounts.set(event.id, expandEventToAmounts(event, monthlyPeriods));
  }

  // Process each period
  for (let pi = 0; pi < monthlyOutputs.length; pi++) {
    const out = monthlyOutputs[pi];
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

    if (useZeroChangeBaseline) {
      const forecastYear = Math.floor(pi / 12) + 1;
      const annualRevenue = hasForecastDrivers
        ? baselineRevenue * Math.pow(1 + Number(forecastDrivers.revenueGrowthPct) / 100, forecastYear)
        : baselineRevenue;
      totalRevenue = annualRevenue / 12;
      const grossMarginPct = Number(forecastDrivers.grossMarginPct);
      const opexPctRevenue = Number(forecastDrivers.opexPctRevenue);
      const depreciationPctRevenue = Number(forecastDrivers.depreciationPctRevenue);
      const capexPctRevenue = Number(forecastDrivers.capexPctRevenue);
      totalCOGS = totalRevenue *
        (Number.isFinite(grossMarginPct) ? 1 - grossMarginPct / 100 : baselineRatios.cogs || 0);
      totalOPEX = totalRevenue *
        (Number.isFinite(opexPctRevenue) ? opexPctRevenue / 100 : baselineRatios.opex || 0);
      totalDepr = totalRevenue *
        (Number.isFinite(depreciationPctRevenue)
          ? depreciationPctRevenue / 100
          : baselineRatios.depreciation || 0);
      totalInterest = Number.isFinite(Number(forecastDrivers.debtCostPct))
        ? (runningDebt * Number(forecastDrivers.debtCostPct)) / 100 / 12
        : baselinePerPeriod * (baselineRatios.interest || 0);
      const preTaxIncome = totalRevenue - totalCOGS - totalOPEX - totalDepr - totalInterest;
      totalTax = hasForecastDrivers
        ? Math.max(0, preTaxIncome * numberOrZero(assumptions.taxRatePct ?? 0.21))
        : baselinePerPeriod * (baselineRatios.tax || 0);
      totalCapex = totalRevenue *
        (Number.isFinite(capexPctRevenue) ? capexPctRevenue / 100 : baselineRatios.capex || 0);
    }

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
          // Respect the sign of `amt`: a positive amount is a real cost (the
          // common case), a negative amount is a genuine OPEX REDUCTION/saving
          // (e.g. "OpEx reduction (automation)") and must reduce totalOPEX, not
          // get flipped into an increase by Math.abs(). `out.pl.OPEX = -totalOPEX`
          // below then turns a reduction into a positive profit contribution.
          totalOPEX += amt;
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

    if (hasForecastDrivers) {
      const annualRevenue = totalRevenue * 12;
      const annualCogs = totalCOGS * 12;
      const targetAR = Number.isFinite(Number(forecastDrivers.dsoDays))
        ? (annualRevenue * Number(forecastDrivers.dsoDays)) / 365
        : runningAR;
      const targetInventory = Number.isFinite(Number(forecastDrivers.dioDays))
        ? (annualCogs * Number(forecastDrivers.dioDays)) / 365
        : runningInventory;
      const targetAP = Number.isFinite(Number(forecastDrivers.dpoDays))
        ? (annualCogs * Number(forecastDrivers.dpoDays)) / 365
        : runningAP;
      totalWCChange +=
        targetAR - runningAR + (targetInventory - runningInventory) - (targetAP - runningAP);
      runningAR = targetAR;
      runningInventory = targetInventory;
      runningAP = targetAP;
    } else if (totalWCChange !== 0) {
      // Event-driven WC changes affect AR/Inventory/AP proportionally.
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
    out.bs.OTHER_ASSETS = initialOtherAssets;
    out.bs.TOTAL_ASSETS = out.bs.CURRENT_ASSETS + out.bs.PPE_NET + out.bs.OTHER_ASSETS;
    out.bs.AP = runningAP;
    out.bs.CURRENT_LIABILITIES = runningAP;
    out.bs.LONG_TERM_DEBT = runningDebt;
    out.bs.OTHER_LIABILITIES = initialOtherLiabilities;
    out.bs.TOTAL_LIABILITIES =
      out.bs.CURRENT_LIABILITIES + runningDebt + out.bs.OTHER_LIABILITIES;
    out.bs.EQUITY_CAPITAL = runningEquityCapital;
    out.bs.RETAINED_EARNINGS = runningRetainedEarnings;
    out.bs.TOTAL_EQUITY = runningEquityCapital + runningRetainedEarnings;
    out.bs.TOTAL_LIABILITIES_EQUITY = out.bs.TOTAL_LIABILITIES + out.bs.TOTAL_EQUITY;
  }

  // Roll up to configured granularity (UI/view), keeping monthly as internal SSOT compute.
  const outputs = aggregateMonthlyOutputs(monthlyOutputs, model.granularity || 'monthly');

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

/** Minimal shape both `PoolClient` and our own pinned-transaction wrapper satisfy. */
type SqlClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/**
 * Build a chunked multi-row INSERT (native $N placeholders) so N rows cost a
 * handful of round-trips instead of N. Chunk size is bounded well under
 * Postgres's ~65535 bind-parameter limit.
 */
async function insertRowsBatched(
  client: SqlClient,
  sql: string,
  columnCount: number,
  rows: unknown[][],
  batchSize = 500
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    let paramIndex = 1;
    const placeholders = batch
      .map(() => `(${Array.from({ length: columnCount }, () => `$${paramIndex++}`).join(', ')})`)
      .join(', ');
    await client.query(`${sql} VALUES ${placeholders}`, batch.flat());
  }
}

/**
 * CORRECTNESS (B2 correction): everything computeModel() produces for one
 * model -- output rows, inline validations, and the R1-R8 shadow-reconcile
 * checks -- written on the CALLER's client, inside the CALLER's transaction.
 * This function issues no BEGIN/COMMIT/ROLLBACK of its own and does not
 * acquire or release a connection; it is only ever called with an
 * already-open, caller-owned client so that a failure at ANY point here
 * (an output row, a validation row, a shadow-reconcile row) rolls back
 * everything the caller wrote before calling this, not just this function's
 * own writes. There is deliberately no non-fatal try/catch around the
 * shadow-reconcile write here anymore: a fault there now fails the whole
 * unit of work rather than silently completing with a missing shadow
 * observation while claiming success.
 */
async function writeComputeResultRows(
  client: SqlClient,
  modelId: string,
  result: ComputeResult,
  scenario: string
): Promise<void> {
  await client.query(`DELETE FROM financial_model_outputs WHERE model_id = $1 AND scenario = $2`, [
    modelId,
    scenario,
  ]);
  await client.query(`DELETE FROM financial_model_validations WHERE model_id = $1`, [modelId]);

  const outputRows: unknown[][] = [];
  for (const period of result.periods) {
    for (const [type, lines] of [
      ['P&L', period.pl],
      ['BS', period.bs],
      ['CF', period.cf],
    ] as const) {
      for (const [code, value] of Object.entries(lines)) {
        outputRows.push([
          uuidv4(),
          modelId,
          period.date,
          period.label,
          type,
          code,
          LINE_NAMES[code] || code,
          round2(value as number),
          scenario,
        ]);
      }
    }
  }
  await insertRowsBatched(
    client,
    `INSERT INTO financial_model_outputs
     (id, model_id, period_date, period_label, statement_type, line_code, line_name, value, scenario)`,
    9,
    outputRows
  );

  logger.info('[financialModeling] writeComputeResultRows outputs', {
    modelId,
    scenario,
    periods: result.periods.length,
    outputsInserted: outputRows.length,
  });

  const validationRows = result.validations.map((v) => [
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
  ]);
  await insertRowsBatched(
    client,
    `INSERT INTO financial_model_validations
     (id, model_id, period_date, check_code, check_name, status, expected_value, actual_value, difference, message)`,
    10,
    validationRows
  );

  // SHADOW: R1-R8 reconcile over the computed periods. Part of the SAME unit
  // of work now -- see the function doc comment above for why this is no
  // longer wrapped in a non-fatal try/catch.
  await shadowReconcileModel(client, modelId, result);

  // Preserved from the pre-correction implementation: touches only
  // updated_at, not status, on a failing compute. Kept verbatim rather than
  // removed or "fixed" -- out of scope for this correctness pass.
  if (result.overallStatus === 'fail') {
    await client.query(`UPDATE financial_models SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      modelId,
    ]);
  }
}

/**
 * Public entry point for the three non-approve callers (compute-preview
 * routes and valuationService.ts) that just need "recompute and persist",
 * with no CAS/version/approval semantics. Owns its own connection and
 * transaction boundary: BEGIN, write everything via writeComputeResultRows,
 * COMMIT -- genuinely atomic for the first time (previously each DELETE/
 * INSERT/shadow-check was its own independent connection checkout with no
 * transaction at all). The PoolClient is released in `finally` on every
 * path: BEGIN failure, a write failure, COMMIT failure, and ROLLBACK
 * failure (which is logged, never thrown in place of the original error).
 */
export async function persistComputeResult(
  modelId: string,
  result: ComputeResult,
  scenario: string = 'base'
): Promise<void> {
  const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
  const client = await getPoolClientForPinnedTransaction();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;
    await writeComputeResultRows(client, modelId, result, scenario);
    await client.query('COMMIT');
    began = false;
  } catch (error) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('[financialModeling] persistComputeResult ROLLBACK failed after a prior error', {
          modelId,
          originalError: error instanceof Error ? error.message : String(error),
          rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * SHADOW adapter (model context). Runs reconcileStatements over the compute
 * outputs and persists R1-R8 records to financial_model_validations. That table
 * has no severity/tolerance columns and its status CHECK forbids 'skipped', so:
 *   - severity + tolerance + rich details are written to the `details` TEXT col;
 *   - skipped checks are NOT written as rows (captured in RECONCILE_SUMMARY).
 * No migration required. Never changes model status (RECONCILE_ENFORCE=false).
 *
 * CORRECTNESS (B2 correction): writes on the CALLER's client, inside the
 * caller's transaction -- no longer wrapped in a non-fatal try/catch by its
 * caller. A shadow-reconcile fault now fails (and rolls back) the whole
 * write, the same as an outputs or validations fault. That is a deliberate
 * behaviour change from the pre-correction contract ("shadow never blocks
 * approve"): the correction explicitly required that nothing claim
 * atomicity while shadow writes happen after commit or on a different
 * connection, and the forced-failure matrix requires a shadow fault to
 * prove a full rollback with no partial data -- both are only true if
 * shadow reconcile is a first-class part of the same unit of work.
 */
async function shadowReconcileModel(
  client: SqlClient,
  modelId: string,
  result: ComputeResult
): Promise<void> {
  const periods: PeriodStatements[] = result.periods.map((p) => ({
    pnl: p.pl,
    bs: p.bs,
    cf: p.cf,
    periodDate: p.date,
    periodLabel: p.label,
  }));
  const rec = reconcileStatements({ context: 'model', periods });

  const skippedCodes: string[] = [];
  const rows: unknown[][] = [];
  for (const check of rec.checks) {
    if (check.status === 'skipped') {
      skippedCodes.push(`${check.checkCode}@${check.periodDate || ''}`);
      continue;
    }
    rows.push([
      uuidv4(),
      modelId,
      check.periodDate || null,
      check.checkCode,
      check.checkName,
      check.status,
      check.expected,
      check.actual,
      check.difference,
      check.message,
      JSON.stringify({
        shadow: true,
        severity: check.severity,
        tolerance: check.tolerance,
        ...(check.details || {}),
      }),
    ]);
  }

  rows.push([
    uuidv4(),
    modelId,
    null,
    'RECONCILE_SUMMARY',
    'Reconcile R1-R8 (shadow)',
    'pass',
    rec.summary.passed,
    rec.summary.failed,
    rec.summary.warnings,
    `Reconcile shadow: ${rec.summary.passed} pass, ${rec.summary.warnings} warn, ${rec.summary.failed} fail, ${rec.summary.skipped} skipped.`,
    JSON.stringify({
      shadow: true,
      enforce: RECONCILE_ENFORCE,
      summary: rec.summary,
      overallStatus: rec.overallStatus,
      blocksReady: rec.blocksReady,
      wouldBlockReady: shouldBlockReady(rec), // false in shadow mode
      skippedChecks: skippedCodes,
    }),
  ]);

  await insertRowsBatched(
    client,
    `INSERT INTO financial_model_validations
     (id, model_id, period_date, check_code, check_name, status, expected_value, actual_value, difference, message, details)`,
    11,
    rows
  );
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
  sourceStatementId?: string;
  sourceStatementPackId?: string;
  /**
   * FIN-04: when supplied, this scenario is created UNDER an existing
   * Investment Case (`COALESCE(case_id, id)` of the referenced row) rather
   * than becoming its own case root. Must belong to the caller's own org —
   * verified below, same cross-org FK-injection guard as project/initiative.
   */
  caseId?: string;
}): Promise<string> {
  const id = uuidv4();

  // Cross-org FK-injection guard: a caller must not graft another org's
  // project/initiative onto a model in its own org. Verify ownership of any
  // supplied FK before the INSERT (same convention as assertModelOwned in
  // financeEnterpriseService — throws 'not found', which the route maps → 404).
  if (params.projectId) {
    const ownedProject = await dbGet<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [params.projectId, params.organizationId]
    );
    if (!ownedProject?.id) throw new Error('Source project not found');
  }
  if (params.initiativeId) {
    const ownedInitiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [params.initiativeId, params.organizationId]
    );
    if (!ownedInitiative?.id) throw new Error('Source initiative not found');
  }
  let resolvedCaseRootId: string | null = null;
  if (params.caseId) {
    const caseRoot = await dbGet<{ id: string; case_id: string | null }>(
      `SELECT id, case_id FROM financial_models WHERE id = ? AND organization_id = ?`,
      [params.caseId, params.organizationId]
    );
    if (!caseRoot?.id) throw new Error('Investment Case not found');
    // Always store the CASE ROOT id, never an intermediate scenario id —
    // COALESCE(case_id, id) is "the case id" for any row (see migration
    // 20260801_fin003_004_case_scenario_baseline.sql doc comment).
    resolvedCaseRootId = caseRoot.case_id || caseRoot.id;
  }

  const seeded =
    params.sourceStatementPackId && params.organizationId
      ? await buildSeededAssumptionsFromPack(params.organizationId, params.sourceStatementPackId)
      : params.sourceStatementId && params.organizationId
        ? await buildSeededAssumptionsFromStatement(params.organizationId, params.sourceStatementId)
        : null;
  const assumptions = mergeAssumptions(seeded?.assumptions || {}, params.assumptions);
  try {
    await dbRun(
      `INSERT INTO financial_models (id, organization_id, project_id, initiative_id, name, description, currency, horizon_months, start_date, granularity, scenario, assumptions_json, created_by, source_statement_id, source_statement_pack_id, case_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        JSON.stringify(assumptions),
        params.createdBy,
        params.sourceStatementId || null,
        params.sourceStatementPackId || null,
        resolvedCaseRootId,
      ]
    );
  } catch {
    try {
      await dbRun(
        `INSERT INTO financial_models (id, organization_id, project_id, initiative_id, name, description, currency, horizon_months, start_date, granularity, scenario, assumptions_json, created_by, source_statement_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          JSON.stringify(assumptions),
          params.createdBy,
          params.sourceStatementId || null,
        ]
      );
    } catch {
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
          JSON.stringify(assumptions),
          params.createdBy,
        ]
      );
    }
  }
  return id;
}

/**
 * Re-pull the historical lines from a model's bound source statement / pack and
 * merge them back into the model's assumptions (S6.4d — "refresh from source").
 *
 * Only the seeded baseline + opening balances + seed metadata are refreshed;
 * any other assumption keys the user edited are preserved by mergeAssumptions.
 * Throws when the model has no source, is approved (immutable), or the source no
 * longer passes the critical-line gate — the route maps those to 400/404.
 */
export async function reseedModelFromSource(
  modelId: string,
  orgId: string
): Promise<{ seededFrom: 'statement' | 'statement_pack'; missingBaselineLines: string[] }> {
  const model = await getModel(modelId, orgId);
  if (!model) throw new Error('Model not found');
  if (String(model.status || '').toLowerCase() === 'approved') {
    throw new Error('Cannot refresh an approved model. Create a new version instead.');
  }

  const packId = model.source_statement_pack_id;
  const statementId = model.source_statement_id;
  if (!packId && !statementId) {
    throw new Error('Model has no source statement to refresh from');
  }

  const seeded = packId
    ? await buildSeededAssumptionsFromPack(orgId, String(packId))
    : await buildSeededAssumptionsFromStatement(orgId, String(statementId));

  const existing =
    typeof model.assumptions_json === 'string'
      ? JSON.parse(model.assumptions_json)
      : model.assumptions_json || {};

  // Refresh strategy: the freshly-seeded values win for the seeded keys and
  // baseline, but we start from the user's existing assumptions so unrelated
  // edits survive. mergeAssumptions keeps seedSource/seedStatus from its first
  // argument, so re-apply the FRESH seed metadata explicitly.
  const refreshed = {
    ...mergeAssumptions(existing, seeded.assumptions),
    seedSource: seeded.assumptions.seedSource,
    seedStatus: seeded.assumptions.seedStatus,
  };

  await dbRun(
    `UPDATE financial_models SET assumptions_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(refreshed), modelId, orgId]
  );

  const seedType = (seeded.assumptions?.seedSource as any)?.type as
    | 'statement'
    | 'statement_pack'
    | undefined;
  const missingBaselineLines = Array.isArray(
    (seeded.assumptions?.seedStatus as any)?.missingBaselineLines
  )
    ? ((seeded.assumptions?.seedStatus as any).missingBaselineLines as string[])
    : [];

  return {
    seededFrom: seedType || (packId ? 'statement_pack' : 'statement'),
    missingBaselineLines,
  };
}

export async function getModel(modelId: string, orgId?: string): Promise<any> {
  const sql = orgId
    ? `SELECT * FROM financial_models WHERE id = ? AND organization_id = ?`
    : `SELECT * FROM financial_models WHERE id = ?`;
  const model = (await dbGet(sql, orgId ? [modelId, orgId] : [modelId])) as any;
  if (!model) return null;
  model.assumptions_json =
    typeof model.assumptions_json === 'string'
      ? JSON.parse(model.assumptions_json)
      : model.assumptions_json;
  return model;
}

/**
 * #82f — F5 wiring: `assumptionsRegistry` (Z114) → status realnych driverów tego modelu
 * (baseline P&L + otwarcie bilansu), do zakładki „Inputs & Assumptions"
 * (`FinancialModelWorkspace.tsx`). REUŻYWA sygnały już policzone przy seedowaniu
 * (`seedSource`/`seedStatus.missingBaselineLines`, patrz `assumptionsFinancialModelDrivers.ts`)
 * — nic nie przelicza, nic nie zgaduje. Read-only, fail-soft (wzorzec
 * `loadFinanceReportLineageForPack`): błąd → `available:false`, nigdy 500.
 */
export async function getModelAssumptionsStatus(
  modelId: string,
  orgId: string | undefined
): Promise<{
  modelId: string;
  available: boolean;
  isGrounded: boolean;
  seedSource: Record<string, any> | null;
  assumptions: ReturnType<typeof listAssumptions>;
  coverage: ReturnType<typeof auditCoverage>;
} | null> {
  const model = await getModel(modelId, orgId);
  if (!model) return null;

  const assumptionsJson = (model.assumptions_json || {}) as Record<string, any>;
  const seedSource = assumptionsJson.seedSource || null;
  const seedStatus = assumptionsJson.seedStatus || null;
  const missingBaselineLines: string[] = Array.isArray(seedStatus?.missingBaselineLines)
    ? seedStatus.missingBaselineLines
    : [];
  const isGrounded =
    seedSource?.type === 'statement' ||
    seedSource?.type === 'statement_pack' ||
    Boolean(model.source_statement_id || model.source_statement_pack_id);

  const rawAssumptions = financialModelToAssumptions({
    assumptions: assumptionsJson,
    isGrounded,
    missingBaselineLines,
    seedSource,
  });

  return {
    modelId,
    available: true,
    isGrounded,
    seedSource,
    assumptions: listAssumptions(rawAssumptions),
    coverage: auditCoverage('financial_model.3stmt', FINANCIAL_MODEL_DRIVERS, rawAssumptions),
  };
}

export async function listModels(orgId: string): Promise<any[]> {
  return ((await dbAll(
    `SELECT fm.id, fm.name, fm.description, fm.project_id, fm.initiative_id, fm.currency, fm.horizon_months, fm.start_date, fm.granularity, fm.scenario, fm.status, fm.version, fm.created_at, fm.updated_at, fm.source_statement_id, fm.source_statement_pack_id, fm.case_id, fm.is_baseline,
            (SELECT COUNT(*) FROM financial_model_events fme WHERE fme.model_id = fm.id AND fme.is_active = TRUE) AS event_count
     FROM financial_models fm
     WHERE fm.organization_id = ?
     ORDER BY fm.updated_at DESC
     LIMIT 50`,
    [orgId]
  )) || []) as any[];
}

export interface UpdateModelResult {
  success: boolean;
  code?: 'VERSION_CONFLICT';
  serverVersion?: number;
}

/**
 * FIN-03: `opts.expectedVersion`, when supplied, turns this into a
 * compare-and-swap write — `WHERE id = ? AND version = ?` — mirroring the
 * established CAS pattern in presentations.routes.ts (conditional UPDATE,
 * `changes === 0` => stale, re-read the current version, report it). Without
 * `opts.expectedVersion` this is the original unconditional metadata update
 * (unchanged behavior for every pre-existing caller).
 */
export async function updateModel(
  modelId: string,
  updates: Record<string, any>,
  opts?: { expectedVersion?: number }
): Promise<UpdateModelResult> {
  const allowedFields = [
    'name',
    'description',
    'currency',
    'horizon_months',
    'start_date',
    'granularity',
    'scenario',
    'status',
    'source_statement_pack_id',
  ];
  // Approval-state guard (mass-assignment defense): the `approved` lifecycle
  // state may ONLY be reached via approveModel(), which recomputes + validates,
  // writes the approved_snapshot, records approved_by, and bumps version. A
  // generic metadata update must never forge it directly (that would persist an
  // "approved" model with no validation gate, no snapshot, and no approver).
  // Allowed self-service transitions remain draft↔review.
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (!allowedFields.includes(k)) continue;
    if (k === 'status' && String(v).trim().toLowerCase() === 'approved') {
      continue; // forged approval — drop silently; use POST /:id/approve
    }
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (updates.assumptions) {
    sets.push('assumptions_json = ?');
    vals.push(JSON.stringify(updates.assumptions));
  }
  if (sets.length === 0) return { success: true };
  sets.push('updated_at = CURRENT_TIMESTAMP');

  if (opts?.expectedVersion !== undefined) {
    const whereVals = [...vals, modelId, opts.expectedVersion];
    const result = (await dbRun(
      `UPDATE financial_models SET ${sets.join(', ')} WHERE id = ? AND version = ?`,
      whereVals
    )) as { changes?: number } | undefined;
    if ((result?.changes ?? 0) === 0) {
      const latest = await dbGet<{ version: number }>(
        `SELECT version FROM financial_models WHERE id = ?`,
        [modelId]
      );
      return { success: false, code: 'VERSION_CONFLICT', serverVersion: latest?.version };
    }
    return { success: true };
  }

  vals.push(modelId);
  await dbRun(`UPDATE financial_models SET ${sets.join(', ')} WHERE id = ?`, vals);
  return { success: true };
}

/**
 * FIN-03: idempotency check for a create-model / approve-model call. Looks up
 * `financial_model_idempotency` (org + key + operation scoped, unique
 * constraint added by migration 20260801_fin003_004_case_scenario_baseline.sql).
 * Returns the ORIGINAL resource id a prior call with the same key produced,
 * or null when this key has never been seen for this operation.
 */
export async function findIdempotentResource(
  organizationId: string,
  idempotencyKey: string,
  operation: 'create_model' | 'approve_model'
): Promise<string | null> {
  const row = await dbGet<{ resource_id: string }>(
    `SELECT resource_id FROM financial_model_idempotency WHERE organization_id = ? AND idempotency_key = ? AND operation = ?`,
    [organizationId, idempotencyKey, operation]
  );
  return row?.resource_id || null;
}

/**
 * Records a (org, key, operation) -> resource mapping. Uses ON CONFLICT DO
 * NOTHING so a genuine race between two requests bearing the SAME key for
 * the SAME operation resolves to "whichever INSERT wins" without erroring —
 * the caller should always re-read via findIdempotentResource after a
 * conflict rather than trust its own in-flight resourceId blindly.
 */
export async function recordIdempotentResource(
  organizationId: string,
  idempotencyKey: string,
  operation: 'create_model' | 'approve_model',
  resourceId: string
): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO financial_model_idempotency (id, organization_id, idempotency_key, operation, resource_id, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (organization_id, idempotency_key, operation) DO NOTHING`,
      [uuidv4(), organizationId, idempotencyKey, operation, resourceId]
    );
  } catch {
    // Idempotency table may not exist yet if migration not applied — fail
    // open on RECORDING (the create/approve itself already succeeded), the
    // same fail-soft convention as the financial_model_versions insert below.
  }
}

/**
 * Serialize requests for one idempotency key on a pinned PostgreSQL session.
 *
 * The unique ledger row alone is too late for create-model: two callers can
 * both observe an empty ledger, create different models, and only then race
 * to record the winner.  This transaction-scoped advisory lock closes that
 * check/create/record gap while leaving unrelated keys fully concurrent.
 */
export async function withFinancialModelIdempotencyLock<T>(
  organizationId: string,
  idempotencyKey: string,
  operation: 'create_model' | 'approve_model',
  work: () => Promise<T>
): Promise<T> {
  const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      `${organizationId}:${operation}`,
      idempotencyKey,
    ]);
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function approveModel(
  modelId: string,
  userId: string,
  opts?: { expectedVersion?: number }
): Promise<{
  success: boolean;
  error?: string;
  code?: 'VERSION_CONFLICT';
  serverVersion?: number;
}> {
  const model = await getModel(modelId);
  if (!model) return { success: false, error: 'Model not found' };

  // Cheap pre-check outside the transaction: rejects an obviously stale
  // caller before doing the expensive recompute. It is NOT the authority --
  // the row-lock + CAS re-check inside the transaction below is, because
  // anything read here can go stale before the write.
  if (opts?.expectedVersion !== undefined && Number(model.version || 1) !== opts.expectedVersion) {
    return {
      success: false,
      code: 'VERSION_CONFLICT',
      serverVersion: Number(model.version || 1),
      error: 'Version conflict: model was modified since you last read it.',
    };
  }

  // Recompute and validate BEFORE opening the transaction: this is pure
  // read+CPU work and holding a row lock across it would serialize every
  // concurrent approve for no correctness benefit.
  const result = await computeModel(modelId);
  if (result.overallStatus === 'fail') {
    return { success: false, error: 'Model has failing validations. Fix issues before approving.' };
  }

  const snapshot = JSON.stringify({
    periods: result.periods,
    validations: result.validations,
    computedAt: new Date().toISOString(),
  });
  const scenario = model.scenario || 'base';

  // ── ONE unit of work ──────────────────────────────────────────────────
  // Ownership is claimed FIRST, by locking the model row, and only then is
  // anything written. This is the substantive correctness fix: previously
  // outputs were replaced before the CAS ran, so N concurrent approves for
  // the same model all deleted and rewrote the same outputs and only then
  // discovered they had lost -- losers destroyed and rewrote the winner's
  // data. Now a loser is rejected while holding no more than a row lock,
  // having written nothing at all.
  //
  // Order inside the transaction:
  //   1. SELECT ... FOR UPDATE  -- serialize same-model approvers
  //   2. CAS re-check on the locked row  -- authoritative version check
  //   3. output replacement + validations + shadow reconcile
  //   4. model row UPDATE (status/version/snapshot)
  //   5. version-history INSERT
  //   6. COMMIT
  // All six either land together or none do.
  const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
  const client = await getPoolClientForPinnedTransaction();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;

    const locked = await client.query(
      `SELECT version FROM financial_models WHERE id = $1 FOR UPDATE`,
      [modelId]
    );
    if (locked.rows.length === 0) {
      await client.query('ROLLBACK');
      began = false;
      return { success: false, error: 'Model not found' };
    }
    const lockedVersion = Number(locked.rows[0].version || 1);

    // Authoritative CAS. An explicit expectedVersion must still match the
    // row we now hold the lock on; without one, the version read before the
    // recompute must not have moved underneath us.
    const requiredVersion =
      opts?.expectedVersion !== undefined ? opts.expectedVersion : Number(model.version || 1);
    if (lockedVersion !== requiredVersion) {
      await client.query('ROLLBACK');
      began = false;
      return {
        success: false,
        code: 'VERSION_CONFLICT',
        serverVersion: lockedVersion,
        error: 'Version conflict: model was modified concurrently. Refresh and retry.',
      };
    }

    const nextVersion = lockedVersion + 1;

    await writeComputeResultRows(client, modelId, result, scenario);

    const updated = await client.query(
      `UPDATE financial_models
          SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
              approved_snapshot = $2, version = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND version = $5`,
      [userId, snapshot, nextVersion, modelId, lockedVersion]
    );
    if ((updated.rowCount ?? 0) === 0) {
      // Unreachable while we hold FOR UPDATE on this row, but treated as a
      // hard failure rather than an ignorable one: a silent 0-row UPDATE
      // here would mean the lock did not do what this code assumes.
      throw new Error('APPROVE_CAS_UNEXPECTED_NOOP');
    }

    // Version history is part of the unit of work, not a fire-and-forget
    // afterthought. The pre-correction code swallowed every error here with
    // an empty catch ("table may not exist yet"), which meant an approved
    // model could exist with no history row and still report success.
    await client.query(
      `INSERT INTO financial_model_versions (id, model_id, version, snapshot_data, approved_by, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [uuidv4(), modelId, nextVersion, snapshot, userId]
    );

    await client.query('COMMIT');
    began = false;
    return { success: true };
  } catch (error) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Never let a rollback failure mask the original error.
        logger.error('[financialModeling] approveModel ROLLBACK failed after a prior error', {
          modelId,
          originalError: error instanceof Error ? error.message : String(error),
          rollbackError:
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// FIN-04: Investment Case scenario grouping + baseline
// ---------------------------------------------------------------------------

/** "The case id" for any model row — root rows are their own case. */
function caseRootExpr(): string {
  return 'COALESCE(case_id, id)';
}

/**
 * All scenarios (siblings, including the case root itself) that belong to
 * the same Investment Case as `anyModelId`, org-scoped. Each row carries
 * `is_baseline` so the caller can render which one is active.
 */
export async function listCaseScenarios(anyModelId: string, orgId: string): Promise<any[]> {
  const anchor = await dbGet<{ id: string; case_id: string | null }>(
    `SELECT id, case_id FROM financial_models WHERE id = ? AND organization_id = ?`,
    [anyModelId, orgId]
  );
  if (!anchor?.id) return [];
  const caseRootId = anchor.case_id || anchor.id;
  return ((await dbAll(
    `SELECT id, name, scenario, status, version, is_baseline, case_id, currency, start_date, horizon_months, created_at, updated_at
     FROM financial_models
     WHERE organization_id = ? AND ${caseRootExpr()} = ?
     ORDER BY created_at ASC`,
    [orgId, caseRootId]
  )) || []) as any[];
}

export interface SetBaselineResult {
  success: boolean;
  error?: string;
  code?: 'NOT_FOUND';
  caseId?: string;
  previousBaselineModelId?: string | null;
}

/**
 * FIN-04 — atomically make `targetModelId` the ONE active baseline of its
 * Investment Case, demoting whatever was previously the baseline.
 *
 * Real transactional guarantee, not application-level "hope nothing races".
 *
 * WHY NOT plain `dbRun()` (even twice, even as a single data-modifying CTE):
 *   - Two separate `dbRun()` calls each pull a connection from the pool
 *     independently (see `executeWithLogging`/`getPool()` in
 *     PostgresDatabase.ts) — they are NOT the same session, so a `BEGIN` on
 *     one call has no effect on the next; there is no shared transaction to
 *     be atomic within.
 *   - A single compound statement — `WITH demoted AS (UPDATE ... RETURNING
 *     id) UPDATE ... RETURNING id` — was tried first and empirically FAILS:
 *     per PostgreSQL's documented semantics for data-modifying CTEs ("the
 *     sub-statements in WITH are executed concurrently with each other and
 *     with the main query ... they cannot see one another's effects on the
 *     target tables"), the demote and the promote are not guaranteed to
 *     apply in that order. When the promote's row write lands before the
 *     demote's, both rows are transiently TRUE at once and the immediate
 *     (non-deferred) unique index `idx_fm_one_baseline_per_case` raises
 *     `duplicate key value violates unique constraint` — reproduced live
 *     against the local Postgres while building this function.
 *
 * The actually-correct mechanism: one PINNED connection
 * (`getPoolClientForPinnedTransaction()` — PostgresDatabase.ts, the same
 * "one connection for the whole call" primitive FIN-005's Atelier promotion
 * uses for its own atomic multi-statement write), on which we run
 * `BEGIN` → demote → promote → `COMMIT`. Within ONE transaction, the second
 * statement (promote) sees the FIRST statement's (demote) already-applied
 * effect — Postgres transaction-local statement visibility, not the
 * same-snapshot CTE trap above — so by the time promote runs, zero rows are
 * TRUE for this case and setting the target TRUE raises no conflict. A
 * second concurrent `setBaseline` call for a sibling scenario of the same
 * case takes a row lock on `BEGIN`'s demote and genuinely queues behind this
 * transaction (or vice versa) — last COMMIT wins, but there is never a
 * window where two scenarios of the same case are BOTH committed baseline.
 * The partial unique index remains the belt-and-suspenders backstop for any
 * other code path that might ever touch `is_baseline` directly.
 */
export async function setBaseline(
  targetModelId: string,
  orgId: string,
  actorId: string
): Promise<SetBaselineResult> {
  const target = await dbGet<{ id: string; case_id: string | null; is_baseline: boolean }>(
    `SELECT id, case_id, is_baseline FROM financial_models WHERE id = ? AND organization_id = ?`,
    [targetModelId, orgId]
  );
  if (!target?.id) return { success: false, code: 'NOT_FOUND', error: 'Model not found' };

  const caseRootId = target.case_id || target.id;

  const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');

    // Lock EVERY row of this case (root + all scenarios) up front, before
    // reading or touching anything. This closes a real TOCTOU race that a
    // narrower lock leaves open: reproduced live — race two setBaseline()
    // calls for a case whose CURRENT baseline is neither target (e.g.
    // baseline=Upside, racing Base vs Downside). Both transactions' demote
    // step only touches rows that are baseline AT THE MOMENT the demote
    // statement runs — since neither Base nor Downside is baseline yet,
    // neither transaction's demote ever locks the OTHER's target row. Tx1
    // commits (target1=TRUE) before Tx2's promote runs; Tx2's promote then
    // collides with Tx1's now-committed TRUE row -> a genuine Postgres
    // `duplicate key value violates unique constraint` (not merely a
    // theoretical race — this exact error was observed in this suite before
    // this FOR UPDATE was added). Locking every row of the case FIRST means
    // the second transaction's very first statement blocks until the first
    // transaction fully commits, so by the time it proceeds it always reads
    // the true post-commit state.
    await client.query(
      `SELECT id FROM financial_models WHERE organization_id = $1 AND COALESCE(case_id, id) = $2 FOR UPDATE`,
      [orgId, caseRootId]
    );

    const previousResult = await client.query(
      `SELECT id FROM financial_models WHERE organization_id = $1 AND COALESCE(case_id, id) = $2 AND is_baseline = TRUE AND id != $3`,
      [orgId, caseRootId, targetModelId]
    );
    const previousBaselineModelId: string | null = previousResult.rows[0]?.id || null;

    // Demote first, in its own statement — its effect is visible to the
    // NEXT statement in this same transaction (unlike the CTE trap above).
    await client.query(
      `UPDATE financial_models SET is_baseline = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND COALESCE(case_id, id) = $2 AND is_baseline = TRUE AND id != $3`,
      [orgId, caseRootId, targetModelId]
    );

    const promoteResult = await client.query(
      `UPDATE financial_models SET is_baseline = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [targetModelId, orgId]
    );

    if ((promoteResult.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return { success: false, code: 'NOT_FOUND', error: 'Model not found' };
    }

    try {
      await client.query(
        `INSERT INTO financial_model_baseline_audit (id, organization_id, case_id, previous_baseline_model_id, new_baseline_model_id, changed_by, changed_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [uuidv4(), orgId, caseRootId, previousBaselineModelId, targetModelId, actorId]
      );
    } catch {
      // Audit table may not exist yet if migration not applied — fail-soft
      // on the audit write only; the baseline change itself still commits.
    }

    await client.query('COMMIT');
    return { success: true, caseId: caseRootId, previousBaselineModelId };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Connection may already be broken; nothing more we can do here.
    }
    throw err;
  } finally {
    client.release();
  }
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
