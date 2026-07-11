/**
 * Z111 — Finance Ratio Family Catalog (Silnik analizy wskaźnikowej)
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_FINANCE_2026-07-10.md §3.1
 * "Silnik liczy → LLM tylko ubiera w język" — this module is the "silnik
 * liczy" half only. No LLM, no narration, no I/O: a pure, deterministic
 * function of a canonical-line-code value map, exactly like the reconcile
 * pattern in `financialModelingService.ts` (`loadSeedValueRows` /
 * `valuesByCode`) and `ratioAnalysisService.computeRatios` (`resolvedValues`).
 *
 * WHY A NEW FILE (reuse-not-rebuild note):
 * `ratioAnalysisService.RATIO_CATALOG` already computes ~34 ratios from the
 * same canonical line codes and is live on `GET /api/finance-statements/:id/
 * ratios` (mounted in Gateway.ts) — that engine is NOT touched or duplicated
 * in behavior here. This module exists because the concept doc asks for a
 * specific, named 5-family taxonomy (Płynność/Rentowność/Zadłużenie/
 * Efektywność/Wartość — RATIO_CATALOG uses liquidity/profitability/leverage/
 * efficiency/growth, no "value/investor" family) AND a stricter
 * missing-vs-zero contract: every formula here treats an ABSENT line code as
 * "cannot compute" (`skipped`, value `null`), never silently substituting 0
 * (RATIO_CATALOG's `safe()` sometimes falls back to `?? 0` for optional
 * legs, e.g. QUICK_RATIO's inventory term). That "no guessing" contract is
 * required by this task and mirrors the reconcile validator's philosophy
 * (F6): an unknown value must never be presented as a computed one.
 *
 * Formulas mirror the same industry-standard definitions already in the
 * codebase (`extendedRatiosService.ts`, `financeCompositeScores.ts`,
 * `ratioAnalysisService.ts`) — this file does not invent new finance theory,
 * it reorganizes + fills the one confirmed gap (ROIC−WACC spread family
 * item, which needs a WACC input this file does not compute — see §5/EV,
 * a later step).
 *
 * Additive: this file is not imported by any existing route/service, so it
 * changes the behavior of nothing that exists today.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RatioFamily = 'liquidity' | 'profitability' | 'leverage' | 'efficiency' | 'value';

export type RatioDirection = 'higher_better' | 'lower_better';

export type RatioUnit = 'x' | '%' | 'days' | 'currency' | 'pp';

export type ComputedRatioStatus = 'computed' | 'skipped';

/** Canonical-line-code keyed value map — same shape as the reconcile pattern. */
export type LineValueMap = Record<string, number>;

/** Optional externally-supplied inputs this engine cannot derive from statement lines alone. */
export interface RatioFamilyEngineOptions {
  /** WACC as a whole-number percent (e.g. 9.5 for 9.5%), from the valuation/EV engine (§5). */
  waccPct?: number;
}

export interface RatioFamilyDefinition {
  code: string;
  family: RatioFamily;
  label: string;
  labelPl: string;
  formula: string;
  /** Canonical line codes (financeCanonicalRegistry) this formula reads directly. */
  requiredLineCodes: string[];
  direction: RatioDirection;
  unit: RatioUnit;
  compute: (v: LineValueMap, opts: RatioFamilyEngineOptions) => number | null;
}

export interface ComputedFamilyRatio {
  code: string;
  family: RatioFamily;
  label: string;
  labelPl: string;
  value: number | null;
  status: ComputedRatioStatus;
  direction: RatioDirection;
  unit: RatioUnit;
  formula: string;
  missingLineCodes: string[];
  /**
   * Canonical line codes this formula reads (`def.requiredLineCodes`), present regardless
   * of `status` — additive field for lineage (#82g Finance report lineage): lets a caller
   * trace a computed ratio back to the exact statement-pack lines that fed it, without
   * re-deriving the definition table. Purely additive (new field, existing values
   * unchanged) — safe for callers that destructure a subset of this interface.
   */
  requiredLineCodes: string[];
}

export interface DupontFromLines {
  roe: number | null;
  netMarginPct: number | null;
  assetTurnover: number | null;
  equityMultiplier: number | null;
  status: ComputedRatioStatus;
  missingLineCodes: string[];
}

