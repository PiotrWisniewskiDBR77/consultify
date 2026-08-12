/**
 * PKG_F (Finance v3 — Baseline Models) — dev-render host for the REAL
 * `<BaselineWorkspace>` (src/components/Finance/BaselineWorkspace.tsx).
 *
 * Zamyka sześć naruszeń, które orkiestrator wskazał na zrzucie starego
 * ekranu „Models" (`?screen=finance-model-workspace`, patrz
 * `docs/validation/finance-v3/generated/gate-e/PKG_F_BASELINE_report.md`
 * §3 — „PRZED"). Ten harness renderuje NOWY, PRAWDZIWY komponent (nie
 * reimplementację) z mockami spiętymi na `window.fetch`, bo
 * `BaselineWorkspace` woła cztery endpointy `/api/v8/finance-v2/baseline/*`
 * (Pakiet B2) przez hooki (`useBaselineAssumptionsEditor`,
 * `useBaselineOutputs`, `useBaselineCompute`) — te hooki importują FUNKCJE
 * NAZWANE z `financeV2.api.ts` (nie metody na mutowalnym obiekcie jak
 * `V8FinanceApi`), więc podmiana metody-na-obiekcie (wzorzec
 * `finance-model-workspace.tsx`) tu nie zadziała — patrz uzasadnienie w
 * raporcie §4. Mock na `window.fetch` jest niezależny od kształtu importu.
 *
 * CLAUDE.md rule #7 — Piotr nigdy nie jest pierwszym testerem wizualnym: ten
 * ekran jest renderowany i zrzucany PRZEZE MNIE (bez logowania Piotra),
 * DOPIERO wtedy idzie do akceptu na zrzutach.
 *
 * URL: ?screen=finance-baseline-workspace[&lang=pl|en][&theme=light|dark]
 *   &view=assumptions|wyliczenia   startowy widok (default: assumptions)
 *   &scene=default|fundinggap      default: model zdrowy (kasa dodatnia);
 *                                   fundinggap: kasa spada poniżej zera w
 *                                   dwóch miesiącach — dowód V-anty-plug na
 *                                   zrzucie (alarm + liczba ujemna, nie 0)
 *   &status=DRAFT|APPROVED|IN_REVIEW  status wersji (default: DRAFT)
 */
import React from 'react';

import { BaselineWorkspace, type BaselineWorkspaceProps, type BaselineWorkspaceView } from '../../src/components/Finance/BaselineWorkspace';
import type { AssumptionRowSpec } from '../../src/components/Finance/baseline/AssumptionsView';
import type { PeriodMeta } from '../../src/components/Finance/baseline/CalculationsView';
import type {
  BaselineAssumptionDto,
  BaselineComputeResultDto,
  BaselineOutputDto,
  BusinessVersionStatus,
} from '../../src/services/api/financeV2.types';

const params = new URLSearchParams(window.location.search);
const initialView = (params.get('view') as BaselineWorkspaceView | null) ?? 'assumptions';
const scene = params.get('scene') === 'fundinggap' ? 'fundinggap' : 'default';
const statusOverride = (params.get('status') as BusinessVersionStatus | null) ?? 'DRAFT';

const BV_ID = 'bv-dbr77-baseline-1';
const ARTIFACT_ID = 'art-dbr77-baseline-1';
const ENTITY_ID = 'ent-dbr77-parent';

// ── Trzy okresy miesięczne (styczeń–marzec 2026) — wystarczające do dowodu
// rollupu miesiąc/kwartał/rok i pełnej szerokości siatki (V-5). ────────────
const FORECAST_PERIODS: PeriodMeta[] = [
  { periodId: 'per-2026-01', label: '01/2026', yearMonth: '2026-01' },
  { periodId: 'per-2026-02', label: '02/2026', yearMonth: '2026-02' },
  { periodId: 'per-2026-03', label: '03/2026', yearMonth: '2026-03' },
];
const OPENING_BS_PERIOD_ID = 'per-2025-12';

