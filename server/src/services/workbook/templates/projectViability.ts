/**
 * projectViability — parametric builder for a project profitability/viability
 * assessment (NPV / IRR / payback / profitability index).
 *
 * EIGHTH registered template in the model-template library (after
 * threeScenarioPnL, operatingBudget, dcfValuation, breakEven, cashflow12m,
 * unitEconomics, loanAmortization) and the FIRST to answer the single most
 * common consulting question — "does THIS PROJECT pay off?" — as opposed to
 * `dcfValuation`, which values a whole COMPANY. Same reliability thesis: the
 * LLM/caller parametrizes a PROVEN template — every projected cash flow,
 * discount factor, NPV, IRR, payback period and profitability index is a real
 * Excel formula, no magic-numbers, inputs live only on the Assumptions sheet.
 *
 * The math (n = 0..horizonYears; n=0 is the investment moment, n=1..N are the
 * operating years):
 *   Gross operating cash flow: CF(1) = BaseCF ; CF(n) = CF(n-1) * (1+growth)
 *   Tax on operating flow:     Tax(n) = MAX(CF(n), 0) * TaxRate
 *   Net cash flow:             Net(0) = -Investment
 *                              Net(n) = CF(n) - Tax(n)                  [1≤n<N]
 *                              Net(N) = CF(N) - Tax(N) + ResidualValue  [n=N]
 *   Discount factor:           1 / (1+DiscountRate)^n
 *   Discounted net flow:       Net(n) * DiscountFactor(n)
 *   Cumulative net (nominal):  running sum of Net(0..n)   → simple payback
 *   Cumulative net (PV):       running sum of Discounted(0..n) → discounted payback
 *   NPV:                       NPV(DiscountRate, Net(1..N)) + Net(0)     [Excel NPV()]
 *   IRR:                       IRR(Net(0..N))                            [Excel IRR()]
 *   Profitability Index (PI):  SUM(Discounted(1..N)) / Investment
 *   Simple payback (years):    COUNTIF(CumulativeNominal(1..N), "<0")   [whole-year approximation]
 *   Discounted payback (years):COUNTIF(CumulativePV(1..N), "<0")        [whole-year approximation]
 *
 * `horizonYears` decides the SHAPE of the model (number of year columns) so it
 * is resolved at build time in JS (clamped 3..15), not carried as a live
 * formula input — everything downstream of it (the year columns, the NPV/IRR
 * ranges, the payback COUNTIF ranges) is still a real formula, just sized for
 * the chosen horizon. The payback COUNTIF is a deliberate non-array
 * approximation (counts full years where cumulative cash is still negative) —
 * exact to the year, not interpolated to the month; a normal, well-understood
 * spreadsheet convention (same "build-time-sized, run-time-live" philosophy
 * as loanAmortization's schedule and dcfValuation's projection).
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

export interface ProjectViabilityParams {
  /** Project name (banner + title). */
  projectName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** First calendar year of the operating horizon (Year 1). Year 0 = this - 1. */
  startYear?: number;
  /** Initial investment (CAPEX) — the Year-0 cash outflow. */
  investment?: number;
  /** Gross (pre-tax) operating cash flow in Year 1. */
  baseCashFlow?: number;
  /** Projected operating cash-flow growth rate applied through the horizon (fraction). */
  cashFlowGrowthPct?: number;
  /** Discount rate (required rate of return / cost of capital) — fraction. */
  discountRatePct?: number;
  /** Residual/terminal value realized at the END of the horizon (e.g. resale, scrap). */
  residualValue?: number;
  /** Tax rate applied to the operating cash flow (fraction; 0 = flows already net of tax). */
  taxRatePct?: number;
  /** Number of operating years, i.e. the horizon (3..15). */
  horizonYears?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

// Exported so the template registry can derive its FE-facing parameter
// descriptors from the SAME source of truth the builder uses.
export const PROJECT_VIABILITY_GENERAL_DEFAULTS = {
  projectName: 'Projekt inwestycyjny',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  investment: 1_000_000,
} as const;

