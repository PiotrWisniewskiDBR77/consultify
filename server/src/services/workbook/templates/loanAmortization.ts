/**
 * loanAmortization — parametric builder for a loan amortization schedule.
 *
 * SEVENTH registered template in the model-template library (after
 * threeScenarioPnL, operatingBudget, dcfValuation, breakEven, cashflow12m,
 * unitEconomics). Same reliability thesis: the LLM/caller parametrizes a
 * PROVEN template — the annuity payment, the interest/principal split, and
 * the declining balance are all real Excel formulas, no magic-numbers,
 * inputs live only on the Assumptions sheet.
 *
 * The math (month m, m = 1..termMonths; r = monthly rate = AnnualRate / 12):
 *   Rata (annuity payment, arithmetic — NOT the PMT() function):
 *     Rata = LoanAmount * r / (1 - (1+r)^-n)         [n = termMonths, constant every row]
 *   Saldo początkowe (opening balance):
 *     m=1   = LoanAmount
 *     m>1   = Saldo końcowe(m-1)
 *   Odsetki (interest):        Saldo początkowe(m) * r
 *   Kapitał (principal):       Rata(m) - Odsetki(m)
 *   Saldo końcowe (closing):   Saldo początkowe(m) - Kapitał(m)
 *
 * `termMonths` decides the SHAPE of the model (number of schedule ROWS) so it
 * is resolved at build time in JS (clamped 1..360), not carried as a live
 * formula input — everything downstream is still a real formula, just sized
 * for the chosen term. The "Miesiąc" index column is ALSO a formula chain
 * (row 1 = bare "1", row m>1 = prior + 1) rather than a raw constant — a raw
 * constant would coincidentally equal the `termMonths` assumption value on
 * the LAST row and false-trigger the Assumptions-duplication quality check
 * (WQ-03), which flags any bare numeric cell elsewhere in the workbook that
 * matches a raw Assumptions input.
 *
 * A trailing "RAZEM" row sums the Rata/Odsetki/Kapitał columns (a real
 * additive total: total paid, total interest, total principal — the latter
 * must equal the original loan amount, a nice built-in sanity check) and
 * pulls the final closing balance (should be ~0 — full amortization).
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

export interface LoanAmortizationParams {
  /** Company name (banner + title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Principal — the loan amount disbursed at month 0. */
  loanAmount?: number;
  /** Nominal annual interest rate (fraction). e.g. 0.08 = 8%/year. */
  annualInterestRatePct?: number;
  /** Loan term in months (1..360). */
  termMonths?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

// Exported so the template registry can derive its FE-facing parameter
// descriptors from the SAME source of truth the builder uses.
export const LOAN_AMORTIZATION_GENERAL_DEFAULTS = {
  companyName: 'Spółka',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  loanAmount: 500_000,
} as const;

export const LOAN_AMORTIZATION_DRIVER_DEFAULTS: Required<
  Pick<LoanAmortizationParams, 'annualInterestRatePct' | 'termMonths'>
> = {
  annualInterestRatePct: 0.08,
  termMonths: 36,
};

/** Clamp a strictly-positive amount (a principal must divide safely). */
function safePositive(v: number | undefined, fallback: number, min = 0.01): number {
  if (v === undefined || v === null || !Number.isFinite(v) || v < min) return fallback;
  return v;
}

/** Clamp a strictly-positive rate — the annuity formula divides by (1-(1+r)^-n),
 *  which is undefined at r=0, so 0%/negative rates are nudged to a tiny positive floor. */