// ── Założenia — jedno na typ harmonogramu (7), pełny grid (V-5: brak martwej
// przestrzeni — realistyczna liczba wierszy z realnym źródłem/jakością). ──
const ASSUMPTION_SPECS: Array<{ scheduleType: BaselineAssumptionDto['scheduleType']; driverCode: string; value: string; unit: string; rule: BaselineAssumptionDto['rule']; quality: BaselineAssumptionDto['quality']; historical: string }> = [
  { scheduleType: 'revenue_pvm', driverCode: 'REVENUE_GROWTH_YOY', value: '0.12', unit: 'PCT', rule: 'GROWTH_RATE', quality: 'CONFIRMED', historical: '0.08' },
  { scheduleType: 'cogs_opex', driverCode: 'COGS_PCT_OF_REVENUE', value: '0.58', unit: 'PCT', rule: 'HISTORICAL_AVERAGE', quality: 'CONFIRMED', historical: '0.6' },
  { scheduleType: 'cogs_opex', driverCode: 'OPEX_PCT_OF_REVENUE', value: '0.22', unit: 'PCT', rule: 'HISTORICAL_AVERAGE', quality: 'ESTIMATED', historical: '0.24' },
  { scheduleType: 'wc_dso_dio_dpo', driverCode: 'DSO_DAYS', value: '45', unit: 'DAYS', rule: 'HISTORICAL_AVERAGE', quality: 'CONFIRMED', historical: '42' },
  { scheduleType: 'wc_dso_dio_dpo', driverCode: 'DIO_DAYS', value: '30', unit: 'DAYS', rule: 'HISTORICAL_AVERAGE', quality: 'ESTIMATED', historical: '28' },
  { scheduleType: 'wc_dso_dio_dpo', driverCode: 'DPO_DAYS', value: '35', unit: 'DAYS', rule: 'MANUAL_OVERRIDE', quality: 'DEGRADED_INSUFFICIENT_HISTORY', historical: '31' },
  { scheduleType: 'capex_depreciation', driverCode: 'CAPEX_PCT_OF_REVENUE', value: '0.04', unit: 'PCT', rule: 'FIXED_VALUE', quality: 'ESTIMATED', historical: '0.05' },
  { scheduleType: 'debt_maturity', driverCode: 'CASH_INTEREST_RATE_ANNUAL_PCT', value: '0.055', unit: 'PCT', rule: 'FIXED_VALUE', quality: 'CONFIRMED', historical: '0.05' },
  { scheduleType: 'tax_nol', driverCode: 'STATUTORY_TAX_RATE_PCT', value: '0.19', unit: 'PCT', rule: 'FIXED_VALUE', quality: 'CONFIRMED', historical: '0.19' },
];

const ASSUMPTION_ROW_ORDER: AssumptionRowSpec[] = ASSUMPTION_SPECS.map((s) => ({
  scheduleType: s.scheduleType,
  driverCode: s.driverCode,
  entityId: ENTITY_ID,
  periodId: FORECAST_PERIODS[0].periodId,
}));

const MOCK_ASSUMPTIONS: BaselineAssumptionDto[] = ASSUMPTION_SPECS.map((s, i) => ({
  assumptionId: `assumption-${i}`,
  scheduleType: s.scheduleType,
  driverCode: s.driverCode,
  entityId: ENTITY_ID,
  periodId: FORECAST_PERIODS[0].periodId,
  basePeriodId: OPENING_BS_PERIOD_ID,
  rule: s.rule,
  value: {
    status: 'PRESENT_NONZERO',
    valueDecimal: s.value,
    unit: s.unit,
    sourceRef: { historicalValueDecimal: s.historical, statementPackLabel: 'Pakiet sprawozdań FY2025', analysisVersionLabel: 'Analiza v3' },
  },
  rangeLow: s.unit === 'PCT' ? String(Math.max(0, Number(s.value) - 0.1)) : null,
  rangeHigh: s.unit === 'PCT' ? String(Number(s.value) + 0.1) : null,
  quality: s.quality,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-10T14:00:00.000Z',
}));

