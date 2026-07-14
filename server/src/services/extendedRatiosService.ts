/**
 * M16/7.2 + 7.3 — Extended Ratios Service
 *
 * Pure, DB-free complementary layer on top of the base 18-ratio engine
 * (financialAnalysisService / ratioAnalysisService — NOT touched here).
 *
 * Adds the return / capital-structure / coverage / efficiency ratios the
 * analysis tabs were missing — ROE, ROA, ROIC, ROCE, D/E, equity ratio,
 * net debt / EBITDA, DSCR, asset turnover, fixed-asset turnover — plus a
 * DuPont decomposition of ROE and a generic industry-benchmark comparator.
 *
 * Every function is a pure computation: same input → same output, no I/O,
 * no side effects, safe NaN/Infinity guards on every division.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExtendedRatioCategory = 'return' | 'leverage' | 'coverage' | 'efficiency';

export type ExtendedRatioStatus = 'ok' | 'warn' | 'critical';

/**
 * Financial inputs. All monetary figures in the same currency/unit.
 * `taxRatePct` is a whole-number percent (e.g. 19 for 19%) used to derive NOPAT.
 */
export interface ExtendedFinancials {
  netIncome: number;
  equity: number;
  totalAssets: number;
  ebit: number;
  ebitda: number;
  debt: number;
  cash: number;
  revenue: number;
  fixedAssets: number;
  taxRatePct: number;
}

export interface ExtendedRatio {
  code: string;
  label: string;
  value: number | null;
  category: ExtendedRatioCategory;
  status: ExtendedRatioStatus;
}

export interface DupontDecomposition {
  roe: number | null;
  netMargin: number | null;
  assetTurnover: number | null;
  equityMultiplier: number | null;
}

export interface IndustryBenchmark {
  p25: number;
  median: number;
  p75: number;
}

export type BenchmarkPercentile = 'p25' | 'median' | 'p75' | 'above' | 'below';

export interface BenchmarkComparison {
  percentile: BenchmarkPercentile;
  status: ExtendedRatioStatus;
}

// ---------------------------------------------------------------------------
// Safe math helpers
// ---------------------------------------------------------------------------

/** Division guarded against zero / non-finite denominators and results. */
function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Net Operating Profit After Tax = EBIT × (1 − taxRate). */
function nopat(ebit: number, taxRatePct: number): number | null {
  if (!Number.isFinite(ebit) || !Number.isFinite(taxRatePct)) return null;
  const taxRate = taxRatePct / 100;
  return ebit * (1 - taxRate);
}

/**
 * Threshold-based status for a "higher is better" ratio.
 * value below `critical` → critical, below `warn` → warn, else ok.
 * A null value is treated as critical (cannot be evaluated → flag it).
 */
function higherBetterStatus(
  value: number | null,
  warn: number,
  critical: number
): ExtendedRatioStatus {
  if (value === null) return 'critical';
  if (value < critical) return 'critical';
  if (value < warn) return 'warn';
  return 'ok';
}

/**
 * Threshold-based status for a "lower is better" ratio.
 * value above `critical` → critical, above `warn` → warn, else ok.
 */
function lowerBetterStatus(
  value: number | null,
  warn: number,
  critical: number
): ExtendedRatioStatus {
  if (value === null) return 'critical';
  if (value > critical) return 'critical';
  if (value > warn) return 'warn';
  return 'ok';
}

// ---------------------------------------------------------------------------
// 1. computeExtendedRatios
// ---------------------------------------------------------------------------

/**
 * Compute the extended set of ratios beyond the base engine.
 *
 * Invested capital = equity + (debt − cash)   [net-debt basis]
 * Capital employed = equity + debt             [current liabilities not modeled]
 */