function safeRate(v: number | undefined, fallback: number, min = 0.0001, max = 1): number {
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

// ---------------------------------------------------------------------------
// Layout constants — Assumptions ("Założenia") sheet
//
// Columns: A = Driver (text) | B = Wartość (number)
// Rows (Excel row = data-index + 2, header is row 1):
//   2  Kwota kredytu             ← currency
//   3  Oprocentowanie roczne %   ← percent
//   4  Okres (miesiące)          ← integer, 1–360
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

const AR = {
  amount: 2,
  rate: 3,
  term: 4,
} as const;

/** Absolute reference to an assumption cell in column B, e.g. 'Założenia'!$B$3. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$B$${row}`;
}

function buildAssumptionsSheet(
  loanAmount: number,
  annualInterestRatePct: number,
  termMonths: number,
  currencyLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'driver', header: 'Driver', type: 'text', width: 30 },
    { key: 'wartosc', header: 'Wartość', type: 'number' },
  ];

  const inputFill = 'FFF6DF'; // soft amber — classic "input" convention
  const pctFmt = '0.00%';
  const curFmt =
    currencyLabel === 'PLN' ? '# ##0" zł"' : currencyLabel === 'EUR' ? '€#,##0' : '$#,##0';

  const amountValidation: DataValidation = {
    type: 'decimal',
    operator: 'greaterThan',
    min: 0,
    allowBlank: false,
    promptTitle: 'Kwota kredytu',
    prompt: 'Dodatnia kwota kredytu.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Kwota kredytu musi być liczbą > 0.',
  };
  const rateValidation: DataValidation = {
    type: 'decimal',
    operator: 'between',
    min: 0.0001,
    max: 1,
    allowBlank: false,
    promptTitle: 'Oprocentowanie',
    prompt: 'Roczna stopa jako ułamek, np. 0,08 = 8%.',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: powyżej 0 do 1 (tj. do 100%).',
  };
  const termValidation: DataValidation = {
    type: 'whole',
    operator: 'between',
    min: 1,
    max: 360,
    allowBlank: false,
    promptTitle: 'Okres kredytu',
    prompt: 'Liczba miesięcy spłaty (1–360).',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: 1–360 miesięcy.',
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
    row('Kwota kredytu', loanAmount, curFmt, amountValidation),
    row('Oprocentowanie roczne %', annualInterestRatePct, pctFmt, rateValidation),
    row('Okres (miesiące)', termMonths, '0', termValidation),
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia harmonogramu kredytu (edytowalne).',
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
// "Harmonogram" sheet — one row per month + a trailing RAZEM (totals) row.
//
// Columns: A = Miesiąc | B = Saldo początkowe | C = Rata | D = Odsetki |
//          E = Kapitał | F = Saldo końcowe
// ---------------------------------------------------------------------------

const HARMONOGRAM_SHEET = 'Harmonogram';

function buildHarmonogramSheet(termMonths: number, currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'miesiac', header: 'Miesiąc', type: 'number', width: 10 },
    { key: 'saldoPoczatkowe', header: 'Saldo początkowe', type: 'currency' },
    { key: 'rata', header: 'Rata', type: 'currency' },
    { key: 'odsetki', header: 'Odsetki', type: 'currency' },
    { key: 'kapital', header: 'Kapitał', type: 'currency' },
    { key: 'saldoKoncowe', header: 'Saldo końcowe', type: 'currency' },
  ];
  const currencyFmt = currencyNumFmt(currencyHint);

  // Monthly rate expression, referenced (not embedded as a literal) — always
  // pulled from the Assumptions sheet so editing the rate there recalculates
  // every row.
  const rExpr = `(${aRef(AR.rate)}/12)`;
  // Constant annuity payment (arithmetic PMT), the SAME formula every row —
  // referencing the ORIGINAL principal + term, never the declining balance.
  const rataFormula = `${aRef(AR.amount)}*${rExpr}/(1-(1+${rExpr})^-${aRef(AR.term)})`;

  const rows: Row[] = [];
  for (let m = 1; m <= termMonths; m++) {
    const excelRow = m + 1; // header is row 1
    const prevRow = excelRow - 1;
    const cells: Record<string, Cell> = {
      miesiac: {
        formula: m === 1 ? '1' : `A${prevRow}+1`,
        style: { numberFormat: '0' },
      },
      saldoPoczatkowe: {
        formula: m === 1 ? aRef(AR.amount) : `F${prevRow}`,
        style: { numberFormat: currencyFmt },
      },
      rata: { formula: rataFormula, style: { numberFormat: currencyFmt } },
      odsetki: { formula: `B${excelRow}*${rExpr}`, style: { numberFormat: currencyFmt } },
      kapital: { formula: `C${excelRow}-D${excelRow}`, style: { numberFormat: currencyFmt } },
      saldoKoncowe: { formula: `B${excelRow}-E${excelRow}`, style: { numberFormat: currencyFmt } },
    };
    rows.push({ cells });
  }

  const lastDataRow = termMonths + 1;
  rows.push({
    cells: {
      miesiac: { value: 'RAZEM', style: { bold: true } },
      rata: {
        formula: `SUM(C2:C${lastDataRow})`,
        style: { numberFormat: currencyFmt, bold: true },
      },
      odsetki: {
        formula: `SUM(D2:D${lastDataRow})`,
        style: { numberFormat: currencyFmt, bold: true },
      },
      kapital: {
        formula: `SUM(E2:E${lastDataRow})`,
        style: { numberFormat: currencyFmt, bold: true },
      },
      saldoKoncowe: {
        formula: `F${lastDataRow}`,
        style: { numberFormat: currencyFmt, bold: true },
      },
    },
    isSummary: true,
  });

  return {
    name: HARMONOGRAM_SHEET,
    purpose:
      'Harmonogram spłaty kredytu (rata annuitetowa, arytmetyka, nie funkcja PMT): saldo, rata, odsetki, ' +
      'kapitał — każda pozycja = formuła; RAZEM = suma rat/odsetek/kapitału + saldo końcowe ostatniego miesiąca.',
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

export function buildLoanAmortizationSchema(params: LoanAmortizationParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';

  const loanAmount = safePositive(params.loanAmount, LOAN_AMORTIZATION_GENERAL_DEFAULTS.loanAmount);
  const annualInterestRatePct = safeRate(
    params.annualInterestRatePct,
    LOAN_AMORTIZATION_DRIVER_DEFAULTS.annualInterestRatePct
  );
  const termMonths = Math.min(
    360,
    Math.max(
      1,
      Number.isFinite(params.termMonths)
        ? Math.round(params.termMonths as number)
        : LOAN_AMORTIZATION_DRIVER_DEFAULTS.termMonths
    )
  );

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(loanAmount, annualInterestRatePct, termMonths, label),
    buildHarmonogramSheet(termMonths, hint),
  ];

  return {
    title: `${companyName} — Harmonogram spłaty kredytu`,
    description:
      `Parametryczny harmonogram spłaty kredytu (rata annuitetowa) na ${termMonths} miesięcy: saldo ` +
      'początkowe, rata, podział na odsetki i kapitał, saldo końcowe malejące do zera. Każda pozycja to ' +
      `formuła; wejścia na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'loanAmortization',
      companyName,
      currency: label,
      loanAmount,
      annualInterestRatePct,
      termMonths,
    },
  };
}

export default buildLoanAmortizationSchema;
