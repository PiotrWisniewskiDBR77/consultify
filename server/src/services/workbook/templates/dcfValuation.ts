/**
 * dcfValuation — parametric builder for a classic DCF (Discounted Cash Flow)
 * valuation model: Enterprise Value → Equity Value.
 *
 * Follows the same reliability thesis as `threeScenarioPnL` / `unitEconomics`:
 * the LLM parametrizes a PROVEN template instead of inventing a DCF from
 * scratch (where it would invent magic-numbers, mis-place a discount-factor
 * exponent, or break the Gordon terminal-value formula). The output is a
 * complete, correct `WorkbookSchema` — every computed cell on the "DCF" sheet
 * is a real Excel formula referencing the "Założenia" (Assumptions) sheet.
 *
 * The math (unlevered FCF → PV → EV → equity):
 *   Revenue(t):    t=1 → baseRevenue*(1+g_rev) ; t>1 → Revenue(t-1)*(1+g_rev)
 *   EBIT(t):       Revenue(t) * marża EBIT
 *   NOPAT(t):      EBIT(t) * (1 - stopa podatku)
 *   D&A(t):        Revenue(t) * D&A%
 *   CAPEX(t):      Revenue(t) * CAPEX%
 *   ΔWC(t):        Revenue(t) * ΔWC%
 *   Unlevered FCF(t) = NOPAT(t) + D&A(t) - CAPEX(t) - ΔWC(t)
 *   Discount factor(t) = 1 / (1 + WACC)^t
 *   PV(FCF)(t)     = FCF(t) * discount factor(t)
 *
 *   Terminal value (Gordon growth, at end of year N):
 *     TV        = FCF(N) * (1 + g) / (WACC - g)
 *     PV(TV)    = TV * discount factor(N)
 *
 *   Enterprise Value = Σ PV(FCF)(1..N) + PV(TV)
 *   Equity Value     = Enterprise Value - dług netto
 *
 * IMPORTANT (finance): the Gordon denominator (WACC - g) MUST be positive, i.e.
 * WACC > g, or the terminal value is nonsensical / negative. The builder clamps
 * `terminalGrowthPct` to stay strictly below WACC (see `resolveParams`), so the
 * emitted formula `.../(WACC-g)` is always well-defined. The formula itself is
 * the standard textbook form — the guard lives in the resolved inputs, not in a
 * hacked formula.
 *
 * Formulas are emitted WITHOUT a leading `=` (the builder writes the string
 * verbatim into the worksheet XML `<f>` element, which must be `=`-free). The
 * discount-factor exponent (the literal year number `t`) is a legal constant
 * INSIDE a formula string — not a magic-number cell value.
 */

import type {
  Cell,
  ColumnDef,
  ConditionalFormattingBlock,
  DataValidation,
  Row,
  Sheet,
  WorkbookSchema,
} from '../WorkbookSchema.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export interface DcfValuationParams {
  /** Company name (title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Base-year (year 0) revenue in the model currency. */
  baseRevenue?: number;
  /** Year-over-year revenue growth during the forecast. FRACTION (0.10 = +10%). */
  revenueGrowthPct?: number;
  /** EBIT (operating) margin as a fraction of revenue. e.g. 0.20 = 20%. */
  ebitMarginPct?: number;
  /** Effective tax rate on EBIT. FRACTION (0.19 = 19%). */
  taxRatePct?: number;
  /** Depreciation & amortization as a fraction of revenue. */
  daPct?: number;
  /** Capital expenditure as a fraction of revenue. */
  capexPct?: number;
  /** Change in net working capital as a fraction of revenue. */
  workingCapitalChangePct?: number;
  /** Weighted Average Cost of Capital (discount rate). FRACTION (0.10 = 10%). */
  waccPct?: number;
  /** Long-term (perpetuity) growth rate `g` for terminal value. FRACTION. */
  terminalGrowthPct?: number;
  /** Net debt subtracted from Enterprise Value to reach Equity Value. */
  netDebt?: number;
  /** Number of explicit forecast years (default 5). Clamped to [1, 15]. */
  forecastYears?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

