/**
 * T051 — Financial Ratio Analysis Service
 *
 * Comprehensive ratio engine: liquidity, profitability, leverage, efficiency, growth.
 * Each ratio has a formula definition, required lines, fallback/NA, and status thresholds.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

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
  };
}

export interface RatioAnalysisResult {
  statementId: string;
  periodLabel: string;
  ratios: ComputedRatio[];
  categories: Record<RatioCategory, ComputedRatio[]>;
  coverageSummary: { total: number; computed: number; na: number; coveragePct: number };
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
  return op(a, b);
};

const div = (a: number, b: number) => a / b;

export const RATIO_CATALOG: RatioDefinition[] = [
  // ── Liquidity ──
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

  // ── Profitability ──
  {
    code: 'GROSS_MARGIN',
    name: 'Gross Margin',
    namePl: 'Marża brutto',
    category: 'profitability',
    formula: 'Gross Margin / Revenue × 100',
    formulaDescription: 'Percentage of revenue retained after direct costs',
    formulaDescriptionPl: 'Procent przychodu pozostający po kosztach bezpośrednich',
    requiredLines: ['GROSS_MARGIN', 'REVENUE'],
    compute: (v) => safe(v.GROSS_MARGIN, v.REVENUE, (a, b) => (a / b) * 100),
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
    requiredLines: ['NET_INCOME', 'EQUITY'],
    compute: (v) => safe(v.NET_INCOME, v.EQUITY, (a, b) => (a / b) * 100),
    thresholds: { warn: 8, critical: 3, direction: 'higher_better' },
    unit: '%',
  },

  // ── Leverage ──
  {
    code: 'DEBT_TO_EQUITY',
    name: 'Debt-to-Equity',
    namePl: 'Wskaźnik zadłużenia do kapitału',
    category: 'leverage',
    formula: 'Total Liabilities / Equity',
    formulaDescription: 'Proportion of financing from debt vs equity',
    formulaDescriptionPl: 'Proporcja finansowania długiem względem kapitału',
    requiredLines: ['TOTAL_LIABILITIES', 'EQUITY'],
    compute: (v) => safe(v.TOTAL_LIABILITIES, v.EQUITY, div),
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
    code: 'INTEREST_COVERAGE',
    name: 'Interest Coverage',
    namePl: 'Wskaźnik pokrycia odsetek',
    category: 'leverage',
    formula: 'EBIT / Interest Expense',
    formulaDescription: 'Ability to service debt from operating profit',
    formulaDescriptionPl: 'Zdolność obsługi długu z zysku operacyjnego',
    requiredLines: ['EBIT', 'INTEREST_EXPENSE'],
    compute: (v) => safe(v.EBIT, v.INTEREST_EXPENSE, div),
    thresholds: { warn: 3.0, critical: 1.5, direction: 'higher_better' },
    unit: 'x',
  },

  // ── Efficiency ──
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
    code: 'AR_DAYS',
    name: 'AR Days (DSO)',
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
    code: 'AP_DAYS',
    name: 'AP Days (DPO)',
    namePl: 'Dni rotacji zobowiązań (DPO)',
    category: 'efficiency',
    formula: '(AP / COGS) × 365',
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
];

// Growth ratios are computed separately (require two periods)

// ---------------------------------------------------------------------------
// Compute ratios for a single statement
// ---------------------------------------------------------------------------

export async function computeRatios(
  statementId: string,
  organizationId: string
): Promise<RatioAnalysisResult> {
  const stmtRows = (await dbAll(`SELECT * FROM financial_statements WHERE id = ?`, [
    statementId,
  ])) as any[];
  if (!stmtRows.length) throw new Error('Statement not found');
  const stmt = stmtRows[0];

  // Load values with canonical line codes
  const valueRows = (await dbAll(
    `SELECT fsv.*, fsl.line_code FROM financial_statement_values fsv
     LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
     WHERE fsv.statement_id = ?`,
    [statementId]
  )) as any[];

  const values: Record<string, number> = {};
  for (const row of valueRows) {
    if (row.line_code && row.value !== null) {
      values[row.line_code] = row.value;
    }
  }

  // Load benchmarks
  const benchmarkRows = (await dbAll(
    `SELECT * FROM financial_ratio_benchmarks WHERE organization_id = ?`,
    [organizationId]
  )) as any[];
  const benchmarkMap: Record<string, any> = {};
  for (const b of benchmarkRows) {
    benchmarkMap[b.ratio_code] = b;
  }

  const ratios: ComputedRatio[] = [];

  for (const def of RATIO_CATALOG) {
    const missingLines = def.requiredLines.filter((code) => !(code in values));
    const coveragePct =
      def.requiredLines.length > 0
        ? Math.round(
            ((def.requiredLines.length - missingLines.length) / def.requiredLines.length) * 100
          )
        : 100;

    let computedValue: number | null = null;
    let status: RatioStatus = 'na';

    if (missingLines.length === 0) {
      computedValue = def.compute(values);
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
      ...(bm
        ? {
            benchmark: {
              p25: bm.p25,
              median: bm.median,
              p75: bm.p75,
              targetMin: bm.target_min,
              targetMax: bm.target_max,
              source: bm.source_label,
            },
          }
        : {}),
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
  const loadValues = async (sid: string) => {
    const rows = (await dbAll(
      `SELECT fsl.line_code, fsv.value FROM financial_statement_values fsv
       LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
       WHERE fsv.statement_id = ? AND fsl.line_code IS NOT NULL`,
      [sid]
    )) as any[];
    const map: Record<string, number> = {};
    for (const r of rows) if (r.value !== null) map[r.line_code] = r.value;
    return map;
  };

  const current = await loadValues(currentStatementId);
  const previous = await loadValues(previousStatementId);

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
  addGrowth('NET_INCOME', 'Net Income Growth', 'Wzrost zysku netto');
  addGrowth('EBITDA', 'EBITDA Growth', 'Wzrost EBITDA');
  addGrowth('TOTAL_ASSETS', 'Asset Growth', 'Wzrost aktywów');

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
