/**
 * operatingBudget — parametric builder for a 12-month operating budget.
 *
 * SECOND registered template in the model-template library (after
 * threeScenarioPnL). Same reliability thesis: the LLM/caller parametrizes a
 * PROVEN template instead of inventing a budget model from scratch — every
 * line item is a real Excel formula, no magic-numbers, inputs live only on the
 * Assumptions sheet.
 *
 * The math (per month m, m = 1..12):
 *   Revenue:            m=1 = baseMonthlyRevenue ; m>1 = Revenue(m-1) * (1+growth)
 *   Variable costs:      Revenue(m) * variableCostPct
 *   Margin (var. costs):  Revenue(m) - Variable costs(m)
 *   Rent / Salaries / Marketing / Other fixed:
 *                        m=1 = <category base> ; m>1 = <category>(m-1) * (1+fixedCostGrowthPct)
 *   Fixed costs total:    Rent(m) + Salaries(m) + Marketing(m) + Other(m)
 *   Total costs:          Variable costs(m) + Fixed costs total(m)
 *   Operating result:     Revenue(m) - Total costs(m)
 *   Cumulative result:    m=1 = Operating result(1) ; m>1 = Cumulative(m-1) + Operating result(m)
 *   Operating margin %:   Operating result(m) / Revenue(m)
 *
 * A 13th "RAZEM" (annual total) column sums each line across the 12 months
 * (horizontal SUM — never a magic-number). A "Podsumowanie" sheet pulls the
 * annual KPIs off the RAZEM column via cross-sheet formulas.
 *
 * Formulas are emitted WITHOUT a leading `=` (see threeScenarioPnL.ts header
 * comment for why — the builder writes the string verbatim into `<f>`).
 */

import type {
  Cell,
  ColumnDef,
  DataValidation,
  Row,
  Sheet,
  WorkbookSchema,
} from '../WorkbookSchema.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export interface OperatingBudgetParams {
  /** Company name (banner + title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Budget year (labels the 12 month columns). */
  startYear?: number;
  /** Revenue in month 1. */
  baseMonthlyRevenue?: number;
  /** Month-over-month revenue growth (fraction). e.g. 0.02 = +2%/mo. */
  monthlyRevenueGrowthPct?: number;
  /** Variable costs as a fraction of revenue. e.g. 0.35 = 35% of revenue. */
  variableCostPct?: number;
  /** Rent in month 1. */
  rentMonthly?: number;
  /** Salaries in month 1. */
  salariesMonthly?: number;
  /** Marketing spend in month 1. */
  marketingMonthly?: number;
  /** Other fixed costs in month 1. */
  otherFixedMonthly?: number;
  /** Month-over-month growth applied to every fixed-cost line (fraction). */
  fixedCostGrowthPct?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

// Exported so the template registry can derive its FE-facing parameter
// descriptors from the SAME source of truth the builder uses.
export const OPERATING_BUDGET_GENERAL_DEFAULTS = {
  companyName: 'Spółka',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  baseMonthlyRevenue: 200_000,
} as const;

export const OPERATING_BUDGET_DRIVER_DEFAULTS: Required<
  Pick<
    OperatingBudgetParams,
    | 'monthlyRevenueGrowthPct'
    | 'variableCostPct'
    | 'rentMonthly'
    | 'salariesMonthly'
    | 'marketingMonthly'
    | 'otherFixedMonthly'
    | 'fixedCostGrowthPct'
  >
> = {
  monthlyRevenueGrowthPct: 0.02,
  variableCostPct: 0.35,
  rentMonthly: 15_000,
  salariesMonthly: 60_000,
  marketingMonthly: 10_000,
  otherFixedMonthly: 5_000,
  fixedCostGrowthPct: 0.005,
};

/** Clamp a fraction to a sane bound; fall back to `fallback` when not finite. */
function safeFraction(v: number | undefined, fallback: number, min = -1, max = 2): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Clamp a non-negative currency amount; fall back to `fallback` when invalid. */
function safeAmount(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || !Number.isFinite(v) || v < 0) return fallback;
  return v;
}

