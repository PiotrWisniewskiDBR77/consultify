/**
 * unitEconomics — parametric builder for a classic SaaS/e-commerce Unit
 * Economics model.
 *
 * Follows the same reliability thesis as `threeScenarioPnL`: the LLM
 * parametrizes a PROVEN template instead of inventing a unit-economics model
 * from scratch. The output is a complete, correct `WorkbookSchema` — every
 * metric on the "Unit Economics" sheet is a real Excel formula referencing
 * the "Założenia" (Assumptions) sheet, never a magic-number.
 *
 * The math (single customer/unit, monthly cadence):
 *   Marża brutto / jednostkę = ARPU - koszt zmienny na jednostkę
 *   Marża brutto miesięczna  = ARPU - koszt zmienny - koszt utrzymania
 *   Contribution margin %    = (ARPU - koszt zmienny) / ARPU
 *   Lifetime (mies.)         = IF(churn>0, 1/churn, 0)   (avoids div/0)
 *   LTV                      = Marża brutto miesięczna * Lifetime
 *   LTV / CAC                = LTV / CAC
 *   Okres zwrotu CAC (mies.) = IF(Marża brutto miesięczna>0, CAC / Marża brutto miesięczna, 0)
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

export interface UnitEconomicsParams {
  /** Company / product name (title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Average Revenue Per Account/User, per month (ARPU). */
  arpu?: number;
  /** Variable cost per unit/customer, per month. */
  kosztZmienny?: number;
  /** Customer Acquisition Cost (one-off, per new customer). */
  cac?: number;
  /** Monthly churn rate, as a FRACTION (0.05 = 5%/month). */
  churnMiesieczny?: number;
  /** Monthly cost to serve/retain a customer (e.g. support, hosting). */
  kosztUtrzymania?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

const DEFAULTS: Required<UnitEconomicsParams> = {
  companyName: 'Spółka',
  currencyCode: 'PLN',
  arpu: 250,
  kosztZmienny: 60,
  cac: 900,
  churnMiesieczny: 0.03,
  kosztUtrzymania: 20,
};