export const PROJECT_VIABILITY_DRIVER_DEFAULTS: Required<
  Pick<
    ProjectViabilityParams,
    | 'baseCashFlow'
    | 'cashFlowGrowthPct'
    | 'discountRatePct'
    | 'residualValue'
    | 'taxRatePct'
    | 'horizonYears'
  >
> = {
  baseCashFlow: 350_000,
  cashFlowGrowthPct: 0.05,
  discountRatePct: 0.1,
  residualValue: 100_000,
  taxRatePct: 0.19,
  horizonYears: 5,
};

/** Clamp a fraction to a sane bound; fall back to `fallback` when not finite. */
function safeFraction(v: number | undefined, fallback: number, min = -1, max = 2): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Clamp an amount (may be negative, e.g. a decommissioning cost) to a finite number. */
function safeAmount(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return v;
}

/** Clamp a strictly-positive amount (an investment must divide safely). */
function safePositive(v: number | undefined, fallback: number, min = 0.01): number {
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

/** 0-based column index → letter. Sufficient for ≤26 columns (horizon ≤15 → ≤16 cols). */
function colLetter(idx0: number): string {
  return String.fromCharCode(65 + idx0);
}

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns: A = Driver (text) | B = Wartość (number)
// Rows (Excel row = data-index + 2, header is row 1):
//   2  Nakład początkowy (inwestycja)              ← currency
//   3  Przepływ operacyjny brutto — rok 1           ← currency
//   4  Wzrost przepływów % rocznie                  ← percent
//   5  Stopa dyskontowa (wymagana stopa zwrotu)      ← percent
//   6  Wartość rezydualna (koniec horyzontu)         ← currency
//   7  Stopa podatkowa (od przepływu operacyjnego)   ← percent
//   8  Horyzont projektu (lata)                      ← integer (informational; sizes the model)
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

const AR = {
  investment: 2,
  cf1: 3,
  cfGrowth: 4,
  discountRate: 5,
  residualValue: 6,
  taxRate: 7,
  horizon: 8,
} as const;

/** Absolute reference to an assumption cell in column B, e.g. 'Założenia'!$B$4. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$B$${row}`;
}

function buildAssumptionsSheet(
  investment: number,
  baseCashFlow: number,
  cashFlowGrowthPct: number,
  discountRatePct: number,
  residualValue: number,
  taxRatePct: number,
  horizonYears: number,
  currencyLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 38 },
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
    prompt: 'Dodatnia liczba w walucie modelu.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Kwota musi być liczbą ≥ 0.',
  };
  const signedAmountValidation: DataValidation = {
    type: 'decimal',
    operator: 'between',
    min: -1_000_000_000,
    max: 1_000_000_000,
    allowBlank: false,
    promptTitle: 'Kwota',
    prompt: 'Liczba w walucie modelu (może być ujemna, np. koszt likwidacji).',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Podaj liczbę.',
  };
  const horizonValidation: DataValidation = {
    type: 'whole',
    operator: 'between',
    min: 3,
    max: 15,
    allowBlank: false,
    promptTitle: 'Horyzont projektu',
    prompt: 'Liczba lat eksploatacji projektu (3–15).',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: 3–15 lat.',
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
    row('Nakład początkowy (inwestycja)', investment, curFmt, amountValidation),
    row(
      'Przepływ operacyjny brutto — rok 1 (przed podatkiem)',
      baseCashFlow,
      curFmt,
      signedAmountValidation
    ),
    row('Wzrost przepływów % rocznie', cashFlowGrowthPct, pctFmt, percentValidation),
    row('Stopa dyskontowa (wymagana stopa zwrotu)', discountRatePct, pctFmt, {
      ...percentValidation,
      min: 0.001,
      max: 1,
    }),
    row('Wartość rezydualna (koniec horyzontu)', residualValue, curFmt, signedAmountValidation),
    row('Stopa podatkowa (od przepływu operacyjnego)', taxRatePct, pctFmt, {
      ...percentValidation,
      min: 0,
      max: 1,
    }),
    row('Horyzont projektu (lata)', horizonYears, '0', horizonValidation),
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia oceny opłacalności projektu (edytowalne).',
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
// "Przepływy" sheet — the engine: one column per year (0..horizonYears),
// one row per line item. Every populated cell is a live formula.
//
// Rows (Excel row = index + 2):
//   2  Przepływ operacyjny brutto (przed podatkiem)   [Year 0 has no cell — not yet operating]
//   3  Podatek od przepływu operacyjnego               [Year 0 has no cell]
//   4  Przepływ pieniężny netto                        [Year 0 = -Investment; Year N += residual]
//   5  Współczynnik dyskontowy
//   6  Zdyskontowany przepływ netto
//   7  Skumulowany przepływ netto (niezdyskontowany)   [→ simple payback]
//   8  Skumulowany przepływ zdyskontowany               [→ discounted payback]
// ---------------------------------------------------------------------------

const PRZEPLYWY_SHEET = 'Przepływy';
const ENGINE_ROW = {
  gross: 2,
  tax: 3,
  net: 4,
  discountFactor: 5,
  discounted: 6,
  cumUndiscounted: 7,
  cumDiscounted: 8,
} as const;

function buildPrzeplywySheet(
  startYear: number,
  horizonYears: number,
  currencyHint: 'pln' | 'eur' | 'usd'
): Sheet {
  const columns: ColumnDef[] = [{ key: 'pozycja', header: 'Pozycja', type: 'text', width: 40 }];
  for (let n = 0; n <= horizonYears; n++) {
    columns.push({
      key: `rok${n}`,
      header: n === 0 ? 'Rok 0 (inwestycja)' : `Rok ${n} (${startYear + n - 1})`,
      type: 'number',
    });
  }
  const currencyFmt = currencyNumFmt(currencyHint);

  // yearCols[n] = the worksheet column LETTER for year n (n = 0..horizonYears).
  const yearCols = Array.from({ length: horizonYears + 1 }, (_, n) => colLetter(n + 1)); // B, C, D, ...

  function buildRow(
    label: string,
    numberFormat: string,
    formulaFor: (n: number, col: string, prevCol: string | null) => string | null
  ): Row {
    const cells: Record<string, Cell> = { pozycja: { value: label } };
    for (let n = 0; n <= horizonYears; n++) {
      const col = yearCols[n];
      const prevCol = n > 0 ? yearCols[n - 1] : null;
      const formula = formulaFor(n, col, prevCol);
      if (formula !== null) {
        cells[`rok${n}`] = { formula, style: { numberFormat } };
      }
    }
    return { cells };
  }

  const rows: Row[] = [
    // Row 2 — gross operating cash flow. No cell for Year 0 (pre-operating).
    buildRow('Przepływ operacyjny brutto (przed podatkiem)', currencyFmt, (n, col, prevCol) => {
      if (n === 0) return null;
      if (n === 1) return aRef(AR.cf1);
      return `${prevCol}${ENGINE_ROW.gross}*(1+${aRef(AR.cfGrowth)})`;
    }),
    // Row 3 — tax on the (non-negative) operating flow. No cell for Year 0.
    buildRow('Podatek od przepływu operacyjnego', currencyFmt, (n, col) => {
      if (n === 0) return null;
      return `MAX(${col}${ENGINE_ROW.gross},0)*${aRef(AR.taxRate)}`;
    }),
    // Row 4 — net cash flow. Year 0 = -Investment; last year adds the residual value.
    buildRow('Przepływ pieniężny netto', currencyFmt, (n, col) => {
      if (n === 0) return `-${aRef(AR.investment)}`;
      const base = `${col}${ENGINE_ROW.gross}-${col}${ENGINE_ROW.tax}`;
      return n === horizonYears ? `${base}+${aRef(AR.residualValue)}` : base;
    }),
    // Row 5 — discount factor = 1/(1+rate)^n (n=0 → factor 1).
    buildRow('Współczynnik dyskontowy', '0.000', (n) => `1/(1+${aRef(AR.discountRate)})^${n}`),
    // Row 6 — discounted net cash flow.
    buildRow(
      'Zdyskontowany przepływ netto',
      currencyFmt,
      (n, col) => `${col}${ENGINE_ROW.net}*${col}${ENGINE_ROW.discountFactor}`
    ),
    // Row 7 — cumulative NOMINAL net cash flow (→ simple payback).
    buildRow('Skumulowany przepływ netto (niezdyskontowany)', currencyFmt, (n, col, prevCol) =>
      n === 0
        ? `${col}${ENGINE_ROW.net}`
        : `${prevCol}${ENGINE_ROW.cumUndiscounted}+${col}${ENGINE_ROW.net}`
    ),
    // Row 8 — cumulative DISCOUNTED net cash flow (→ discounted payback).
    buildRow('Skumulowany przepływ zdyskontowany', currencyFmt, (n, col, prevCol) =>
      n === 0
        ? `${col}${ENGINE_ROW.discounted}`
        : `${prevCol}${ENGINE_ROW.cumDiscounted}+${col}${ENGINE_ROW.discounted}`
    ),
  ];

  return {
    name: PRZEPLYWY_SHEET,
    purpose:
      'Projekcja przepływów pieniężnych projektu i ich wartości bieżącej — każda pozycja to formuła; ' +
      'kolumna „Rok 0" = moment inwestycji.',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// "Wyniki" sheet — NPV, IRR, payback (simple + discounted), profitability index.
//
// Columns: A = Metryka (text) | B = Wartość (number)
// Rows (Excel row = index + 2):
//   2  NPV (wartość bieżąca netto)                        [summary]  ← =NPV(...)
//   3  IRR (wewnętrzna stopa zwrotu)                        [summary]  ← =IRR(...)
//   4  Suma zdyskontowanych przepływów operacyjnych (1..N)
//   5  Wskaźnik rentowności (PI)                            [summary]
//   6  Okres zwrotu prosty (lata, przybliżenie)
//   7  Okres zwrotu zdyskontowany (lata, przybliżenie)
// ---------------------------------------------------------------------------

const WYNIKI_SHEET = 'Wyniki';
const WR = {
  npv: 2,
  irr: 3,
  sumPvOperating: 4,
  pi: 5,
  paybackSimple: 6,
  paybackDiscounted: 7,
} as const;

function buildWynikiSheet(horizonYears: number, currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'metryka', header: 'Metryka', type: 'text', width: 42 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);
  const firstOperatingCol = colLetter(2); // n=1 → column C ('pozycja' is A, 'rok0' is B)
  const lastCol = colLetter(horizonYears + 1); // n=horizonYears

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

  const netRange = `'${PRZEPLYWY_SHEET}'!${firstOperatingCol}${ENGINE_ROW.net}:${lastCol}${ENGINE_ROW.net}`;
  const netRangeFull = `'${PRZEPLYWY_SHEET}'!B${ENGINE_ROW.net}:${lastCol}${ENGINE_ROW.net}`;
  const discRange = `'${PRZEPLYWY_SHEET}'!${firstOperatingCol}${ENGINE_ROW.discounted}:${lastCol}${ENGINE_ROW.discounted}`;
  const cumRange = `'${PRZEPLYWY_SHEET}'!${firstOperatingCol}${ENGINE_ROW.cumUndiscounted}:${lastCol}${ENGINE_ROW.cumUndiscounted}`;
  const cumDiscRange = `'${PRZEPLYWY_SHEET}'!${firstOperatingCol}${ENGINE_ROW.cumDiscounted}:${lastCol}${ENGINE_ROW.cumDiscounted}`;

  const rows: Row[] = [
    metricRow(
      'NPV (wartość bieżąca netto)',
      `NPV(${aRef(AR.discountRate)},${netRange})+'${PRZEPLYWY_SHEET}'!B${ENGINE_ROW.net}`,
      {
        summary: true,
      }
    ),
    metricRow('IRR (wewnętrzna stopa zwrotu)', `IRR(${netRangeFull})`, {
      summary: true,
      numberFormat: '0.0%',
    }),
    metricRow(
      'Suma zdyskontowanych przepływów operacyjnych (lata 1–' + horizonYears + ')',
      `SUM(${discRange})`
    ),
    metricRow(
      'Wskaźnik rentowności (PI = suma PV / nakład)',
      `B${WR.sumPvOperating}/${aRef(AR.investment)}`,
      {
        summary: true,
        numberFormat: '0.00',
      }
    ),
    metricRow('Okres zwrotu prosty (lata, przybliżenie)', `COUNTIF(${cumRange},"<0")`, {
      numberFormat: '0" lat"',
    }),
    metricRow('Okres zwrotu zdyskontowany (lata, przybliżenie)', `COUNTIF(${cumDiscRange},"<0")`, {
      numberFormat: '0" lat"',
    }),
  ];

  return {
    name: WYNIKI_SHEET,
    purpose:
      'NPV, IRR, wskaźnik rentowności i okres zwrotu (prosty i zdyskontowany) — każda pozycja to formuła ' +
      `wyliczona z arkusza „${PRZEPLYWY_SHEET}".`,
    columns,
    rows,
    freezeRow: 1,
    tabColor: '1D9E75',
  };
}

// ---------------------------------------------------------------------------
// "Wrażliwość" sheet — 2-D NPV grid: discount rate (columns) × cash-flow
// level as a % of the base assumption (rows). Uses the EQ-B sensitivityTables
// primitive: the interior is a real formula per cell (the NPV expanded as an
// explicit N-term sum, N fixed at build time from horizonYears), not a
// hardcoded readout.
// ---------------------------------------------------------------------------

const WRAZLIWOSC_SHEET = 'Wrażliwość';

function buildWrazliwoscSheet(
  discountRatePct: number,
  horizonYears: number,
  investmentRef: string,
  cf1Ref: string,
  growthRef: string,
  taxRef: string,
  residualRef: string,
  currencyHint: 'pln' | 'eur' | 'usd'
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'info', header: 'Analiza wrażliwości NPV', type: 'text', width: 70 },
  ];
  const rows: Row[] = [
    {
      cells: {
        info: {
          value:
            'NPV projektu przy różnych poziomach stopy dyskontowej (kolumny) i różnych poziomach ' +
            'przepływów pieniężnych względem założenia bazowego (wiersze, % przepływu bazowego).',
        },
      },
    },
  ];

  // Column variants: base discount rate ± 2pp / ± 4pp, floored at 0.1%.
  const colInputs = [-0.04, -0.02, 0, 0.02, 0.04]
    .map((delta) => Math.max(0.001, discountRatePct + delta))
    .sort((a, b) => a - b);
  // Row variants: cash-flow level as a fraction of the base assumption.
  const rowInputs = [0.7, 0.85, 1.0, 1.15, 1.3];

  // Build the NPV formula as an explicit sum of `horizonYears` discounted
  // terms (N is fixed at build time, so no array formula is needed). {row}
  // scales the base gross cash flow; {col} is the variant discount rate.
  const terms: string[] = [];
  for (let n = 1; n <= horizonYears; n++) {
    const grossExpr = `(${cf1Ref}*(1+${growthRef})^${n - 1})`;
    const scaledExpr = `(${grossExpr}*{row})`;
    const netExpr =
      n === horizonYears
        ? `(${scaledExpr}*(1-${taxRef})+${residualRef})`
        : `(${scaledExpr}*(1-${taxRef}))`;
    terms.push(`${netExpr}/(1+{col})^${n}`);
  }
  const outputFormulaTemplate = `-${investmentRef}+${terms.join('+')}`;

  return {
    name: WRAZLIWOSC_SHEET,
    purpose:
      'NPV w funkcji stopy dyskontowej i poziomu przepływów pieniężnych — siatka formuł, nie odczyt statyczny.',
    columns,
    rows,
    freezeRow: 1,
    tabColor: '6B7280',
    sensitivityTables: [
      {
        title: 'NPV — wrażliwość (stopa dyskontowa × poziom przepływów)',
        anchorCell: 'B5',
        cornerLabel: 'Poziom CF ↓ / Stopa dysk. →',
        colInputs,
        rowInputs,
        outputFormulaTemplate,
        numberFormat: currencyNumFmt(currencyHint),
        headerNumberFormat: '0.0%',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildProjectViabilitySchema(params: ProjectViabilityParams = {}): WorkbookSchema {
  const projectName =
    (params.projectName ?? 'Projekt inwestycyjny').trim() || 'Projekt inwestycyjny';
  const startYear =
    Number.isFinite(params.startYear) && (params.startYear as number) > 0
      ? Math.floor(params.startYear as number)
      : new Date().getFullYear() + 1;

  const investment = safePositive(params.investment, PROJECT_VIABILITY_GENERAL_DEFAULTS.investment);
  const baseCashFlow = safeAmount(
    params.baseCashFlow,
    PROJECT_VIABILITY_DRIVER_DEFAULTS.baseCashFlow
  );
  const cashFlowGrowthPct = safeFraction(
    params.cashFlowGrowthPct,
    PROJECT_VIABILITY_DRIVER_DEFAULTS.cashFlowGrowthPct
  );
  const discountRatePct = safeFraction(
    params.discountRatePct,
    PROJECT_VIABILITY_DRIVER_DEFAULTS.discountRatePct,
    0.001,
    1
  );
  const residualValue = safeAmount(
    params.residualValue,
    PROJECT_VIABILITY_DRIVER_DEFAULTS.residualValue
  );
  const taxRatePct = safeFraction(
    params.taxRatePct,
    PROJECT_VIABILITY_DRIVER_DEFAULTS.taxRatePct,
    0,
    1
  );
  const horizonYears = Math.min(
    15,
    Math.max(
      3,
      Number.isFinite(params.horizonYears)
        ? Math.round(params.horizonYears as number)
        : PROJECT_VIABILITY_DRIVER_DEFAULTS.horizonYears
    )
  );

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(
      investment,
      baseCashFlow,
      cashFlowGrowthPct,
      discountRatePct,
      residualValue,
      taxRatePct,
      horizonYears,
      label
    ),
    buildPrzeplywySheet(startYear, horizonYears, hint),
    buildWynikiSheet(horizonYears, hint),
    buildWrazliwoscSheet(
      discountRatePct,
      horizonYears,
      aRef(AR.investment),
      aRef(AR.cf1),
      aRef(AR.cfGrowth),
      aRef(AR.taxRate),
      aRef(AR.residualValue),
      hint
    ),
  ];

  return {
    title: `${projectName} — Ocena opłacalności`,
    description:
      `Parametryczna ocena opłacalności projektu na ${horizonYears} lat: projekcja przepływów pieniężnych ` +
      'netto → NPV → IRR → wskaźnik rentowności (PI) → okres zwrotu prosty i zdyskontowany, plus analiza ' +
      `wrażliwości NPV na stopę dyskontową i poziom przepływów. Każda pozycja to formuła; wejścia na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'projectViability',
      projectName,
      currency: label,
      startYear,
      investment,
      baseCashFlow,
      cashFlowGrowthPct,
      discountRatePct,
      residualValue,
      taxRatePct,
      horizonYears,
    },
  };
}

export default buildProjectViabilitySchema;