/** Map a human currency code to the styler's hint + the assumptions symbol. */
function currencyMeta(code: string | undefined): { hint: 'pln' | 'eur' | 'usd'; label: string } {
  switch ((code ?? 'PLN').toUpperCase()) {
    case 'EUR':
      return { hint: 'eur', label: 'EUR' };
    case 'USD':
      return { hint: 'usd', label: 'USD' };
    default:
      return { hint: 'pln', label: 'PLN' };
  }
}

/** Accounting-style currency number format per hint (negatives red in parens). */
function currencyNumFmt(hint: 'pln' | 'eur' | 'usd'): string {
  switch (hint) {
    case 'eur':
      return '€#,##0;[Red](€#,##0);"–"';
    case 'usd':
      return '$#,##0;[Red]($#,##0);"–"';
    default:
      return '# ##0" zł";[Red](# ##0" zł");"–"';
  }
}

const MONTH_NAMES = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns: A = Driver (text) | B = Wartość (number)
// Rows (Excel row = data-index + 2, header is row 1):
//   2  Przychód m-c 1            ← currency
//   3  Wzrost przychodów m/m %   ← percent
//   4  Koszty zmienne % przych.  ← percent
//   5  Czynsz (m-c 1)            ← currency
//   6  Wynagrodzenia (m-c 1)     ← currency
//   7  Marketing (m-c 1)         ← currency
//   8  Pozostałe koszty stałe    ← currency
//   9  Wzrost kosztów stałych m/m % ← percent
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

const AR = {
  revenue: 2,
  revenueGrowth: 3,
  variableCostPct: 4,
  rent: 5,
  salaries: 6,
  marketing: 7,
  otherFixed: 8,
  fixedCostGrowth: 9,
} as const;