/** Clamp a finite number to a sane bound; fall back when not finite. */
function safeNumber(v: number | undefined, fallback: number, min = 0, max = 1_000_000_000): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Clamp a fraction (e.g. churn) to [0, 1]. */
function safeFraction(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
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

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns:  A = Driver (text) | B = Wartość
// Rows (Excel row = data-index + 2, header is row 1):
//   2  ARPU (przychód / jednostkę / mies.)   ← currency
//   3  Koszt zmienny / jednostkę / mies.     ← currency
//   4  CAC (koszt pozyskania klienta)        ← currency
//   5  Miesięczny churn %                    ← percent
//   6  Koszt utrzymania klienta / mies.      ← currency
// ---------------------------------------------------------------------------

const AR = {
  arpu: 2,
  kosztZmienny: 3,
  cac: 4,
  churn: 5,
  kosztUtrzymania: 6,
} as const;

const ASSUMPTIONS_SHEET = 'Założenia';
const A_COL = 'B';

/** Absolute reference to an assumption cell, e.g. 'Założenia'!$B$2. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$${A_COL}$${row}`;
}

// ---------------------------------------------------------------------------
// Assumptions sheet builder
// ---------------------------------------------------------------------------

function buildAssumptionsSheet(
  arpu: number,
  kosztZmienny: number,
  cac: number,
  churn: number,
  kosztUtrzymania: number,
  currencyLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 34 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];

  const inputFill = 'FFF2CC'; // per task spec — input-cell chrome
  const pctFmt = '0.0%';
  const curFmt = currencyInputFmt(currencyLabel);

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

  const percentValidation: DataValidation = {
    type: 'decimal',
    operator: 'between',
    min: 0,
    max: 1,
    allowBlank: false,
    promptTitle: 'Wartość ułamkowa',
    prompt: 'Podaj ułamek, np. 0,03 = 3%.',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: 0 do 1 (tj. 0% do 100%).',
  };

  const inputCell = (value: number, fmt: string, validation: DataValidation): Cell => ({
    value,
    style: { bgColor: inputFill, border: 'thin', numberFormat: fmt },
    validation,
  });

  const rows: Row[] = [
    {
      cells: {
        driver: { value: 'ARPU (przychód / jednostkę / mies.)', style: { bold: true } },
        wartosc: inputCell(
          arpu,
          curFmt,
          nonNegativeValidation('ARPU', 'Średni przychód na jednostkę/klienta miesięcznie.')
        ),
      },
    },
    {
      cells: {
        driver: { value: 'Koszt zmienny / jednostkę / mies.' },
        wartosc: inputCell(
          kosztZmienny,
          curFmt,
          nonNegativeValidation('Koszt zmienny', 'Bezpośredni koszt zmienny na jednostkę miesięcznie.')
        ),
      },
    },
    {
      cells: {
        driver: { value: 'CAC (koszt pozyskania klienta)' },
        wartosc: inputCell(
          cac,
          curFmt,
          nonNegativeValidation('CAC', 'Jednorazowy koszt pozyskania jednego klienta.')
        ),
      },
    },
    {
      cells: {
        driver: { value: 'Miesięczny churn %' },
        wartosc: inputCell(churn, pctFmt, percentValidation),
      },
    },
    {
      cells: {
        driver: { value: 'Koszt utrzymania klienta / mies.' },
        wartosc: inputCell(
          kosztUtrzymania,
          curFmt,
          nonNegativeValidation('Koszt utrzymania', 'Miesięczny koszt obsługi/utrzymania klienta (np. support, hosting).')
        ),
      },
    },
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia modelu jednostkowej ekonomiki (edytowalne).',
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
// Unit Economics sheet builder
//
// Columns: A = Pozycja (text) | B = Wartość | C = Jednostka (text)
// Rows (Excel row = index + 2):
//   2  Marża brutto / jednostkę            [currency]
//   3  Marża brutto miesięczna             [currency]
//   4  Contribution margin %               [percent]
//   5  Żywotność klienta (lifetime, mies.) [number]           [summary]
//   6  LTV                                 [currency]          [summary]
//   7  LTV / CAC                           [number, ratio]     [summary]
//   8  Okres zwrotu CAC (mies.)            [number]            [summary]
// ---------------------------------------------------------------------------

const UE = {
  grossMarginUnit: 2,
  grossMarginMonthly: 3,
  contributionMarginPct: 4,
  lifetime: 5,
  ltv: 6,
  ltvCac: 7,
  paybackMonths: 8,
} as const;

function buildUnitEconomicsSheet(currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'pozycja', header: 'Pozycja', type: 'text', width: 34 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
    { key: 'jednostka', header: 'Jednostka', type: 'text', width: 16 },
  ];

  const currencyFmt = currencyNumFmt(currencyHint);
  const pctFmt = '0.0%';
  const numFmt = '0.00';
  const monthsFmt = '0.0';

  function mRow(
    label: string,
    formula: string,
    unit: string,
    numberFormat: string,
    opts: { summary?: boolean } = {}
  ): Row {
    const style = opts.summary ? { numberFormat, bold: true } : { numberFormat };
    return {
      cells: {
        pozycja: { value: label, style: opts.summary ? { bold: true } : undefined },
        wartosc: { formula, style },
        jednostka: { value: unit },
      },
      isSummary: opts.summary,
    };
  }

  // Marża brutto / jednostkę = ARPU - koszt zmienny
  const grossMarginUnitFormula = `${aRef(AR.arpu)}-${aRef(AR.kosztZmienny)}`;
  // Marża brutto miesięczna = ARPU - koszt zmienny - koszt utrzymania
  const grossMarginMonthlyFormula = `${aRef(AR.arpu)}-${aRef(AR.kosztZmienny)}-${aRef(AR.kosztUtrzymania)}`;
  // Contribution margin % = (ARPU - koszt zmienny) / ARPU
  const contributionMarginFormula = `(${aRef(AR.arpu)}-${aRef(AR.kosztZmienny)})/${aRef(AR.arpu)}`;
  // Lifetime (mies.) = IF(churn>0, 1/churn, 0) — avoids div/0
  const lifetimeFormula = `IF(${aRef(AR.churn)}>0,1/${aRef(AR.churn)},0)`;
  // LTV = Marża brutto miesięczna * Lifetime
  const ltvFormula = `B${UE.grossMarginMonthly}*B${UE.lifetime}`;
  // LTV / CAC = LTV / CAC
  const ltvCacFormula = `B${UE.ltv}/${aRef(AR.cac)}`;
  // Okres zwrotu CAC (mies.) = IF(marża miesięczna>0, CAC / marża miesięczna, 0)
  const paybackFormula = `IF(B${UE.grossMarginMonthly}>0,${aRef(AR.cac)}/B${UE.grossMarginMonthly},0)`;

  const rows: Row[] = [
    mRow('Marża brutto / jednostkę', grossMarginUnitFormula, 'waluta/jednostkę', currencyFmt),
    mRow('Marża brutto miesięczna', grossMarginMonthlyFormula, 'waluta/mies.', currencyFmt),
    mRow('Contribution margin %', contributionMarginFormula, '%', pctFmt),
    mRow('Żywotność klienta (lifetime)', lifetimeFormula, 'mies.', monthsFmt, { summary: true }),
    mRow('LTV (wartość życiowa klienta)', ltvFormula, 'waluta', currencyFmt, { summary: true }),
    mRow('LTV / CAC', ltvCacFormula, 'x', numFmt, { summary: true }),
    mRow('Okres zwrotu CAC (payback)', paybackFormula, 'mies.', monthsFmt, { summary: true }),
  ];

  // Color-scale on the LTV/CAC cell's column band: healthy (≥3) green, weak red.
  // Simple cellIs-based signal over the single ratio cell.
  const conditionalFormatting: ConditionalFormattingBlock[] = [
    {
      ref: `B${UE.ltvCac}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThanOrEqual',
          formulae: ['3'],
          style: { bgColor: 'E4F4EC', bold: true },
        },
        {
          type: 'cellIs',
          operator: 'lessThan',
          formulae: ['1'],
          style: { bgColor: 'FCE4E4', bold: true },
        },
      ],
    },
  ];

  return {
    name: 'Unit Economics',
    purpose: 'Ekonomika jednostkowa: marża, LTV, CAC, payback — każda pozycja jako formuła.',
    columns,
    rows,
    freezeRow: 1,
    conditionalFormatting,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildUnitEconomicsSchema(params: UnitEconomicsParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? DEFAULTS.companyName).trim() || DEFAULTS.companyName;
  const arpu = safeNumber(params.arpu, DEFAULTS.arpu);
  const kosztZmienny = safeNumber(params.kosztZmienny, DEFAULTS.kosztZmienny);
  const cac = safeNumber(params.cac, DEFAULTS.cac);
  const churnMiesieczny = safeFraction(params.churnMiesieczny, DEFAULTS.churnMiesieczny);
  const kosztUtrzymania = safeNumber(params.kosztUtrzymania, DEFAULTS.kosztUtrzymania);

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(arpu, kosztZmienny, cac, churnMiesieczny, kosztUtrzymania, label),
    buildUnitEconomicsSheet(hint),
  ];

  return {
    title: `${companyName} — Model Unit Economics`,
    description:
      'Parametryczny model jednostkowej ekonomiki: marża brutto, contribution margin, ' +
      'lifetime, LTV, LTV/CAC, okres zwrotu CAC. Każda metryka to formuła; wejścia na ' +
      `arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'unitEconomics',
      companyName,
      currency: label,
      arpu,
      kosztZmienny,
      cac,
      churnMiesieczny,
      kosztUtrzymania,
    },
  };
}

export default buildUnitEconomicsSchema;
