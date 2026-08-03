/**
 * unitEconomics — parametric builder for SaaS unit economics.
 *
 * SIXTH registered template in the model-template library (after
 * threeScenarioPnL, operatingBudget, dcfValuation, breakEven, cashflow12m).
 * Same reliability thesis: the LLM/caller parametrizes a PROVEN template —
 * LTV, LTV/CAC, CAC payback period, NRR, and the 12-month
 * customers/MRR churn-decay projection are all real Excel formulas, no
 * magic-numbers, inputs live only on the Assumptions sheet.
 *
 * The math:
 *   LTV (lifetime value):        ARPU * GrossMargin% / Churn%
 *   LTV / CAC:                   LTV / CAC
 *   CAC payback period (months): CAC / (ARPU * GrossMargin%)
 *   NRR (m/m, no expansion):     1 - Churn%
 *   Projection (month m, m=1..12):
 *     Customers(1) = StartingMRR / ARPU
 *     Customers(m>1) = Customers(m-1) * (1 - Churn%)
 *     MRR(m) = Customers(m) * ARPU
 *
 * A 13th "RAZEM" column mirrors the cashflow12m convention: since neither
 * "customers" nor "MRR" is naturally additive across months, RAZEM is a
 * direct reference to December's figure (already the year-end state —
 * summing it again would be meaningless), same as cashflow12m's "Saldo
 * narastające" RAZEM.
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

export interface UnitEconomicsParams {
  /** Company name (banner + title). */
  companyName?: string;
  /** ISO-ish currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** MRR (Monthly Recurring Revenue) at the start of the projection. */
  startingMrr?: number;
  /** Month-over-month customer churn rate (fraction). e.g. 0.03 = 3%/mo. */
  churnPctMonthly?: number;
  /** Customer Acquisition Cost (fully-loaded, per new customer). */
  cac?: number;
  /** Gross margin (fraction of revenue retained after COGS/hosting/support). */
  grossMarginPct?: number;
  /** ARPU — Average Revenue Per User/account, per month. */
  arpu?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

// Exported so the template registry can derive its FE-facing parameter
// descriptors from the SAME source of truth the builder uses.
export const UNIT_ECONOMICS_GENERAL_DEFAULTS = {
  companyName: 'Spółka',
  currencyCode: 'PLN' as 'PLN' | 'EUR' | 'USD',
  startingMrr: 50_000,
} as const;

export const UNIT_ECONOMICS_DRIVER_DEFAULTS: Required<
  Pick<UnitEconomicsParams, 'churnPctMonthly' | 'cac' | 'grossMarginPct' | 'arpu'>
> = {
  churnPctMonthly: 0.03,
  cac: 1_200,
  grossMarginPct: 0.75,
  arpu: 250,
};

/** Clamp a fraction to a STRICTLY POSITIVE bound — churn/margin are LTV/payback
 *  divisors, so a 0 or negative value would ship a #DIV/0!/negative-LTV schema. */
