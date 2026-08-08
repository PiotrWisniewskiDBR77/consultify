/**
 * T051 — Financial Ratio Analysis Service
 *
 * Comprehensive ratio engine: liquidity, profitability, leverage, efficiency, growth.
 * Each ratio has a formula definition, required lines, fallback/NA, and status thresholds.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { normalizeCanonicalLineCode, withCanonicalAliases } from './financeCanonicalResolver.js';
import {
  type CompositeScoresSummary,
  computeAllCompositeScores,
} from './financeCompositeScores.js';
import {
  type BenchmarkRatioCode,
  describeRatioAgainstBenchmark,
  getRatioBenchmark,
} from './financeIndustryBenchmarks.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RatioCategory = 'liquidity' | 'profitability' | 'leverage' | 'efficiency' | 'growth';
export type RatioStatus = 'ok' | 'warn' | 'critical' | 'na';

export interface RatioDefinition {
  code: string;
  name: string;
  namePl: string;
  category: RatioCategory;
  formula: string;
  formulaDescription: string;
  formulaDescriptionPl: string;
  requiredLines: string[];
  compute: (values: Record<string, number>) => number | null;
  thresholds: { warn: number; critical: number; direction: 'higher_better' | 'lower_better' };
  unit: string;
}

export interface ComputedRatio {
  code: string;
  name: string;
  namePl: string;
  category: RatioCategory;
  value: number | null;
  status: RatioStatus;
  formula: string;
  formulaDescription: string;
  formulaDescriptionPl: string;
  unit: string;
  coveragePct: number;
  missingLines: string[];
  benchmark?: {
    p25?: number;
    median?: number;
    p75?: number;
    targetMin?: number;
    targetMax?: number;
    source?: string;
    /** 'org' = organization-entered benchmark (financial_ratio_benchmarks row);
     *  'industry' = static per-industry fallback (financeIndustryBenchmarks). */
    origin?: 'org' | 'industry';
    /** Only set when origin === 'industry'. */
    industry?: string;
    industryLabelPl?: string;
    industryLabelEn?: string;
    asOf?: string;
    confidence?: 'sourced' | 'expert-estimate';
    /** Bilingual "your X vs industry median Y–Z" citation sentence (O6.2/O6.3). */
    narrativePl?: string;
    narrativeEn?: string;
    /** O6.3 — "kto odświeża" + calibration-trigger disclaimer. Only set when origin === 'industry'. */
    refreshOwnerPl?: string;
    refreshOwnerEn?: string;
    disclaimerPl?: string;
    disclaimerEn?: string;
  };
}

export interface RatioAnalysisResult {
  statementId: string;
  periodLabel: string;
  ratios: ComputedRatio[];
  categories: Record<RatioCategory, ComputedRatio[]>;
  coverageSummary: { total: number; computed: number; na: number; coveragePct: number };
  compositeScores?: CompositeScoresSummary;
}

function deriveStatementReadiness(row: {
  readiness_status?: unknown;
  status?: unknown;
  validation_status?: unknown;
}): 'ready' | 'recoverable' | 'pending' {
  const readiness = String(row.readiness_status || '')
    .trim()
    .toLowerCase();
  if (['ready', 'recoverable', 'pending'].includes(readiness)) {
    return readiness as 'ready' | 'recoverable' | 'pending';
  }

  const rawStatus = String(row.status || '')
    .trim()
    .toLowerCase();
  const validationStatus = String(row.validation_status || '')
    .trim()
    .toLowerCase();

  if (
    ['confirmed', 'mapped'].includes(rawStatus) &&
    ['pass', 'warnings', 'warning'].includes(validationStatus)
  ) {
    return 'ready';
  }
  if (['imported', 'mapped', 'confirmed'].includes(rawStatus)) {
    return 'recoverable';
  }
  return 'pending';
}

/**
 * Best-effort org industry lookup — never throws (schema drift / missing org → undefined).
 * Exported (additive) so other report composers (e.g. financeReportSectionService) can
 * attach the same industry-benchmark context to a different ratio catalog's codes
 * without re-querying/duplicating this lookup.
 */
export async function loadOrganizationIndustry(
  organizationId: string
): Promise<string | undefined> {
  try {
    const row = await dbGet<any>(`SELECT industry FROM organizations WHERE id = ?`, [
      organizationId,
    ]);
    const industry = String(row?.industry || '').trim();
    return industry.length > 0 ? industry : undefined;
  } catch (err) {
    logger.warn(`[RatioAnalysisService] Could not load organization industry: ${err}`);
    return undefined;
  }
}

async function assertReadyStatement(statementId: string, organizationId: string): Promise<any> {
  let stmt: any;
  try {
    stmt = await dbGet<any>(
      `SELECT id, organization_id, statement_pack_id, period_label, period_start, period_end, status, validation_status, readiness_status
       FROM financial_statements
       WHERE id = ? AND organization_id = ?`,
      [statementId, organizationId]
    );
  } catch {
    stmt = await dbGet<any>(
      `SELECT id, organization_id, statement_pack_id, period_label, period_start, period_end, status, validation_status
       FROM financial_statements
       WHERE id = ? AND organization_id = ?`,
      [statementId, organizationId]
    );
  }

  if (!stmt) throw new Error('Statement not found');

  if (deriveStatementReadiness(stmt) !== 'ready') {
    throw new Error('Statement must be statement-ready before ratio computation');
  }

  return stmt;
}

// ---------------------------------------------------------------------------
// Ratio Catalog
// ---------------------------------------------------------------------------

const safe = (
  a: number | undefined,
  b: number | undefined,
  op: (a: number, b: number) => number
): number | null => {
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (op === div && b === 0) return null;
  // Guard non-finite results for ALL ops, not just `div`: percentage ratios use an
  // inline `(a, b) => (a / b) * 100` op which previously leaked Infinity on b === 0.
  const result = op(a, b);
  return Number.isFinite(result) ? result : null;
};

const div = (a: number, b: number) => a / b;

