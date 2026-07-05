/**
 * budgetVsActual — parametric builder for a classic controlling "Budget vs
 * Actual" (Budżet vs Wykonanie) workbook.
 *
 * Follows the threeScenarioPnL pattern (the library's canon): the LLM
 * parametrizes a PROVEN template instead of designing a controlling report
 * from scratch — every computed cell is a real Excel formula, inputs live on
 * a dedicated "Założenia" (Assumptions) sheet, and there are zero
 * magic-numbers in the computed columns.
 *
 * The math (per line item):
 *   Wariancja (variance):        wykonanie − budżet
 *   Wariancja % (variance %):    wariancja / budżet
 * Summary row:
 *   SUMA budżet / wykonanie:     SUM over the data rows above
 *   SUMA wariancja:              SUM over the data rows above (not
 *                                 wykonanie−budżet again — stays consistent
 *                                 with WQ-02 sum-coverage over ITS OWN column)
 *   SUMA wariancja %:            SUMA wariancja / SUMA budżet (own formula,
 *                                 NOT a SUM of percentages — percentages
 *                                 don't sum meaningfully)
 *
 * Formulas are emitted WITHOUT a leading `=` (the builder writes the string
 * verbatim into the worksheet XML `<f>` element, which must be `=`-free).
 */

import type {
  Cell,
  ColumnDef,
  ConditionalFormattingBlock,
  Row,
  Sheet,
  WorkbookSchema,
} from '../WorkbookSchema.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/** A single budget line item (cost or revenue position). */
export interface BudgetLineItem {
  /** Line label, e.g. "Wynagrodzenia". */
  nazwa: string;
  /** Planned (budgeted) amount. */
  budzet: number;
  /** Actual (executed) amount. */
  wykonanie: number;
}

export interface BudgetVsActualParams {
  /** Report title (banner). */
  title?: string;
  /** Currency selector understood by the styler (pln/eur/usd). */
  currencyCode?: 'PLN' | 'EUR' | 'USD';
  /** Period label shown in the report title, e.g. "Q1 2026" or "Rok 2026". */
  periodLabel?: string;
  /** Budget line items. Falls back to sensible demo data when omitted/empty. */
  items?: BudgetLineItem[];
  /**
   * Variance tolerance threshold (fraction, e.g. 0.05 = 5%) used only for the
   * conditional-formatting cut and shown on the Assumptions sheet as a
   * reference input; not used in any computed-column formula.
   */
  tolerancePct?: number;
}

// ---------------------------------------------------------------------------
// Defaults + validation
// ---------------------------------------------------------------------------

const DEFAULT_ITEMS: BudgetLineItem[] = [
  { nazwa: 'Przychody ze sprzedaży', budzet: 1_200_000, wykonanie: 1_260_000 },
  { nazwa: 'Wynagrodzenia', budzet: 450_000, wykonanie: 468_000 },
  { nazwa: 'Marketing', budzet: 120_000, wykonanie: 98_000 },
  { nazwa: 'Koszty operacyjne', budzet: 200_000, wykonanie: 215_000 },
  { nazwa: 'IT i licencje', budzet: 80_000, wykonanie: 76_000 },
  { nazwa: 'Najem i media', budzet: 90_000, wykonanie: 90_000 },
  { nazwa: 'Pozostałe koszty', budzet: 60_000, wykonanie: 71_000 },
];

const DEFAULT_TOLERANCE_PCT = 0.05;

function safeItems(items: BudgetLineItem[] | undefined): BudgetLineItem[] {
  if (!Array.isArray(items) || items.length === 0) return DEFAULT_ITEMS;
  const cleaned = items
    .filter((it) => it && typeof it.nazwa === 'string' && it.nazwa.trim().length > 0)
    .map((it) => ({
      nazwa: it.nazwa.trim(),
      budzet: Number.isFinite(it.budzet) ? it.budzet : 0,
      wykonanie: Number.isFinite(it.wykonanie) ? it.wykonanie : 0,
    }));
  return cleaned.length > 0 ? cleaned : DEFAULT_ITEMS;
}

