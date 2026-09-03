/**
 * DYŻUR 200 — dedykowany harness zrzutów dla 14 pozostałych paneli finansowych
 * z rejestru `FinanceValuePanelsSurface.tsx` (flaga `ff.finance_value_panels`,
 * domyślnie OFF), które NIE są objęte istniejącym `finance-value-panels.tsx`
 * (ten obsługuje: value, driver, monte-carlo, real-options, frontier,
 * sensitivity, scenarios — 7/21).
 *
 * Wzór: `dev-render/screens/finance-value-panels.tsx` (ta sama konwencja:
 * REALNE komponenty prezentacyjne, mock-dane wstrzykiwane przez `fetcher`,
 * `AutoRun` klika przycisk(i) „uruchom" po zamontowaniu, żeby zrzut pokazywał
 * WYPEŁNIONY stan, nie pusty formularz).
 *
 * Dwa panele (`CashForecastPanel`, `VarianceNarrationPanel`) nie mają punktu
 * wstrzyknięcia `fetcher` — wołają `postCashForecast`/`postVarianceNarrate`
 * wprost (prawdziwe `POST /api/v8/finance-planning/cash-forecast` i
 * `POST /api/v8/finance-intelligence/variance/narrate`, patrz korekta #2 w
 * raporcie dyżuru 200). Ten harness nie uruchamia backendu, więc dla TYCH
 * DWÓCH podmieniamy `window.fetch` (na poziomie modułu, raz, patrz
 * `installFetchStubs` niżej) — realny komponent, przechwycona wyłącznie
 * warstwa sieci pod dokładnie te dwie ścieżki; każdy inny request przechodzi
 * do oryginalnego fetch bez zmian.
 *
 * URL params (jak w finance-value-panels.tsx):
 *   ?panel=banking|cash-forecast|driver-tree|extended-ratios|headcount|
 *          investment-appraisal|rolling-forecast|valuation-visuals|
 *          value-attribution|value-capture|value-ledger|variance-bridge|
 *          variance-narration|ev-basket
 *   &theme=light|dark  (harness-wide, patrz main.tsx)
 */
import React, { useEffect } from 'react';

import { BankingValuePanel } from '../../src/components/Economics/panels/BankingValuePanel';
import { CashForecastPanel } from '../../src/components/Economics/panels/CashForecastPanel';
import {
  type DriverChartNode,
  DriverTreePanel,
} from '../../src/components/Economics/panels/DriverTreePanel';
import { EvBasketFootballField } from '../../src/components/Economics/panels/EvBasketFootballField';
import type { EvBasketResult } from '../../src/components/Economics/panels/EvBasketFootballField';
import { ExtendedRatiosPanel } from '../../src/components/Economics/panels/ExtendedRatiosPanel';
import { HeadcountPlannerPanel } from '../../src/components/Economics/panels/HeadcountPlannerPanel';
import { InvestmentAppraisalPanel } from '../../src/components/Economics/panels/InvestmentAppraisalPanel';
import { RollingForecastPanel } from '../../src/components/Economics/panels/RollingForecastPanel';
import { ValuationVisualsPanel } from '../../src/components/Economics/panels/ValuationVisualsPanel';
import type { ValuationResults } from '../../src/components/Economics/panels/ValuationVisualsPanel';
import { ValueAttributionPanel } from '../../src/components/Economics/panels/ValueAttributionPanel';
import { ValueCapturePipelinePanel } from '../../src/components/Economics/panels/ValueCapturePipelinePanel';
import { ValueLedgerPanel } from '../../src/components/Economics/panels/ValueLedgerPanel';
import { VarianceBridgePanel } from '../../src/components/Economics/panels/VarianceBridgePanel';
import { VarianceNarrationPanel } from '../../src/components/Economics/panels/VarianceNarrationPanel';