/**
 * Derive computed lines from components.
 * Runs after raw values are loaded — fills in EBITDA, Net Debt, NOPAT etc.
 * Also resolves cross-statement references (D&A from CF when missing in P&L).
 */
function deriveComputedValues(v: Record<string, number>): Record<string, number> {
  const r = { ...v };

  if (r.DEPRECIATION === undefined) {
    const cfDa =
      (r.DEPRECIATION_ADDBACK ?? 0) ||
      (r.DEPRECIATION_INTANGIBLES_CF ?? 0) +
        (r.DEPRECIATION_PPE_CF ?? 0) +
        (r.DEPRECIATION_ROU_CF ?? 0);
    if (cfDa > 0) r.DEPRECIATION = cfDa;
  }

  if (r.EBITDA === undefined && r.EBIT !== undefined && r.DEPRECIATION !== undefined) {
    r.EBITDA = r.EBIT + Math.abs(r.DEPRECIATION);
  }

  if (r.NET_INCOME === undefined && r.NET_INCOME_CONTINUING !== undefined) {
    r.NET_INCOME = r.NET_INCOME_CONTINUING;
  }

  const totalDebt = (r.LONG_TERM_DEBT ?? 0) + (r.SHORT_TERM_DEBT ?? 0);
  if (
    r.TOTAL_DEBT === undefined &&
    (r.LONG_TERM_DEBT !== undefined || r.SHORT_TERM_DEBT !== undefined)
  ) {
    r.TOTAL_DEBT = totalDebt;
  }

  if (r.NET_DEBT === undefined && r.TOTAL_DEBT !== undefined && r.CASH !== undefined) {
    r.NET_DEBT = r.TOTAL_DEBT - r.CASH;
  }

  if (
    r.INVESTED_CAPITAL === undefined &&
    r.TOTAL_EQUITY !== undefined &&
    r.NET_DEBT !== undefined
  ) {
    r.INVESTED_CAPITAL = r.TOTAL_EQUITY + r.NET_DEBT;
  }

  if (
    r.CAPITAL_EMPLOYED === undefined &&
    r.TOTAL_ASSETS !== undefined &&
    r.CURRENT_LIABILITIES !== undefined
  ) {
    r.CAPITAL_EMPLOYED = r.TOTAL_ASSETS - r.CURRENT_LIABILITIES;
  }

  if (r.FREE_CASH_FLOW === undefined && r.OPERATING_CF !== undefined && r.CAPEX !== undefined) {
    r.FREE_CASH_FLOW = r.OPERATING_CF + r.CAPEX;
  }

  if (r.NOPAT === undefined && r.EBIT !== undefined) {
    const ebt = r.EBT ?? 0;
    const taxRate = ebt !== 0 ? Math.abs(r.TAX_EXPENSE ?? 0) / Math.abs(ebt) : 0.19;
    r.NOPAT = r.EBIT * (1 - taxRate);
  }

  return r;
}

