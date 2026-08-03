/**
 * dcfValuation — parametric builder for a simple Discounted Cash Flow valuation.
 *
 * THIRD registered template in the model-template library (after
 * threeScenarioPnL, operatingBudget). Same reliability thesis: the LLM/caller
 * parametrizes a PROVEN template — every projected cash flow, discount factor,
 * present value, terminal value and the Enterprise/Equity Value bridge is a
 * real Excel formula, no magic-numbers, inputs live only on the Assumptions
 * sheet.
 *
 * The math (n = 1..horizonYears, explicit projection period):
 *   FCF projection:      FCF(1) = FCF0 * (1+growth) ; FCF(n) = FCF(n-1) * (1+growth)
 *   Discount factor:      1 / (1+WACC)^n
 *   PV of FCF(n):         FCF(n) * DiscountFactor(n)
 *   Sum of PV(FCF):        Σ PV(FCF(1..horizon))
 *   Terminal value (TV):   FCF(horizon) * (1+terminalGrowth) / (WACC - terminalGrowth)
 *   PV of TV:              TV / (1+WACC)^horizon
 *   Enterprise Value (EV): Sum of PV(FCF) + PV of TV
 *   Equity Value:          EV - Net debt
 *   Value per share:       Equity Value / Shares outstanding
 *
 * `horizonYears` decides the SHAPE of the model (number of year columns) so it
 * is resolved at build time in JS (clamped 3..10), not carried as a live
 * formula input — everything downstream of it (the year columns, the SUM
 * range, the TV exponent) is still a real formula, just sized for the chosen
 * horizon.
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

export interface DcfValuationParams {
  /** Company name (banner + title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Valuation year (Year 0 — the base year FCF was actually earned). */
  valuationYear?: number;
  /** Free cash flow in the base year (Year 0, last actual). */
  fcf0?: number;
  /** Projected FCF growth rate applied through the explicit horizon (fraction). */
  fcfGrowthPct?: number;
  /** Weighted Average Cost of Capital — the discount rate (fraction). */
  waccPct?: number;
  /** Perpetuity (terminal) growth rate used in the Gordon-growth TV (fraction). */
  terminalGrowthPct?: number;
  /** Number of explicit projection years (3..10). */
  horizonYears?: number;
  /** Net debt (debt - cash) — bridges Enterprise Value to Equity Value. */
  netDebt?: number;
  /** Shares outstanding — divides Equity Value into a per-share figure. */
  sharesOutstanding?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

export const DCF_GENERAL_DEFAULTS = {
  companyName: 'Spółka',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  fcf0: 1_000_000,
} as const;

export const DCF_DRIVER_DEFAULTS: Required<
  Pick<
    DcfValuationParams,
    | 'fcfGrowthPct'
    | 'waccPct'
    | 'terminalGrowthPct'
    | 'horizonYears'
    | 'netDebt'
    | 'sharesOutstanding'
  >
> = {
  fcfGrowthPct: 0.08,
  waccPct: 0.1,
  terminalGrowthPct: 0.02,
  horizonYears: 5,
  netDebt: 200_000,
  sharesOutstanding: 1_000_000,
};

/** Clamp a fraction to a sane bound; fall back to `fallback` when not finite. */
function safeFraction(v: number | undefined, fallback: number, min = -1, max = 2): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Clamp an amount (may be negative, e.g. net cash) to a finite number. */
function safeAmount(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return v;
}

