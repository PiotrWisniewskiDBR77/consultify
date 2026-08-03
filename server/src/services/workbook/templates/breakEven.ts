/**
 * breakEven — parametric builder for a break-even (BEP) analysis.
 *
 * FOURTH registered template in the model-template library (after
 * threeScenarioPnL, operatingBudget, dcfValuation). Same reliability thesis:
 * the LLM/caller parametrizes a PROVEN template — unit contribution margin,
 * break-even volume/revenue, margin of safety, and a volume-sensitivity table
 * are all real Excel formulas, no magic-numbers, inputs live only on the
 * Assumptions sheet.
 *
 * The math:
 *   Contribution margin (per unit):  Price - VariableCostPerUnit
 *   BEP volume (units):               FixedCosts / ContributionMargin
 *   BEP revenue:                      BEP volume * Price
 *   Margin of safety (units):         PlannedVolume - BEP volume
 *   Margin of safety (%):             Margin of safety (units) / PlannedVolume
 *   Sensitivity row (volume level L): Volume = BEPvolume * L
 *                                      Revenue = Volume * Price
 *                                      Variable costs = Volume * VariableCostPerUnit
 *                                      Total costs = Variable costs + FixedCosts
 *                                      Result = Revenue - Total costs
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

export interface BreakEvenParams {
  /** Company name (banner + title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Selling price per unit. */
  unitPrice?: number;
  /** Variable cost per unit (materials, direct labor, etc.). */
  variableCostPerUnit?: number;
  /** Total fixed costs for the period (rent, salaries, overhead). */
  fixedCosts?: number;
  /** Planned/expected sales volume (units) — anchors the margin-of-safety calc. */
  plannedVolume?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

// Exported so the template registry can derive its FE-facing parameter
// descriptors from the SAME source of truth the builder uses.
export const BREAK_EVEN_GENERAL_DEFAULTS = {
  companyName: 'Spółka',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  unitPrice: 120,
} as const;

export const BREAK_EVEN_DRIVER_DEFAULTS: Required<
  Pick<BreakEvenParams, 'variableCostPerUnit' | 'fixedCosts' | 'plannedVolume'>
> = {
  variableCostPerUnit: 70,
  fixedCosts: 250_000,
  plannedVolume: 8_000,
};

/** Clamp a non-negative amount; fall back to `fallback` when invalid/negative. */
function safeAmount(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || !Number.isFinite(v) || v < 0) return fallback;
  return v;
}

/** Clamp a strictly-positive amount (a price must divide safely). */
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

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns: A = Driver (text) | B = Wartość (number)
// Rows (Excel row = data-index + 2, header is row 1):
//   2  Cena jednostkowa                    ← currency
//   3  Koszt zmienny na sztukę              ← currency
//   4  Koszty stałe                         ← currency
//   5  Planowany wolumen sprzedaży (szt.)   ← integer
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

const AR = {
  price: 2,
  varCost: 3,
  fixedCosts: 4,
  plannedVolume: 5,
} as const;