const DEFAULTS: Required<Omit<DcfValuationParams, 'companyName' | 'currencyCode'>> = {
  baseRevenue: 1_000_000,
  revenueGrowthPct: 0.1,
  ebitMarginPct: 0.2,
  taxRatePct: 0.19,
  daPct: 0.05,
  capexPct: 0.06,
  workingCapitalChangePct: 0.02,
  waccPct: 0.1,
  terminalGrowthPct: 0.02,
  netDebt: 200_000,
  forecastYears: 5,
};

/** Clamp a finite number to a sane bound; fall back when not finite. */
function safeNumber(v: number | undefined, fallback: number, min = -1e15, max = 1e15): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Clamp a fraction to a bound; fall back when not finite. */
function safeFraction(v: number | undefined, fallback: number, min = -1, max = 5): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
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

/** Plain (non-accounting) currency format for the assumptions sheet inputs. */
function currencyInputFmt(label: string): string {
  return label === 'PLN' ? '# ##0" zł"' : label === 'EUR' ? '€#,##0' : '$#,##0';
}

/** Fully-resolved, validated inputs used by BOTH the sheets and the metadata. */
interface ResolvedParams {
  companyName: string;
  hint: 'pln' | 'eur' | 'usd';
  label: string;
  baseRevenue: number;
  revenueGrowthPct: number;
  ebitMarginPct: number;
  taxRatePct: number;
  daPct: number;
  capexPct: number;
  workingCapitalChangePct: number;
  waccPct: number;
  terminalGrowthPct: number;
  netDebt: number;
  forecastYears: number;
}

function resolveParams(params: DcfValuationParams): ResolvedParams {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';
  const { hint, label } = currencyMeta(params.currencyCode);

  const baseRevenue = safeNumber(params.baseRevenue, DEFAULTS.baseRevenue, 0);
  const revenueGrowthPct = safeFraction(params.revenueGrowthPct, DEFAULTS.revenueGrowthPct);
  const ebitMarginPct = safeFraction(params.ebitMarginPct, DEFAULTS.ebitMarginPct, -1, 1);
  const taxRatePct = safeFraction(params.taxRatePct, DEFAULTS.taxRatePct, 0, 1);
  const daPct = safeFraction(params.daPct, DEFAULTS.daPct, 0, 1);
  const capexPct = safeFraction(params.capexPct, DEFAULTS.capexPct, 0, 1);
  const workingCapitalChangePct = safeFraction(
    params.workingCapitalChangePct,
    DEFAULTS.workingCapitalChangePct,
    -1,
    1,
  );

  // WACC first — terminal g is then guaranteed strictly below it (Gordon needs
  // WACC > g, else TV = FCF*(1+g)/(WACC-g) is undefined / negative).
  let waccPct = safeFraction(params.waccPct, DEFAULTS.waccPct, 0.0001, 1);
  const rawG = safeFraction(params.terminalGrowthPct, DEFAULTS.terminalGrowthPct, -1, 1);
  // Keep g at least 0.5pp below WACC. If the caller pushed g ≥ WACC, cap g.
  const maxG = waccPct - 0.005;
  const terminalGrowthPct = Math.min(rawG, maxG);

  const netDebt = safeNumber(params.netDebt, DEFAULTS.netDebt);
  const forecastYearsRaw = safeNumber(params.forecastYears, DEFAULTS.forecastYears, 1, 15);
  const forecastYears = Math.max(1, Math.min(15, Math.round(forecastYearsRaw)));

  return {
    companyName,
    hint,
    label,
    baseRevenue,
    revenueGrowthPct,
    ebitMarginPct,
    taxRatePct,
    daPct,
    capexPct,
    workingCapitalChangePct,
    waccPct,
    terminalGrowthPct,
    netDebt,
    forecastYears,
  };
}

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns:  A = Driver (text) | B = Wartość
// Rows (Excel row = data-index + 2, header is row 1):
//   2  Przychód bazowy (rok 0)              ← currency
//   3  Wzrost przychodów %/rok              ← percent
//   4  Marża EBIT %                          ← percent
//   5  Stopa podatku %                       ← percent
//   6  D&A % przychodu                       ← percent
//   7  CAPEX % przychodu                     ← percent
//   8  Δ Kapitał obrotowy % przychodu        ← percent
//   9  WACC %                                ← percent
//   10 Terminal growth (g) %                 ← percent
//   11 Dług netto                            ← currency
//   12 Liczba okresów prognozy (lat)         ← number (integer)
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';
const A_COL = 'B';

