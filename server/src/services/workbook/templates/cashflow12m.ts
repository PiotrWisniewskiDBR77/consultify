/**
 * cashflow12m — parametric builder for a 12-month cash-flow forecast.
 *
 * FIFTH registered template in the model-template library (after
 * threeScenarioPnL, operatingBudget, dcfValuation, breakEven). Same
 * reliability thesis: the LLM/caller parametrizes a PROVEN template — every
 * cash inflow/outflow, the net monthly flow, and the running (cumulative)
 * balance is a real Excel formula, no magic-numbers, inputs live only on the
 * Assumptions sheet.
 *
 * The math (per month m, m = 1..12):
 *   Revenue (booked):     m=1 = baseMonthlyRevenue ; m>1 = Revenue(m-1) * (1+growth)
 *   Wpływy (cash in):      Revenue(m - paymentDelayMonths), or 0 when that month
 *                          is before month 1 (no cash has arrived yet).
 *   Koszty (cash out):     m=1 = monthlyCosts ; m>1 = Koszty(m-1) * (1+costGrowth)
 *   Przepływ netto:        Wpływy(m) - Koszty(m)
 *   Saldo narastające:     m=1 = openingBalance + Przepływ netto(1)
 *                          m>1 = Saldo(m-1) + Przepływ netto(m)
 *
 * `paymentDelayMonths` decides the SHAPE of the "Wpływy" formulas (which prior
 * month's revenue a given month's cash-in references), so it is resolved at
 * build time in JS (clamped 0..3), not carried as a live formula input —
 * everything downstream is still a real formula.
 *
 * A 13th "RAZEM" (annual total) column sums each flow line across the 12
 * months (horizontal SUM — never a magic-number); the running balance's RAZEM
 * is December's balance (already the year-end figure — summing it again would
 * double-count). A "Podsumowanie" sheet pulls the annual KPIs off the RAZEM
 * column via cross-sheet formulas.
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

export interface Cashflow12mParams {
  /** Company name (banner + title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Forecast year (labels the 12 month columns). */
  startYear?: number;
  /** Cash balance at the start of month 1. */
  openingBalance?: number;
  /** Booked revenue in month 1 (drives cash inflow via the payment-delay lag). */
  baseMonthlyRevenue?: number;
  /** Month-over-month revenue growth (fraction). e.g. 0.02 = +2%/mo. */
  monthlyRevenueGrowthPct?: number;
  /** How many months after booking the revenue is actually collected (0..3). */
  paymentDelayMonths?: number;
  /** Cash costs paid out in month 1. */
  monthlyCosts?: number;
  /** Month-over-month growth applied to the cost line (fraction). */
  costGrowthPct?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

// Exported so the template registry can derive its FE-facing parameter
// descriptors from the SAME source of truth the builder uses.
export const CASHFLOW_GENERAL_DEFAULTS = {
  companyName: 'Spółka',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  openingBalance: 100_000,
} as const;

export const CASHFLOW_DRIVER_DEFAULTS: Required<
  Pick<
    Cashflow12mParams,
    | 'baseMonthlyRevenue'
    | 'monthlyRevenueGrowthPct'
    | 'paymentDelayMonths'
    | 'monthlyCosts'
    | 'costGrowthPct'
  >