/** Absolute reference to an assumption cell in column B, e.g. 'Założenia'!$B$3. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$B$${row}`;
}

function buildAssumptionsSheet(
  unitPrice: number,
  variableCostPerUnit: number,
  fixedCosts: number,
  plannedVolume: number,
  currencyLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 34 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];

  const inputFill = 'FFF6DF'; // soft amber — classic "input" convention
  const curFmt =
    currencyLabel === 'PLN' ? '# ##0" zł"' : currencyLabel === 'EUR' ? '€#,##0' : '$#,##0';

  const priceValidation: DataValidation = {
    type: 'decimal',
    operator: 'greaterThan',
    min: 0,
    allowBlank: false,
    promptTitle: 'Cena',
    prompt: 'Dodatnia cena jednostkowa.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Cena musi być liczbą > 0.',
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
  const volumeValidation: DataValidation = {
    type: 'whole',
    operator: 'greaterThanOrEqual',
    min: 0,
    allowBlank: false,
    promptTitle: 'Wolumen',
    prompt: 'Liczba sztuk ≥ 0.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Wolumen musi być liczbą całkowitą ≥ 0.',
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
    row('Cena jednostkowa', unitPrice, curFmt, priceValidation),
    row('Koszt zmienny na sztukę', variableCostPerUnit, curFmt, amountValidation),
    row('Koszty stałe', fixedCosts, curFmt, amountValidation),
    row('Planowany wolumen sprzedaży (szt.)', plannedVolume, '# ##0', volumeValidation),
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia analizy progu rentowności (edytowalne).',
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
// "Próg rentowności" sheet — BEP volume/revenue + margin of safety.
//
// Columns: A = Metryka (text) | B = Wartość (number)
// Rows (Excel row = index + 2):
//   2  Marża jednostkowa (kontrybucja)
//   3  Wolumen progu rentowności (BEP, szt.)   [summary]
//   4  Przychód progu rentowności (BEP)        [summary]
//   5  Planowany wolumen sprzedaży (szt.)
//   6  Margines bezpieczeństwa (szt.)
//   7  Margines bezpieczeństwa (%)
// ---------------------------------------------------------------------------

const BEP_SHEET = 'Próg rentowności';
const BEP = {
  margin: 2,
  volume: 3,
  revenue: 4,
  plannedVolume: 5,
  safetyUnits: 6,
  safetyPct: 7,
} as const;

function buildBepSheet(currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'metryka', header: 'Metryka', type: 'text', width: 36 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);

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
    metricRow('Marża jednostkowa (kontrybucja)', `${aRef(AR.price)}-${aRef(AR.varCost)}`),
    metricRow('Wolumen progu rentowności (BEP, szt.)', `${aRef(AR.fixedCosts)}/B${BEP.margin}`, {
      summary: true,
      numberFormat: '# ##0',
    }),
    metricRow('Przychód progu rentowności (BEP)', `B${BEP.volume}*${aRef(AR.price)}`, {
      summary: true,
    }),
    metricRow('Planowany wolumen sprzedaży (szt.)', aRef(AR.plannedVolume), {
      numberFormat: '# ##0',
    }),
    metricRow('Margines bezpieczeństwa (szt.)', `B${BEP.plannedVolume}-B${BEP.volume}`, {
      numberFormat: '# ##0',
    }),
    metricRow('Margines bezpieczeństwa (%)', `B${BEP.safetyUnits}/B${BEP.plannedVolume}`, {
      numberFormat: '0.0%',
    }),
  ];

  return {
    name: BEP_SHEET,
    purpose:
      'Próg rentowności (BEP): wolumen, przychód i margines bezpieczeństwa — każda pozycja = formuła.',
    columns,
    rows,
    freezeRow: 1,
    tabColor: '1D9E75',
  };
}

// ---------------------------------------------------------------------------
// "Analiza wrażliwości" sheet — result at several volume levels relative to BEP.
//
// Columns: A = Poziom (text) | B = Wolumen | C = Przychód | D = Koszty zmienne |
//          E = Koszty razem | F = Wynik
// Rows: one per volume level (multiplier of the BEP volume).
// ---------------------------------------------------------------------------

const SENSITIVITY_SHEET = 'Analiza wrażliwości';
const SENSITIVITY_LEVELS: Array<{ label: string; mult: number }> = [
  { label: '50% BEP', mult: 0.5 },
  { label: '75% BEP', mult: 0.75 },
  { label: '100% BEP (próg rentowności)', mult: 1 },
  { label: '125% BEP', mult: 1.25 },
  { label: '150% BEP', mult: 1.5 },
  { label: '200% BEP', mult: 2 },
];

function buildSensitivitySheet(currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'poziom', header: 'Poziom', type: 'text', width: 30 },
    { key: 'wolumen', header: 'Wolumen (szt.)', type: 'number' },
    { key: 'przychod', header: 'Przychód', type: 'currency' },
    { key: 'kosztyZmienne', header: 'Koszty zmienne', type: 'currency' },
    { key: 'kosztyRazem', header: 'Koszty razem', type: 'currency' },
    { key: 'wynik', header: 'Wynik', type: 'currency' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);

  const rows: Row[] = SENSITIVITY_LEVELS.map((level, idx) => {
    const excelRow = idx + 2;
    const cells: Record<string, Cell> = {
      poziom: { value: level.label },
      wolumen: {
        formula: `'${BEP_SHEET}'!$B$${BEP.volume}*${level.mult}`,
        style: { numberFormat: '# ##0' },
      },
      przychod: { formula: `B${excelRow}*${aRef(AR.price)}`, style: { numberFormat: currencyFmt } },
      kosztyZmienne: {
        formula: `B${excelRow}*${aRef(AR.varCost)}`,
        style: { numberFormat: currencyFmt },
      },
      kosztyRazem: {
        formula: `D${excelRow}+${aRef(AR.fixedCosts)}`,
        style: { numberFormat: currencyFmt },
      },
      wynik: { formula: `C${excelRow}-E${excelRow}`, style: { numberFormat: currencyFmt } },
    };
    return { cells };
  });

  return {
    name: SENSITIVITY_SHEET,
    purpose: 'Wynik przy różnych poziomach wolumenu (% BEP) — każda pozycja = formuła.',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildBreakEvenSchema(params: BreakEvenParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';

  const unitPrice = safePositive(params.unitPrice, BREAK_EVEN_GENERAL_DEFAULTS.unitPrice);
  let variableCostPerUnit = safeAmount(
    params.variableCostPerUnit,
    BREAK_EVEN_DRIVER_DEFAULTS.variableCostPerUnit
  );
  // Defensive: contribution margin (price - variable cost) must be strictly
  // positive, else BEP volume = fixed / margin divides by ≤0. If the caller
  // passed a variable cost ≥ price, nudge it below price so the default
  // model never ships a #DIV/0!/negative-BEP schema. (A user can still edit
  // the assumption cells afterwards — that is a normal spreadsheet risk, not
  // a schema defect — same convention as dcfValuation's WACC/g nudge.)
  if (variableCostPerUnit >= unitPrice) {
    variableCostPerUnit = unitPrice * 0.5;
  }
  const fixedCosts = safeAmount(params.fixedCosts, BREAK_EVEN_DRIVER_DEFAULTS.fixedCosts);
  const plannedVolume = Math.round(
    safeAmount(params.plannedVolume, BREAK_EVEN_DRIVER_DEFAULTS.plannedVolume)
  );

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(unitPrice, variableCostPerUnit, fixedCosts, plannedVolume, label),
    buildBepSheet(hint),
    buildSensitivitySheet(hint),
  ];

  return {
    title: `${companyName} — Analiza progu rentowności`,
    description:
      'Parametryczna analiza progu rentowności (BEP): marża jednostkowa, wolumen i przychód BEP, ' +
      `margines bezpieczeństwa, tabela wrażliwości wyniku. Każda pozycja to formuła; wejścia na ` +
      `arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'breakEven',
      companyName,
      currency: label,
      unitPrice,
      variableCostPerUnit,
      fixedCosts,
      plannedVolume,
    },
  };
}

export default buildBreakEvenSchema;