/** Excel rows of each assumption driver on the Założenia sheet. */
const AR = {
  revenue: 2,
  growth: 3,
  ebitMargin: 4,
  tax: 5,
  da: 6,
  capex: 7,
  wc: 8,
  wacc: 9,
  terminalG: 10,
  netDebt: 11,
  years: 12,
} as const;

/** Absolute cross-sheet reference to an assumption cell, e.g. 'Założenia'!$B$9. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$${A_COL}$${row}`;
}

// ---------------------------------------------------------------------------
// Assumptions sheet builder
// ---------------------------------------------------------------------------

function buildAssumptionsSheet(p: ResolvedParams): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 34 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];

  const inputFill = 'FFF2CC'; // per task spec — input-cell chrome
  const pctFmt = '0.0%';
  const curFmt = currencyInputFmt(p.label);
  const intFmt = '0';

  const nonNegativeValidation = (promptTitle: string, prompt: string): DataValidation => ({
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    min: 0,
    allowBlank: false,
    promptTitle,
    prompt,
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Wartość musi być liczbą ≥ 0.',
  });

  const anyNumberValidation = (promptTitle: string, prompt: string): DataValidation => ({
    type: 'decimal',
    operator: 'between',
    min: -1e15,
    max: 1e15,
    allowBlank: false,
    promptTitle,
    prompt,
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Wartość musi być liczbą.',
  });

  const fractionValidation = (min: number, max: number): DataValidation => ({
    type: 'decimal',
    operator: 'between',
    min,
    max,
    allowBlank: false,
    promptTitle: 'Wartość ułamkowa',
    prompt: 'Podaj ułamek, np. 0,10 = 10%.',
    errorTitle: 'Poza zakresem',
    error: `Dozwolony zakres: ${min} do ${max}.`,
  });

  const yearsValidation: DataValidation = {
    type: 'whole',
    operator: 'between',
    min: 1,
    max: 15,
    allowBlank: false,
    promptTitle: 'Liczba lat prognozy',
    prompt: 'Liczba całkowita 1–15.',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: 1 do 15 lat.',
  };

  const inputCell = (value: number, fmt: string, validation: DataValidation): Cell => ({
    value,
    style: { bgColor: inputFill, border: 'thin', numberFormat: fmt },
    validation,
  });

  const rows: Row[] = [
    {
      cells: {
        driver: { value: 'Przychód bazowy (rok 0)', style: { bold: true } },
        wartosc: inputCell(
          p.baseRevenue,
          curFmt,
          nonNegativeValidation('Przychód bazowy', 'Przychód roku bazowego (rok 0) w walucie modelu.'),
        ),
      },
    },
    {
      cells: {
        driver: { value: 'Wzrost przychodów %/rok' },
        wartosc: inputCell(p.revenueGrowthPct, pctFmt, fractionValidation(-1, 5)),
      },
    },
    {
      cells: {
        driver: { value: 'Marża EBIT %' },
        wartosc: inputCell(p.ebitMarginPct, pctFmt, fractionValidation(-1, 1)),
      },
    },
    {
      cells: {
        driver: { value: 'Stopa podatku %' },
        wartosc: inputCell(p.taxRatePct, pctFmt, fractionValidation(0, 1)),
      },
    },
    {
      cells: {
        driver: { value: 'D&A (amortyzacja) % przychodu' },
        wartosc: inputCell(p.daPct, pctFmt, fractionValidation(0, 1)),
      },
    },
    {
      cells: {
        driver: { value: 'CAPEX % przychodu' },
        wartosc: inputCell(p.capexPct, pctFmt, fractionValidation(0, 1)),
      },
    },
    {
      cells: {
        driver: { value: 'Δ Kapitał obrotowy % przychodu' },
        wartosc: inputCell(p.workingCapitalChangePct, pctFmt, fractionValidation(-1, 1)),
      },
    },
    {
      cells: {
        driver: { value: 'WACC % (stopa dyskonta)' },
        wartosc: inputCell(p.waccPct, pctFmt, fractionValidation(0.0001, 1)),
      },
    },
    {
      cells: {
        driver: { value: 'Terminal growth (g) %' },
        wartosc: inputCell(p.terminalGrowthPct, pctFmt, fractionValidation(-1, 1)),
      },
    },
    {
      cells: {
        driver: { value: 'Dług netto' },
        wartosc: inputCell(
          p.netDebt,
          curFmt,
          anyNumberValidation('Dług netto', 'Dług netto odejmowany od Enterprise Value (może być ujemny = gotówka netto).'),
        ),
      },
    },
    {
      cells: {
        driver: { value: 'Liczba okresów prognozy (lat)' },
        wartosc: inputCell(p.forecastYears, intFmt, yearsValidation),
      },
    },
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia modelu DCF (edytowalne).',
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
// DCF sheet builder
//
// Columns: A = Pozycja (text) | Rok 1 | Rok 2 | … | Rok N
//   Year t sits in column letter yearCol(t): B=Rok1, C=Rok2, …
// Rows (Excel row = index + 2):
//   2  Przychód                       (Revenue)
//   3  EBIT                            = Revenue * marża EBIT
//   4  NOPAT                           = EBIT * (1 - podatek)          [summary]
//   5  + D&A                           = Revenue * D&A%
//   6  − CAPEX                         = Revenue * CAPEX%
//   7  − Δ Kapitał obrotowy            = Revenue * ΔWC%
//   8  Unlevered FCF                   = NOPAT + D&A − CAPEX − ΔWC     [summary]
//   9  Współczynnik dyskonta           = 1/(1+WACC)^t
//   10 PV(FCF)                         = FCF * współczynnik            [summary]
// ---------------------------------------------------------------------------

const DR = {
  revenue: 2,
  ebit: 3,
  nopat: 4,
  da: 5,
  capex: 6,
  wc: 7,
  fcf: 8,
  discountFactor: 9,
  pvFcf: 10,
} as const;

/** Column letter for forecast year `t` (1-based): t=1 → 'B', t=2 → 'C', … */
function yearColLetter(t: number): string {
  // t=1 → index 1 (B). colIndexToLetter-ish for the single-letter range we need.
  let n = t + 1; // 1-based column number (A=1 is the label column)
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildDcfSheet(p: ResolvedParams): Sheet {
  const N = p.forecastYears;
  const currencyFmt = currencyNumFmt(p.hint);
  const factorFmt = '0.0000';

  const columns: ColumnDef[] = [{ key: 'pozycja', header: 'Pozycja', type: 'text', width: 30 }];
  for (let t = 1; t <= N; t++) {
    columns.push({ key: `rok${t}`, header: `Rok ${t}`, type: 'number' });
  }

  const colKey = (t: number): string => `rok${t}`;

  // ---- formula factories (all WITHOUT leading '=') ----

  // Revenue: t=1 → baseRevenue*(1+growth); t>1 → prevRevenue*(1+growth).
  const revenueFormula = (t: number): string => {
    if (t === 1) return `${aRef(AR.revenue)}*(1+${aRef(AR.growth)})`;
    const prev = yearColLetter(t - 1);
    return `${prev}${DR.revenue}*(1+${aRef(AR.growth)})`;
  };

  // A line proportional to this year's revenue: Revenue(col) * driver%.
  const pctOfRevenue = (col: string, driverRow: number): string =>
    `${col}${DR.revenue}*${aRef(driverRow)}`;

  function fRow(
    label: string,
    formulaFor: (t: number, col: string) => string,
    opts: { summary?: boolean; numberFormat?: string } = {},
  ): Row {
    const cells: Record<string, Cell> = {
      pozycja: { value: label, style: opts.summary ? { bold: true } : undefined },
    };
    for (let t = 1; t <= N; t++) {
      const col = yearColLetter(t);
      const numberFormat = opts.numberFormat ?? currencyFmt;
      const style = opts.summary ? { numberFormat, bold: true } : { numberFormat };
      cells[colKey(t)] = { formula: formulaFor(t, col), style };
    }
    return { cells, isSummary: opts.summary };
  }

  const rows: Row[] = [
    // Row 2 — Przychód
    fRow('Przychód', (t) => revenueFormula(t)),
    // Row 3 — EBIT = Revenue * marża EBIT
    fRow('EBIT', (_t, col) => pctOfRevenue(col, AR.ebitMargin)),
    // Row 4 — NOPAT = EBIT * (1 - podatek)  [summary]
    fRow(
      'NOPAT',
      (_t, col) => `${col}${DR.ebit}*(1-${aRef(AR.tax)})`,
      { summary: true },
    ),
    // Row 5 — + D&A = Revenue * D&A%
    fRow('+ D&A (amortyzacja)', (_t, col) => pctOfRevenue(col, AR.da)),
    // Row 6 — − CAPEX = Revenue * CAPEX%
    fRow('− CAPEX', (_t, col) => pctOfRevenue(col, AR.capex)),
    // Row 7 — − Δ Kapitał obrotowy = Revenue * ΔWC%
    fRow('− Δ Kapitał obrotowy', (_t, col) => pctOfRevenue(col, AR.wc)),
    // Row 8 — Unlevered FCF = NOPAT + D&A − CAPEX − ΔWC  [summary]
    fRow(
      'Unlevered FCF',
      (_t, col) => `${col}${DR.nopat}+${col}${DR.da}-${col}${DR.capex}-${col}${DR.wc}`,
      { summary: true },
    ),
    // Row 9 — Współczynnik dyskonta = 1/(1+WACC)^t
    fRow(
      'Współczynnik dyskonta',
      (t) => `1/(1+${aRef(AR.wacc)})^${t}`,
      { numberFormat: factorFmt },
    ),
    // Row 10 — PV(FCF) = FCF * współczynnik dyskonta  [summary]
    fRow(
      'PV (zdyskontowany FCF)',
      (_t, col) => `${col}${DR.fcf}*${col}${DR.discountFactor}`,
      { summary: true },
    ),
  ];

  return {
    name: 'DCF',
    purpose: 'Prognoza wolnych przepływów pieniężnych i ich dyskontowanie (każda pozycja = formuła).',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Valuation summary sheet builder ("Wycena")
//
// Columns: A = Pozycja (text) | B = Wartość
// Rows (Excel row = idx + 2):
//   2  Suma PV(FCF) (lata 1..N)   = SUM('DCF'!B10:<lastCol>10)
//   3  Wartość rezydualna (TV)    = 'DCF'!<lastCol>8*(1+g)/(WACC-g)         (Gordon)
//   4  PV wartości rezydualnej    = TV * 'DCF'!<lastCol>9 (discount factor N)
//   5  Enterprise Value           = Suma PV(FCF) + PV(TV)                    [summary]
//   6  − Dług netto               = 'Założenia'!$B$11
//   7  Equity Value               = Enterprise Value − dług netto            [summary]
// ---------------------------------------------------------------------------

const VR = {
  sumPvFcf: 2,
  terminalValue: 3,
  pvTerminal: 4,
  enterpriseValue: 5,
  netDebt: 6,
  equityValue: 7,
} as const;

function buildValuationSheet(p: ResolvedParams): Sheet {
  const N = p.forecastYears;
  const currencyFmt = currencyNumFmt(p.hint);
  const lastCol = yearColLetter(N); // Year-N column on the DCF sheet.

  const columns: ColumnDef[] = [
    { key: 'pozycja', header: 'Pozycja', type: 'text', width: 32 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];

  function vRow(
    label: string,
    formula: string,
    opts: { summary?: boolean } = {},
  ): Row {
    const style = opts.summary
      ? { numberFormat: currencyFmt, bold: true }
      : { numberFormat: currencyFmt };
    return {
      cells: {
        pozycja: { value: label, style: opts.summary ? { bold: true } : undefined },
        wartosc: { formula, style },
      },
      isSummary: opts.summary,
    };
  }

  // Suma PV(FCF) = SUM over the DCF PV(FCF) row (row 10), from B..lastCol.
  const sumPvFcfFormula = `SUM('DCF'!B${DR.pvFcf}:${lastCol}${DR.pvFcf})`;
  // Terminal value (Gordon) = FCF(N) * (1+g) / (WACC - g).
  const terminalValueFormula =
    `'DCF'!${lastCol}${DR.fcf}*(1+${aRef(AR.terminalG)})/(${aRef(AR.wacc)}-${aRef(AR.terminalG)})`;
  // PV of terminal value = TV * discount factor of year N (DCF row 9, lastCol).
  const pvTerminalFormula = `B${VR.terminalValue}*'DCF'!${lastCol}${DR.discountFactor}`;
  // Enterprise Value = Suma PV(FCF) + PV(TV).
  const enterpriseValueFormula = `B${VR.sumPvFcf}+B${VR.pvTerminal}`;
  // Net debt (pulled from assumptions, not a duplicated constant).
  const netDebtFormula = `${aRef(AR.netDebt)}`;
  // Equity Value = Enterprise Value − net debt.
  const equityValueFormula = `B${VR.enterpriseValue}-B${VR.netDebt}`;

  const rows: Row[] = [
    vRow(`Suma PV(FCF) (lata 1–${N})`, sumPvFcfFormula),
    vRow('Wartość rezydualna (TV, Gordon)', terminalValueFormula),
    vRow('PV wartości rezydualnej', pvTerminalFormula),
    vRow('Enterprise Value (EV)', enterpriseValueFormula, { summary: true }),
    vRow('− Dług netto', netDebtFormula),
    vRow('Equity Value', equityValueFormula, { summary: true }),
  ];

  // Highlight the two headline results (EV row + Equity Value row, col B).
  const conditionalFormatting: ConditionalFormattingBlock[] = [
    {
      ref: `B${VR.equityValue}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: ['0'],
          style: { bgColor: 'E4F4EC', bold: true },
        },
        {
          type: 'cellIs',
          operator: 'lessThanOrEqual',
          formulae: ['0'],
          style: { bgColor: 'FCE4E4', bold: true },
        },
      ],
    },
  ];

  return {
    name: 'Wycena',
    purpose: 'Podsumowanie wyceny DCF: EV = Σ PV(FCF) + PV(TV); Equity Value = EV − dług netto.',
    columns,
    rows,
    freezeRow: 1,
    conditionalFormatting,
    tabColor: '1D9E75',
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildDcfValuationSchema(params: DcfValuationParams = {}): WorkbookSchema {
  const p = resolveParams(params);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(p),
    buildDcfSheet(p),
    buildValuationSheet(p),
  ];

  return {
    title: `${p.companyName} — Wycena DCF`,
    description:
      'Parametryczny model wyceny metodą zdyskontowanych przepływów pieniężnych (DCF): ' +
      `prognoza ${p.forecastYears} lat, unlevered FCF, dyskontowanie WACC, wartość rezydualna ` +
      'metodą Gordona → Enterprise Value → Equity Value. Każda pozycja to formuła; wejścia ' +
      `na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'dcfValuation',
      companyName: p.companyName,
      currency: p.label,
      baseRevenue: p.baseRevenue,
      revenueGrowthPct: p.revenueGrowthPct,
      ebitMarginPct: p.ebitMarginPct,
      taxRatePct: p.taxRatePct,
      daPct: p.daPct,
      capexPct: p.capexPct,
      workingCapitalChangePct: p.workingCapitalChangePct,
      waccPct: p.waccPct,
      terminalGrowthPct: p.terminalGrowthPct,
      netDebt: p.netDebt,
      forecastYears: p.forecastYears,
    },
  };
}

export default buildDcfValuationSchema;
