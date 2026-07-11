/**
 * Mock host for <FinanceLightShell> — the Finance module light shell.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 scale-up numbers shaped exactly like the engine output contracts:
 *   - statementLines: key P&L/BS/CF lines (display only, mln PLN)
 *   - reconcile: shape of `reconciliationService.ts` (R1–R8 check codes)
 *   - ratios: shape of `financeRatioFamilyCatalog.ts` (5 families, 24 codes)
 *   - evBasket: identical `EvBasketResult` mock used by the EV football-field
 *     harness (ev-football-field.tsx) — same DBR77 valuation numbers, so the
 *     two harnesses agree.
 *   - prediction: 4-quarter revenue/EBITDA forecast with model confidence.
 */
import React from 'react';

import FinanceLightShell, {
  type FinanceRatioLite,
  type ReconcileCheckLite,
} from '../../src/components/Economics/FinanceLightShell';
import type { EvBasketResult } from '../../src/components/Economics/panels/EvBasketFootballField';

const STATEMENT_LINES = [
  { label: 'Przychód', value: 68_400_000 },
  { label: 'EBITDA', value: 16_800_000 },
  { label: 'Zysk netto', value: 9_150_000 },
  { label: 'Aktywa razem', value: 54_200_000 },
  { label: 'Kapitał własny', value: 31_600_000 },
  { label: 'Gotówka', value: 11_300_000 },
];

const RECONCILE_CHECKS: ReconcileCheckLite[] = [
  {
    checkCode: 'R1_BS_EQUATION',
    checkName: 'Aktywa = Pasywa + Kapitał',
    status: 'pass',
    severity: 'error',
    message: 'Bilans domyka się co do grosza (różnica 0 PLN).',
  },
  {
    checkCode: 'R2_CASH_TIEOUT',
    checkName: 'Uzgodnienie gotówki',
    status: 'pass',
    severity: 'error',
    message: 'Zmiana gotówki z CF zgadza się z różnicą bilansową.',
  },
  {
    checkCode: 'R3_NET_INCOME_TIE',
    checkName: 'Zysk netto P&L = CF',
    status: 'pass',
    severity: 'error',
    message: 'Zysk netto w rachunku wyników zgadza się z punktem startowym cash flow.',
  },
  {
    checkCode: 'R4_PPE_ROLLFORWARD',
    checkName: 'Rolka środków trwałych',
    status: 'warning',
    severity: 'warning',
    message: 'CAPEX z CF nieco odbiega od przyrostu PPE — sprawdź sprzedaż/likwidację środków.',
  },
  {
    checkCode: 'R5_DEBT_ROLLFORWARD',
    checkName: 'Rolka zadłużenia',
    status: 'pass',
    severity: 'error',
    message: 'Zaciągnięcia i spłaty zgadzają się ze zmianą salda długu.',
  },
  {
    checkCode: 'R6_WC_BRIDGE',
    checkName: 'Mostek kapitału obrotowego',
    status: 'pass',
    severity: 'warning',
    message: 'Zmiana AR/zapasów/AP w CF zgadza się z różnicą bilansową.',
  },
  {
    checkCode: 'R7_PERIOD_CONTINUITY',
    checkName: 'Ciągłość okresów',
    status: 'pass',
    severity: 'warning',
    message: 'Bilans zamknięcia okresu = bilans otwarcia okresu kolejnego.',
  },
  {
    checkCode: 'R8_SIGN_MAGNITUDE_SANITY',
    checkName: 'Sensowność znaków i rzędów wielkości',
    status: 'skipped',
    severity: 'warning',
    message: 'Pominięte — kalibracja znaków DBR77 (spec §5) jeszcze nie zamknięta.',
  },
];

const RECONCILE = {
  checks: RECONCILE_CHECKS,
  summary: {
    passed: RECONCILE_CHECKS.filter((c) => c.status === 'pass').length,
    warnings: RECONCILE_CHECKS.filter((c) => c.status === 'warning').length,
    failed: RECONCILE_CHECKS.filter((c) => c.status === 'fail').length,
    skipped: RECONCILE_CHECKS.filter((c) => c.status === 'skipped').length,
    overallStatus: 'warning' as const,
  },
};

