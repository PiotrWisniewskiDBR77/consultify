/**
 * threeScenarioPnL — parametric builder for a 3-scenario, 3-year P&L model.
 *
 * FLAGSHIP model template of the workbook template library. The goal is to make
 * autonomous Excel modelling RELIABLE: instead of asking the LLM to design a
 * financial model from scratch (where it invents magic-numbers, forgets a
 * formula, or breaks a cross-sheet ref), the LLM parametrizes a PROVEN template.
 * The output is a complete, correct `WorkbookSchema` — every P&L line is a real
 * Excel formula, chained Y1→Y2→Y3, cross-referencing an "Założenia" (Assumptions)
 * sheet, for THREE scenarios (Base / Bull / Bear).
 *
 * Design choices (documented deliberately — see task DOWÓD):
 *   • 3 COLUMNS PER SCENARIO (not `scenarioSwitch`). A `scenarioSwitch` collapses
 *     the model to ONE active scenario selected by a dropdown — great for an
 *     interactive equity model, but it hides the other two scenarios. This
 *     template's whole point is to show Base/Bull/Bear side-by-side across 3
 *     years AND drive a Comparison sheet off all three at once, so a static
 *     3-column layout is the clearer, auditable choice. (`scenarioSwitch` stays
 *     available in the schema for a future interactive variant.)
 *   • EVERY P&L cell is a FORMULA — no magic-numbers. Line items reference the
 *     Assumptions sheet by cross-sheet A1 (`'Założenia'!$B$2` …). Year chaining
 *     (Yn = Y(n-1) × (1+growth)) makes the model recalculate end-to-end.
 *   • Inputs live ONLY on the Assumptions sheet (colored, data-validated,
 *     named-ranged via `isAssumptions`). This satisfies the quality gate's
 *     assumptions-separation rule and keeps the P&L a pure computation layer.
 *
 * The math (per scenario, per year):
 *   Revenue:      Y1 = baseRevenue ;  Yn = Y(n-1) * (1 + growth)
 *   COGS:         Revenue * cogsPct
 *   Gross Profit: Revenue - COGS
 *   OPEX:         Revenue * opexPct
 *   EBITDA:       Gross Profit - OPEX
 *   D&A:          Revenue * daPct
 *   EBIT:         EBITDA - D&A
 *   Interest:     Revenue * interestPct
 *   EBT:          EBIT - Interest
 *   Tax:          MAX(0, EBT) * taxRatePct
 *   Net income:   EBT - Tax
 *   Net margin %: Net income / Revenue
 *
 * Formulas are emitted WITHOUT a leading `=` (the builder writes the string
 * verbatim into the worksheet XML `<f>` element, which must be `=`-free).
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

/** Per-scenario drivers. All percentages are FRACTIONS (0.05 = 5%). */
export interface ScenarioDrivers {
  /** Year-over-year revenue growth (applied Y2, Y3). e.g. 0.10 = +10%/yr. */
  revenueGrowthPct: number;
  /** COGS as a fraction of revenue. e.g. 0.55 = 55% of revenue. */
  cogsPct: number;
  /** Operating expenses (OPEX) as a fraction of revenue. */
  opexPct: number;
  /** Depreciation & amortization as a fraction of revenue. */
  daPct: number;
  /** Interest expense as a fraction of revenue. */
  interestPct: number;
  /** Effective tax rate applied to positive EBT. e.g. 0.19 = 19%. */
  taxRatePct: number;
}