// ── Wyliczenia — pełny zestaw 31 linii kanonicznych x 3 okresy. W scenie
// "fundinggap" CASH spada poniżej zera w 02/2026 i 03/2026 (bez plugu). ──
const CANONICAL_LINES: Array<{ code: string; statementType: 'P&L' | 'BS' | 'CF'; values: [number, number, number] }> = [
  { code: 'REVENUE', statementType: 'P&L', values: [420000, 431000, 448000] },
  { code: 'COGS', statementType: 'P&L', values: [-243600, -250000, -260000] },
  { code: 'GROSS_MARGIN', statementType: 'P&L', values: [176400, 181000, 188000] },
  { code: 'OPEX', statementType: 'P&L', values: [-92400, -94800, -98600] },
  { code: 'EBITDA', statementType: 'P&L', values: [84000, 86200, 89400] },
  { code: 'DEPRECIATION', statementType: 'P&L', values: [-8500, -8500, -8700] },
  { code: 'EBIT', statementType: 'P&L', values: [75500, 77700, 80700] },
  { code: 'INTEREST_EXPENSE', statementType: 'P&L', values: [-3200, -3100, -3000] },
  { code: 'TAX_EXPENSE', statementType: 'P&L', values: [-13737, -14174, -14763] },
  { code: 'NET_INCOME', statementType: 'P&L', values: [58563, 60426, 62937] },
  { code: 'AR', statementType: 'BS', values: [630000, 646500, 672000] },
  { code: 'INVENTORY', statementType: 'BS', values: [203000, 208300, 216700] },
  { code: 'CURRENT_ASSETS', statementType: 'BS', values: [833000, 854800, 888700] },
  { code: 'FIXED_ASSETS', statementType: 'BS', values: [410000, 418000, 425000] },
  { code: 'TOTAL_ASSETS', statementType: 'BS', values: [1243000, 1272800, 1313700] },
  { code: 'AP', statementType: 'BS', values: [236000, 241900, 251300] },
  { code: 'CURRENT_LIABILITIES', statementType: 'BS', values: [236000, 241900, 251300] },
  { code: 'LONG_TERM_DEBT', statementType: 'BS', values: [580000, 560000, 540000] },
  { code: 'TOTAL_LIABILITIES', statementType: 'BS', values: [816000, 801900, 791300] },
  { code: 'EQUITY', statementType: 'BS', values: [427000, 487426, 550363] },
  { code: 'TOTAL_LIABILITIES_EQUITY', statementType: 'BS', values: [1243000, 1289326, 1341663] },
  { code: 'RETAINED_EARNINGS', statementType: 'BS', values: [368563, 428989, 491926] },
  { code: 'DIVIDENDS_DECLARED', statementType: 'BS', values: [0, 0, 0] },
  { code: 'WORKING_CAPITAL', statementType: 'BS', values: [597000, 612900, 637400] },
  { code: 'CFO', statementType: 'CF', values: [61000, 58000, 63500] },
  { code: 'CFI', statementType: 'CF', values: [-16800, -17200, -17900] },
  { code: 'CFF', statementType: 'CF', values: [-20000, -20000, -20000] },
  { code: 'NET_CHANGE_CASH', statementType: 'CF', values: [24200, 20800, 25600] },
  { code: 'CAPEX', statementType: 'CF', values: [-16800, -17200, -17900] },
  { code: 'FCF', statementType: 'CF', values: [44200, 40800, 45600] },
];

// CASH — jedyna linia różna między scenami (§DEC-FIN-002: bez plugu, kasa to
// wynik, nie zmienna domykająca). "fundinggap": ujemna w 2 z 3 miesięcy.
const CASH_BY_SCENE: Record<'default' | 'fundinggap', [number, number, number]> = {
  default: [214200, 235000, 260600],
  fundinggap: [24200, -85000, -130400],
};

function outputRow(lineCode: string, statementType: 'P&L' | 'BS' | 'CF', periodIndex: number, value: number): BaselineOutputDto {
  const period = FORECAST_PERIODS[periodIndex];
  return {
    outputId: `out-${lineCode}-${period.periodId}`,
    statementType,
    canonicalLineId: `line-${lineCode}`,
    lineCode,
    entityId: ENTITY_ID,
    periodId: period.periodId,
    periodLabel: period.label,
    consolidationScope: 'CONSOLIDATED',
    value: {
      status: value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
      valueDecimal: String(value),
      nativeCurrency: 'PLN',
      presentationCurrency: 'PLN',
      unit: 'UNITS',
      multiplier: '1',
    },
    valueKind: 'FORECAST',
    drivingScheduleType: null,
    createdBy: 'user-piotr-demo',
    createdAt: '2026-08-10T14:32:00.000Z',
  };
}