// 24 ratios across the 5 families (mirrors financeRatioFamilyCatalog.ts codes).
const RATIOS: FinanceRatioLite[] = [
  // Płynność
  { code: 'CURRENT_RATIO', family: 'liquidity', labelPl: 'Wskaźnik bieżącej płynności', formula: 'Aktywa obrotowe / Zobowiązania krótkoterm.', value: 1.85, unit: 'x', direction: 'higher_better', status: 'computed' },
  { code: 'QUICK_RATIO', family: 'liquidity', labelPl: 'Wskaźnik szybkiej płynności', formula: '(Aktywa obrotowe − Zapasy) / Zob. krótkoterm.', value: 1.42, unit: 'x', direction: 'higher_better', status: 'computed' },
  { code: 'CASH_RATIO', family: 'liquidity', labelPl: 'Wskaźnik gotówkowej płynności', formula: 'Gotówka / Zobowiązania krótkoterm.', value: 0.61, unit: 'x', direction: 'higher_better', status: 'computed' },
  { code: 'CCC', family: 'liquidity', labelPl: 'Cykl konwersji gotówki', formula: 'DSO + DIO − DPO', value: 38, unit: 'days', direction: 'lower_better', status: 'computed' },
  // Rentowność
  { code: 'GROSS_MARGIN', family: 'profitability', labelPl: 'Marża brutto', formula: 'Zysk brutto / Przychód × 100', value: 54.2, unit: '%', direction: 'higher_better', status: 'computed' },
  { code: 'EBITDA_MARGIN', family: 'profitability', labelPl: 'Marża EBITDA', formula: 'EBITDA / Przychód × 100', value: 24.6, unit: '%', direction: 'higher_better', status: 'computed' },
  { code: 'OPERATING_MARGIN', family: 'profitability', labelPl: 'Marża operacyjna', formula: 'EBIT / Przychód × 100', value: 18.3, unit: '%', direction: 'higher_better', status: 'computed' },
  { code: 'NET_MARGIN', family: 'profitability', labelPl: 'Marża netto', formula: 'Zysk netto / Przychód × 100', value: 13.4, unit: '%', direction: 'higher_better', status: 'computed' },
  { code: 'ROA', family: 'profitability', labelPl: 'Rentowność aktywów (ROA)', formula: 'Zysk netto / Aktywa razem × 100', value: 16.9, unit: '%', direction: 'higher_better', status: 'computed' },
  { code: 'ROE', family: 'profitability', labelPl: 'Rentowność kapitału (ROE)', formula: 'Zysk netto / Kapitał własny × 100', value: 29.0, unit: '%', direction: 'higher_better', status: 'computed' },
  // Zadłużenie
  { code: 'DEBT_TO_EQUITY', family: 'leverage', labelPl: 'Dług / kapitał własny', formula: 'Dług razem / Kapitał własny', value: 0.72, unit: 'x', direction: 'lower_better', status: 'computed' },
  { code: 'NET_DEBT_TO_EBITDA', family: 'leverage', labelPl: 'Dług netto / EBITDA', formula: '(Dług razem − Gotówka) / EBITDA', value: 1.1, unit: 'x', direction: 'lower_better', status: 'computed' },
  { code: 'INTEREST_COVERAGE', family: 'leverage', labelPl: 'Pokrycie odsetek', formula: 'EBIT / Koszty odsetkowe', value: 8.4, unit: 'x', direction: 'higher_better', status: 'computed' },
  { code: 'NET_DEBT', family: 'leverage', labelPl: 'Dług netto', formula: 'Dług razem − Gotówka', value: null, unit: 'currency', direction: 'lower_better', status: 'skipped' },
  { code: 'EQUITY_RATIO', family: 'leverage', labelPl: 'Wskaźnik kapitału własnego', formula: 'Kapitał własny / Aktywa razem', value: 58.3, unit: '%', direction: 'higher_better', status: 'computed' },
  // Efektywność
  { code: 'ASSET_TURNOVER', family: 'efficiency', labelPl: 'Rotacja aktywów', formula: 'Przychód / Aktywa razem', value: 1.26, unit: 'x', direction: 'higher_better', status: 'computed' },
  { code: 'DSO', family: 'efficiency', labelPl: 'Rotacja należności (DSO)', formula: 'Należności / Przychód × 365', value: 46, unit: 'days', direction: 'lower_better', status: 'computed' },
  { code: 'DIO', family: 'efficiency', labelPl: 'Rotacja zapasów (DIO)', formula: 'Zapasy / |KWS| × 365', value: 21, unit: 'days', direction: 'lower_better', status: 'computed' },
  { code: 'DPO', family: 'efficiency', labelPl: 'Rotacja zobowiązań (DPO)', formula: 'Zobowiązania / |KWS| × 365', value: 29, unit: 'days', direction: 'lower_better', status: 'computed' },
  { code: 'WC_TURNOVER', family: 'efficiency', labelPl: 'Rotacja kapitału obrotowego', formula: 'Przychód / Kapitał obrotowy', value: 5.8, unit: 'x', direction: 'higher_better', status: 'computed' },
  // Wartość
  { code: 'ROIC', family: 'value', labelPl: 'ROIC', formula: 'NOPAT / Kapitał zainwestowany', value: 19.8, unit: '%', direction: 'higher_better', status: 'computed' },
  { code: 'FCF_CONVERSION', family: 'value', labelPl: 'Konwersja FCF', formula: 'FCF / EBITDA × 100', value: 61.2, unit: '%', direction: 'higher_better', status: 'computed' },
  { code: 'CAPEX_TO_REVENUE', family: 'value', labelPl: 'CAPEX / Przychód', formula: 'CAPEX / Przychód × 100', value: 4.1, unit: '%', direction: 'lower_better', status: 'computed' },
  { code: 'ROIC_WACC_SPREAD', family: 'value', labelPl: 'Spread ROIC − WACC', formula: 'ROIC − WACC', value: null, unit: 'pp', direction: 'higher_better', status: 'skipped' },
];