// ── AutoRun — identyczny wzorzec co w finance-value-panels.tsx: po zamontowaniu
// klika kolejno wskazane data-testid, żeby zrzut łapał WYPEŁNIONY wynik. ──────
function AutoRun({ testIds, children }: { testIds: string[]; children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const testId of testIds) {
        if (cancelled) return;
        document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
        // Małe odstępy między klikami — niektóre handlery czytają stan formularza
        // po poprzednim ustawieniu wyniku (React batching), zbyt szybki drugi
        // klik potrafi trafić w jeszcze nieprzemontowany DOM.
        await new Promise((r) => setTimeout(r, 250));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testIds]);
  return <>{children}</>;
}

/**
 * `CashForecastPanel` i `VarianceNarrationPanel` nie przyjmują `fetcher` —
 * wołają realny `v8Post` wprost. Podmieniamy `window.fetch` WYŁĄCZNIE dla ich
 * dwóch ścieżek na czas życia strony harnessu; każdy inny request (locales,
 * HMR, inne assety) idzie do oryginalnego fetch bez zmian.
 *
 * ★ Instalowane na POZIOMIE MODUŁU, NIE w `useEffect`: React commit'uje
 * efekty dziecko→rodzic (bottom-up), więc gdyby patch siedział w efekcie
 * hosta-rodzica, `AutoRun` (dziecko) zdążyłby kliknąć przycisk i wystrzelić
 * PRAWDZIWY (niezałatany) fetch, zanim efekt rodzica w ogóle by wystartował
 * — złapane na `variance-narration`: konsola pokazywała żywe 404 z dev-servera
 * mimo obecności stuba w kodzie. Moduł tego ekranu jest importowany leniwie
 * (`React.lazy`) tylko gdy ten screen jest wybrany, więc kod na poziomie
 * modułu i tak wykonuje się raz, w pełni PRZED zamontowaniem jakiegokolwiek
 * komponentu potomnego.
 */