function safeFraction(v: number | undefined, fallback: number, min = 0.001, max = 1): number {
  if (v === undefined || v === null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Clamp a non-negative amount; fall back to `fallback` when invalid/negative. */
function safeAmount(v: number | undefined, fallback: number): number {
  if (v === undefined || v === null || !Number.isFinite(v) || v < 0) return fallback;
  return v;
}

/** Clamp a strictly-positive amount (a divisor must never be ≤0). */
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
//   2  MRR startowy               ← currency
//   3  Churn m/m %                ← percent
//   4  CAC (koszt pozyskania)     ← currency
//   5  Marża brutto %             ← percent
//   6  ARPU (przychód/klient/m-c) ← currency
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

const AR = {
  mrr: 2,
  churn: 3,
  cac: 4,
  margin: 5,
  arpu: 6,
} as const;

/** Absolute reference to an assumption cell in column B, e.g. 'Założenia'!$B$3. */
function aRef(row: number): string {
  return `'${ASSUMPTIONS_SHEET}'!$B$${row}`;
}

function buildAssumptionsSheet(
  startingMrr: number,
  churnPctMonthly: number,
  cac: number,
  grossMarginPct: number,
  arpu: number,
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
  const positiveAmountValidation: DataValidation = {
    type: 'decimal',
    operator: 'greaterThan',
    min: 0,
    allowBlank: false,
    promptTitle: 'Kwota',
    prompt: 'Kwota musi być większa od zera.',
    errorTitle: 'Nieprawidłowa wartość',
    error: 'Kwota musi być liczbą > 0.',
  };
  const percentValidation: DataValidation = {
    type: 'decimal',
    operator: 'between',
    min: 0.0001,
    max: 1,
    allowBlank: false,
    promptTitle: 'Wartość ułamkowa',
    prompt: 'Podaj ułamek > 0 i ≤ 1, np. 0,03 = 3%.',
    errorTitle: 'Poza zakresem',
    error: 'Dozwolony zakres: powyżej 0 do 1 (tj. do 100%).',
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
    row('MRR startowy', startingMrr, curFmt, amountValidation),
    row('Churn m/m %', churnPctMonthly, pctFmt, percentValidation),
    row('CAC (koszt pozyskania klienta)', cac, curFmt, positiveAmountValidation),
    row('Marża brutto %', grossMarginPct, pctFmt, percentValidation),
    row('ARPU (śr. przychód / klient / m-c)', arpu, curFmt, positiveAmountValidation),
  ];

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe założenia ekonomii jednostkowej SaaS (edytowalne).',
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
// "Metryki" sheet — LTV, LTV/CAC, CAC payback period, NRR.
//
// Columns: A = Metryka (text) | B = Wartość (number)
// Rows (Excel row = index + 2):
//   2  LTV (wartość życiowa klienta)          [summary]
//   3  LTV / CAC                              [summary]
//   4  Okres zwrotu CAC (miesiące)
//   5  NRR (Net Revenue Retention, m/m)
// ---------------------------------------------------------------------------

const METRYKI_SHEET = 'Metryki';
const MET = {
  ltv: 2,
  ltvCac: 3,
  payback: 4,
  nrr: 5,
} as const;

function buildMetrykiSheet(currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [
    { key: 'metryka', header: 'Metryka', type: 'text', width: 38 },
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
    metricRow(
      'LTV (wartość życiowa klienta)',
      `${aRef(AR.arpu)}*${aRef(AR.margin)}/${aRef(AR.churn)}`,
      {
        summary: true,
      }
    ),
    metricRow('LTV / CAC', `B${MET.ltv}/${aRef(AR.cac)}`, {
      summary: true,
      numberFormat: '0.00"x"',
    }),
    metricRow(
      'Okres zwrotu CAC (miesiące)',
      `${aRef(AR.cac)}/(${aRef(AR.arpu)}*${aRef(AR.margin)})`,
      {
        numberFormat: '0.0',
      }
    ),
    metricRow('NRR (Net Revenue Retention, m/m)', `1-${aRef(AR.churn)}`, { numberFormat: '0.0%' }),
  ];

  return {
    name: METRYKI_SHEET,
    purpose:
      'Kluczowe metryki ekonomii jednostkowej (LTV, LTV/CAC, payback, NRR) — każda pozycja = formuła.',
    columns,
    rows,
    freezeRow: 1,
    tabColor: '1D9E75',
  };
}

// ---------------------------------------------------------------------------
// "Projekcja 12m" sheet — customers/MRR churn-decay projection.
//
// Columns: A = Pozycja (text) | B..M = 12 miesiące | N = RAZEM (grudzień)
// Rows (Excel row = index + 2):
//   2  Liczba klientów (aktywnych)
//   3  MRR
// ---------------------------------------------------------------------------

const PROJ = {
  customers: 2,
  mrr: 3,
} as const;

const MONTH_COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const PROJEKCJA_SHEET = 'Projekcja 12m';

function buildProjekcjaSheet(currencyHint: 'pln' | 'eur' | 'usd'): Sheet {
  const columns: ColumnDef[] = [{ key: 'pozycja', header: 'Pozycja', type: 'text', width: 32 }];
  for (let m = 1; m <= 12; m++) {
    columns.push({ key: `m${m}`, header: `Miesiąc ${m}`, type: 'number' });
  }
  columns.push({ key: 'razem', header: 'RAZEM (grudzień)', type: 'number' });

  const currencyFmt = currencyNumFmt(currencyHint);
  const monthKey = (i: number): string => `m${i + 1}`; // i: 0-based month index

  // Row 2 — Liczba klientów: m1 = StartingMRR / ARPU; m>1 = prior * (1 - churn).
  const custRow: Row = (() => {
    const cells: Record<string, Cell> = { pozycja: { value: 'Liczba klientów (aktywnych)' } };
    MONTH_COLS.forEach((col, i) => {
      const formula =
        i === 0
          ? `${aRef(AR.mrr)}/${aRef(AR.arpu)}`
          : `${MONTH_COLS[i - 1]}${PROJ.customers}*(1-${aRef(AR.churn)})`;
      cells[monthKey(i)] = { formula, style: { numberFormat: '# ##0.0' } };
    });
    cells.razem = {
      formula: `${MONTH_COLS[11]}${PROJ.customers}`,
      style: { numberFormat: '# ##0.0' },
    };
    return { cells };
  })();

  // Row 3 — MRR: customers(m) * ARPU (same-column reference to row 2).
  const mrrRow: Row = (() => {
    const cells: Record<string, Cell> = { pozycja: { value: 'MRR', style: { bold: true } } };
    MONTH_COLS.forEach((col) => {
      cells[monthKey(MONTH_COLS.indexOf(col))] = {
        formula: `${col}${PROJ.customers}*${aRef(AR.arpu)}`,
        style: { numberFormat: currencyFmt, bold: true },
      };
    });
    cells.razem = {
      formula: `${MONTH_COLS[11]}${PROJ.mrr}`,
      style: { numberFormat: currencyFmt, bold: true },
    };
    return { cells, isSummary: true };
  })();

  const rows: Row[] = [custRow, mrrRow];

  return {
    name: PROJEKCJA_SHEET,
    purpose:
      'Projekcja klientów i MRR na 12 miesięcy z uwzględnieniem churnu — każda pozycja = formuła; ' +
      'RAZEM = stan na koniec grudnia.',
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

export function buildUnitEconomicsSchema(params: UnitEconomicsParams = {}): WorkbookSchema {
  const companyName = (params.companyName ?? 'Spółka').trim() || 'Spółka';

  const startingMrr = safeAmount(params.startingMrr, UNIT_ECONOMICS_GENERAL_DEFAULTS.startingMrr);
  const churnPctMonthly = safeFraction(
    params.churnPctMonthly,
    UNIT_ECONOMICS_DRIVER_DEFAULTS.churnPctMonthly
  );
  const cac = safePositive(params.cac, UNIT_ECONOMICS_DRIVER_DEFAULTS.cac);
  const grossMarginPct = safeFraction(
    params.grossMarginPct,
    UNIT_ECONOMICS_DRIVER_DEFAULTS.grossMarginPct
  );
  const arpu = safePositive(params.arpu, UNIT_ECONOMICS_DRIVER_DEFAULTS.arpu);

  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(startingMrr, churnPctMonthly, cac, grossMarginPct, arpu, label),
    buildMetrykiSheet(hint),
    buildProjekcjaSheet(hint),
  ];

  return {
    title: `${companyName} — Ekonomia jednostkowa SaaS`,
    description:
      'Parametryczna ekonomia jednostkowa SaaS: LTV, LTV/CAC, okres zwrotu CAC, NRR oraz 12-miesięczna ' +
      `projekcja klientów/MRR z churnem. Każda pozycja to formuła; wejścia na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'unitEconomics',
      companyName,
      currency: label,
      startingMrr,
      churnPctMonthly,
      cac,
      grossMarginPct,
      arpu,
    },
  };
}

export default buildUnitEconomicsSchema;