function safeFraction(v: number | undefined, fallback: number, min = 0, max = 1): number {
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
// Columns:  A = Parametr (text) | B = Wartość (number)
// Rows (Excel row = data-index + 2, header is row 1):
//   2  Liczba pozycji (informational, count of line items)
//   3  Próg tolerancji wariancji % (used only for CF reference — not in
//      any computed formula elsewhere, so it never violates WQ-03/WQ-01)
// ---------------------------------------------------------------------------

const ASSUMPTIONS_SHEET = 'Założenia';

function buildAssumptionsSheet(
  itemCount: number,
  tolerancePct: number,
  periodLabel: string
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'parametr', header: 'Parametr', type: 'text', width: 34 },
    { key: 'wartosc', header: 'Wartość', type: 'number', width: 18 },
  ];

  const inputFill = 'FFF2CC'; // canon input-cell chrome
  const pctFmt = '0.0%';

  const inputCell = (value: number, fmt?: string): Cell => ({
    value,
    style: { bgColor: inputFill, border: 'thin', ...(fmt ? { numberFormat: fmt } : {}) },
  });

  const rows: Row[] = [
    {
      cells: {
        parametr: { value: 'Okres raportowania', style: { bold: true } },
        wartosc: inputCell(0, undefined),
      },
    },
    {
      cells: {
        parametr: { value: 'Liczba pozycji budżetowych' },
        wartosc: inputCell(itemCount),
      },
    },
    {
      cells: {
        parametr: { value: 'Próg tolerancji wariancji %' },
        wartosc: inputCell(tolerancePct, pctFmt),
      },
    },
  ];

  // The period-label row carries a text value in a numeric-typed column key
  // ("wartosc") — that's fine for the schema (Cell.value accepts string too),
  // but to keep the "Wartość" column semantically number-only (avoiding a
  // false WQ-04 mixed-format read on a text cell), we write the period label
  // as a dedicated text override on that single row.
  rows[0].cells.wartosc = {
    value: periodLabel,
    style: { bgColor: inputFill, border: 'thin' },
  };

  return {
    name: ASSUMPTIONS_SHEET,
    purpose: 'Wejściowe parametry raportu Budżet vs Wykonanie (edytowalne).',
    columns,
    rows,
    freezeRow: 1,
    isAssumptions: true,
    nameKeyColumn: 'parametr',
    nameValueColumn: 'wartosc',
    tabColor: 'F59E0B',
  };
}

// ---------------------------------------------------------------------------
// Main "Budżet vs Wykonanie" sheet builder
//
// Columns: A = Pozycja (text) | B = Budżet (currency) | C = Wykonanie
//          (currency) | D = Wariancja (currency, FORMULA) | E = Wariancja %
//          (percent, FORMULA)
// Rows: one per line item (Excel row = index + 2), then a SUMA row.
// ---------------------------------------------------------------------------

const MAIN_SHEET = 'Budżet vs Wykonanie';

