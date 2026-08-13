/**
 * Pakiet F — słowniki PL + metadane dla ekranu Baseline (Założenia/Wyliczenia).
 *
 * Zero zgadywania: `CANONICAL_LINE_META`/`STATEMENT_TYPE_OF`/kolejność linii
 * to PORT z `server/src/services/finance/canonical/baselineComputeService.ts`
 * (`CANONICAL_CODES:112-120`, `STATEMENT_TYPE_OF:122-129`) — czytane w
 * całości 2026-08-11, `server/**` poza allowlistą tego pakietu więc port, nie
 * import. Etykiety znanych driverów (`DRIVER_META`) pochodzą z przykładów
 * faktycznie zapisywanych przez `makeBaselineVersion()` w
 * `server/src/services/finance/canonical/__tests__/perfSlo.pg.test.ts:240-257`
 * (jedyne miejsce w repo z realnym `driverCode` per `scheduleType` — reszta
 * driverów spoza tej listy dostaje bezpieczny fallback wg `unit` zwracanego
 * przez API, nie zgadywaną nazwę).
 */
import type { BaselineAssumptionRule, BaselineScheduleType, BaselineStatementType } from '@/services/api/financeV2.types';

// ---------------------------------------------------------------------------
// Linie kanoniczne — 31 kodów, ich sprawozdanie i sposób agregacji przy
// zwijaniu miesięcy do kwartału/roku.
// ---------------------------------------------------------------------------

export type CanonicalLineCode =
  | 'REVENUE' | 'COGS' | 'GROSS_MARGIN' | 'OPEX' | 'EBITDA' | 'DEPRECIATION' | 'EBIT'
  | 'INTEREST_EXPENSE' | 'TAX_EXPENSE' | 'NET_INCOME'
  | 'CASH' | 'AR' | 'INVENTORY' | 'CURRENT_ASSETS' | 'FIXED_ASSETS' | 'TOTAL_ASSETS'
  | 'AP' | 'CURRENT_LIABILITIES' | 'LONG_TERM_DEBT' | 'TOTAL_LIABILITIES'
  | 'EQUITY' | 'TOTAL_LIABILITIES_EQUITY' | 'RETAINED_EARNINGS' | 'DIVIDENDS_DECLARED' | 'WORKING_CAPITAL'
  | 'CFO' | 'CFI' | 'CFF' | 'NET_CHANGE_CASH' | 'CAPEX' | 'FCF';

/** Kolejność renderowania w obrębie jednej grupy (P&L/BS/CF) — ta sama co silnik. */
export const CANONICAL_LINE_ORDER: readonly CanonicalLineCode[] = [
  'REVENUE', 'COGS', 'GROSS_MARGIN', 'OPEX', 'EBITDA', 'DEPRECIATION', 'EBIT',
  'INTEREST_EXPENSE', 'TAX_EXPENSE', 'NET_INCOME',
  'CASH', 'AR', 'INVENTORY', 'CURRENT_ASSETS', 'FIXED_ASSETS', 'TOTAL_ASSETS',
  'AP', 'CURRENT_LIABILITIES', 'LONG_TERM_DEBT', 'TOTAL_LIABILITIES',
  'EQUITY', 'TOTAL_LIABILITIES_EQUITY', 'RETAINED_EARNINGS', 'DIVIDENDS_DECLARED', 'WORKING_CAPITAL',
  'CFO', 'CFI', 'CFF', 'NET_CHANGE_CASH', 'CAPEX', 'FCF',
];

export const STATEMENT_TYPE_OF_LINE: Record<CanonicalLineCode, BaselineStatementType> = {
  REVENUE: 'P&L', COGS: 'P&L', GROSS_MARGIN: 'P&L', OPEX: 'P&L', EBITDA: 'P&L', DEPRECIATION: 'P&L',
  EBIT: 'P&L', INTEREST_EXPENSE: 'P&L', TAX_EXPENSE: 'P&L', NET_INCOME: 'P&L',
  CASH: 'BS', AR: 'BS', INVENTORY: 'BS', CURRENT_ASSETS: 'BS', FIXED_ASSETS: 'BS', TOTAL_ASSETS: 'BS',
  AP: 'BS', CURRENT_LIABILITIES: 'BS', LONG_TERM_DEBT: 'BS', TOTAL_LIABILITIES: 'BS',
  EQUITY: 'BS', TOTAL_LIABILITIES_EQUITY: 'BS', RETAINED_EARNINGS: 'BS', DIVIDENDS_DECLARED: 'BS', WORKING_CAPITAL: 'BS',
  CFO: 'CF', CFI: 'CF', CFF: 'CF', NET_CHANGE_CASH: 'CF', CAPEX: 'CF', FCF: 'CF',
};