export function computeExtendedRatios(fin: ExtendedFinancials): ExtendedRatio[] {
  const {
    netIncome,
    equity,
    totalAssets,
    ebit,
    ebitda,
    debt,
    cash,
    revenue,
    fixedAssets,
    taxRatePct,
  } = fin;

  const netDebt = debt - cash;
  const investedCapital = equity + netDebt;
  const capitalEmployed = equity + debt;
  const nopatValue = nopat(ebit, taxRatePct);

  const roe = safeDiv(netIncome, equity);
  const roa = safeDiv(netIncome, totalAssets);
  const roic = nopatValue === null ? null : safeDiv(nopatValue, investedCapital);
  const roce = safeDiv(ebit, capitalEmployed);
  const debtToEquity = safeDiv(debt, equity);
  const equityRatio = safeDiv(equity, totalAssets);
  const netDebtToEbitda = safeDiv(netDebt, ebitda);
  // DSCR ≈ EBITDA available to service total debt obligations.
  const dscr = safeDiv(ebitda, debt);
  const assetTurnover = safeDiv(revenue, totalAssets);
  const fixedAssetTurnover = safeDiv(revenue, fixedAssets);

  return [
    {
      code: 'roe',
      label: 'Return on Equity (ROE)',
      value: roe,
      category: 'return',
      status: higherBetterStatus(roe, 0.1, 0),
    },
    {
      code: 'roa',
      label: 'Return on Assets (ROA)',
      value: roa,
      category: 'return',
      status: higherBetterStatus(roa, 0.05, 0),
    },
    {
      code: 'roic',
      label: 'Return on Invested Capital (ROIC)',
      value: roic,
      category: 'return',
      status: higherBetterStatus(roic, 0.08, 0),
    },
    {
      code: 'roce',
      label: 'Return on Capital Employed (ROCE)',
      value: roce,
      category: 'return',
      status: higherBetterStatus(roce, 0.08, 0),
    },
    {
      code: 'debt_to_equity',
      label: 'Debt / Equity (D/E)',
      value: debtToEquity,
      category: 'leverage',
      status: lowerBetterStatus(debtToEquity, 1.5, 2.5),
    },
    {
      code: 'equity_ratio',
      label: 'Equity Ratio',
      value: equityRatio,
      category: 'leverage',
      status: higherBetterStatus(equityRatio, 0.4, 0.2),
    },
    {
      code: 'net_debt_to_ebitda',
      label: 'Net Debt / EBITDA',
      value: netDebtToEbitda,
      category: 'leverage',
      status: lowerBetterStatus(netDebtToEbitda, 3, 4),
    },
    {
      code: 'dscr',
      label: 'Debt Service Coverage (DSCR)',
      value: dscr,
      category: 'coverage',
      status: higherBetterStatus(dscr, 1.25, 1),
    },
    {
      code: 'asset_turnover',
      label: 'Asset Turnover',
      value: assetTurnover,
      category: 'efficiency',
      status: higherBetterStatus(assetTurnover, 0.5, 0.2),
    },
    {
      code: 'fixed_asset_turnover',
      label: 'Fixed-Asset Turnover',
      value: fixedAssetTurnover,
      category: 'efficiency',
      status: higherBetterStatus(fixedAssetTurnover, 1, 0.5),
    },
  ];
}

// ---------------------------------------------------------------------------
// 2. dupontDecomposition
// ---------------------------------------------------------------------------

/**
 * Three-step DuPont decomposition of ROE:
 *
 *   ROE = netMargin × assetTurnover × equityMultiplier
 *       = (netIncome / revenue) × (revenue / totalAssets) × (totalAssets / equity)
 *
 * The identity holds exactly (revenue and totalAssets cancel), so the product of
 * the three returned components equals the returned `roe` whenever every factor
 * is computable.
 */
export function dupontDecomposition(fin: ExtendedFinancials): DupontDecomposition {
  const { netIncome, revenue, totalAssets, equity } = fin;

  const netMargin = safeDiv(netIncome, revenue);
  const assetTurnover = safeDiv(revenue, totalAssets);
  const equityMultiplier = safeDiv(totalAssets, equity);

  const roe =
    netMargin === null || assetTurnover === null || equityMultiplier === null
      ? safeDiv(netIncome, equity)
      : netMargin * assetTurnover * equityMultiplier;

  return { roe, netMargin, assetTurnover, equityMultiplier };
}

// ---------------------------------------------------------------------------
// 3. benchmarkStatus
// ---------------------------------------------------------------------------

/**
 * Position a value against an industry benchmark distribution (quartiles).
 *
 * Buckets (higher-is-better orientation):
 *   value < p25            → 'below'   (critical)
 *   p25 <= value < median  → 'p25'     (warn)
 *   median <= value < p75  → 'median'  (ok)
 *   p75 <= value           → 'p75' / 'above' (ok)
 *
 * Exact ties land on the named percentile (p25 / median / p75).
 */
export function benchmarkStatus(value: number, benchmark: IndustryBenchmark): BenchmarkComparison {
  const { p25, median, p75 } = benchmark;

  if (!Number.isFinite(value)) {
    return { percentile: 'below', status: 'critical' };
  }

  if (value < p25) {
    return { percentile: 'below', status: 'critical' };
  }
  if (value === p25) {
    return { percentile: 'p25', status: 'warn' };
  }
  if (value < median) {
    return { percentile: 'p25', status: 'warn' };
  }
  if (value === median) {
    return { percentile: 'median', status: 'ok' };
  }
  if (value < p75) {
    return { percentile: 'median', status: 'ok' };
  }
  if (value === p75) {
    return { percentile: 'p75', status: 'ok' };
  }
  return { percentile: 'above', status: 'ok' };
}