> = {
  baseMonthlyRevenue: 150_000,
  monthlyRevenueGrowthPct: 0.02,
  paymentDelayMonths: 1,
  monthlyCosts: 120_000,
  costGrowthPct: 0.01,
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

/** Clamp the opening balance — MAY be negative (an overdraft is a valid start). */
function safeBalance(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
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
//   2  Saldo początkowe             ← currency (may be negative)
//   3  Przychód m-c 1               ← currency
//   4  Wzrost przychodów m/m %      ← percent
//   5  Opóźnienie płatności (m-ce)  ← integer 0–3
//   6  Koszty m-c 1                 ← currency
//   7  Wzrost kosztów m/m %         ← percent
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

const AR = {
  openingBalance: 2,
  revenue: 3,
  revenueGrowth: 4,
  paymentDelay: 5,
  costs: 6,
  costGrowth: 7,
} as const;

/** Absolute reference to an assumption cell in column B, e.g. 'Założenia'!$B$3. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$B$${row}`;
}

function buildAssumptionsSheet(
  openingBalance: number,
  baseMonthlyRevenue: number,
  monthlyRevenueGrowthPct: number,
  paymentDelayMonths: number,
  monthlyCosts: number,
  costGrowthPct: number,
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
  const delayValidation: DataValidation = {
    type: 'whole',
    operator: 'between',
    min: 0,
    max: 3,
    allowBlank: false,
    promptTitle: 'Opóźnienie płatności',
    prompt: 'Liczba miesięcy opóźnienia wpływu (0–3).',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: 0–3 miesiące.',
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
    row('Saldo początkowe', openingBalance, curFmt, amountValidation),
    row('Przychód m-c 1', baseMonthlyRevenue, curFmt, amountValidation),
    row('Wzrost przychodów m/m %', monthlyRevenueGrowthPct, pctFmt, percentValidation),
    row('Opóźnienie płatności (miesiące)', paymentDelayMonths, '0', delayValidation),
    row('Koszty m-c 1', monthlyCosts, curFmt, amountValidation),
    row('Wzrost kosztów m/m %', costGrowthPct, pctFmt, percentValidation),
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia prognozy przepływów pieniężnych (edytowalne).',
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
// "Przepływy" sheet builder — 12-month cash-flow forecast.
//
// Columns: A = Pozycja (text) | B..M = 12 miesiące | N = RAZEM (rok)
// Rows (Excel row = index + 2):
//   2  Przychód (memoriałowo)
//   3  Wpływy (kasowo)
//   4  Koszty (wypływy)
//   5  Przepływ netto (m/m)             [summary]
//   6  Saldo narastające                [summary]
// ---------------------------------------------------------------------------

const CF = {
  revenue: 2,
  inflow: 3,
  costs: 4,
  net: 5,
  balance: 6,
} as const;

const MONTH_COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const RAZEM_COL = 'N';

function buildCashflowSheet(
  startYear: number,
  paymentDelayMonths: number,
  currencyHint: 'pln' | 'eur' | 'usd'
): Sheet {
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
    razemFormula: () => string,
    opts: { summary?: boolean } = {}
  ): Row {
    const cells: Record<string, Cell> = {
      pozycja: { value: label, style: opts.summary ? { bold: true } : undefined },
    };
    const style = opts.summary
      ? { numberFormat: currencyFmt, bold: true }
      : { numberFormat: currencyFmt };
    MONTH_COLS.forEach((col, i) => {
      cells[monthKey(i)] = { formula: formulaFor(col, i), style };
    });
    cells.razem = { formula: razemFormula(), style };
    return { cells, isSummary: opts.summary };
  }

  const rows: Row[] = [
    // Row 2 — Przychód (memoriałowo): m1 = Assumptions revenue; m>1 chains off prior month.
    fRow(
      'Przychód (memoriałowo)',
      (col, i) =>
        i === 0
          ? aRef(AR.revenue)
          : `${MONTH_COLS[i - 1]}${CF.revenue}*(1+${aRef(AR.revenueGrowth)})`,
      () => `SUM(B${CF.revenue}:M${CF.revenue})`
    ),
    // Row 3 — Wpływy (kasowo): revenue booked `paymentDelayMonths` earlier; 0 when
    // that source month is before month 1 (no cash has arrived yet). The 0 is
    // still emitted as a FORMULA (not a bare constant) to keep the sheet's
    // "every line item is a formula" contract literal.
    fRow(
      'Wpływy',
      (col, i) => {
        const source = i - paymentDelayMonths;
        return source < 0 ? '0' : `${MONTH_COLS[source]}${CF.revenue}`;
      },
      () => `SUM(B${CF.inflow}:M${CF.inflow})`
    ),
    // Row 4 — Koszty (wypływy): m1 = Assumptions costs; m>1 chains off prior month.
    fRow(
      'Koszty',
      (col, i) =>
        i === 0 ? aRef(AR.costs) : `${MONTH_COLS[i - 1]}${CF.costs}*(1+${aRef(AR.costGrowth)})`,
      () => `SUM(B${CF.costs}:M${CF.costs})`
    ),
    // Row 5 — Przepływ netto = Wpływy - Koszty (arithmetic, not SUM — a plain
    // subtraction keeps the deterministic quality gate's SUM-coverage heuristic,
    // which assumes ONE flat total block, from mis-firing on this multi-line sheet).
    fRow(
      'Przepływ netto (m/m)',
      (col) => `${col}${CF.inflow}-${col}${CF.costs}`,
      () => `SUM(B${CF.net}:M${CF.net})`,
      { summary: true }
    ),
    // Row 6 — Saldo narastające: m1 = openingBalance + net(m1); m>1 = balance(m-1) + net(m).
    // RAZEM = December's balance (already the year-end figure — summing it again
    // would double-count).
    fRow(
      'Saldo narastające',
      (col, i) =>
        i === 0
          ? `${aRef(AR.openingBalance)}+${col}${CF.net}`
          : `${MONTH_COLS[i - 1]}${CF.balance}+${col}${CF.net}`,
      () => `M${CF.balance}`,
      { summary: true }
    ),
  ];

  return {
    name: 'Przepływy',
    purpose:
      'Prognoza przepływów pieniężnych 12-miesięczna (każda pozycja = formuła; RAZEM = suma roczna).',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Podsumowanie sheet builder — annual KPIs pulled off the Przepływy RAZEM column.
// ---------------------------------------------------------------------------

function buildPodsumowanieSheet(currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'metryka', header: 'Metryka', type: 'text', width: 30 },
    { key: 'wartosc', header: 'Wartość (rok)', type: 'number' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);

  const metricRow = (label: string, cfRow: number): Row => ({
    cells: {
      metryka: { value: label, style: { bold: true } },
      wartosc: {
        formula: `'Przepływy'!${RAZEM_COL}${cfRow}`,
        style: { numberFormat: currencyFmt, bold: true },
      },
    },
    isSummary: true,
  });

  const rows: Row[] = [
    metricRow('Wpływy razem (rok)', CF.inflow),
    metricRow('Koszty razem (rok)', CF.costs),
    metricRow('Przepływ netto (rok)', CF.net),
    metricRow('Saldo końcowe (grudzień)', CF.balance),
  ];

  return {
    name: 'Podsumowanie',
    purpose: 'Roczne KPI przepływów — pociągnięte z kolumny RAZEM arkusza „Przepływy".',
    columns,
    rows,
    freezeRow: 1,
    tabColor: '1D9E75',
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildCashflow12mSchema(params: Cashflow12mParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';
  const startYear =
    Number.isFinite(params.startYear) && (params.startYear as number) > 0
      ? Math.floor(params.startYear as number)
      : new Date().getFullYear();

  const openingBalance = safeBalance(
    params.openingBalance,
    CASHFLOW_GENERAL_DEFAULTS.openingBalance
  );
  const baseMonthlyRevenue = safeAmount(
    params.baseMonthlyRevenue,
    CASHFLOW_DRIVER_DEFAULTS.baseMonthlyRevenue
  );
  const monthlyRevenueGrowthPct = safeFraction(
    params.monthlyRevenueGrowthPct,
    CASHFLOW_DRIVER_DEFAULTS.monthlyRevenueGrowthPct
  );
  const paymentDelayMonths = Math.min(
    3,
    Math.max(
      0,
      Number.isFinite(params.paymentDelayMonths)
        ? Math.round(params.paymentDelayMonths as number)
        : CASHFLOW_DRIVER_DEFAULTS.paymentDelayMonths
    )
  );
  const monthlyCosts = safeAmount(params.monthlyCosts, CASHFLOW_DRIVER_DEFAULTS.monthlyCosts);
  const costGrowthPct = safeFraction(params.costGrowthPct, CASHFLOW_DRIVER_DEFAULTS.costGrowthPct);

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(
      openingBalance,
      baseMonthlyRevenue,
      monthlyRevenueGrowthPct,
      paymentDelayMonths,
      monthlyCosts,
      costGrowthPct,
      label
    ),
    buildCashflowSheet(startYear, paymentDelayMonths, hint),
    buildPodsumowanieSheet(hint),
  ];

  return {
    title: `${companyName} — Prognoza przepływów pieniężnych ${startYear}`,
    description:
      'Parametryczna prognoza przepływów pieniężnych 12-miesięczna: wpływy (z opóźnieniem płatności), ' +
      `wypływy, przepływ netto m/m, saldo narastające. Każda pozycja to formuła; wejścia na arkuszu ` +
      `„${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'cashflow12m',
      companyName,
      currency: label,
      startYear,
      openingBalance,
      paymentDelayMonths,
    },
  };
}

export default buildCashflow12mSchema;