/**
 * Skróty finansowe zostają kanoniczne PO ANGIELSKU (CLAUDE.md V-4: „skróty
 * finansowe REVENUE/COGS/EBITDA mogą zostać") — reszta etykiety po polsku.
 * `aggregation`: linie przepływowe (P&L/CF) sumują się przy zwijaniu
 * miesiąc→kwartał/rok; linie zasobowe (bilans) biorą wartość z OSTATNIEGO
 * miesiąca okresu (stan na koniec), nigdy sumę — sumowanie salda bilansowego
 * dałoby fizycznie bezsensowną liczbę.
 */
export const CANONICAL_LINE_META: Record<CanonicalLineCode, { labelPl: string; aggregation: 'flow-sum' | 'stock-end' }> = {
  REVENUE: { labelPl: 'Przychody (REVENUE)', aggregation: 'flow-sum' },
  COGS: { labelPl: 'Koszt własny sprzedaży (COGS)', aggregation: 'flow-sum' },
  GROSS_MARGIN: { labelPl: 'Marża brutto', aggregation: 'flow-sum' },
  OPEX: { labelPl: 'Koszty operacyjne (OPEX)', aggregation: 'flow-sum' },
  EBITDA: { labelPl: 'EBITDA', aggregation: 'flow-sum' },
  DEPRECIATION: { labelPl: 'Amortyzacja', aggregation: 'flow-sum' },
  EBIT: { labelPl: 'EBIT', aggregation: 'flow-sum' },
  INTEREST_EXPENSE: { labelPl: 'Koszty odsetkowe', aggregation: 'flow-sum' },
  TAX_EXPENSE: { labelPl: 'Podatek dochodowy', aggregation: 'flow-sum' },
  NET_INCOME: { labelPl: 'Wynik netto', aggregation: 'flow-sum' },
  CASH: { labelPl: 'Gotówka (CASH)', aggregation: 'stock-end' },
  AR: { labelPl: 'Należności (AR)', aggregation: 'stock-end' },
  INVENTORY: { labelPl: 'Zapasy', aggregation: 'stock-end' },
  CURRENT_ASSETS: { labelPl: 'Aktywa obrotowe', aggregation: 'stock-end' },
  FIXED_ASSETS: { labelPl: 'Aktywa trwałe', aggregation: 'stock-end' },
  TOTAL_ASSETS: { labelPl: 'Aktywa razem', aggregation: 'stock-end' },
  AP: { labelPl: 'Zobowiązania handlowe (AP)', aggregation: 'stock-end' },
  CURRENT_LIABILITIES: { labelPl: 'Zobowiązania krótkoterminowe', aggregation: 'stock-end' },
  LONG_TERM_DEBT: { labelPl: 'Dług długoterminowy', aggregation: 'stock-end' },
  TOTAL_LIABILITIES: { labelPl: 'Zobowiązania razem', aggregation: 'stock-end' },
  EQUITY: { labelPl: 'Kapitał własny', aggregation: 'stock-end' },
  TOTAL_LIABILITIES_EQUITY: { labelPl: 'Pasywa razem', aggregation: 'stock-end' },
  RETAINED_EARNINGS: { labelPl: 'Zyski zatrzymane', aggregation: 'stock-end' },
  DIVIDENDS_DECLARED: { labelPl: 'Dywidendy zadeklarowane', aggregation: 'flow-sum' },
  WORKING_CAPITAL: { labelPl: 'Kapitał obrotowy netto', aggregation: 'stock-end' },
  CFO: { labelPl: 'Przepływy operacyjne (CFO)', aggregation: 'flow-sum' },
  CFI: { labelPl: 'Przepływy inwestycyjne (CFI)', aggregation: 'flow-sum' },
  CFF: { labelPl: 'Przepływy finansowe (CFF)', aggregation: 'flow-sum' },
  NET_CHANGE_CASH: { labelPl: 'Zmiana netto gotówki', aggregation: 'flow-sum' },
  CAPEX: { labelPl: 'Nakłady inwestycyjne (CAPEX)', aggregation: 'flow-sum' },
  FCF: { labelPl: 'Wolne przepływy pieniężne (FCF)', aggregation: 'flow-sum' },
};