/** Clamp a strictly-positive amount (shares outstanding must divide safely). */
function safePositive(v: number | undefined, fallback: number, min = 1): number {
  if (v === undefined || v === null || !Number.isFinite(v) || v < min) return fallback;
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

/** 0-based column index → letter. Sufficient for ≤26 columns (horizon ≤10). */
function colLetter(idx0: number): string {
  return String.fromCharCode(65 + idx0);
}

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns: A = Driver (text) | B = Wartość (number)
// Rows (Excel row = data-index + 2, header is row 1):
//   2  FCF rok bazowy (rok 0)          ← currency
//   3  Wzrost FCF (prognoza) % rocznie ← percent
//   4  WACC (stopa dyskontowa) %       ← percent
//   5  Wzrost terminalny (g) %         ← percent
//   6  Dług netto                      ← currency
//   7  Liczba akcji                    ← number
//   8  Horyzont prognozy (lata)        ← integer (informational; sizes the model)
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

const AR = {
  fcf0: 2,
  fcfGrowth: 3,
  wacc: 4,
  terminalGrowth: 5,
  netDebt: 6,
  shares: 7,
  horizon: 8,
} as const;

/** Absolute reference to an assumption cell in column B, e.g. 'Założenia'!$B$4. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$B$${row}`;
}

function buildAssumptionsSheet(
  fcf0: number,
  fcfGrowthPct: number,
  waccPct: number,
  terminalGrowthPct: number,
  netDebt: number,
  sharesOutstanding: number,
  horizonYears: number,
  currencyLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 34 },
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
    prompt: 'Podaj ułamek, np. 0,08 = 8%.',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: -1 do 2 (tj. -100% do +200%).',
  };
  const amountValidation: DataValidation = {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    min: 0,
    allowBlank: false,
    promptTitle: 'Kwota',
    prompt: 'Liczba w walucie modelu.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Podaj liczbę.',
  };
  const sharesValidation: DataValidation = {
    type: 'decimal',
    operator: 'greaterThan',
    min: 0,
    allowBlank: false,
    promptTitle: 'Liczba akcji',
    prompt: 'Dodatnia liczba akcji.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Liczba akcji musi być > 0.',
  };
  const horizonValidation: DataValidation = {
    type: 'whole',
    operator: 'between',
    min: 3,
    max: 10,
    allowBlank: false,
    promptTitle: 'Horyzont prognozy',
    prompt: 'Liczba lat jawnej prognozy (3–10).',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: 3–10 lat.',
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
    row('FCF rok bazowy (rok 0)', fcf0, curFmt, amountValidation),
    row('Wzrost FCF (prognoza) % rocznie', fcfGrowthPct, pctFmt, percentValidation),
    row('WACC (stopa dyskontowa) %', waccPct, pctFmt, { ...percentValidation, min: 0.001, max: 1 }),
    row('Wzrost terminalny (g) %', terminalGrowthPct, pctFmt, {
      ...percentValidation,
      min: -0.5,
      max: 0.5,
    }),
    row('Dług netto', netDebt, curFmt, amountValidation),
    row('Liczba akcji', sharesOutstanding, '# ##0', sharesValidation),
    row('Horyzont prognozy (lata)', horizonYears, '0', horizonValidation),
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia wyceny DCF (edytowalne).',
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
// Projekcja FCF sheet — one column per explicit projection year.
//
// Columns: A = Pozycja (text) | B..(B+horizon-1) = Rok 1..Rok N
// Rows (Excel row = index + 2):
//   2  Przepływy pieniężne (FCF)
//   3  Współczynnik dyskontowy
//   4  Zdyskontowany FCF (PV)
// ---------------------------------------------------------------------------

const FCF_ROW = { fcf: 2, discountFactor: 3, pv: 4 } as const;
const PROJEKCJA_SHEET = 'Projekcja FCF';

function buildProjectionSheet(
  valuationYear: number,
  horizonYears: number,
  currencyHint: 'pln' | 'eur' | 'usd'
): Sheet {
  const columns: ColumnDef[] = [{ key: 'pozycja', header: 'Pozycja', type: 'text', width: 32 }];
  for (let n = 1; n <= horizonYears; n++) {
    columns.push({ key: `rok${n}`, header: `Rok ${n} (${valuationYear + n})`, type: 'number' });
  }
  const currencyFmt = currencyNumFmt(currencyHint);

  const yearCols = Array.from({ length: horizonYears }, (_, i) => colLetter(i + 1)); // B, C, D, ...

  function fRow(
    label: string,
    formulaFor: (col: string, n: number) => string,
    numberFormat: string
  ): Row {
    const cells: Record<string, Cell> = { pozycja: { value: label } };
    yearCols.forEach((col, i) => {
      const n = i + 1; // 1-based year index
      cells[`rok${n}`] = { formula: formulaFor(col, n), style: { numberFormat } };
    });
    return { cells };
  }

  const rows: Row[] = [
    // Row 2 — FCF: Year1 = FCF0*(1+growth); Yn = Y(n-1)*(1+growth).
    fRow(
      'Przepływy pieniężne (FCF)',
      (col, n) =>
        n === 1
          ? `${aRef(AR.fcf0)}*(1+${aRef(AR.fcfGrowth)})`
          : `${yearCols[n - 2]}${FCF_ROW.fcf}*(1+${aRef(AR.fcfGrowth)})`,
      currencyFmt
    ),
    // Row 3 — Discount factor = 1/(1+WACC)^n.
    fRow('Współczynnik dyskontowy', (col, n) => `1/(1+${aRef(AR.wacc)})^${n}`, '0.000'),
    // Row 4 — PV of FCF = FCF(n) * DiscountFactor(n).
    fRow(
      'Zdyskontowany FCF (PV)',
      (col) => `${col}${FCF_ROW.fcf}*${col}${FCF_ROW.discountFactor}`,
      currencyFmt
    ),
  ];

  return {
    name: PROJEKCJA_SHEET,
    purpose:
      'Projekcja wolnych przepływów pieniężnych (FCF) i ich wartości bieżącej — każda pozycja = formuła.',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Wycena sheet — Enterprise Value → Equity Value → Value per share bridge.
//
// Columns: A = Metryka (text) | B = Wartość (number)
// Rows (Excel row = index + 2):
//   2  Suma zdyskontowanych FCF (lata 1..N)  [summary]
//   3  Wartość rezydualna (Terminal Value)
//   4  Zdyskontowana wartość rezydualna (PV TV)
//   5  Enterprise Value (EV)                 [summary]
//   6  Dług netto
//   7  Equity Value                          [summary]
//   8  Liczba akcji
//   9  Wartość na akcję
// ---------------------------------------------------------------------------

const WR = {
  sumPv: 2,
  tv: 3,
  pvTv: 4,
  ev: 5,
  netDebt: 6,
  equity: 7,
  shares: 8,
  perShare: 9,
} as const;

function buildWycenaSheet(horizonYears: number, currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'metryka', header: 'Metryka', type: 'text', width: 34 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);
  const lastYearCol = colLetter(horizonYears); // year columns start at B (idx1) → last = idx(horizon)

  const metricRow = (
    label: string,
    formula: string,
    opts: { summary?: boolean; numberFormat?: string } = {}
  ): Row => ({
    cells: {
      metryka: { value: label, style: opts.summary ? { bold: true } : undefined },
      wartosc: {
        formula,
        style: { numberFormat: opts.numberFormat ?? currencyFmt, bold: opts.summary },
      },
    },
    isSummary: opts.summary,
  });

  const rows: Row[] = [
    metricRow(
      `Suma zdyskontowanych FCF (lata 1–${horizonYears})`,
      `SUM('${PROJEKCJA_SHEET}'!B${FCF_ROW.pv}:${lastYearCol}${FCF_ROW.pv})`,
      { summary: true }
    ),
    metricRow(
      'Wartość rezydualna (Terminal Value)',
      `'${PROJEKCJA_SHEET}'!${lastYearCol}${FCF_ROW.fcf}*(1+${aRef(AR.terminalGrowth)})/(${aRef(AR.wacc)}-${aRef(AR.terminalGrowth)})`
    ),
    metricRow(
      'Zdyskontowana wartość rezydualna (PV TV)',
      `B${WR.tv}/(1+${aRef(AR.wacc)})^${horizonYears}`
    ),
    metricRow('Enterprise Value (EV)', `B${WR.sumPv}+B${WR.pvTv}`, { summary: true }),
    metricRow('Dług netto', aRef(AR.netDebt)),
    metricRow('Equity Value', `B${WR.ev}-B${WR.netDebt}`, { summary: true }),
    metricRow('Liczba akcji', aRef(AR.shares), { numberFormat: '# ##0' }),
    metricRow('Wartość na akcję', `B${WR.equity}/B${WR.shares}`),
  ];

  return {
    name: 'Wycena',
    purpose: 'Mostek Enterprise Value → Equity Value → Wartość na akcję — każda pozycja = formuła.',
    columns,
    rows,
    freezeRow: 1,
    tabColor: '1D9E75',
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildDcfValuationSchema(params: DcfValuationParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';
  const valuationYear =
    Number.isFinite(params.valuationYear) && (params.valuationYear as number) > 0
      ? Math.floor(params.valuationYear as number)
      : new Date().getFullYear();

  const fcf0 = safeAmount(params.fcf0, DCF_GENERAL_DEFAULTS.fcf0);
  const fcfGrowthPct = safeFraction(params.fcfGrowthPct, DCF_DRIVER_DEFAULTS.fcfGrowthPct);
  const waccPct = safeFraction(params.waccPct, DCF_DRIVER_DEFAULTS.waccPct, 0.001, 1);
  const terminalGrowthPct = safeFraction(
    params.terminalGrowthPct,
    DCF_DRIVER_DEFAULTS.terminalGrowthPct,
    -0.5,
    0.5
  );
  let waccResolved = waccPct;
  // Defensive: a Gordon-growth TV divides by (WACC - g); if the caller passed a
  // WACC ≤ terminal growth, nudge WACC just above it so the default model never
  // ships a #DIV/0!/negative-TV schema. (A user can still edit the assumption
  // cells afterwards — that is a normal spreadsheet risk, not a schema defect.)
  if (waccResolved <= terminalGrowthPct) {
    waccResolved = terminalGrowthPct + 0.01;
  }
  const netDebt = safeAmount(params.netDebt, DCF_DRIVER_DEFAULTS.netDebt);
  const sharesOutstanding = safePositive(
    params.sharesOutstanding,
    DCF_DRIVER_DEFAULTS.sharesOutstanding
  );
  const horizonYears = Math.min(
    10,
    Math.max(
      3,
      Number.isFinite(params.horizonYears)
        ? Math.round(params.horizonYears as number)
        : DCF_DRIVER_DEFAULTS.horizonYears
    )
  );

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(
      fcf0,
      fcfGrowthPct,
      waccResolved,
      terminalGrowthPct,
      netDebt,
      sharesOutstanding,
      horizonYears,
      label
    ),
    buildProjectionSheet(valuationYear, horizonYears, hint),
    buildWycenaSheet(horizonYears, hint),
  ];

  return {
    title: `${companyName} — Wycena DCF`,
    description:
      `Prosta wycena metodą DCF: projekcja FCF na ${horizonYears} lat, zdyskontowana WACC-iem, ` +
      'wartość rezydualna metodą Gordona, mostek EV → Equity Value → wartość na akcję. Każda ' +
      `pozycja to formuła; wejścia na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'dcfValuation',
      companyName,
      currency: label,
      valuationYear,
      horizonYears,
    },
  };
}

export default buildDcfValuationSchema;