export interface ThreeScenarioPnLParams {
  /** Company name (banner + title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** First projected year (Y1). e.g. 2026. */
  startYear?: number;
  /** Base-year (Y1) revenue in the model currency. */
  baseRevenue?: number;
  /** Base scenario drivers. */
  base?: Partial<ScenarioDrivers>;
  /** Bull (upside) scenario drivers. */
  bull?: Partial<ScenarioDrivers>;
  /** Bear (downside) scenario drivers. */
  bear?: Partial<ScenarioDrivers>;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

// Exported so the template registry (templates/index.ts) can derive its FE-facing
// parameter descriptors (label/type/default/min-max) from the SAME source of truth
// the builder uses — no drift between the form defaults and the model defaults.
export const DEFAULT_BASE: ScenarioDrivers = {
  revenueGrowthPct: 0.08,
  cogsPct: 0.55,
  opexPct: 0.22,
  daPct: 0.05,
  interestPct: 0.02,
  taxRatePct: 0.19,
};

export const DEFAULT_BULL: ScenarioDrivers = {
  revenueGrowthPct: 0.18,
  cogsPct: 0.5,
  opexPct: 0.2,
  daPct: 0.05,
  interestPct: 0.015,
  taxRatePct: 0.19,
};

export const DEFAULT_BEAR: ScenarioDrivers = {
  revenueGrowthPct: 0.0,
  cogsPct: 0.62,
  opexPct: 0.26,
  daPct: 0.05,
  interestPct: 0.03,
  taxRatePct: 0.19,
};

/** Non-scenario defaults, also surfaced as parameter descriptors. */
export const THREE_SCENARIO_GENERAL_DEFAULTS = {
  companyName: 'Spółka',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  baseRevenue: 1_000_000,
} as const;

/** Clamp a fraction to a sane bound; fall back to `fallback` when not finite. */
function safeFraction(v: number | undefined, fallback: number, min = -1, max = 5): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function resolveDrivers(
  partial: Partial<ScenarioDrivers> | undefined,
  defaults: ScenarioDrivers
): ScenarioDrivers {
  const p = partial ?? {};
  return {
    revenueGrowthPct: safeFraction(p.revenueGrowthPct, defaults.revenueGrowthPct),
    cogsPct: safeFraction(p.cogsPct, defaults.cogsPct, 0, 1),
    opexPct: safeFraction(p.opexPct, defaults.opexPct, 0, 1),
    daPct: safeFraction(p.daPct, defaults.daPct, 0, 1),
    interestPct: safeFraction(p.interestPct, defaults.interestPct, 0, 1),
    taxRatePct: safeFraction(p.taxRatePct, defaults.taxRatePct, 0, 1),
  };
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

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns:  A = Driver (text) | B = Base | C = Bull | D = Bear
// Rows (Excel row = data-index + 2, header is row 1):
//   2  Revenue (base year)   ← currency
//   3  Revenue growth %/yr   ← percent
//   4  COGS % of revenue     ← percent
//   5  OPEX % of revenue     ← percent
//   6  D&A % of revenue      ← percent
//   7  Interest % of revenue ← percent
//   8  Tax rate %            ← percent
// ---------------------------------------------------------------------------

const A_COL = { base: 'B', bull: 'C', bear: 'D' } as const;
type ScenKey = keyof typeof A_COL;
const SCEN_ORDER: ScenKey[] = ['base', 'bull', 'bear'];
const SCEN_LABEL: Record<ScenKey, string> = { base: 'Base', bull: 'Bull', bear: 'Bear' };

/** Excel rows of each assumption driver on the Założenia sheet. */
const AR = {
  revenue: 2,
  growth: 3,
  cogs: 4,
  opex: 5,
  da: 6,
  interest: 7,
  tax: 8,
} as const;

const ASSUMPTIONS_SHEET = 'Założenia';

/** Absolute cross-sheet reference to an assumption cell, e.g. 'Założenia'!$B$3. */
function aRef(scen: ScenKey, row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$${A_COL[scen]}$${row}`;
}

// ---------------------------------------------------------------------------
// Assumptions sheet builder
// ---------------------------------------------------------------------------

function buildAssumptionsSheet(
  baseRevenue: number,
  base: ScenarioDrivers,
  bull: ScenarioDrivers,
  bear: ScenarioDrivers,
  currencyLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 30 },
    { key: 'base', header: 'Base', type: 'number' },
    { key: 'bull', header: 'Bull', type: 'number' },
    { key: 'bear', header: 'Bear', type: 'number' },
  ];

  // Input-cell chrome: a light fill + thin border so a reviewer instantly sees
  // "these are the cells I edit". Percent rows carry a % number format.
  const inputFill = 'FFF6DF'; // soft amber — classic "input" convention
  const pctFmt = '0.0%';
  const curFmt =
    currencyLabel === 'PLN' ? '# ##0" zł"' : currencyLabel === 'EUR' ? '€#,##0' : '$#,##0';

  const percentValidation: DataValidation = {
    type: 'decimal',
    operator: 'between',
    min: -1,
    max: 5,
    allowBlank: false,
    promptTitle: 'Wartość ułamkowa',
    prompt: 'Podaj ułamek, np. 0,08 = 8%.',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: -1 do 5 (tj. -100% do +500%).',
  };
  const revenueValidation: DataValidation = {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    min: 0,
    allowBlank: false,
    promptTitle: 'Przychód roku bazowego',
    prompt: 'Dodatnia liczba w walucie modelu.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Przychód musi być liczbą ≥ 0.',
  };

  const inputCell = (value: number, fmt: string, validation: DataValidation): Cell => ({
    value,
    style: { bgColor: inputFill, border: 'thin', numberFormat: fmt },
    validation,
  });

  const rows: Row[] = [
    {
      cells: {
        driver: { value: 'Przychód roku bazowego', style: { bold: true } },
        base: inputCell(baseRevenue, curFmt, revenueValidation),
        bull: inputCell(baseRevenue, curFmt, revenueValidation),
        bear: inputCell(baseRevenue, curFmt, revenueValidation),
      },
    },
    {
      cells: {
        driver: { value: 'Wzrost przychodów %/rok' },
        base: inputCell(base.revenueGrowthPct, pctFmt, percentValidation),
        bull: inputCell(bull.revenueGrowthPct, pctFmt, percentValidation),
        bear: inputCell(bear.revenueGrowthPct, pctFmt, percentValidation),
      },
    },
    {
      cells: {
        driver: { value: 'COGS % przychodów' },
        base: inputCell(base.cogsPct, pctFmt, percentValidation),
        bull: inputCell(bull.cogsPct, pctFmt, percentValidation),
        bear: inputCell(bear.cogsPct, pctFmt, percentValidation),
      },
    },
    {
      cells: {
        driver: { value: 'OPEX % przychodów' },
        base: inputCell(base.opexPct, pctFmt, percentValidation),
        bull: inputCell(bull.opexPct, pctFmt, percentValidation),
        bear: inputCell(bear.opexPct, pctFmt, percentValidation),
      },
    },
    {
      cells: {
        driver: { value: 'Amortyzacja (D&A) % przychodów' },
        base: inputCell(base.daPct, pctFmt, percentValidation),
        bull: inputCell(bull.daPct, pctFmt, percentValidation),
        bear: inputCell(bear.daPct, pctFmt, percentValidation),
      },
    },
    {
      cells: {
        driver: { value: 'Odsetki % przychodów' },
        base: inputCell(base.interestPct, pctFmt, percentValidation),
        bull: inputCell(bull.interestPct, pctFmt, percentValidation),
        bear: inputCell(bear.interestPct, pctFmt, percentValidation),
      },
    },
    {
      cells: {
        driver: { value: 'Stopa podatkowa %' },
        base: inputCell(base.taxRatePct, pctFmt, percentValidation),
        bull: inputCell(bull.taxRatePct, pctFmt, percentValidation),
        bear: inputCell(bear.taxRatePct, pctFmt, percentValidation),
      },
    },
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia modelu (edytowalne) — 3 scenariusze.',
    columns,
    rows,
    freezeRow: 1,
    // P3 — emit workbook-level named ranges for each input row (Base column) so
    // formulas may reference friendly names; cross-sheet A1 refs stay valid too.
    isAssumptions: true,
    nameKeyColumn: 'driver',
    nameValueColumn: 'base',
    tabColor: 'F59E0B',
  };
}

// ---------------------------------------------------------------------------
// P&L sheet builder
//
// Columns: A = Pozycja (text) | per scenario 3 year-columns.
//   Base: B(Y1) C(Y2) D(Y3) | Bull: E F G | Bear: H I J
// Rows (Excel row = index + 2):
//   2  Przychody          (Revenue)
//   3  COGS
//   4  Zysk brutto        (Gross profit)   [summary]
//   5  OPEX
//   6  EBITDA                              [summary]
//   7  Amortyzacja (D&A)
//   8  EBIT                                [summary]
//   9  Odsetki            (Interest)
//   10 EBT                                 [summary]
//   11 Podatek            (Tax)
//   12 Zysk netto         (Net income)     [summary]
//   13 Marża netto %      (Net margin)
// ---------------------------------------------------------------------------

/** P&L line rows in the exact vertical order (Excel row = index + 2). */
const PL = {
  revenue: 2,
  cogs: 3,
  gross: 4,
  opex: 5,
  ebitda: 6,
  da: 7,
  ebit: 8,
  interest: 9,
  ebt: 10,
  tax: 11,
  net: 12,
  margin: 13,
} as const;

/** Column letters for each scenario's 3 years. */
const PL_COLS: Record<ScenKey, [string, string, string]> = {
  base: ['B', 'C', 'D'],
  bull: ['E', 'F', 'G'],
  bear: ['H', 'I', 'J'],
};

/** Which scenario a P&L column letter belongs to (for driver refs). */
function scenFromCol(col: string): ScenKey {
  for (const scen of SCEN_ORDER) {
    if (PL_COLS[scen].includes(col)) return scen;
  }
  return 'base';
}

function buildPnLSheet(startYear: number, currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const yearLabels = [startYear, startYear + 1, startYear + 2];

  const columns: ColumnDef[] = [{ key: 'pozycja', header: 'Pozycja', type: 'text', width: 32 }];
  for (const scen of SCEN_ORDER) {
    yearLabels.forEach((yr, yi) => {
      columns.push({
        key: `${scen}_y${yi + 1}`,
        header: `${SCEN_LABEL[scen]} ${yr}`,
        // Every value column carries currency lines except the single margin row
        // (which overrides its own cells with a % format). `type: 'number'` keeps
        // the column semantically neutral so the quality gate's currency/percent
        // format checks (WQ-04/WQ-05) never fire on a legitimately mixed column.
        type: 'number',
      });
    });
  }

  const colKey = (scen: ScenKey, yearIdx: number): string => `${scen}_y${yearIdx + 1}`;
  const currencyFmt = currencyNumFmt(currencyHint);

  // ---- formula factories (all WITHOUT leading '=') ----

  // Revenue: Y1 references Assumptions base-revenue; Y2/Y3 chain off prior year.
  const revenueFormula = (scen: ScenKey, yearIdx: number): string => {
    if (yearIdx === 0) return aRef(scen, AR.revenue);
    const prevCol = PL_COLS[scen][yearIdx - 1];
    return `${prevCol}${PL.revenue}*(1+${aRef(scen, AR.growth)})`;
  };

  // A cost line = Revenue(this col) * driver%.
  const costOfRevenue = (col: string, driverRow: number): string =>
    `${col}${PL.revenue}*${aRef(scenFromCol(col), driverRow)}`;

  // Build a row given a label, a per-(scen,year) formula factory, and flags.
  function fRow(
    label: string,
    formulaFor: (scen: ScenKey, yearIdx: number) => string,
    opts: { summary?: boolean; marginPct?: boolean } = {}
  ): Row {
    const cells: Record<string, Cell> = {
      pozycja: { value: label, style: opts.summary ? { bold: true } : undefined },
    };
    for (const scen of SCEN_ORDER) {
      for (let yi = 0; yi < 3; yi++) {
        const numberFormat = opts.marginPct ? '0.0%' : currencyFmt;
        const style = opts.summary ? { numberFormat, bold: true } : { numberFormat };
        cells[colKey(scen, yi)] = { formula: formulaFor(scen, yi), style };
      }
    }
    return { cells, isSummary: opts.summary };
  }

  const rows: Row[] = [
    // Row 2 — Przychody (Revenue)
    fRow('Przychody', (scen, yi) => revenueFormula(scen, yi)),
    // Row 3 — COGS
    fRow('COGS', (scen, yi) => costOfRevenue(PL_COLS[scen][yi], AR.cogs)),
    // Row 4 — Zysk brutto = Revenue - COGS
    fRow(
      'Zysk brutto',
      (scen, yi) => {
        const c = PL_COLS[scen][yi];
        return `${c}${PL.revenue}-${c}${PL.cogs}`;
      },
      { summary: true }
    ),
    // Row 5 — OPEX
    fRow('OPEX', (scen, yi) => costOfRevenue(PL_COLS[scen][yi], AR.opex)),
    // Row 6 — EBITDA = Gross - OPEX
    fRow(
      'EBITDA',
      (scen, yi) => {
        const c = PL_COLS[scen][yi];
        return `${c}${PL.gross}-${c}${PL.opex}`;
      },
      { summary: true }
    ),
    // Row 7 — Amortyzacja (D&A)
    fRow('Amortyzacja (D&A)', (scen, yi) => costOfRevenue(PL_COLS[scen][yi], AR.da)),
    // Row 8 — EBIT = EBITDA - D&A
    fRow(
      'EBIT',
      (scen, yi) => {
        const c = PL_COLS[scen][yi];
        return `${c}${PL.ebitda}-${c}${PL.da}`;
      },
      { summary: true }
    ),
    // Row 9 — Odsetki (Interest)
    fRow('Odsetki', (scen, yi) => costOfRevenue(PL_COLS[scen][yi], AR.interest)),
    // Row 10 — EBT = EBIT - Interest
    fRow(
      'EBT (zysk przed opodatkowaniem)',
      (scen, yi) => {
        const c = PL_COLS[scen][yi];
        return `${c}${PL.ebit}-${c}${PL.interest}`;
      },
      { summary: true }
    ),
    // Row 11 — Podatek = MAX(0, EBT) * taxRate
    fRow('Podatek', (scen, yi) => {
      const c = PL_COLS[scen][yi];
      return `MAX(0,${c}${PL.ebt})*${aRef(scen, AR.tax)}`;
    }),
    // Row 12 — Zysk netto = EBT - Tax
    fRow(
      'Zysk netto',
      (scen, yi) => {
        const c = PL_COLS[scen][yi];
        return `${c}${PL.ebt}-${c}${PL.tax}`;
      },
      { summary: true }
    ),
    // Row 13 — Marża netto % = Net / Revenue
    fRow(
      'Marża netto %',
      (scen, yi) => {
        const c = PL_COLS[scen][yi];
        return `${c}${PL.net}/${c}${PL.revenue}`;
      },
      { marginPct: true }
    ),
  ];

  return {
    name: 'P&L',
    purpose: 'Rachunek wyników 3-letni × 3 scenariusze (każda pozycja = formuła).',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Comparison sheet builder ("Porównanie")
//
// Pulls Revenue / EBITDA / Net income for the 3 scenarios (Year 3), each as a
// cross-sheet formula off the P&L sheet — no constants. A color-scale highlights
// best↔worst across the 3 scenario columns.
//
// Columns: A = Metryka (text) | B = Base | C = Bull | D = Bear
// Rows (Excel row = idx + 2):
//   2  Przychody (Y3)
//   3  EBITDA (Y3)
//   4  Zysk netto (Y3)
// ---------------------------------------------------------------------------

function buildComparisonSheet(startYear: number, currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const y3 = startYear + 2;
  const columns: ColumnDef[] = [
    { key: 'metryka', header: 'Metryka', type: 'text', width: 26 },
    { key: 'base', header: 'Base', type: 'number' },
    { key: 'bull', header: 'Bull', type: 'number' },
    { key: 'bear', header: 'Bear', type: 'number' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);

  // The P&L Year-3 column letter for each scenario (3rd year = index 2).
  const y3Col: Record<ScenKey, string> = {
    base: PL_COLS.base[2],
    bull: PL_COLS.bull[2],
    bear: PL_COLS.bear[2],
  };

  const metricRow = (label: string, plRow: number): Row => {
    const cells: Record<string, Cell> = {
      metryka: { value: label, style: { bold: true } },
    };
    for (const scen of SCEN_ORDER) {
      cells[scen] = {
        formula: `'P&L'!${y3Col[scen]}${plRow}`,
        style: { numberFormat: currencyFmt },
      };
    }
    return { cells };
  };

  const rows: Row[] = [
    metricRow(`Przychody (${y3})`, PL.revenue),
    metricRow(`EBITDA (${y3})`, PL.ebitda),
    metricRow(`Zysk netto (${y3})`, PL.net),
  ];

  // Color-scale across the 3 scenario columns (B..D) over the 3 metric rows.
  const conditionalFormatting: ConditionalFormattingBlock[] = [
    {
      ref: 'B2:D4',
      rules: [{ type: 'colorScale', colors: ['FCE4E4', 'FFF3CD', 'E4F4EC'] }],
    },
  ];

  return {
    name: 'Porównanie',
    purpose: 'Porównanie scenariuszy (rok 3): Przychody / EBITDA / Zysk netto.',
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

export function buildThreeScenarioPnLSchema(params: ThreeScenarioPnLParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';
  const startYear =
    Number.isFinite(params.startYear) && (params.startYear as number) > 0
      ? Math.floor(params.startYear as number)
      : new Date().getFullYear();
  const baseRevenue =
    Number.isFinite(params.baseRevenue) && (params.baseRevenue as number) >= 0
      ? (params.baseRevenue as number)
      : 1_000_000;

  const base = resolveDrivers(params.base, DEFAULT_BASE);
  const bull = resolveDrivers(params.bull, DEFAULT_BULL);
  const bear = resolveDrivers(params.bear, DEFAULT_BEAR);

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(baseRevenue, base, bull, bear, label),
    buildPnLSheet(startYear, hint),
    buildComparisonSheet(startYear, hint),
  ];

  return {
    title: `${companyName} — Model P&L (3 scenariusze × 3 lata)`,
    description:
      'Parametryczny rachunek wyników: Base / Bull / Bear, lata ' +
      `${startYear}–${startYear + 2}. Każda pozycja P&L to formuła; wejścia na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'threeScenarioPnL',
      companyName,
      currency: label,
      startYear,
      baseRevenue,
    },
  };
}

export default buildThreeScenarioPnLSchema;