function buildMainSheet(
  items: BudgetLineItem[],
  currencyHint: 'pln' | 'eur' | 'usd'
): Sheet {
  const columns: ColumnDef[] = [
    { key: 'pozycja', header: 'Pozycja', type: 'text', width: 32 },
    { key: 'budzet', header: 'Budżet', type: 'currency' },
    { key: 'wykonanie', header: 'Wykonanie', type: 'currency' },
    { key: 'wariancja', header: 'Wariancja', type: 'currency' },
    { key: 'wariancja_proc', header: 'Wariancja %', type: 'percent' },
  ];

  const currencyFmt = currencyNumFmt(currencyHint);
  const pctFmt = '0.0%';

  // Data rows start at Excel row 2 (row idx 0 → row 2).
  const dataRows: Row[] = items.map((it, idx) => {
    const r = idx + 2;
    const cells: Record<string, Cell> = {
      pozycja: { value: it.nazwa },
      budzet: { value: it.budzet, style: { numberFormat: currencyFmt } },
      wykonanie: { value: it.wykonanie, style: { numberFormat: currencyFmt } },
      // Wariancja = Wykonanie − Budżet (ALWAYS a formula, never a constant).
      wariancja: { formula: `C${r}-B${r}`, style: { numberFormat: currencyFmt } },
      // Wariancja % = Wariancja / Budżet (ALWAYS a formula).
      wariancja_proc: { formula: `D${r}/B${r}`, style: { numberFormat: pctFmt } },
    };
    return { cells };
  });

  const firstDataRow = 2;
  const lastDataRow = firstDataRow + items.length - 1;
  const summaryRowNum = lastDataRow + 1;

  const summaryRow: Row = {
    isSummary: true,
    cells: {
      pozycja: { value: 'SUMA', style: { bold: true } },
      budzet: {
        formula: `SUM(B${firstDataRow}:B${lastDataRow})`,
        style: { numberFormat: currencyFmt, bold: true },
      },
      wykonanie: {
        formula: `SUM(C${firstDataRow}:C${lastDataRow})`,
        style: { numberFormat: currencyFmt, bold: true },
      },
      wariancja: {
        formula: `SUM(D${firstDataRow}:D${lastDataRow})`,
        style: { numberFormat: currencyFmt, bold: true },
      },
      // Total variance % is its OWN ratio (SUMA wariancja / SUMA budżet),
      // not a SUM of the per-row percentages (which wouldn't be meaningful).
      wariancja_proc: {
        formula: `D${summaryRowNum}/B${summaryRowNum}`,
        style: { numberFormat: pctFmt, bold: true },
      },
    },
  };

  const rows: Row[] = [...dataRows, summaryRow];

  // Conditional formatting on Wariancja % (data rows only): overrun (positive
  // variance on a cost line reads as "wykonanie > budżet") shown red,
  // favorable/negative variance shown green. Kept simple: a 3-stop color
  // scale anchored on 0, over the data rows (excludes the SUMA row so the
  // scale isn't skewed by the aggregate).
  const cfRef = `E${firstDataRow}:E${lastDataRow}`;
  const conditionalFormatting: ConditionalFormattingBlock[] = [
    {
      ref: cfRef,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: ['0'],
          style: { fontColor: 'FFFFFF', bgColor: 'C0392B' },
        },
      ],
    },
    {
      ref: cfRef,
      rules: [
        {
          type: 'cellIs',
          operator: 'lessThan',
          formulae: ['0'],
          style: { fontColor: 'FFFFFF', bgColor: '1D9E75' },
        },
      ],
    },
  ];

  return {
    name: MAIN_SHEET,
    purpose: 'Budżet vs Wykonanie: pozycja, budżet, wykonanie, wariancja i wariancja % (formuły).',
    columns,
    rows,
    freezeRow: 1,
    freezeCol: 1,
    conditionalFormatting,
    tabColor: '0C447C',
  };
}

// ---------------------------------------------------------------------------
// Top-level builder
// ---------------------------------------------------------------------------

export function buildBudgetVsActualSchema(
  params: BudgetVsActualParams = {}
): WorkbookSchema {
  const title = (params.title ?? 'Budżet vs Wykonanie').trim() || 'Budżet vs Wykonanie';
  const periodLabel = (params.periodLabel ?? `Rok ${new Date().getFullYear()}`).trim();
  const items = safeItems(params.items);
  const tolerancePct = safeFraction(params.tolerancePct, DEFAULT_TOLERANCE_PCT, 0, 1);
  const { hint, label } = currencyMeta(params.currencyCode);

  const sheets: Sheet[] = [
    buildAssumptionsSheet(items.length, tolerancePct, periodLabel),
    buildMainSheet(items, hint),
  ];

  return {
    title: `${title} — ${periodLabel}`,
    description:
      'Parametryczny raport kontrolingowy: budżet, wykonanie, wariancja i wariancja % ' +
      `dla ${items.length} pozycji. Każda wariancja to formuła; wejścia na arkuszu „${ASSUMPTIONS_SHEET}".`,
    author: 'Consultify',
    sheets,
    metadata: {
      template: 'budgetVsActual',
      title,
      currency: label,
      periodLabel,
      itemCount: items.length,
      tolerancePct,
    },
  };
}

export default buildBudgetVsActualSchema;