function installFetchStubs(stubs: Array<{ pathSuffix: string; jsonData: unknown }>): void {
  const w = window as unknown as { __day200FetchStubbed?: boolean };
  if (w.__day200FetchStubbed) return;
  w.__day200FetchStubbed = true;
  const original = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const hit = stubs.find((s) => url.includes(s.pathSuffix));
    if (hit) {
      return new Response(JSON.stringify({ data: hit.jsonData, meta: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return original(input, init);
  }) as typeof window.fetch;
}

// ── Mock-dane — realistyczna skala DBR77 (jak istniejące 7 zrzuconych paneli
// i istniejący `dev-render/screens/ev-football-field.tsx`). ─────────────────

const BANKING_BANK_RESULT = {
  bankedAmount: 400_000,
  budgetLineImpact: { lineCode: 'OPEX-IT', deltaValue: -400_000 },
  period: '2027-Q1',
};
const BANKING_STATUS_RESULT = { status: 'banked' as const, variance: 20_000 };
const BANKING_PORTFOLIO_RESULT = {
  totalBanked: 550_000,
  totalPending: 150_000,
  totalLeaked: 70_000,
  bankedPct: 0.69,
};

const CASH_FORECAST_RESPONSE = {
  forecast: [
    { period: 'M1', inflows: 120_000, outflows: 150_000, netCash: -30_000, closingCash: 220_000 },
    { period: 'M2', inflows: 125_000, outflows: 150_000, netCash: -25_000, closingCash: 195_000 },
    { period: 'M3', inflows: 130_000, outflows: 155_000, netCash: -25_000, closingCash: 170_000 },
    { period: 'M4', inflows: 135_000, outflows: 150_000, netCash: -15_000, closingCash: 155_000 },
  ],
  runway: { runwayPeriods: 8.2, cashOutPeriod: null },
  alerts: [],
  curve: [
    { t: 'M0', cash: 250_000 },
    { t: 'M1', cash: 220_000 },
    { t: 'M2', cash: 195_000 },
    { t: 'M3', cash: 170_000 },
    { t: 'M4', cash: 155_000 },
  ],
};

const DRIVER_TREE_EVALUATE = {
  values: { customers: 1000, arpu: 120, revenue: 120_000 },
  order: ['customers', 'arpu', 'revenue'],
};
const DRIVER_TREE_CHART: { root: DriverChartNode } = {
  root: {
    id: 'revenue',
    label: 'Revenue',
    value: 120_000,
    formula: 'customers × arpu',
    op: '*',
    children: [
      { id: 'customers', label: 'Customers', value: 1000, children: [] },
      { id: 'arpu', label: 'ARPU', value: 120, children: [] },
    ],
  },
};

const EXTENDED_RATIOS_RESULT = [
  { code: 'ROE', label: 'ROE', value: 0.15, category: 'return' as const, status: 'ok' as const },
  { code: 'ROA', label: 'ROA', value: 0.06, category: 'return' as const, status: 'ok' as const },
  {
    code: 'ROIC',
    label: 'ROIC',
    value: 0.1166,
    category: 'return' as const,
    status: 'ok' as const,
  },
  {
    code: 'DE',
    label: 'Dług/Kapitał (D/E)',
    value: 0.75,
    category: 'leverage' as const,
    status: 'warn' as const,
  },
  {
    code: 'NET_DEBT_EBITDA',
    label: 'Dług netto/EBITDA',
    value: 1.73,
    category: 'leverage' as const,
    status: 'ok' as const,
  },
  {
    code: 'DSCR',
    label: 'DSCR',
    value: 2.1,
    category: 'coverage' as const,
    status: 'ok' as const,
  },
  {
    code: 'ASSET_TURN',
    label: 'Rotacja aktywów',
    value: 0.75,
    category: 'efficiency' as const,
    status: 'ok' as const,
  },
  {
    code: 'FIXED_ASSET_TURN',
    label: 'Rotacja aktywów trwałych',
    value: 1.67,
    category: 'efficiency' as const,
    status: 'ok' as const,
  },
];
const EXTENDED_DUPONT_RESULT = {
  roe: 0.15,
  netMargin: 0.08,
  assetTurnover: 0.75,
  equityMultiplier: 2.5,
};
const EXTENDED_BENCHMARK_RESULT = { percentile: 'above' as const, status: 'ok' as const };

const HEADCOUNT_OPEX_RESULT = {
  rows: [
    { period: 'M1', headcount: 1, totalSalary: 4_000, totalLoaded: 5_000 },
    { period: 'M2', headcount: 2, totalSalary: 10_500, totalLoaded: 13_050 },
    { period: 'M3', headcount: 2, totalSalary: 13_000, totalLoaded: 16_150 },
    { period: 'M4', headcount: 2, totalSalary: 13_000, totalLoaded: 16_150 },
    { period: 'M5', headcount: 2, totalSalary: 13_000, totalLoaded: 16_150 },
    { period: 'M6', headcount: 2, totalSalary: 13_000, totalLoaded: 16_150 },
  ],
};
const HEADCOUNT_SUMMARY_RESULT = { summary: { totalRoles: 2, avgLoadedAnnual: 96_600 } };

// `irr`/`mirr` to procent 0–100 (nie ułamek) — `InvestmentAppraisalPanel.fmtPct`
// robi tylko `v.toFixed(1)+'%'`, bez mnożenia ×100 (ten sam wzorzec jak
// `discountRatePct`/`hurdleRatePct` — sufiks "Pct" = już w procentach).
const APPRAISAL_RESULT = {
  npv: 512_340,
  irr: 18.4,
  mirr: 15.2,
  payback: 2.6,
  discountedPayback: 3.1,
  pi: 1.34,
  verdict: 'go' as const,
};

const ROLLING_REFORECAST_RESULT = {
  lines: [
    { period: 'P01', value: 98_000, source: 'actual' as const },
    { period: 'P02', value: 108_000, source: 'actual' as const },
    { period: 'P03', value: 110_000, source: 'forecast' as const },
    { period: 'P04', value: 115_000, source: 'forecast' as const },
    { period: 'P05', value: 120_000, source: 'forecast' as const },
  ],
};
const ROLLING_ROLLFORWARD_RESULT = {
  lines: [
    { period: 'P06', value: 124_000 },
    { period: 'P07', value: 128_000 },
    { period: 'P08', value: 132_000 },
  ],
};

const VALUATION_VISUALS_MOCK: ValuationResults = {
  dcf: { enterpriseValue: 215_000_000 },
  comps: { impliedEnterpriseValue: { min: 170_000_000, median: 195_000_000, max: 220_000_000 } },
  sensitivity: {
    waccGrid: [9, 10, 11, 12, 13],
    gGrid: [1, 2, 3],
    matrix: [9, 10, 11, 12, 13].flatMap((wacc) =>
      [1, 2, 3].map((g) => ({ wacc, g, ev: 260_000_000 - wacc * 6_000_000 + g * 8_000_000 }))
    ),
  },
  tornado: [
    { label: 'Wzrost przychodów', low: 180_000_000, high: 250_000_000 },
    { label: 'Marża brutto', low: 195_000_000, high: 235_000_000 },
    { label: 'WACC', low: 190_000_000, high: 240_000_000 },
  ],
  assetBased: { enterpriseValue: 165_000_000 },
};

const ATTRIBUTION_RESULT = {
  totalAttributed: 620_000,
  byKpi: [
    { kpiId: 'kpi-margin', delta: 10, attributed: 500_000, unexplainedRemainder: 0 },
    { kpiId: 'kpi-churn', delta: 5, attributed: 120_000, unexplainedRemainder: 30_000 },
  ],
  doubleCountAvoided: 100_000,
};

const CAPTURE_FUNNEL_RESULT = [
  { gate: 'G0' as const, count: 8, totalValue: 2_400_000, conversionFromPrev: 1 },
  { gate: 'G1' as const, count: 6, totalValue: 1_950_000, conversionFromPrev: 0.75 },
  { gate: 'G2' as const, count: 5, totalValue: 1_600_000, conversionFromPrev: 0.83 },
  { gate: 'G3' as const, count: 4, totalValue: 1_250_000, conversionFromPrev: 0.8 },
  { gate: 'G4' as const, count: 3, totalValue: 980_000, conversionFromPrev: 0.75 },
  { gate: 'G5' as const, count: 2, totalValue: 620_000, conversionFromPrev: 0.67 },
];
const CAPTURE_INITIATIVES_RESULT = [
  { id: 'init-001', title: 'Wdrożenie ERP — Berlin' },
  { id: 'init-002', title: 'Optymalizacja łańcucha dostaw' },
  { id: 'init-003', title: 'Automatyzacja fakturowania' },
];
const CAPTURE_GATES_RESULT = [
  {
    id: 'gate-1',
    organizationId: 'org-demo',
    initiativeId: 'init-001',
    gate: 'G3' as const,
    status: 'passed' as const,
    criteria: 'Podpisana umowa wdrożeniowa',
    signedOffBy: 'a.kowalska',
    signedOffAt: '2026-06-01T10:00:00Z',
    valueEvidence: 420_000,
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'gate-2',
    organizationId: 'org-demo',
    initiativeId: 'init-002',
    gate: 'G2' as const,
    status: 'pending' as const,
    criteria: 'Potwierdzenie oszczędności w budżecie Q3',
    signedOffBy: null,
    signedOffAt: null,
    valueEvidence: 180_000,
    createdAt: '2026-05-12T08:00:00Z',
    updatedAt: '2026-05-12T08:00:00Z',
  },
  {
    id: 'gate-3',
    organizationId: 'org-demo',
    initiativeId: 'init-003',
    gate: 'G5' as const,
    status: 'passed' as const,
    criteria: 'Audyt finansowy zamknięty',
    signedOffBy: 'm.nowak',
    signedOffAt: '2026-07-20T14:00:00Z',
    valueEvidence: 310_000,
    createdAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-07-20T14:00:00Z',
  },
];

const LEDGER_CURRENT_VALUE_RESULT = {
  current: 1_180_000,
  baselineValue: 1_000_000,
  auditTrail: [
    {
      kind: 'baseline',
      id: 'base-1',
      delta: 1_000_000,
      runningTotal: 1_000_000,
      reason: 'Zamrożona wartość bazowa Q1',
      at: '2026-01-15T09:00:00Z',
    },
    {
      kind: 'correction',
      id: 'entry-1',
      delta: 120_000,
      runningTotal: 1_120_000,
      reason: 'Aktualizacja po recertyfikacji KPI',
      at: '2026-04-10T09:00:00Z',
    },
    {
      kind: 'correction',
      id: 'entry-2',
      delta: 60_000,
      runningTotal: 1_180_000,
      reason: 'Dodatkowe oszczędności operacyjne Q2',
      at: '2026-06-20T09:00:00Z',
    },
  ],
};

const VARIANCE_BRIDGE_LINES = [
  { label: 'Revenue', plan: 1_000_000, actual: 940_000, isCost: false },
  { label: 'COGS', plan: 400_000, actual: 430_000, isCost: true },
  { label: 'Marketing', plan: 120_000, actual: 95_000, isCost: true },
];
const VARIANCE_BRIDGE_RESULT = {
  steps: [
    { label: 'Plan', value: 480_000, kind: 'start' as const },
    { label: 'Revenue', value: 60_000, kind: 'decrease' as const },
    { label: 'COGS', value: 30_000, kind: 'decrease' as const },
    { label: 'Marketing', value: 25_000, kind: 'increase' as const },
    { label: 'Actual', value: 415_000, kind: 'total' as const },
  ],
  totalVariance: -65_000,
};

// `pct`/`sharePct` to procent 0–100 (nie ułamek) — patrz server
// `varianceNarrationService.ts`: `roundTo((Math.abs(x) / totalAbs) * 100, 1)`.
const VARIANCE_NARRATE_RESPONSE = {
  narration: {
    headline:
      'Wynik poniżej planu — niższe przychody nie zostały w pełni zrekompensowane oszczędnościami w marketingu',
    drivers: [
      { line: 'Revenue', contribution: -60_000, pct: 52.2, direction: 'unfavorable' as const },
      { line: 'COGS', contribution: -30_000, pct: 26.1, direction: 'unfavorable' as const },
      { line: 'Marketing', contribution: 25_000, pct: 21.7, direction: 'favorable' as const },
    ],
    commentary:
      'Przychody spadły o 60k wobec planu, częściowo skompensowane niższymi kosztami marketingu (+25k); łączna niekorzystna wariancja to 65k.',
  },
  drivers: [
    { line: 'Revenue', variance: -60_000, sharePct: 52.2 },
    { line: 'COGS', variance: -30_000, sharePct: 26.1 },
    { line: 'Marketing', variance: 25_000, sharePct: 21.7 },
  ],
  severity: 'watch' as const,
};

// Instalacja NA POZIOMIE MODUŁU (patrz komentarz przy `installFetchStubs`
// powyżej) — wykonuje się raz, w pełni przed zamontowaniem jakiegokolwiek
// komponentu, więc `AutoRun` nigdy nie zdąży kliknąć przed patchem.
installFetchStubs([
  { pathSuffix: '/finance-planning/cash-forecast', jsonData: CASH_FORECAST_RESPONSE },
  { pathSuffix: '/finance-intelligence/variance/narrate', jsonData: VARIANCE_NARRATE_RESPONSE },
]);

// Ten sam koszyk co istniejący `dev-render/screens/ev-football-field.tsx`
// (skala DBR77, 4 metody, strefa przecięcia + flaga rozjazdu) — zachowuje
// spójność stylu danych między dwoma harnessami tego samego panelu.
const EV_BASKET_MOCK: EvBasketResult = {
  methods: [
    {
      key: 'dcf',
      label: 'DCF (zdyskontowane przepływy)',
      low: 185,
      mid: 215,
      high: 245,
      weight: 0.35,
      note: 'WACC 11.2% · wzrost rezydualny 2.5%',
    },
    {
      key: 'trading_multiples',
      label: 'Mnożniki rynkowe (EV/Revenue)',
      low: 170,
      mid: 195,
      high: 220,
      weight: 0.2,
      note: 'EV/Revenue 3.2–4.1x · grupa porównawcza SaaS B2B',
    },
    {
      key: 'ev_ebitda',
      label: 'EV/EBITDA',
      low: 175,
      mid: 200,
      high: 225,
      weight: 0.25,
      note: 'EV/EBITDA 11–14x · EBITDA znormalizowana 16.8M',
    },
    {
      key: 'precedent_transactions',
      label: 'Transakcje porównywalne',
      low: 205,
      mid: 245,
      high: 285,
      weight: 0.2,
      note: '3 transakcje sektorowe 2024–2025 · premia kontrolna 15%',
    },
  ],
  intersection: { low: 205, high: 220 },
  recommended: { low: 205, mid: 213, high: 220 },
  consistencyFlag: {
    triggered: true,
    thresholdPct: 20,
    maxDivergencePct: 25.6,
    message:
      'Transakcje porównywalne odchylają się istotnie od mnożników rynkowych — sprawdź dobór transakcji i premię kontrolną.',
    topDriver: {
      methods: ['trading_multiples', 'precedent_transactions'],
      divergencePct: 25.6,
      lowerLabel: 'Mnożniki rynkowe (EV/Revenue)',
      higherLabel: 'Transakcje porównywalne',
    },
  },
  weights: { dcf: 0.35, trading_multiples: 0.2, ev_ebitda: 0.25, precedent_transactions: 0.2 },
};

// Per-panel maksymalna szerokość hosta — zgodnie z konwencją finance-value-panels.tsx
// (720 dla wąskich formularzy), poszerzone tam, gdzie wewnętrzne tabele/wykresy
// tego wymagają (jak istniejący ev-football-field.tsx: 980).
const WIDTH: Record<string, number> = {
  banking: 760,
  'cash-forecast': 820,
  'driver-tree': 720,
  'extended-ratios': 900,
  headcount: 860,
  'investment-appraisal': 780,
  'rolling-forecast': 860,
  'valuation-visuals': 980,
  'value-attribution': 860,
  'value-capture': 900,
  'value-ledger': 720,
  'variance-bridge': 780,
  'variance-narration': 780,
  'ev-basket': 980,
};

export interface Day200FinancePanelsScreenProps {
  panelOverride?: string;
}

export default function Day200FinancePanelsScreen({
  panelOverride,
}: Day200FinancePanelsScreenProps = {}): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const panel = panelOverride ?? params.get('panel') ?? 'banking';

  let body: React.ReactElement;
  switch (panel) {
    case 'banking':
      body = (
        <AutoRun testIds={['banking-bank', 'banking-check-status', 'banking-portfolio-run']}>
          <BankingValuePanel
            fetcher={{
              bank: async () => BANKING_BANK_RESULT,
              status: async () => BANKING_STATUS_RESULT,
              portfolio: async () => BANKING_PORTFOLIO_RESULT,
            }}
          />
        </AutoRun>
      );
      break;
    case 'cash-forecast':
      body = (
        <AutoRun testIds={['cash-forecast-run']}>
          <CashForecastPanel />
        </AutoRun>
      );
      break;
    case 'driver-tree':
      body = (
        <AutoRun testIds={['driver-tree-run']}>
          <DriverTreePanel
            fetcher={{
              evaluate: async () => DRIVER_TREE_EVALUATE,
              chart: async () => DRIVER_TREE_CHART,
            }}
          />
        </AutoRun>
      );
      break;
    case 'extended-ratios':
      body = (
        <AutoRun testIds={['ratios-compute', 'ratios-dupont-compute', 'ratios-benchmark-run']}>
          <ExtendedRatiosPanel
            fetcher={{
              extended: async () => EXTENDED_RATIOS_RESULT,
              dupont: async () => EXTENDED_DUPONT_RESULT,
              benchmark: async () => EXTENDED_BENCHMARK_RESULT,
            }}
          />
        </AutoRun>
      );
      break;
    case 'headcount':
      body = (
        <AutoRun testIds={['headcount-run']}>
          <HeadcountPlannerPanel
            fetcher={{
              opex: async () => HEADCOUNT_OPEX_RESULT,
              summary: async () => HEADCOUNT_SUMMARY_RESULT,
            }}
          />
        </AutoRun>
      );
      break;
    case 'investment-appraisal':
      body = (
        <AutoRun testIds={['appraise-compute']}>
          <InvestmentAppraisalPanel fetcher={async () => APPRAISAL_RESULT} />
        </AutoRun>
      );
      break;
    case 'rolling-forecast':
      body = (
        <AutoRun testIds={['rolling-forecast-run']}>
          <RollingForecastPanel
            fetcher={{
              reforecast: async () => ROLLING_REFORECAST_RESULT,
              rollForward: async () => ROLLING_ROLLFORWARD_RESULT,
            }}
          />
        </AutoRun>
      );
      break;
    case 'valuation-visuals':
      body = <ValuationVisualsPanel valuation={VALUATION_VISUALS_MOCK} />;
      break;
    case 'value-attribution':
      body = (
        <AutoRun testIds={['attribution-run']}>
          <ValueAttributionPanel fetcher={async () => ATTRIBUTION_RESULT} />
        </AutoRun>
      );
      break;
    case 'value-capture':
      // Auto-ładuje się w useEffect przy montowaniu (bez klikania) — patrz
      // ValueCapturePipelinePanel.tsx `useEffect(() => { void load(); }, [])`.
      body = (
        <ValueCapturePipelinePanel
          fetcher={{
            funnel: async () => CAPTURE_FUNNEL_RESULT,
            gates: async () => CAPTURE_GATES_RESULT,
            listInitiatives: async () => CAPTURE_INITIATIVES_RESULT,
          }}
        />
      );
      break;
    case 'value-ledger':
      body = (
        <AutoRun testIds={['ledger-refresh']}>
          <ValueLedgerPanel fetcher={{ currentValue: async () => LEDGER_CURRENT_VALUE_RESULT }} />
        </AutoRun>
      );
      break;
    case 'variance-bridge':
      // Auto-fetch w useEffect gdy `lines` jest niepuste — patrz
      // VarianceBridgePanel.tsx (bez przycisku, bez AutoRun).
      body = (
        <VarianceBridgePanel
          lines={VARIANCE_BRIDGE_LINES}
          fetcher={async () => VARIANCE_BRIDGE_RESULT}
        />
      );
      break;
    case 'variance-narration':
      body = (
        <AutoRun testIds={['variance-narration-run']}>
          <VarianceNarrationPanel />
        </AutoRun>
      );
      break;
    case 'ev-basket':
      body = (
        <EvBasketFootballField
          basket={EV_BASKET_MOCK}
          unitLabel="mln PLN"
          subjectLabel="DBR77 Sp. z o.o. — Wycena Q2 2026"
        />
      );
      break;
    default:
      body = (
        <div style={{ fontFamily: 'system-ui', fontSize: 13, color: 'var(--c-danger)' }}>
          Nieznany panel: {panel}
        </div>
      );
  }

  const maxWidth = WIDTH[panel] ?? 760;

  return (
    <div style={{ maxWidth, margin: '0 auto', padding: 24, background: 'var(--c-bg)' }}>
      <div
        style={{
          marginBottom: 12,
          fontFamily: 'system-ui',
          fontSize: 12,
          color: 'var(--c-text-muted)',
        }}
      >
        day200 · panel=<b>{panel}</b>
      </div>
      {body}
    </div>
  );
}