// ---------------------------------------------------------------------------
// Safe math — missing (absent key) is ALWAYS null, never 0
// ---------------------------------------------------------------------------

/** True only when every code is a present, finite key in the map (a real 0 counts as present). */
function hasAll(v: LineValueMap, codes: string[]): boolean {
  return codes.every((c) => c in v && Number.isFinite(v[c]));
}

function missingOf(v: LineValueMap, codes: string[]): string[] {
  return codes.filter((c) => !(c in v) || !Number.isFinite(v[c]));
}

/** Division guarded against a missing/zero/non-finite denominator. */
function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

function round(value: number | null, decimals = 4): number | null {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Shared derived building blocks (strict — null on any missing input)
// ---------------------------------------------------------------------------

/** DSO = AR / Revenue × 365 */
function dsoOf(v: LineValueMap): number | null {
  if (!hasAll(v, ['AR', 'REVENUE'])) return null;
  return safeDiv(v.AR, v.REVENUE) === null ? null : (v.AR / v.REVENUE) * 365;
}

/** DIO = Inventory / |COGS| × 365 */
function dioOf(v: LineValueMap): number | null {
  if (!hasAll(v, ['INVENTORY', 'COGS'])) return null;
  const cogsAbs = Math.abs(v.COGS);
  return safeDiv(v.INVENTORY, cogsAbs) === null ? null : (v.INVENTORY / cogsAbs) * 365;
}

/** DPO = AP / |COGS| × 365 */
function dpoOf(v: LineValueMap): number | null {
  if (!hasAll(v, ['AP', 'COGS'])) return null;
  const cogsAbs = Math.abs(v.COGS);
  return safeDiv(v.AP, cogsAbs) === null ? null : (v.AP / cogsAbs) * 365;
}

/** NOPAT — prefer the canonical reported/computed line; else derive from EBIT × (1 − effective tax rate). */
function nopatOf(v: LineValueMap): number | null {
  if (hasAll(v, ['NOPAT'])) return v.NOPAT;
  if (!hasAll(v, ['EBIT', 'EBT', 'TAX_EXPENSE'])) return null;
  if (v.EBT === 0) return null;
  const effectiveTaxRate = Math.abs(v.TAX_EXPENSE) / Math.abs(v.EBT);
  return v.EBIT * (1 - effectiveTaxRate);
}

/** Invested capital — prefer the canonical line; else derive Equity + Net Debt. */
function investedCapitalOf(v: LineValueMap): number | null {
  if (hasAll(v, ['INVESTED_CAPITAL'])) return v.INVESTED_CAPITAL;
  if (hasAll(v, ['TOTAL_EQUITY', 'NET_DEBT'])) return v.TOTAL_EQUITY + v.NET_DEBT;
  if (hasAll(v, ['TOTAL_EQUITY', 'TOTAL_DEBT', 'CASH'])) {
    return v.TOTAL_EQUITY + (v.TOTAL_DEBT - v.CASH);
  }
  return null;
}

/** Net debt — prefer the canonical line; else derive Total Debt − Cash. */
function netDebtOf(v: LineValueMap): number | null {
  if (hasAll(v, ['NET_DEBT'])) return v.NET_DEBT;
  if (hasAll(v, ['TOTAL_DEBT', 'CASH'])) return v.TOTAL_DEBT - v.CASH;
  return null;
}

function roicOf(v: LineValueMap): number | null {
  const nopat = nopatOf(v);
  const investedCapital = investedCapitalOf(v);
  if (nopat === null || investedCapital === null) return null;
  return safeDiv(nopat, investedCapital);
}

// ---------------------------------------------------------------------------
// 1. Declarative registry — 24 ratios × 5 families
// ---------------------------------------------------------------------------

export const FINANCE_RATIO_FAMILY_CATALOG: RatioFamilyDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // PŁYNNOŚĆ (4)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'CURRENT_RATIO',
    family: 'liquidity',
    label: 'Current Ratio',
    labelPl: 'Wskaźnik bieżącej płynności',
    formula: 'CURRENT_ASSETS / CURRENT_LIABILITIES',
    requiredLineCodes: ['CURRENT_ASSETS', 'CURRENT_LIABILITIES'],
    direction: 'higher_better',
    unit: 'x',
    compute: (v) =>
      hasAll(v, ['CURRENT_ASSETS', 'CURRENT_LIABILITIES'])
        ? safeDiv(v.CURRENT_ASSETS, v.CURRENT_LIABILITIES)
        : null,
  },
  {
    code: 'QUICK_RATIO',
    family: 'liquidity',
    label: 'Quick Ratio',
    labelPl: 'Wskaźnik szybkiej płynności',
    formula: '(CURRENT_ASSETS − INVENTORY) / CURRENT_LIABILITIES',
    requiredLineCodes: ['CURRENT_ASSETS', 'INVENTORY', 'CURRENT_LIABILITIES'],
    direction: 'higher_better',
    unit: 'x',
    compute: (v) =>
      hasAll(v, ['CURRENT_ASSETS', 'INVENTORY', 'CURRENT_LIABILITIES'])
        ? safeDiv(v.CURRENT_ASSETS - v.INVENTORY, v.CURRENT_LIABILITIES)
        : null,
  },
  {
    code: 'CASH_RATIO',
    family: 'liquidity',
    label: 'Cash Ratio',
    labelPl: 'Wskaźnik gotówkowej płynności',
    formula: 'CASH / CURRENT_LIABILITIES',
    requiredLineCodes: ['CASH', 'CURRENT_LIABILITIES'],
    direction: 'higher_better',
    unit: 'x',
    compute: (v) =>
      hasAll(v, ['CASH', 'CURRENT_LIABILITIES']) ? safeDiv(v.CASH, v.CURRENT_LIABILITIES) : null,
  },
  {
    code: 'CCC',
    family: 'liquidity',
    label: 'Cash Conversion Cycle',
    labelPl: 'Cykl konwersji gotówki (CCC)',
    formula: 'DSO + DIO − DPO',
    requiredLineCodes: ['AR', 'REVENUE', 'INVENTORY', 'COGS', 'AP'],
    direction: 'lower_better',
    unit: 'days',
    compute: (v) => {
      const dso = dsoOf(v);
      const dio = dioOf(v);
      const dpo = dpoOf(v);
      if (dso === null || dio === null || dpo === null) return null;
      return dso + dio - dpo;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RENTOWNOŚĆ (6)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'GROSS_MARGIN',
    family: 'profitability',
    label: 'Gross Margin',
    labelPl: 'Marża brutto',
    formula: 'GROSS_PROFIT / REVENUE × 100',
    requiredLineCodes: ['GROSS_PROFIT', 'REVENUE'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['GROSS_PROFIT', 'REVENUE'])
        ? mulOrNull(safeDiv(v.GROSS_PROFIT, v.REVENUE), 100)
        : null,
  },
  {
    code: 'EBITDA_MARGIN',
    family: 'profitability',
    label: 'EBITDA Margin',
    labelPl: 'Marża EBITDA',
    formula: 'EBITDA / REVENUE × 100',
    requiredLineCodes: ['EBITDA', 'REVENUE'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['EBITDA', 'REVENUE']) ? mulOrNull(safeDiv(v.EBITDA, v.REVENUE), 100) : null,
  },
  {
    code: 'OPERATING_MARGIN',
    family: 'profitability',
    label: 'Operating Margin',
    labelPl: 'Marża operacyjna',
    formula: 'EBIT / REVENUE × 100',
    requiredLineCodes: ['EBIT', 'REVENUE'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['EBIT', 'REVENUE']) ? mulOrNull(safeDiv(v.EBIT, v.REVENUE), 100) : null,
  },
  {
    code: 'NET_MARGIN',
    family: 'profitability',
    label: 'Net Margin',
    labelPl: 'Marża netto',
    formula: 'NET_INCOME / REVENUE × 100',
    requiredLineCodes: ['NET_INCOME', 'REVENUE'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['NET_INCOME', 'REVENUE']) ? mulOrNull(safeDiv(v.NET_INCOME, v.REVENUE), 100) : null,
  },
  {
    code: 'ROA',
    family: 'profitability',
    label: 'Return on Assets',
    labelPl: 'Zwrot z aktywów (ROA)',
    formula: 'NET_INCOME / TOTAL_ASSETS × 100',
    requiredLineCodes: ['NET_INCOME', 'TOTAL_ASSETS'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['NET_INCOME', 'TOTAL_ASSETS'])
        ? mulOrNull(safeDiv(v.NET_INCOME, v.TOTAL_ASSETS), 100)
        : null,
  },
  {
    code: 'ROE',
    family: 'profitability',
    label: 'Return on Equity',
    labelPl: 'Zwrot z kapitału własnego (ROE)',
    formula: 'NET_INCOME / TOTAL_EQUITY × 100 (patrz też computeDupontFromLines dla dekompozycji 3-stopniowej)',
    requiredLineCodes: ['NET_INCOME', 'TOTAL_EQUITY'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['NET_INCOME', 'TOTAL_EQUITY'])
        ? mulOrNull(safeDiv(v.NET_INCOME, v.TOTAL_EQUITY), 100)
        : null,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ZADŁUŻENIE (5)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'DEBT_TO_EQUITY',
    family: 'leverage',
    label: 'Debt / Equity',
    labelPl: 'Dług / Kapitał własny (D/E)',
    formula: 'TOTAL_DEBT / TOTAL_EQUITY',
    requiredLineCodes: ['TOTAL_DEBT', 'TOTAL_EQUITY'],
    direction: 'lower_better',
    unit: 'x',
    compute: (v) =>
      hasAll(v, ['TOTAL_DEBT', 'TOTAL_EQUITY']) ? safeDiv(v.TOTAL_DEBT, v.TOTAL_EQUITY) : null,
  },
  {
    code: 'NET_DEBT_TO_EBITDA',
    family: 'leverage',
    label: 'Net Debt / EBITDA',
    labelPl: 'Dług netto / EBITDA',
    formula: 'NET_DEBT / EBITDA',
    requiredLineCodes: ['NET_DEBT', 'EBITDA'],
    direction: 'lower_better',
    unit: 'x',
    compute: (v) => {
      const netDebt = netDebtOf(v);
      if (netDebt === null || !hasAll(v, ['EBITDA'])) return null;
      return safeDiv(netDebt, v.EBITDA);
    },
  },
  {
    code: 'INTEREST_COVERAGE',
    family: 'leverage',
    label: 'Interest Coverage',
    labelPl: 'Wskaźnik pokrycia odsetek',
    formula: 'EBIT / |INTEREST_EXPENSE|',
    requiredLineCodes: ['EBIT', 'INTEREST_EXPENSE'],
    direction: 'higher_better',
    unit: 'x',
    compute: (v) =>
      hasAll(v, ['EBIT', 'INTEREST_EXPENSE'])
        ? safeDiv(v.EBIT, Math.abs(v.INTEREST_EXPENSE))
        : null,
  },
  {
    code: 'NET_DEBT',
    family: 'leverage',
    label: 'Net Debt',
    labelPl: 'Dług netto',
    formula: 'NET_DEBT (kanoniczna) lub TOTAL_DEBT − CASH',
    requiredLineCodes: ['NET_DEBT'],
    direction: 'lower_better',
    unit: 'currency',
    compute: (v) => netDebtOf(v),
  },
  {
    code: 'EQUITY_RATIO',
    family: 'leverage',
    label: 'Equity Ratio',
    labelPl: 'Wskaźnik autonomii finansowej',
    formula: 'TOTAL_EQUITY / TOTAL_ASSETS × 100',
    requiredLineCodes: ['TOTAL_EQUITY', 'TOTAL_ASSETS'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['TOTAL_EQUITY', 'TOTAL_ASSETS'])
        ? mulOrNull(safeDiv(v.TOTAL_EQUITY, v.TOTAL_ASSETS), 100)
        : null,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // EFEKTYWNOŚĆ (5)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'ASSET_TURNOVER',
    family: 'efficiency',
    label: 'Asset Turnover',
    labelPl: 'Obrotowość aktywów',
    formula: 'REVENUE / TOTAL_ASSETS',
    requiredLineCodes: ['REVENUE', 'TOTAL_ASSETS'],
    direction: 'higher_better',
    unit: 'x',
    compute: (v) =>
      hasAll(v, ['REVENUE', 'TOTAL_ASSETS']) ? safeDiv(v.REVENUE, v.TOTAL_ASSETS) : null,
  },
  {
    code: 'DSO',
    family: 'efficiency',
    label: 'Days Sales Outstanding',
    labelPl: 'Dni rotacji należności (DSO)',
    formula: 'AR / REVENUE × 365',
    requiredLineCodes: ['AR', 'REVENUE'],
    direction: 'lower_better',
    unit: 'days',
    compute: (v) => dsoOf(v),
  },
  {
    code: 'DIO',
    family: 'efficiency',
    label: 'Days Inventory Outstanding',
    labelPl: 'Dni rotacji zapasów (DIO)',
    formula: 'INVENTORY / |COGS| × 365',
    requiredLineCodes: ['INVENTORY', 'COGS'],
    direction: 'lower_better',
    unit: 'days',
    compute: (v) => dioOf(v),
  },
  {
    code: 'DPO',
    family: 'efficiency',
    label: 'Days Payable Outstanding',
    labelPl: 'Dni rotacji zobowiązań (DPO)',
    formula: 'AP / |COGS| × 365',
    requiredLineCodes: ['AP', 'COGS'],
    direction: 'lower_better',
    unit: 'days',
    compute: (v) => dpoOf(v),
  },
  {
    code: 'WC_TURNOVER',
    family: 'efficiency',
    label: 'Working Capital Turnover',
    labelPl: 'Obrotowość kapitału obrotowego',
    formula: 'REVENUE / (CURRENT_ASSETS − CURRENT_LIABILITIES)',
    requiredLineCodes: ['REVENUE', 'CURRENT_ASSETS', 'CURRENT_LIABILITIES'],
    direction: 'higher_better',
    unit: 'x',
    compute: (v) => {
      if (!hasAll(v, ['REVENUE', 'CURRENT_ASSETS', 'CURRENT_LIABILITIES'])) return null;
      const wc = v.CURRENT_ASSETS - v.CURRENT_LIABILITIES;
      return wc > 0 ? safeDiv(v.REVENUE, wc) : null;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WARTOŚĆ / INWESTORSKIE (4)
  // ═══════════════════════════════════════════════════════════════════════
  {
    code: 'ROIC',
    family: 'value',
    label: 'Return on Invested Capital',
    labelPl: 'Zwrot z kapitału zainwestowanego (ROIC)',
    formula: 'NOPAT / INVESTED_CAPITAL × 100 (NOPAT/INVESTED_CAPITAL kanoniczne lub wyprowadzone)',
    requiredLineCodes: ['NOPAT', 'INVESTED_CAPITAL'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) => mulOrNull(roicOf(v), 100),
  },
  {
    code: 'FCF_CONVERSION',
    family: 'value',
    label: 'FCF Conversion',
    labelPl: 'Konwersja FCF (FCF / EBITDA)',
    formula: 'FREE_CASH_FLOW / EBITDA × 100',
    requiredLineCodes: ['FREE_CASH_FLOW', 'EBITDA'],
    direction: 'higher_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['FREE_CASH_FLOW', 'EBITDA'])
        ? mulOrNull(safeDiv(v.FREE_CASH_FLOW, v.EBITDA), 100)
        : null,
  },
  {
    code: 'CAPEX_TO_REVENUE',
    family: 'value',
    label: 'Capex / Revenue',
    labelPl: 'Nakłady inwestycyjne / Przychody',
    formula: '|CAPEX| / REVENUE × 100',
    requiredLineCodes: ['CAPEX', 'REVENUE'],
    direction: 'lower_better',
    unit: '%',
    compute: (v) =>
      hasAll(v, ['CAPEX', 'REVENUE'])
        ? mulOrNull(safeDiv(Math.abs(v.CAPEX), v.REVENUE), 100)
        : null,
  },
  {
    code: 'ROIC_WACC_SPREAD',
    family: 'value',
    label: 'ROIC − WACC Spread',
    labelPl: 'Spread ROIC − WACC (kreacja wartości)',
    formula: 'ROIC(%) − WACC(%) [WACC = wejście z silnika wyceny, §5 — SKIPPED BY DESIGN bez podania]',
    requiredLineCodes: ['NOPAT', 'INVESTED_CAPITAL'],
    direction: 'higher_better',
    unit: 'pp',
    compute: (v, opts) => {
      if (opts.waccPct === undefined || !Number.isFinite(opts.waccPct)) return null;
      const roicPct = mulOrNull(roicOf(v), 100);
      if (roicPct === null) return null;
      return roicPct - opts.waccPct;
    },
  },
];

function mulOrNull(value: number | null, factor: number): number | null {
  return value === null ? null : value * factor;
}

// ---------------------------------------------------------------------------
// 2. Engine — compute the whole catalog against a line-code value map
// ---------------------------------------------------------------------------

/**
 * Compute every ratio in FINANCE_RATIO_FAMILY_CATALOG against a canonical
 * line-code value map (e.g. loaded the same way as reconcile: `SELECT
 * fsl.line_code, fsv.value FROM financial_statement_values fsv JOIN
 * financial_statement_lines fsl ...` folded into a Record<string, number>).
 *
 * Pure / deterministic / DB-free: same input → same output, no side effects.
 * A ratio whose required inputs are not present in `values` is `skipped`
 * with `value: null` — never 0, never guessed.
 */
export function computeFinanceRatioFamilyCatalog(
  values: LineValueMap,
  opts: RatioFamilyEngineOptions = {}
): ComputedFamilyRatio[] {
  return FINANCE_RATIO_FAMILY_CATALOG.map((def) => {
    const missingLineCodes = missingOf(values, def.requiredLineCodes);
    const raw = def.compute(values, opts);
    const value = raw === null ? null : round(raw);
    return {
      code: def.code,
      family: def.family,
      label: def.label,
      labelPl: def.labelPl,
      value,
      status: value === null ? 'skipped' : 'computed',
      direction: def.direction,
      unit: def.unit,
      formula: def.formula,
      missingLineCodes,
      requiredLineCodes: def.requiredLineCodes,
    };
  });
}

/** Group an already-computed list by family, preserving catalog order within each family. */
export function groupByFamily(
  ratios: ComputedFamilyRatio[]
): Record<RatioFamily, ComputedFamilyRatio[]> {
  const grouped: Record<RatioFamily, ComputedFamilyRatio[]> = {
    liquidity: [],
    profitability: [],
    leverage: [],
    efficiency: [],
    value: [],
  };
  for (const r of ratios) {
    grouped[r.family].push(r);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// 3. DuPont 3-step decomposition of ROE (strict, line-code map input)
// ---------------------------------------------------------------------------

/**
 * ROE = Net Margin × Asset Turnover × Equity Multiplier
 *     = (NET_INCOME / REVENUE) × (REVENUE / TOTAL_ASSETS) × (TOTAL_ASSETS / TOTAL_EQUITY)
 *
 * The identity holds exactly (REVENUE and TOTAL_ASSETS cancel algebraically)
 * whenever every required line is present; when any is missing the whole
 * decomposition is `skipped` rather than partially computed with a 0-filled
 * gap (that would silently misstate the missing factor as "no effect").
 */
export function computeDupontFromLines(values: LineValueMap): DupontFromLines {
  const required = ['NET_INCOME', 'REVENUE', 'TOTAL_ASSETS', 'TOTAL_EQUITY'];
  const missingLineCodes = missingOf(values, required);

  if (missingLineCodes.length > 0) {
    return {
      roe: null,
      netMarginPct: null,
      assetTurnover: null,
      equityMultiplier: null,
      status: 'skipped',
      missingLineCodes,
    };
  }

  const netMargin = safeDiv(values.NET_INCOME, values.REVENUE);
  const assetTurnover = safeDiv(values.REVENUE, values.TOTAL_ASSETS);
  const equityMultiplier = safeDiv(values.TOTAL_ASSETS, values.TOTAL_EQUITY);

  if (netMargin === null || assetTurnover === null || equityMultiplier === null) {
    return {
      roe: null,
      netMarginPct: null,
      assetTurnover: null,
      equityMultiplier: null,
      status: 'skipped',
      missingLineCodes: [],
    };
  }

  const roe = netMargin * assetTurnover * equityMultiplier;

  return {
    roe: round(roe * 100),
    netMarginPct: round(netMargin * 100),
    assetTurnover: round(assetTurnover),
    equityMultiplier: round(equityMultiplier),
    status: 'computed',
    missingLineCodes: [],
  };
}