const MOCK_OUTPUTS: BaselineOutputDto[] = [
  ...CANONICAL_LINES.flatMap((line) => line.values.map((v, i) => outputRow(line.code, line.statementType, i, v))),
  ...CASH_BY_SCENE[scene].map((v, i) => outputRow('CASH', 'BS', i, v)),
];

const CASH_QUALITY_FLAG: Array<'FUNDING_GAP' | null> =
  scene === 'fundinggap' ? [null, 'FUNDING_GAP', 'FUNDING_GAP'] : [null, null, null];

const MOCK_COMPUTE_RESULT: BaselineComputeResultDto = {
  jobId: 'job-dbr77-baseline-1',
  jobStatus: 'succeeded',
  periodsComputed: FORECAST_PERIODS.length,
  monthlyResults: FORECAST_PERIODS.map((p, i) => ({
    periodId: p.periodId,
    converged: true,
    iterationsUsed: 3 + i,
    cash: CASH_BY_SCENE[scene][i],
    netIncome: CANONICAL_LINES.find((l) => l.code === 'NET_INCOME')!.values[i],
    qualityFlag: CASH_QUALITY_FLAG[i],
  })),
};

// ── window.fetch mock — patrz nagłówek pliku dlaczego (nie da się łatwo
// podmienić eksportowanych funkcji `financeV2.api.ts` z zewnątrz modułu). ──
const g = window as unknown as { __BASELINE_WORKSPACE_FETCH__?: boolean };
if (!g.__BASELINE_WORKSPACE_FETCH__) {
  g.__BASELINE_WORKSPACE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (data: unknown, status = 200): Response =>
      new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes(`/baseline/${BV_ID}/assumptions`)) {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ businessVersionId: BV_ID, writtenCount: 1, assumptions: [] });
      }
      return json(MOCK_ASSUMPTIONS);
    }
    if (url.includes(`/baseline/${BV_ID}/outputs`)) return json(MOCK_OUTPUTS);
    if (url.includes(`/baseline/${BV_ID}/compute`)) return json(MOCK_COMPUTE_RESULT);
    if (url.includes('/artifacts/') && url.includes('/rename')) return json({ artifactId: ARTIFACT_ID, naturalKey: 'Nowa nazwa (dev-render)' });
    if (url.includes('/versions/') && url.includes('/transitions')) return json({ status: statusOverride, version: 1 });
    if (url.includes('/models/') && url.includes('/approve')) return new Response(JSON.stringify({ success: true, status: 'APPROVED' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/models/') && url.includes('/reopen')) return json({ status: 'DRAFT', versionNo: 2 });

    if (url.includes('/api/')) return json([]);
    return realFetch(input as RequestInfo, init);
  };
}

function buildProps(): BaselineWorkspaceProps {
  return {
    artifactId: ARTIFACT_ID,
    businessVersionId: BV_ID,
    entityId: ENTITY_ID,
    name: 'DBR77 — Model bazowy FY2026',
    status: statusOverride,
    freshness: 'CURRENT',
    version: 1,
    role: 'preparer',
    forecastPeriods: FORECAST_PERIODS,
    openingBalanceSheetPeriodId: OPENING_BS_PERIOD_ID,
    assumptionRowOrder: ASSUMPTION_ROW_ORDER,
    contextValues: {
      type: 'Model bazowy (Baseline)',
      period: 'FY2026, miesięcznie',
      entity: 'DBR77 sp. z o.o.',
      currencyScale: 'PLN',
      source: 'Pakiet sprawozdań FY2025 (zatwierdzony)',
      lastCompute: '2026-08-10 14:32',
    },
    onNavigateBack: () => {},
    initialView,
  };
}

function SimulatedMenu1(): React.ReactElement {
  return (
    <div className="flex h-10 items-center gap-4 border-b border-c-border-subtle bg-c-surface px-4 text-xs text-c-text-secondary">
      <span className="font-semibold text-c-text">Consultify</span>
      <span>Finance</span>
      <span className="text-c-text-muted">(symulowane Menu 1 — nie część tego pakietu)</span>
    </div>
  );
}

export default function FinanceBaselineWorkspaceScreen(): React.ReactElement {
  return (
    <div className="min-h-screen bg-c-bg" data-testid="finance-baseline-workspace-screen" data-scene={scene}>
      <SimulatedMenu1 />
      <BaselineWorkspace {...buildProps()} />
    </div>
  );
}