export const RATIO_CATALOG: RatioDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // LIQUIDITY (4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: 'CURRENT_RATIO',
    name: 'Current Ratio',
    namePl: 'Wskaźnik bieżącej płynności',
    category: 'liquidity',
    formula: 'Current Assets / Current Liabilities',
    formulaDescription: 'Measures ability to cover short-term obligations with current assets',
    formulaDescriptionPl:
      'Mierzy zdolność pokrycia zobowiązań krótkoterminowych aktywami obrotowymi',
    requiredLines: ['CURRENT_ASSETS', 'CURRENT_LIABILITIES'],
    compute: (v) => safe(v.CURRENT_ASSETS, v.CURRENT_LIABILITIES, div),
    thresholds: { warn: 1.2, critical: 1.0, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'QUICK_RATIO',
    name: 'Quick Ratio',
    namePl: 'Wskaźnik szybkiej płynności',
    category: 'liquidity',
    formula: '(Current Assets − Inventory) / Current Liabilities',
    formulaDescription: 'Stricter liquidity test excluding inventory',
    formulaDescriptionPl: 'Bardziej rygorystyczny test płynności — bez zapasów',
    requiredLines: ['CURRENT_ASSETS', 'INVENTORY', 'CURRENT_LIABILITIES'],
    compute: (v) => {
      const num = (v.CURRENT_ASSETS ?? 0) - (v.INVENTORY ?? 0);
      return safe(num, v.CURRENT_LIABILITIES, div);
    },
    thresholds: { warn: 0.8, critical: 0.5, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'CASH_RATIO',
    name: 'Cash Ratio',
    namePl: 'Wskaźnik gotówkowej płynności',
    category: 'liquidity',
    formula: 'Cash / Current Liabilities',
    formulaDescription: 'Most conservative liquidity measure — only cash',
    formulaDescriptionPl: 'Najbardziej konserwatywna miara płynności — tylko gotówka',
    requiredLines: ['CASH', 'CURRENT_LIABILITIES'],
    compute: (v) => safe(v.CASH, v.CURRENT_LIABILITIES, div),
    thresholds: { warn: 0.2, critical: 0.1, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'WC_TO_REVENUE',
    name: 'Working Capital to Revenue',
    namePl: 'Kapitał obrotowy do przychodów',
    category: 'liquidity',
    formula: '(Current Assets − Current Liabilities) / Revenue × 100',
    formulaDescription: 'Working capital adequacy relative to sales volume',
    formulaDescriptionPl: 'Adekwatność kapitału obrotowego względem skali sprzedaży',
    requiredLines: ['CURRENT_ASSETS', 'CURRENT_LIABILITIES', 'REVENUE'],
    compute: (v) => {
      const wc = (v.CURRENT_ASSETS ?? 0) - (v.CURRENT_LIABILITIES ?? 0);
      return safe(wc, v.REVENUE, (a, b) => (a / b) * 100);
    },
    thresholds: { warn: 5, critical: 0, direction: 'higher_better' },
    unit: '%',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFITABILITY (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: 'GROSS_MARGIN',
    name: 'Gross Margin',
    namePl: 'Marża brutto',
    category: 'profitability',
    formula: 'Gross Profit / Revenue × 100',
    formulaDescription: 'Percentage of revenue retained after direct costs',
    formulaDescriptionPl: 'Procent przychodu pozostający po kosztach bezpośrednich',
    requiredLines: ['GROSS_PROFIT', 'REVENUE'],
    compute: (v) => safe(v.GROSS_PROFIT, v.REVENUE, (a, b) => (a / b) * 100),
    thresholds: { warn: 20, critical: 10, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'OPERATING_MARGIN',
    name: 'Operating Margin',
    namePl: 'Marża operacyjna',
    category: 'profitability',
    formula: 'EBIT / Revenue × 100',
    formulaDescription: 'Profitability from core operations',
    formulaDescriptionPl: 'Rentowność z działalności podstawowej',
    requiredLines: ['EBIT', 'REVENUE'],
    compute: (v) => safe(v.EBIT, v.REVENUE, (a, b) => (a / b) * 100),
    thresholds: { warn: 5, critical: 0, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'NET_MARGIN',
    name: 'Net Margin',
    namePl: 'Marża netto',
    category: 'profitability',
    formula: 'Net Income / Revenue × 100',
    formulaDescription: 'Bottom-line profitability after all expenses and taxes',
    formulaDescriptionPl: 'Rentowność netto po wszystkich kosztach i podatkach',
    requiredLines: ['NET_INCOME', 'REVENUE'],
    compute: (v) => safe(v.NET_INCOME, v.REVENUE, (a, b) => (a / b) * 100),
    thresholds: { warn: 3, critical: 0, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'EBT_MARGIN',
    name: 'EBT Margin',
    namePl: 'Marża zysku brutto (przed opodatkowaniem)',
    category: 'profitability',
    formula: 'EBT / Revenue × 100',
    formulaDescription: 'Pre-tax profitability as percentage of revenue',
    formulaDescriptionPl: 'Rentowność przed opodatkowaniem jako procent przychodu',
    requiredLines: ['EBT', 'REVENUE'],
    compute: (v) => safe(v.EBT, v.REVENUE, (a, b) => (a / b) * 100),
    thresholds: { warn: 5, critical: 0, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'EBITDA_MARGIN',
    name: 'EBITDA Margin',
    namePl: 'Marża EBITDA',
    category: 'profitability',
    formula: 'EBITDA / Revenue × 100',
    formulaDescription: 'Operating profitability before depreciation and amortization',
    formulaDescriptionPl: 'Rentowność operacyjna przed amortyzacją',
    requiredLines: ['EBITDA', 'REVENUE'],
    compute: (v) => safe(v.EBITDA, v.REVENUE, (a, b) => (a / b) * 100),
    thresholds: { warn: 10, critical: 5, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'ROA',
    name: 'Return on Assets',
    namePl: 'Zwrot z aktywów (ROA)',
    category: 'profitability',
    formula: 'Net Income / Total Assets × 100',
    formulaDescription: 'How efficiently assets generate profit',
    formulaDescriptionPl: 'Efektywność generowania zysku z aktywów',
    requiredLines: ['NET_INCOME', 'TOTAL_ASSETS'],
    compute: (v) => safe(v.NET_INCOME, v.TOTAL_ASSETS, (a, b) => (a / b) * 100),
    thresholds: { warn: 3, critical: 1, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'ROE',
    name: 'Return on Equity',
    namePl: 'Zwrot z kapitału własnego (ROE)',
    category: 'profitability',
    formula: 'Net Income / Equity × 100',
    formulaDescription: "Return generated on shareholders' investment",
    formulaDescriptionPl: 'Zwrot wygenerowany na kapitale właścicieli',
    requiredLines: ['NET_INCOME', 'TOTAL_EQUITY'],
    compute: (v) => safe(v.NET_INCOME, v.TOTAL_EQUITY, (a, b) => (a / b) * 100),
    thresholds: { warn: 8, critical: 3, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'ROCE',
    name: 'Return on Capital Employed',
    namePl: 'Zwrot z kapitału zaangażowanego (ROCE)',
    category: 'profitability',
    formula: 'EBIT / (Total Assets − Current Liabilities) × 100',
    formulaDescription: 'Return generated on all long-term capital (equity + long-term debt)',
    formulaDescriptionPl:
      'Zwrot z całego kapitału długoterminowego (kapitał własny + dług długoterminowy)',
    requiredLines: ['EBIT', 'TOTAL_ASSETS', 'CURRENT_LIABILITIES'],
    compute: (v) => {
      const ce = (v.TOTAL_ASSETS ?? 0) - (v.CURRENT_LIABILITIES ?? 0);
      return ce > 0 ? safe(v.EBIT, ce, (a, b) => (a / b) * 100) : null;
    },
    thresholds: { warn: 8, critical: 4, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'ROIC',
    name: 'Return on Invested Capital',
    namePl: 'Zwrot z kapitału zainwestowanego (ROIC)',
    category: 'profitability',
    formula: 'NOPAT / Invested Capital × 100',
    formulaDescription: 'After-tax operating return on all investor capital',
    formulaDescriptionPl: 'Zwrot operacyjny po opodatkowaniu na kapitale wszystkich inwestorów',
    requiredLines: [
      'EBIT',
      'TAX_EXPENSE',
      'EBT',
      'TOTAL_EQUITY',
      'LONG_TERM_DEBT',
      'SHORT_TERM_DEBT',
      'CASH',
    ],
    compute: (v) => {
      const ebt = v.EBT ?? 0;
      const taxRate = ebt !== 0 ? Math.abs(v.TAX_EXPENSE ?? 0) / Math.abs(ebt) : 0.19;
      const nopat = (v.EBIT ?? 0) * (1 - taxRate);
      const totalDebt = (v.LONG_TERM_DEBT ?? 0) + (v.SHORT_TERM_DEBT ?? 0);
      const netDebt = totalDebt - (v.CASH ?? 0);
      const investedCapital = (v.TOTAL_EQUITY ?? 0) + netDebt;
      return investedCapital > 0 ? (nopat / investedCapital) * 100 : null;
    },
    thresholds: { warn: 8, critical: 4, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'EFFECTIVE_TAX_RATE',
    name: 'Effective Tax Rate',
    namePl: 'Efektywna stopa podatkowa',
    category: 'profitability',
    formula: '|Tax Expense| / |EBT| × 100',
    formulaDescription: 'Actual tax burden as percentage of pre-tax profit',
    formulaDescriptionPl:
      'Rzeczywiste obciążenie podatkowe jako procent zysku przed opodatkowaniem',
    requiredLines: ['TAX_EXPENSE', 'EBT'],
    compute: (v) => {
      const ebt = Math.abs(v.EBT ?? 0);
      return ebt > 0 ? (Math.abs(v.TAX_EXPENSE ?? 0) / ebt) * 100 : null;
    },
    thresholds: { warn: 30, critical: 40, direction: 'lower_better' },
    unit: '%',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVERAGE (7)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: 'DEBT_TO_EQUITY',
    name: 'Debt-to-Equity',
    namePl: 'Wskaźnik zadłużenia do kapitału',
    category: 'leverage',
    formula: 'Total Liabilities / Equity',
    formulaDescription: 'Proportion of financing from debt vs equity',
    formulaDescriptionPl: 'Proporcja finansowania długiem względem kapitału',
    requiredLines: ['TOTAL_LIABILITIES', 'TOTAL_EQUITY'],
    compute: (v) => safe(v.TOTAL_LIABILITIES, v.TOTAL_EQUITY, div),
    thresholds: { warn: 2.0, critical: 3.0, direction: 'lower_better' },
    unit: 'x',
  },
  {
    code: 'DEBT_RATIO',
    name: 'Debt Ratio',
    namePl: 'Wskaźnik zadłużenia',
    category: 'leverage',
    formula: 'Total Liabilities / Total Assets',
    formulaDescription: 'Percentage of assets financed by debt',
    formulaDescriptionPl: 'Procent aktywów finansowany długiem',
    requiredLines: ['TOTAL_LIABILITIES', 'TOTAL_ASSETS'],
    compute: (v) => safe(v.TOTAL_LIABILITIES, v.TOTAL_ASSETS, div),
    thresholds: { warn: 0.6, critical: 0.8, direction: 'lower_better' },
    unit: 'x',
  },
  {
    code: 'EQUITY_RATIO',
    name: 'Equity Ratio',
    namePl: 'Wskaźnik autonomii finansowej',
    category: 'leverage',
    formula: 'Equity / Total Assets',
    formulaDescription: 'Proportion of assets financed by equity',
    formulaDescriptionPl: 'Udział kapitału własnego w finansowaniu aktywów',
    requiredLines: ['TOTAL_EQUITY', 'TOTAL_ASSETS'],
    compute: (v) => safe(v.TOTAL_EQUITY, v.TOTAL_ASSETS, div),
    thresholds: { warn: 0.3, critical: 0.2, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'FINANCIAL_LEVERAGE',
    name: 'Financial Leverage (DuPont)',
    namePl: 'Dźwignia finansowa (DuPont)',
    category: 'leverage',
    formula: 'Total Assets / Equity',
    formulaDescription: 'Equity multiplier — DuPont decomposition component',
    formulaDescriptionPl: 'Mnożnik kapitałowy — składnik dekompozycji DuPont',
    requiredLines: ['TOTAL_ASSETS', 'TOTAL_EQUITY'],
    compute: (v) => safe(v.TOTAL_ASSETS, v.TOTAL_EQUITY, div),
    thresholds: { warn: 3.0, critical: 5.0, direction: 'lower_better' },
    unit: 'x',
  },
  {
    code: 'NET_DEBT_TO_EBITDA',
    name: 'Net Debt / EBITDA',
    namePl: 'Dług netto / EBITDA',
    category: 'leverage',
    formula: '(LT Debt + ST Debt − Cash) / EBITDA',
    formulaDescription: 'Key credit metric — years of EBITDA needed to repay net debt',
    formulaDescriptionPl:
      'Kluczowy wskaźnik kredytowy — lata EBITDA potrzebne do spłaty długu netto',
    requiredLines: ['LONG_TERM_DEBT', 'SHORT_TERM_DEBT', 'CASH', 'EBITDA'],
    compute: (v) => {
      const netDebt = (v.LONG_TERM_DEBT ?? 0) + (v.SHORT_TERM_DEBT ?? 0) - (v.CASH ?? 0);
      return safe(netDebt, v.EBITDA, div);
    },
    thresholds: { warn: 3.0, critical: 5.0, direction: 'lower_better' },
    unit: 'x',
  },
  {
    code: 'INTEREST_COVERAGE',
    name: 'Interest Coverage',
    namePl: 'Wskaźnik pokrycia odsetek',
    category: 'leverage',
    formula: 'EBIT / Interest Expense',
    formulaDescription: 'Ability to service debt from operating profit',
    formulaDescriptionPl: 'Zdolność obsługi długu z zysku operacyjnego',
    requiredLines: ['EBIT', 'INTEREST_EXPENSE'],
    compute: (v) => safe(v.EBIT, Math.abs(v.INTEREST_EXPENSE ?? 0), div),
    thresholds: { warn: 3.0, critical: 1.5, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'DEBT_SERVICE_COVERAGE',
    name: 'Debt Service Coverage Ratio',
    namePl: 'Wskaźnik pokrycia obsługi długu (DSCR)',
    category: 'leverage',
    formula: 'Operating CF / (Interest Paid + Debt Repayment)',
    formulaDescription: 'Cash available to service total debt obligations',
    formulaDescriptionPl: 'Gotówka dostępna na obsługę całkowitych zobowiązań dłużnych',
    requiredLines: ['OPERATING_CF', 'INTEREST_PAID', 'DEBT_REPAYMENT'],
    compute: (v) => {
      const debtService = Math.abs(v.INTEREST_PAID ?? 0) + Math.abs(v.DEBT_REPAYMENT ?? 0);
      return debtService > 0 ? (v.OPERATING_CF ?? 0) / debtService : null;
    },
    thresholds: { warn: 1.5, critical: 1.0, direction: 'higher_better' },
    unit: 'x',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFICIENCY (8)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: 'ASSET_TURNOVER',
    name: 'Asset Turnover',
    namePl: 'Obrotowość aktywów',
    category: 'efficiency',
    formula: 'Revenue / Total Assets',
    formulaDescription: 'Revenue generated per unit of assets — DuPont component',
    formulaDescriptionPl: 'Przychód generowany na jednostkę aktywów — składnik DuPont',
    requiredLines: ['REVENUE', 'TOTAL_ASSETS'],
    compute: (v) => safe(v.REVENUE, v.TOTAL_ASSETS, div),
    thresholds: { warn: 0.5, critical: 0.3, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'FIXED_ASSET_TURNOVER',
    name: 'Fixed Asset Turnover',
    namePl: 'Obrotowość aktywów trwałych',
    category: 'efficiency',
    formula: 'Revenue / Fixed Assets',
    formulaDescription: 'Revenue generated per unit of fixed assets',
    formulaDescriptionPl: 'Przychód generowany na jednostkę aktywów trwałych',
    requiredLines: ['REVENUE', 'FIXED_ASSETS'],
    compute: (v) => safe(v.REVENUE, v.FIXED_ASSETS, div),
    thresholds: { warn: 1.0, critical: 0.5, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'WC_TURNOVER',
    name: 'Working Capital Turnover',
    namePl: 'Obrotowość kapitału obrotowego',
    category: 'efficiency',
    formula: 'Revenue / Working Capital',
    formulaDescription: 'Efficiency of working capital deployment',
    formulaDescriptionPl: 'Efektywność wykorzystania kapitału obrotowego',
    requiredLines: ['REVENUE', 'CURRENT_ASSETS', 'CURRENT_LIABILITIES'],
    compute: (v) => {
      const wc = (v.CURRENT_ASSETS ?? 0) - (v.CURRENT_LIABILITIES ?? 0);
      return wc > 0 ? (v.REVENUE ?? 0) / wc : null;
    },
    thresholds: { warn: 3.0, critical: 1.5, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'INVENTORY_TURNOVER',
    name: 'Inventory Turnover',
    namePl: 'Rotacja zapasów',
    category: 'efficiency',
    formula: 'COGS / Inventory',
    formulaDescription: 'How many times inventory is sold and replaced per period',
    formulaDescriptionPl: 'Ile razy zapasy są sprzedane i odnowione w okresie',
    requiredLines: ['COGS', 'INVENTORY'],
    compute: (v) => safe(Math.abs(v.COGS ?? 0), v.INVENTORY, div),
    thresholds: { warn: 4, critical: 2, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'DIO',
    name: 'Days Inventory Outstanding',
    namePl: 'Dni rotacji zapasów (DIO)',
    category: 'efficiency',
    formula: '(Inventory / |COGS|) × 365',
    formulaDescription: 'Average days inventory is held before sale',
    formulaDescriptionPl: 'Średnia liczba dni trzymania zapasów przed sprzedażą',
    requiredLines: ['INVENTORY', 'COGS'],
    compute: (v) => safe(v.INVENTORY, Math.abs(v.COGS ?? 0), (a, b) => (a / b) * 365),
    thresholds: { warn: 60, critical: 90, direction: 'lower_better' },
    unit: 'days',
  },
  {
    code: 'DSO',
    name: 'Days Sales Outstanding',
    namePl: 'Dni rotacji należności (DSO)',
    category: 'efficiency',
    formula: '(AR / Revenue) × 365',
    formulaDescription: 'Average days to collect receivables',
    formulaDescriptionPl: 'Średnia liczba dni na ściągnięcie należności',
    requiredLines: ['AR', 'REVENUE'],
    compute: (v) => safe(v.AR, v.REVENUE, (a, b) => (a / b) * 365),
    thresholds: { warn: 60, critical: 90, direction: 'lower_better' },
    unit: 'days',
  },
  {
    code: 'DPO',
    name: 'Days Payable Outstanding',
    namePl: 'Dni rotacji zobowiązań (DPO)',
    category: 'efficiency',
    formula: '(AP / |COGS|) × 365',
    formulaDescription: 'Average days to pay suppliers',
    formulaDescriptionPl: 'Średnia liczba dni na zapłatę dostawcom',
    requiredLines: ['AP', 'COGS'],
    compute: (v) => safe(v.AP, Math.abs(v.COGS ?? 0), (a, b) => (a / b) * 365),
    thresholds: { warn: 90, critical: 120, direction: 'lower_better' },
    unit: 'days',
  },
  {
    code: 'CCC',
    name: 'Cash Conversion Cycle',
    namePl: 'Cykl konwersji gotówki (CCC)',
    category: 'efficiency',
    formula: 'DSO + DIO − DPO',
    formulaDescription: 'Days between paying for inventory and collecting from customers',
    formulaDescriptionPl: 'Dni między zapłatą za zapasy a otrzymaniem zapłaty od klientów',
    requiredLines: ['AR', 'REVENUE', 'INVENTORY', 'COGS', 'AP'],
    compute: (v) => {
      const dso = safe(v.AR, v.REVENUE, (a, b) => (a / b) * 365);
      const dio = safe(v.INVENTORY, Math.abs(v.COGS ?? 0), (a, b) => (a / b) * 365);
      const dpo = safe(v.AP, Math.abs(v.COGS ?? 0), (a, b) => (a / b) * 365);
      if (dso === null || dio === null || dpo === null) return null;
      return dso + dio - dpo;
    },
    thresholds: { warn: 60, critical: 90, direction: 'lower_better' },
    unit: 'days',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CASH FLOW (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    code: 'OCF_TO_NET_INCOME',
    name: 'Operating CF / Net Income',
    namePl: 'CF operacyjny / Zysk netto (jakość zysku)',
    category: 'efficiency',
    formula: 'Operating CF / Net Income',
    formulaDescription: 'Quality of earnings — cash backing of reported profit',
    formulaDescriptionPl: 'Jakość zysku — gotówkowe pokrycie raportowanego zysku',
    requiredLines: ['OPERATING_CF', 'NET_INCOME'],
    compute: (v) => safe(v.OPERATING_CF, v.NET_INCOME, div),
    thresholds: { warn: 0.8, critical: 0.5, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'FCF_TO_REVENUE',
    name: 'FCF / Revenue',
    namePl: 'FCF / Przychody',
    category: 'efficiency',
    formula: '(Operating CF − Capex) / Revenue × 100',
    formulaDescription: 'Free cash flow yield relative to revenue',
    formulaDescriptionPl: 'Wydajność wolnych przepływów pieniężnych względem przychodów',
    requiredLines: ['OPERATING_CF', 'CAPEX', 'REVENUE'],
    compute: (v) => {
      const fcf = (v.OPERATING_CF ?? 0) + (v.CAPEX ?? 0);
      return safe(fcf, v.REVENUE, (a, b) => (a / b) * 100);
    },
    thresholds: { warn: 5, critical: 0, direction: 'higher_better' },
    unit: '%',
  },
  {
    code: 'CAPEX_TO_REVENUE',
    name: 'Capex / Revenue',
    namePl: 'Nakłady inwestycyjne / Przychody',
    category: 'efficiency',
    formula: '|Capex| / Revenue × 100',
    formulaDescription: 'Capital intensity — investment rate relative to revenue',
    formulaDescriptionPl: 'Intensywność kapitałowa — stopa inwestycji względem przychodów',
    requiredLines: ['CAPEX', 'REVENUE'],
    compute: (v) => safe(Math.abs(v.CAPEX ?? 0), v.REVENUE, (a, b) => (a / b) * 100),
    thresholds: { warn: 15, critical: 25, direction: 'lower_better' },
    unit: '%',
  },
  {
    code: 'CAPEX_TO_DA',
    name: 'Capex / D&A',
    namePl: 'Nakłady / Amortyzacja',
    category: 'efficiency',
    formula: '|Capex| / Depreciation',
    formulaDescription: 'Investment coverage — >1 means growth capex, <1 means underinvestment',
    formulaDescriptionPl: 'Pokrycie inwestycyjne — >1 oznacza inwestowanie ponad odtworzenie',
    requiredLines: ['CAPEX', 'DEPRECIATION'],
    compute: (v) => safe(Math.abs(v.CAPEX ?? 0), Math.abs(v.DEPRECIATION ?? 0), div),
    thresholds: { warn: 0.8, critical: 0.5, direction: 'higher_better' },
    unit: 'x',
  },
  {
    code: 'OCF_TO_TOTAL_DEBT',
    name: 'Operating CF / Total Debt',
    namePl: 'CF operacyjny / Dług ogółem',
    category: 'leverage',
    formula: 'Operating CF / (LT Debt + ST Debt)',
    formulaDescription: 'Ability to repay total debt from cash operations',
    formulaDescriptionPl: 'Zdolność spłaty całkowitego zadłużenia z operacji gotówkowych',
    requiredLines: ['OPERATING_CF', 'LONG_TERM_DEBT', 'SHORT_TERM_DEBT'],
    compute: (v) => {
      const totalDebt = (v.LONG_TERM_DEBT ?? 0) + (v.SHORT_TERM_DEBT ?? 0);
      return totalDebt > 0 ? (v.OPERATING_CF ?? 0) / totalDebt : null;
    },
    thresholds: { warn: 0.25, critical: 0.1, direction: 'higher_better' },
    unit: 'x',
  },
];

// Growth ratios are computed separately (require two periods)

/**
 * RATIO_CATALOG codes that have a matching band in the static per-industry
 * benchmark module (O6.2/O6.3). Not every ratio in the catalog has an
 * industry band yet — those simply keep whatever org-entered benchmark (or
 * none) they already had.
 */
const CATALOG_TO_BENCHMARK_CODE: Partial<Record<string, BenchmarkRatioCode>> = {
  GROSS_MARGIN: 'GROSS_MARGIN',
  OPERATING_MARGIN: 'OPERATING_MARGIN',
  EBITDA_MARGIN: 'EBITDA_MARGIN',
  NET_MARGIN: 'NET_MARGIN',
  ROE: 'ROE',
  ROA: 'ROA',
  CURRENT_RATIO: 'CURRENT_RATIO',
  QUICK_RATIO: 'QUICK_RATIO',
  DEBT_TO_EQUITY: 'DEBT_TO_EQUITY',
  INVENTORY_TURNOVER: 'INVENTORY_TURNOVER',
  DSO: 'DSO',
  DIO: 'DIO',
};

/**
 * Resolve the benchmark to attach to a computed ratio: an organization-
 * entered row (financial_ratio_benchmarks) always wins; otherwise fall back
 * to the static per-industry quartile band for the org's industry, if the
 * ratio has one. Returns undefined when neither is available (caller then
 * relies purely on the universal warn/critical threshold, unchanged).
 */
export function buildRatioBenchmark(
  ratioCode: string,
  orgBenchmarkRow: any,
  orgIndustry: string | undefined,
  computedValue: number | null
): ComputedRatio['benchmark'] | undefined {
  if (orgBenchmarkRow) {
    return {
      p25: orgBenchmarkRow.p25,
      median: orgBenchmarkRow.median,
      p75: orgBenchmarkRow.p75,
      targetMin: orgBenchmarkRow.target_min,
      targetMax: orgBenchmarkRow.target_max,
      source: orgBenchmarkRow.source_label,
      origin: 'org',
    };
  }

  const benchmarkCode = CATALOG_TO_BENCHMARK_CODE[ratioCode];
  if (!benchmarkCode) return undefined;

  const def = RATIO_CATALOG.find((r) => r.code === ratioCode);
  const higherIsBetter = def?.thresholds.direction !== 'lower_better';

  const result = getRatioBenchmark(orgIndustry, benchmarkCode);
  if (!result) return undefined;

  const { band, industry, industryLabel, sourceMetadata } = result;
  const lowBound = Math.min(band.p25, band.p75);
  const highBound = Math.max(band.p25, band.p75);

  let narrativePl: string | undefined;
  let narrativeEn: string | undefined;
  if (computedValue !== null && def) {
    const described = describeRatioAgainstBenchmark({
      industrySegment: orgIndustry,
      ratioCode: benchmarkCode,
      ratioLabel: { pl: def.namePl, en: def.name },
      value: computedValue,
      higherIsBetter,
    });
    narrativePl = described.sentence.pl;
    narrativeEn = described.sentence.en;
  }

  return {
    p25: higherIsBetter ? lowBound : highBound,
    median: band.median,
    p75: higherIsBetter ? highBound : lowBound,
    source: band.source,
    origin: 'industry',
    industry,
    industryLabelPl: industryLabel.pl,
    industryLabelEn: industryLabel.en,
    asOf: band.asOf,
    confidence: band.confidence,
    narrativePl,
    narrativeEn,
    refreshOwnerPl: sourceMetadata.refreshOwner.pl,
    refreshOwnerEn: sourceMetadata.refreshOwner.en,
    disclaimerPl: sourceMetadata.disclaimer.pl,
    disclaimerEn: sourceMetadata.disclaimer.en,
  };
}

// ---------------------------------------------------------------------------
// Compute ratios for a single statement
// ---------------------------------------------------------------------------

export async function computeRatios(
  statementId: string,
  organizationId: string
): Promise<RatioAnalysisResult> {
  const stmt = await assertReadyStatement(statementId, organizationId);

  // Load values with canonical line codes
  const valueRows = (await dbAll(
    `SELECT fsv.*, fsl.line_code FROM financial_statement_values fsv
     LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
     INNER JOIN financial_statements fs ON fs.id = fsv.statement_id
     WHERE fs.organization_id = ?
       AND (
         fs.id = ?
         OR (? IS NOT NULL AND fs.statement_pack_id = ?)
       )
       AND (
         LOWER(COALESCE(fs.readiness_status, 'pending')) = 'ready'
         OR LOWER(COALESCE(fs.status, '')) IN ('confirmed', 'approved')
       )`,
    [organizationId, statementId, stmt.statement_pack_id || null, stmt.statement_pack_id || null]
  )) as any[];

  const values: Record<string, number> = {};
  for (const row of valueRows) {
    const canonicalCode = normalizeCanonicalLineCode(row.line_code);
    if (canonicalCode && row.value !== null) {
      values[canonicalCode] = Number(row.value || 0);
    }
  }
  const resolvedValues = deriveComputedValues(withCanonicalAliases(values));

  // Load benchmarks — organization-entered rows win when present.
  const benchmarkRows = (await dbAll(
    `SELECT * FROM financial_ratio_benchmarks WHERE organization_id = ?`,
    [organizationId]
  )) as any[];
  const benchmarkMap: Record<string, any> = {};
  for (const b of benchmarkRows) {
    benchmarkMap[b.ratio_code] = b;
  }

  // No org-entered benchmark for a ratio → fall back to the static
  // per-industry quartile bands (financeIndustryBenchmarks, O6.2/O6.3)
  // instead of leaving the ratio without any comparison context.
  const orgIndustry = await loadOrganizationIndustry(organizationId);

  const ratios: ComputedRatio[] = [];

  for (const def of RATIO_CATALOG) {
    const missingLines = def.requiredLines.filter((code) => !(code in resolvedValues));
    const coveragePct =
      def.requiredLines.length > 0
        ? Math.round(
            ((def.requiredLines.length - missingLines.length) / def.requiredLines.length) * 100
          )
        : 100;

    let computedValue: number | null = null;
    let status: RatioStatus = 'na';

    if (missingLines.length === 0) {
      computedValue = def.compute(resolvedValues);
      if (computedValue !== null && Number.isFinite(computedValue)) {
        computedValue = Math.round(computedValue * 100) / 100;
        status = evaluateStatus(computedValue, def.thresholds);
      } else {
        computedValue = null;
        status = 'na';
      }
    }

    const bm = benchmarkMap[def.code];

    ratios.push({
      code: def.code,
      name: def.name,
      namePl: def.namePl,
      category: def.category,
      value: computedValue,
      status,
      formula: def.formula,
      formulaDescription: def.formulaDescription,
      formulaDescriptionPl: def.formulaDescriptionPl,
      unit: def.unit,
      coveragePct,
      missingLines,
      benchmark: buildRatioBenchmark(def.code, bm, orgIndustry, computedValue),
    });
  }

  // Group by category
  const categories: Record<RatioCategory, ComputedRatio[]> = {
    liquidity: [],
    profitability: [],
    leverage: [],
    efficiency: [],
    growth: [],
  };
  for (const r of ratios) {
    categories[r.category].push(r);
  }

  const computed = ratios.filter((r) => r.status !== 'na').length;

  // Persist snapshots
  await persistRatioSnapshots(statementId, organizationId, ratios);

  const compositeScores = computeAllCompositeScores(resolvedValues);

  return {
    statementId,
    periodLabel: stmt.period_label || `${stmt.period_start} – ${stmt.period_end}`,
    ratios,
    categories,
    coverageSummary: {
      total: ratios.length,
      computed,
      na: ratios.length - computed,
      coveragePct: Math.round((computed / ratios.length) * 100),
    },
    compositeScores,
  };
}

// ---------------------------------------------------------------------------
// Growth ratios (require two periods)
// ---------------------------------------------------------------------------

export async function computeGrowthRatios(
  currentStatementId: string,
  previousStatementId: string,
  organizationId: string
): Promise<ComputedRatio[]> {
  await assertReadyStatement(currentStatementId, organizationId);
  await assertReadyStatement(previousStatementId, organizationId);

  const loadValues = async (sid: string) => {
    const rows = (await dbAll(
      `SELECT fsl.line_code, fsv.value FROM financial_statement_values fsv
       LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
       WHERE fsv.statement_id = ? AND fsl.line_code IS NOT NULL`,
      [sid]
    )) as any[];
    const map: Record<string, number> = {};
    for (const r of rows) {
      const canonicalCode = normalizeCanonicalLineCode(r.line_code);
      if (canonicalCode && r.value !== null) map[canonicalCode] = Number(r.value || 0);
    }
    return withCanonicalAliases(map);
  };

  const current = deriveComputedValues(await loadValues(currentStatementId));
  const previous = deriveComputedValues(await loadValues(previousStatementId));

  const growthRatios: ComputedRatio[] = [];

  const addGrowth = (lineCode: string, name: string, namePl: string) => {
    const cur = current[lineCode];
    const prev = previous[lineCode];
    const missingLines: string[] = [];
    if (cur === undefined) missingLines.push(`${lineCode} (current)`);
    if (prev === undefined) missingLines.push(`${lineCode} (previous)`);

    let value: number | null = null;
    let status: RatioStatus = 'na';
    if (cur !== undefined && prev !== undefined && prev !== 0) {
      value = Math.round(((cur - prev) / Math.abs(prev)) * 10000) / 100;
      status = value > 0 ? 'ok' : value > -5 ? 'warn' : 'critical';
    }

    growthRatios.push({
      code: `${lineCode}_GROWTH`,
      name,
      namePl,
      category: 'growth',
      value,
      status,
      formula: `(Current − Previous) / |Previous| × 100`,
      formulaDescription: `Year-over-year change in ${name}`,
      formulaDescriptionPl: `Zmiana rok do roku: ${namePl}`,
      unit: '%',
      coveragePct: missingLines.length === 0 ? 100 : 0,
      missingLines,
    });
  };

  addGrowth('REVENUE', 'Revenue Growth', 'Wzrost przychodów');
  addGrowth('GROSS_PROFIT', 'Gross Profit Growth', 'Wzrost marży brutto');
  addGrowth('EBIT', 'EBIT Growth', 'Wzrost EBIT');
  addGrowth('EBITDA', 'EBITDA Growth', 'Wzrost EBITDA');
  addGrowth('NET_INCOME', 'Net Income Growth', 'Wzrost zysku netto');
  addGrowth('TOTAL_ASSETS', 'Asset Growth', 'Wzrost aktywów');
  addGrowth('TOTAL_EQUITY', 'Equity Growth', 'Wzrost kapitału własnego');
  addGrowth('OPERATING_CF', 'Operating CF Growth', 'Wzrost CF operacyjnego');

  return growthRatios;
}

// ---------------------------------------------------------------------------
// Status evaluation
// ---------------------------------------------------------------------------

function evaluateStatus(value: number, thresholds: RatioDefinition['thresholds']): RatioStatus {
  const { warn, critical, direction } = thresholds;
  if (direction === 'higher_better') {
    if (value < critical) return 'critical';
    if (value < warn) return 'warn';
    return 'ok';
  } else {
    if (value > critical) return 'critical';
    if (value > warn) return 'warn';
    return 'ok';
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistRatioSnapshots(
  statementId: string,
  organizationId: string,
  ratios: ComputedRatio[]
): Promise<void> {
  await dbRun(`DELETE FROM financial_ratio_snapshots WHERE statement_id = ?`, [statementId]);
  for (const r of ratios) {
    await dbRun(
      `INSERT INTO financial_ratio_snapshots (id, organization_id, statement_id, ratio_code, ratio_value, status, coverage_pct, missing_lines)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        organizationId,
        statementId,
        r.code,
        r.value,
        r.status,
        r.coveragePct,
        r.missingLines.length > 0 ? JSON.stringify(r.missingLines) : null,
      ]
    );
  }
}

// ---------------------------------------------------------------------------
// Benchmark CRUD
// ---------------------------------------------------------------------------

export async function upsertBenchmark(params: {
  organizationId: string;
  ratioCode: string;
  industry?: string;
  region?: string;
  companySize?: string;
  periodYear?: number;
  p25?: number;
  median?: number;
  p75?: number;
  targetMin?: number;
  targetMax?: number;
  sourceLabel?: string;
  createdBy?: string;
}): Promise<string> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO financial_ratio_benchmarks (id, organization_id, ratio_code, industry, region, company_size, period_year, p25, median, p75, target_min, target_max, source_label, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(organization_id, ratio_code, industry, period_year) DO UPDATE SET
       p25 = excluded.p25, median = excluded.median, p75 = excluded.p75,
       target_min = excluded.target_min, target_max = excluded.target_max,
       source_label = excluded.source_label, updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      params.organizationId,
      params.ratioCode,
      params.industry || null,
      params.region || null,
      params.companySize || null,
      params.periodYear || null,
      params.p25 ?? null,
      params.median ?? null,
      params.p75 ?? null,
      params.targetMin ?? null,
      params.targetMax ?? null,
      params.sourceLabel || null,
      params.createdBy || null,
    ]
  );
  return id;
}

export async function getBenchmarks(organizationId: string): Promise<any[]> {
  return (
    (await dbAll(
      `SELECT * FROM financial_ratio_benchmarks WHERE organization_id = ? ORDER BY ratio_code`,
      [organizationId]
    )) || []
  );
}

// ---------------------------------------------------------------------------
// Ratio catalog export (for UI)
// ---------------------------------------------------------------------------

export function getRatioCatalog(): Array<Omit<RatioDefinition, 'compute'>> {
  return RATIO_CATALOG.map(({ compute, ...rest }) => rest);
}

logger.info('[RatioAnalysisService] Loaded');