/** Absolute reference to an assumption cell in column B, e.g. 'Założenia'!$B$3. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$B$${row}`;
}

function buildAssumptionsSheet(
  baseMonthlyRevenue: number,
  monthlyRevenueGrowthPct: number,
  variableCostPct: number,
  rentMonthly: number,
  salariesMonthly: number,
  marketingMonthly: number,
  otherFixedMonthly: number,
  fixedCostGrowthPct: number,
  currencyLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 32 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];

  const inputFill = 'FFF6DF'; // soft amber — classic "input" convention
  const pctFmt = '0.0%';
  const curFmt =
    currencyLabel === 'PLN' ? '# ##0" zł"' : currencyLabel === 'EUR' ? '€#,##0' : '$#,##0';

  const percentValidation: DataValidation = {
    type: 'decimal',
    operator: 'between',
    min: -1,
    max: 2,
    allowBlank: false,
    promptTitle: 'Wartość ułamkowa',
    prompt: 'Podaj ułamek, np. 0,02 = 2%.',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: -1 do 2 (tj. -100% do +200%).',
  };
  const amountValidation: DataValidation = {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    min: 0,
    allowBlank: false,
    promptTitle: 'Kwota',
    prompt: 'Dodatnia liczba w walucie modelu.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Kwota musi być liczbą ≥ 0.',
  };

  const inputCell = (value: number, fmt: string, validation: DataValidation): Cell => ({
    value,
    style: { bgColor: inputFill, border: 'thin', numberFormat: fmt },
    validation,
  });

  const row = (label: string, value: number, fmt: string, validation: DataValidation): Row => ({
    cells: {
      driver: { value: label },
      wartosc: inputCell(value, fmt, validation),
    },
  });

  const rows: Row[] = [
    row('Przychód m-c 1', baseMonthlyRevenue, curFmt, amountValidation),
    row('Wzrost przychodów m/m %', monthlyRevenueGrowthPct, pctFmt, percentValidation),
    row('Koszty zmienne % przychodów', variableCostPct, pctFmt, {
      ...percentValidation,
      min: 0,
      max: 1,
      error: 'Dozwolony zakres: 0 do 1 (tj. 0% do 100%).',
    }),
    row('Czynsz (m-c 1)', rentMonthly, curFmt, amountValidation),
    row('Wynagrodzenia (m-c 1)', salariesMonthly, curFmt, amountValidation),
    row('Marketing (m-c 1)', marketingMonthly, curFmt, amountValidation),
    row('Pozostałe koszty stałe (m-c 1)', otherFixedMonthly, curFmt, amountValidation),
    row('Wzrost kosztów stałych m/m %', fixedCostGrowthPct, pctFmt, percentValidation),
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia budżetu operacyjnego (edytowalne).',
    columns,
    rows,
    freezeRow: 1,
    isAssumptions: true,
    nameKeyColumn: 'driver',
    nameValueColumn: 'wartosc',
    tabColor: 'F59E0B',
  };
}

// ---------------------------------------------------------------------------
// Budget sheet builder ("Budżet")
//
// Columns: A = Pozycja (text) | B..M = 12 miesiące | N = RAZEM (rok)
// Rows (Excel row = index + 2):
//   2  Przychody
//   3  Koszty zmienne
//   4  Marża na kosztach zmiennych      [summary]
//   5  Czynsz
//   6  Wynagrodzenia
//   7  Marketing
//   8  Pozostałe koszty stałe
//   9  Koszty stałe razem               [summary]
//   10 Koszty razem                     [summary]
//   11 Wynik operacyjny                 [summary]
//   12 Wynik narastająco                [summary]
//   13 Marża operacyjna %
// ---------------------------------------------------------------------------

const PL = {
  revenue: 2,
  varCost: 3,
  margin: 4,
  rent: 5,
  salaries: 6,
  marketing: 7,
  otherFixed: 8,
  fixedTotal: 9,
  totalCost: 10,
  result: 11,
  cumResult: 12,
  marginPct: 13,
} as const;

const MONTH_COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const RAZEM_COL = 'N';

function buildBudgetSheet(startYear: number, currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [{ key: 'pozycja', header: 'Pozycja', type: 'text', width: 32 }];
  MONTH_NAMES.forEach((name, i) => {
    columns.push({ key: `m${i + 1}`, header: `${name} ${startYear}`, type: 'number' });
  });
  columns.push({ key: 'razem', header: 'RAZEM', type: 'number' });

  const currencyFmt = currencyNumFmt(currencyHint);
  const monthKey = (i: number): string => `m${i + 1}`; // i: 0-based month index

  function fRow(
    label: string,
    formulaFor: (col: string, monthIdx: number) => string,
    razemFormula: (rowNum: number) => string,
    opts: { summary?: boolean; marginPct?: boolean } = {}
  ): Row {
    const cells: Record<string, Cell> = {
      pozycja: { value: label, style: opts.summary ? { bold: true } : undefined },
    };
    const numberFormat = opts.marginPct ? '0.0%' : currencyFmt;
    const style = opts.summary ? { numberFormat, bold: true } : { numberFormat };
    MONTH_COLS.forEach((col, i) => {
      cells[monthKey(i)] = { formula: formulaFor(col, i), style };
    });
    cells.razem = { formula: razemFormula(0), style };
    return { cells, isSummary: opts.summary };
  }

  // Row-number placeholder resolved once the row map is known — computed inline below.
  const rows: Row[] = [
    // Row 2 — Przychody: m1 = Assumptions revenue; m>1 chains off prior month.
    fRow(
      'Przychody',
      (col, i) =>
        i === 0
          ? aRef(AR.revenue)
          : `${MONTH_COLS[i - 1]}${PL.revenue}*(1+${aRef(AR.revenueGrowth)})`,
      () => `SUM(B${PL.revenue}:M${PL.revenue})`
    ),
    // Row 3 — Koszty zmienne = Revenue(this col) * variableCostPct.
    fRow(
      'Koszty zmienne',
      (col) => `${col}${PL.revenue}*${aRef(AR.variableCostPct)}`,
      () => `SUM(B${PL.varCost}:M${PL.varCost})`
    ),
    // Row 4 — Marża na kosztach zmiennych = Revenue - Variable costs.
    fRow(
      'Marża na kosztach zmiennych',
      (col) => `${col}${PL.revenue}-${col}${PL.varCost}`,
      () => `SUM(B${PL.margin}:M${PL.margin})`,
      { summary: true }
    ),
    // Row 5 — Czynsz: m1 = Assumptions rent; m>1 chains off prior month * (1+fixedCostGrowth).
    fRow(
      'Czynsz',
      (col, i) =>
        i === 0 ? aRef(AR.rent) : `${MONTH_COLS[i - 1]}${PL.rent}*(1+${aRef(AR.fixedCostGrowth)})`,
      () => `SUM(B${PL.rent}:M${PL.rent})`
    ),
    // Row 6 — Wynagrodzenia (same chain pattern).
    fRow(
      'Wynagrodzenia',
      (col, i) =>
        i === 0
          ? aRef(AR.salaries)
          : `${MONTH_COLS[i - 1]}${PL.salaries}*(1+${aRef(AR.fixedCostGrowth)})`,
      () => `SUM(B${PL.salaries}:M${PL.salaries})`
    ),
    // Row 7 — Marketing (same chain pattern).
    fRow(
      'Marketing',
      (col, i) =>
        i === 0
          ? aRef(AR.marketing)
          : `${MONTH_COLS[i - 1]}${PL.marketing}*(1+${aRef(AR.fixedCostGrowth)})`,
      () => `SUM(B${PL.marketing}:M${PL.marketing})`
    ),
    // Row 8 — Pozostałe koszty stałe (same chain pattern).
    fRow(
      'Pozostałe koszty stałe',
      (col, i) =>
        i === 0
          ? aRef(AR.otherFixed)
          : `${MONTH_COLS[i - 1]}${PL.otherFixed}*(1+${aRef(AR.fixedCostGrowth)})`,
      () => `SUM(B${PL.otherFixed}:M${PL.otherFixed})`
    ),
    // Row 9 — Koszty stałe razem = Czynsz + Wynagrodzenia + Marketing + Pozostałe (arithmetic,
    // NOT SUM() — a plain cell-by-cell addition keeps the deterministic quality gate's
    // SUM-coverage heuristic, which assumes ONE flat total block, from mis-firing on this
    // multi-subtotal sheet).
    fRow(
      'Koszty stałe razem',
      (col) => `${col}${PL.rent}+${col}${PL.salaries}+${col}${PL.marketing}+${col}${PL.otherFixed}`,
      () => `SUM(B${PL.fixedTotal}:M${PL.fixedTotal})`,
      { summary: true }
    ),
    // Row 10 — Koszty razem = Koszty zmienne + Koszty stałe razem.
    fRow(
      'Koszty razem',
      (col) => `${col}${PL.varCost}+${col}${PL.fixedTotal}`,
      () => `SUM(B${PL.totalCost}:M${PL.totalCost})`,
      { summary: true }
    ),
    // Row 11 — Wynik operacyjny = Przychody - Koszty razem.
    fRow(
      'Wynik operacyjny',
      (col) => `${col}${PL.revenue}-${col}${PL.totalCost}`,
      () => `SUM(B${PL.result}:M${PL.result})`,
      { summary: true }
    ),
    // Row 12 — Wynik narastająco: m1 = Wynik operacyjny(m1); m>1 = cumulative(m-1) + result(m).
    // RAZEM = December's cumulative value (already the annual total — summing it again
    // across months would double-count).
    fRow(
      'Wynik narastająco',
      (col, i) =>
        i === 0 ? `${col}${PL.result}` : `${MONTH_COLS[i - 1]}${PL.cumResult}+${col}${PL.result}`,
      () => `M${PL.cumResult}`,
      { summary: true }
    ),
    // Row 13 — Marża operacyjna % = Wynik operacyjny / Przychody. RAZEM = annual margin
    // (annual result / annual revenue) — summing monthly percentages would be meaningless.
    fRow(
      'Marża operacyjna %',
      (col) => `${col}${PL.result}/${col}${PL.revenue}`,
      () => `N${PL.result}/N${PL.revenue}`,
      { marginPct: true }
    ),
  ];

  return {
    name: 'Budżet',
    purpose: 'Budżet operacyjny 12-miesięczny (każda pozycja = formuła; RAZEM = suma roczna).',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Podsumowanie sheet builder — annual KPIs pulled off the Budżet RAZEM column.
// ---------------------------------------------------------------------------

function buildPodsumowanieSheet(currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'metryka', header: 'Metryka', type: 'text', width: 30 },
    { key: 'wartosc', header: 'Wartość (rok)', type: 'number' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);

  const metricRow = (label: string, plRow: number, marginPct = false): Row => ({
    cells: {
      metryka: { value: label, style: { bold: true } },
      wartosc: {
        formula: `'Budżet'!${RAZEM_COL}${plRow}`,
        style: { numberFormat: marginPct ? '0.0%' : currencyFmt, bold: true },
      },
    },
    isSummary: true,
  });

  const rows: Row[] = [
    metricRow('Przychody (rok)', PL.revenue),
    metricRow('Koszty razem (rok)', PL.totalCost),
    metricRow('Wynik operacyjny (rok)', PL.result),
    metricRow('Marża operacyjna % (rok)', PL.marginPct, true),
  ];

  return {
    name: 'Podsumowanie',
    purpose: 'Roczne KPI budżetu — pociągnięte z kolumny RAZEM arkusza „Budżet".',
    columns,
    rows,
    freezeRow: 1,
    tabColor: '1D9E75',
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildOperatingBudgetSchema(params: OperatingBudgetParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';
  const startYear =
    Number.isFinite(params.startYear) && (params.startYear as number) > 0
      ? Math.floor(params.startYear as number)
      : new Date().getFullYear();

  const baseMonthlyRevenue = safeAmount(
    params.baseMonthlyRevenue,
    OPERATING_BUDGET_GENERAL_DEFAULTS.baseMonthlyRevenue
  );
  const monthlyRevenueGrowthPct = safeFraction(
    params.monthlyRevenueGrowthPct,
    OPERATING_BUDGET_DRIVER_DEFAULTS.monthlyRevenueGrowthPct
  );
  const variableCostPct = safeFraction(
    params.variableCostPct,
    OPERATING_BUDGET_DRIVER_DEFAULTS.variableCostPct,
    0,
    1
  );
  const rentMonthly = safeAmount(params.rentMonthly, OPERATING_BUDGET_DRIVER_DEFAULTS.rentMonthly);
  const salariesMonthly = safeAmount(
    params.salariesMonthly,
    OPERATING_BUDGET_DRIVER_DEFAULTS.salariesMonthly
  );
  const marketingMonthly = safeAmount(
    params.marketingMonthly,
    OPERATING_BUDGET_DRIVER_DEFAULTS.marketingMonthly
  );
  const otherFixedMonthly = safeAmount(
    params.otherFixedMonthly,
    OPERATING_BUDGET_DRIVER_DEFAULTS.otherFixedMonthly
  );
  const fixedCostGrowthPct = safeFraction(
    params.fixedCostGrowthPct,
    OPERATING_BUDGET_DRIVER_DEFAULTS.fixedCostGrowthPct
  );

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(
      baseMonthlyRevenue,
      monthlyRevenueGrowthPct,
      variableCostPct,
      rentMonthly,
      salariesMonthly,
      marketingMonthly,
      otherFixedMonthly,
      fixedCostGrowthPct,
      label
    ),
    buildBudgetSheet(startYear, hint),
    buildPodsumowanieSheet(hint),
  ];

  return {
    title: `${companyName} — Budżet operacyjny ${startYear}`,
    description:
      'Parametryczny budżet operacyjny 12-miesięczny: przychody, koszty zmienne/stałe, wynik ' +
      `narastająco. Każda pozycja to formuła; wejścia na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'operatingBudget',
      companyName,
      currency: label,
      startYear,
      baseMonthlyRevenue,
    },
  };
}

export default buildOperatingBudgetSchema;