// Same DBR77 EV basket as the ev-football-field harness — keeps both surfaces
// consistent (Wycena tab embeds the same real component + numbers).
const EV_BASKET: EvBasketResult = {
  methods: [
    { key: 'dcf', label: 'DCF (zdyskontowane przepływy)', low: 185, mid: 215, high: 245, weight: 0.35, note: 'WACC 11.2% · wzrost rezydualny 2.5%' },
    { key: 'trading_multiples', label: 'Mnożniki rynkowe (EV/Revenue)', low: 170, mid: 195, high: 220, weight: 0.2, note: 'EV/Revenue 3.2–4.1x · grupa porównawcza SaaS B2B' },
    { key: 'ev_ebitda', label: 'EV/EBITDA', low: 175, mid: 200, high: 225, weight: 0.25, note: 'EV/EBITDA 11–14x · EBITDA znormalizowana 16.8M' },
    { key: 'precedent_transactions', label: 'Transakcje porównywalne', low: 205, mid: 245, high: 285, weight: 0.2, note: '3 transakcje sektorowe 2024–2025 · premia kontrolna 15%' },
  ],
  intersection: { low: 205, high: 220 },
  recommended: { low: 205, mid: 213, high: 220 },
  consistencyFlag: {
    triggered: true,
    thresholdPct: 20,
    maxDivergencePct: 25.6,
    message: 'Transakcje porównywalne odchylają się istotnie od mnożników rynkowych — sprawdź dobór transakcji i premię kontrolną.',
    topDriver: {
      methods: ['trading_multiples', 'precedent_transactions'],
      divergencePct: 25.6,
      lowerLabel: 'Mnożniki rynkowe (EV/Revenue)',
      higherLabel: 'Transakcje porównywalne',
    },
  },
  weights: { dcf: 0.35, trading_multiples: 0.2, ev_ebitda: 0.25, precedent_transactions: 0.2 },
};

const PREDICTION = [
  { periodLabel: 'Q3 2026', revenue: 18_200_000, ebitda: 4_450_000, confidencePct: 88 },
  { periodLabel: 'Q4 2026', revenue: 19_600_000, ebitda: 4_900_000, confidencePct: 81 },
  { periodLabel: 'Q1 2027', revenue: 20_100_000, ebitda: 5_050_000, confidencePct: 68 },
  { periodLabel: 'Q2 2027', revenue: 21_800_000, ebitda: 5_600_000, confidencePct: 57 },
];

const LINEAGE_SOURCES = [
  { label: 'Pakiet sprawozdań', detail: 'Import Excel · DBR77_FY2025_statements.xlsx · v3' },
  { label: 'Model finansowy', detail: 'Model bazowy · scenariusz „Base case" · v7' },
  { label: 'Koszyk wyceny (EV)', detail: 'valuationBasketService · 4 metody · przeliczono dziś' },
  { label: 'Katalog wskaźników', detail: 'financeRatioFamilyCatalog · 5 rodzin · 24 wskaźniki' },
];

export function FinanceLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <FinanceLightShell
      companyName="DBR77 Sp. z o.o."
      periodLabel="FY2025 (Q2 zamknięty)"
      currency="PLN"
      statementLines={STATEMENT_LINES}
      reconcile={RECONCILE}
      ratios={RATIOS}
      evBasket={EV_BASKET}
      prediction={PREDICTION}
      lineageSources={LINEAGE_SOURCES}
      lastUpdatedLabel="Zaktualizowano dziś, 09:42 · import Excel"
      onExportReport={noop}
      onOpenChat={noop}
    />
  );
}

export default FinanceLightScreen;