// ---------------------------------------------------------------------------
// Typy harmonogramów założeń
// ---------------------------------------------------------------------------

export const BASELINE_SCHEDULE_TYPE_LABELS: Record<BaselineScheduleType, string> = {
  revenue_pvm: 'Przychody (cena/wolumen/mix)',
  headcount: 'Zatrudnienie',
  cogs_opex: 'Koszty (COGS/OPEX)',
  wc_dso_dio_dpo: 'Kapitał obrotowy (DSO/DIO/DPO)',
  capex_depreciation: 'CAPEX i amortyzacja',
  leases: 'Leasingi',
  debt_maturity: 'Harmonogram zadłużenia',
  tax_nol: 'Podatek',
  equity_re: 'Kapitał własny / zyski zatrzymane',
};

export const BASELINE_RULE_LABELS: Record<BaselineAssumptionRule, string> = {
  HISTORICAL_AVERAGE: 'Średnia historyczna',
  GROWTH_RATE: 'Stopa wzrostu',
  FIXED_VALUE: 'Wartość stała',
  LINKED_TO_ANALYSIS_KPI: 'Powiązane z KPI analizy',
  FORMULA: 'Formuła',
  MANUAL_OVERRIDE: 'Ręczna korekta',
};

/** Kontrolka domyślna wg jednostki — gdy driver nie ma wpisu w DRIVER_META. */
export type AssumptionControlKind = 'percent-stepper' | 'amount-precise' | 'days-field' | 'months-field' | 'plain-number';

export function controlKindForUnit(unit: string): AssumptionControlKind {
  switch (unit) {
    case 'PCT':
      return 'percent-stepper';
    case 'DAYS':
      return 'days-field';
    case 'MONTHS':
      return 'months-field';
    case 'UNITS':
      return 'amount-precise';
    default:
      return 'plain-number';
  }
}

export interface DriverMeta {
  labelPl: string;
  /** Bezpieczny zakres domyślny gdy `rangeLow`/`rangeHigh` nie są ustawione na wierszu (tylko dla kontrolek procentowych — stepper/suwak wymaga jakichś granic do narysowania się). */
  defaultSafeRangePct?: [number, number];
}

/** Znane drivery (z realnej fikstury `perfSlo.pg.test.ts`) — reszta dostaje etykietę = surowy `driverCode`. */
export const DRIVER_META: Record<string, DriverMeta> = {
  REVENUE_GROWTH_YOY: { labelPl: 'Wzrost przychodów r/r', defaultSafeRangePct: [-0.2, 0.4] },
  COGS_PCT_OF_REVENUE: { labelPl: 'COGS jako % przychodów', defaultSafeRangePct: [0.3, 0.85] },
  OPEX_PCT_OF_REVENUE: { labelPl: 'OPEX jako % przychodów', defaultSafeRangePct: [0.05, 0.4] },
  DSO_DAYS: { labelPl: 'Dni należności (DSO)' },
  DIO_DAYS: { labelPl: 'Dni zapasów (DIO)' },
  DPO_DAYS: { labelPl: 'Dni zobowiązań (DPO)' },
  CAPEX_PCT_OF_REVENUE: { labelPl: 'CAPEX jako % przychodów', defaultSafeRangePct: [0.01, 0.15] },
  USEFUL_LIFE_MONTHS: { labelPl: 'Okres użytkowania (m-ce)' },
  STATUTORY_TAX_RATE_PCT: { labelPl: 'Stawka podatku CIT', defaultSafeRangePct: [0, 0.35] },
  CASH_INTEREST_RATE_ANNUAL_PCT: { labelPl: 'Oprocentowanie gotówki (roczne)', defaultSafeRangePct: [0, 0.1] },
};

export function driverLabel(driverCode: string): string {
  return DRIVER_META[driverCode]?.labelPl ?? driverCode;
}

/** Formatuje liczbę wg pl-PL, tabular — MISSING/NA/NOT_APPLICABLE muszą wołać `formatFinanceValueForDisplay`, NIGDY tej funkcji wprost na `null`. */
export function formatNumberPl(n: number, opts: { maximumFractionDigits?: number } = {}): string {
  return n.toLocaleString('pl-PL', { maximumFractionDigits: opts.maximumFractionDigits ?? 0 });
}

export function formatPercentPl(fraction: number): string {
  return `${(fraction * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}
