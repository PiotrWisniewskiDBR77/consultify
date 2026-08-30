/**
 * GRAFIKA (2026-08-30, tor 17-finanse-wejście) — dev-render host for the REAL
 * `<FinanceHub>` (src/components/Economics/FinanceHub.tsx), the ENTRY screen
 * of the Finance module (Menu 2/3 + StandardTable + StandardPreview, 5 tabs:
 * Statements / Analysis / Models / Prediction / Enterprise valuation).
 *
 * Właściciel obejrzał piętnaście ekranów Finansów (wszystkie WNĘTRZA —
 * warsztaty i panele w dev-render/screens/finance-*.tsx) i powiedział, że nie
 * ma karty wejściowej: „które firmy są przeanalizowane — pierwsza karta i
 * następne". Ekran wejściowy ISTNIEJE w produkcie (FinanceHub.tsx, 4203
 * linie, StandardTable/StandardModuleBar) — po prostu nikt go nigdy nie
 * wyrenderował w harnessie. Ten plik to robi.
 *
 * CLAUDE.md rule #7 — Piotr nigdy nie jest pierwszym testerem wizualnym: to
 * jest REALNY komponent (nie reimplementacja), montowany z atrapami danych,
 * zrzucany PRZEZ AGENTA, dopiero potem pokazywany właścicielowi.
 *
 * Montaż (wzorzec 1:1 z `finance-model-workspace.tsx` / opis w
 * `dev-render/mocks/seedStore.ts`): `seedRealisticSession()` odblokowuje
 * pełne drzewo providerów w `AppProviders` (V8Provider/OrgProvider/
 * AccessPolicyProvider/…), a `V8FinanceApi` jest zwykłym eksportowanym
 * obiektem — podmiana jego metod patchuje singleton, którego `useFinanceData`
 * (jedyny klient sieciowy tego huba dla wszystkich 5 zakładek) używa do
 * każdego wywołania `/finance/*`. `BrowserRouter` żyje w `AppProviders`, więc
 * `?tab=` czyta wprost `useSearchParams` w hubie — nie trzeba osobnego
 * MemoryRoutera ani propa (FinanceHub go nie przyjmuje).
 *
 * Dane atrapy: SZEŚĆ różnych analizowanych spółek (nie „Firma 1/Firma 2") —
 * różne waluty (PLN/EUR/USD/GBP), różne statusy (draft/w przeglądzie/
 * zatwierdzone), różne okresy i daty — żeby ekran wejściowy faktycznie
 * pokazywał odpowiedź na pytanie właściciela: „które firmy są
 * przeanalizowane". Kształty obiektów wzorowane 1:1 na
 * `src/components/Economics/financeOwnerSampleData.ts` (jedyny istniejący,
 * jednospółkowy fixture „owner review" w src/ — tu rozszerzony do wielu
 * spółek WYŁĄCZNIE w dev-render, bez dotykania src/).
 *
 * URL: ?screen=finance-hub[&lang=pl|en][&theme=light|dark]
 *   &tab=statements|analysis|models|prediction|valuation  (default: statements)
 */
import React from 'react';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { V8FinanceApi } from '../../src/services/api/v8/finance';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// ── Sześć spółek — pakiety sprawozdań (zakładka „Sprawozdania") ────────────
// Kształt: V8FinanceStatementPackSummary (src/services/api/v8/finance.ts),
// mapowany w useFinanceData.ts na FinanceStatementRow. `entity_name` staje
// się tytułem wiersza — to jest DOKŁADNIE odpowiedź na pytanie właściciela.

function pack(overrides: Record<string, unknown>) {
  return {
    id: `pack-${overrides.slug}`,
    version: 1,
    non_financial_line_count: 0,
    document_class: 'ANNUAL_REPORT',
    extraction_strategy: 'TABLE_DETECTION',
    template_family: null,
    values_version: 1,
    missing_statement_types: [],
    pack_quality_reason_codes: [],
    ...overrides,
  };
}

function statement(overrides: Record<string, unknown>) {
  return {
    status: 'approved',
    validation_status: 'approved',
    readiness_status: 'ready',
    readiness_score: 100,
    ...overrides,
  };
}

const MOCK_STATEMENT_PACKS = [
  pack({
    slug: 'techflow-fy2025',
    entity_name: 'TechFlow Solutions Sp. z o.o.',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    period_label: 'FY 2025',
    currency: 'PLN',
    scaling: 'thousands',
    pack_status: 'approved',
    validation_status: 'approved',
    pack_readiness_status: 'ready',
    pack_readiness_score: 100,
    overall_confidence: 0.96,
    pl_count: 1,
    bs_count: 1,
    cf_count: 1,
    source_statement_count: 3,
    updated_at: '2026-08-24T09:10:00.000Z',
    statements: [
      statement({
        id: 'st-techflow-pl',
        statement_type: 'P&L',
        mapped_line_count: 118,
        total_line_count: 118,
        unmapped_line_count: 0,
        source_file_name: 'TechFlow-RZiS-FY2025.pdf',
      }),
      statement({
        id: 'st-techflow-bs',
        statement_type: 'BS',
        mapped_line_count: 96,
        total_line_count: 96,
        unmapped_line_count: 0,
        source_file_name: 'TechFlow-Bilans-FY2025.pdf',
      }),
      statement({
        id: 'st-techflow-cf',
        statement_type: 'CF',
        mapped_line_count: 64,
        total_line_count: 64,
        unmapped_line_count: 0,
        source_file_name: 'TechFlow-CF-FY2025.pdf',
      }),
    ],
  }),
  pack({
    slug: 'nordic-bakery-fy2024',
    entity_name: 'Nordic Bakery Group',
    period_start: '2024-01-01',
    period_end: '2024-12-31',
    period_label: 'FY 2024',
    currency: 'EUR',
    scaling: 'thousands',
    pack_status: 'in_review',
    validation_status: 'pending',
    pack_readiness_status: 'recoverable',
    pack_readiness_score: 72,
    overall_confidence: 0.74,
    pl_count: 1,
    bs_count: 1,
    cf_count: 0,
    source_statement_count: 2,
    missing_statement_types: ['CF'],
    updated_at: '2026-08-21T14:05:00.000Z',
    statements: [
      statement({
        id: 'st-nordic-pl',
        statement_type: 'P&L',
        status: 'approved',
        readiness_status: 'ready',
        mapped_line_count: 84,
        total_line_count: 84,
        unmapped_line_count: 0,
        source_file_name: 'NordicBakery-IncomeStatement-2024.pdf',
      }),
      statement({
        id: 'st-nordic-bs',
        statement_type: 'BS',
        status: 'in_review',
        readiness_status: 'recoverable',
        validation_status: 'pending',
        readiness_score: 68,
        mapped_line_count: 51,
        total_line_count: 60,
        unmapped_line_count: 9,
        source_file_name: 'NordicBakery-Balance-2024.pdf',
      }),
    ],
  }),
  pack({
    slug: 'elmax-fy2025-h1',
    entity_name: 'Elmax Industries S.A.',
    period_start: '2025-01-01',
    period_end: '2025-06-30',
    period_label: 'FY 2025 (H1)',
    currency: 'PLN',
    scaling: 'units',
    pack_status: 'draft',
    validation_status: 'pending',
    pack_readiness_status: 'pending',
    pack_readiness_score: 34,
    overall_confidence: 0.41,
    pl_count: 1,
    bs_count: 0,
    cf_count: 0,
    source_statement_count: 1,
    missing_statement_types: ['BS', 'CF'],
    pack_quality_reason_codes: ['AWAITING_BS_UPLOAD', 'AWAITING_CF_UPLOAD'],
    updated_at: '2026-08-27T08:40:00.000Z',
    statements: [
      statement({
        id: 'st-elmax-pl',
        statement_type: 'P&L',
        status: 'draft',
        readiness_status: 'pending',
        validation_status: 'pending',
        readiness_score: 34,
        mapped_line_count: 22,
        total_line_count: 58,
        unmapped_line_count: 36,
        source_file_name: 'Elmax-RZiS-2025-H1-skan.pdf',
      }),
    ],
  }),
  pack({
    slug: 'greenpack-fy2023',
    entity_name: 'GreenPack Logistics Sp. z o.o.',
    period_start: '2023-01-01',
    period_end: '2023-12-31',
    period_label: 'FY 2023',
    currency: 'PLN',
    scaling: 'thousands',
    pack_status: 'approved',
    validation_status: 'approved',
    pack_readiness_status: 'ready',
    pack_readiness_score: 100,
    overall_confidence: 0.99,
    pl_count: 1,
    bs_count: 1,
    cf_count: 1,
    source_statement_count: 3,
    updated_at: '2026-04-11T10:00:00.000Z',
    statements: [
      statement({
        id: 'st-greenpack-pl',
        statement_type: 'P&L',
        mapped_line_count: 102,
        total_line_count: 102,
        unmapped_line_count: 0,
        source_file_name: 'GreenPack-RZiS-2023.pdf',
      }),
      statement({
        id: 'st-greenpack-bs',
        statement_type: 'BS',
        mapped_line_count: 88,
        total_line_count: 88,
        unmapped_line_count: 0,
        source_file_name: 'GreenPack-Bilans-2023.pdf',
      }),
      statement({
        id: 'st-greenpack-cf',
        statement_type: 'CF',
        mapped_line_count: 47,
        total_line_count: 47,
        unmapped_line_count: 0,
        source_file_name: 'GreenPack-CF-2023.pdf',
      }),
    ],
  }),
  pack({
    slug: 'vantage-fy2025',
    entity_name: 'Vantage Retail Partners',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    period_label: 'FY 2025',
    currency: 'USD',
    scaling: 'units',
    pack_status: 'draft',
    validation_status: 'pending',
    pack_readiness_status: 'pending',
    pack_readiness_score: 12,
    overall_confidence: 0.18,
    pl_count: 0,
    bs_count: 0,
    cf_count: 0,
    source_statement_count: 0,
    missing_statement_types: ['P&L', 'BS', 'CF'],
    pack_quality_reason_codes: ['NO_SOURCE_UPLOADED'],
    updated_at: '2026-08-28T16:20:00.000Z',
    statements: [],
  }),
  pack({
    slug: 'silvertree-fy2025',
    entity_name: 'Silvertree Consulting Group',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    period_label: 'FY 2025',
    currency: 'GBP',
    scaling: 'thousands',
    pack_status: 'approved',
    validation_status: 'approved',
    pack_readiness_status: 'ready',
    pack_readiness_score: 100,
    overall_confidence: 0.93,
    pl_count: 1,
    bs_count: 1,
    cf_count: 1,
    source_statement_count: 3,
    updated_at: '2026-08-18T11:45:00.000Z',
    statements: [
      statement({
        id: 'st-silvertree-pl',
        statement_type: 'P&L',
        mapped_line_count: 71,
        total_line_count: 71,
        unmapped_line_count: 0,
        source_file_name: 'Silvertree-PL-FY2025.pdf',
      }),
      statement({
        id: 'st-silvertree-bs',
        statement_type: 'BS',
        mapped_line_count: 59,
        total_line_count: 59,
        unmapped_line_count: 0,
        source_file_name: 'Silvertree-BS-FY2025.pdf',
      }),
      statement({
        id: 'st-silvertree-cf',
        statement_type: 'CF',
        mapped_line_count: 33,
        total_line_count: 33,
        unmapped_line_count: 0,
        source_file_name: 'Silvertree-CF-FY2025.pdf',
      }),
    ],
  }),
];

// ── Modele (zakładka „Modele") — BASELINE_MODEL, powiązane z pakietami ─────
const MOCK_BASELINE_MODELS = [
  {
    id: 'model-techflow-baseline',
    name: 'TechFlow Solutions — Model bazowy operacyjny 2026–2028',
    artifact_type: 'BASELINE_MODEL',
    status: 'APPROVED',
    scenario: 'base',
    currency: 'PLN',
    horizon_months: 36,
    start_date: '2026-01-01',
    source_statement_pack_id: 'pack-techflow-fy2025',
    event_count: 214,
    updated_at: '2026-08-25T09:30:00.000Z',
  },
  {
    id: 'model-greenpack-baseline',
    name: 'GreenPack Logistics — Model bazowy 2026–2027',
    artifact_type: 'BASELINE_MODEL',
    status: 'REVIEW',
    scenario: 'base',
    currency: 'PLN',
    horizon_months: 24,
    start_date: '2026-01-01',
    source_statement_pack_id: 'pack-greenpack-fy2023',
    event_count: 87,
    updated_at: '2026-08-19T13:00:00.000Z',
  },
  {
    id: 'model-silvertree-baseline',
    name: 'Silvertree Consulting Group — Model bazowy FY2026',
    artifact_type: 'BASELINE_MODEL',
    status: 'DRAFT',
    scenario: 'base',
    currency: 'GBP',
    horizon_months: 12,
    start_date: '2026-01-01',
    source_statement_pack_id: 'pack-silvertree-fy2025',
    event_count: 19,
    updated_at: '2026-08-20T10:15:00.000Z',
  },
];

// ── Prognozy (zakładka „Prognoza") — PREDICTION_SCENARIO + budżety ─────────
const MOCK_PREDICTION_MODELS = [
  {
    id: 'model-techflow-prediction-standard',
    name: 'TechFlow Solutions — Prognoza STANDARD BASE 2026–2028',
    artifact_type: 'PREDICTION_SCENARIO',
    status: 'REVIEW',
    scenario: 'base',
    currency: 'PLN',
    horizon_months: 36,
    start_date: '2026-01-01',
    source_statement_pack_id: 'pack-techflow-fy2025',
    event_count: 214,
    updated_at: '2026-08-26T09:00:00.000Z',
  },
  {
    id: 'model-nordic-prediction-expansion',
    name: 'Nordic Bakery Group — Prognoza ekspansji rynkowej 2026',
    artifact_type: 'PREDICTION_SCENARIO',
    status: 'DRAFT',
    scenario: 'optimistic',
    currency: 'EUR',
    horizon_months: 18,
    start_date: '2026-02-01',
    source_statement_pack_id: 'pack-nordic-bakery-fy2024',
    event_count: 42,
    updated_at: '2026-08-22T15:40:00.000Z',
  },
];

const MOCK_BUDGETS = [
  {
    id: 'elmax-operacyjny-2026',
    title: 'Elmax Industries — Budżet operacyjny 2026',
    status: 'draft',
    currency: 'PLN',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    granularity: 'monthly',
    version: 1,
    updatedAt: '2026-08-27T09:00:00.000Z',
  },
];

// ── Analizy (zakładka „Analiza") ────────────────────────────────────────────
const MOCK_ANALYSES = [
  {
    id: 'analysis-techflow-liquidity',
    title: 'TechFlow Solutions — Analiza płynności i rentowności FY2025',
    status: 'APPROVED',
    analysis_type: 'comprehensive',
    currency: 'PLN',
    periods: ['2024', '2025'],
    source_statement_ids: ['st-techflow-pl', 'st-techflow-bs', 'st-techflow-cf'],
    source_statement_pack_id: 'pack-techflow-fy2025',
    updated_at: '2026-08-25T10:00:00.000Z',
  },
  {
    id: 'analysis-nordic-yoy',
    title: 'Nordic Bakery Group — Analiza porównawcza r/r 2023–2024',
    status: 'REVIEW',
    analysis_type: 'comprehensive',
    currency: 'EUR',
    periods: ['2023', '2024'],
    source_statement_pack_id: 'pack-nordic-bakery-fy2024',
    updated_at: '2026-08-21T16:20:00.000Z',
  },
  {
    id: 'analysis-elmax-automation',
    title: 'Elmax Industries — Case inwestycyjny: automatyzacja linii produkcyjnej',
    status: 'DRAFT',
    analysis_type: 'investment_case',
    currency: 'PLN',
    periods: ['2026', '2027', '2028'],
    source_statement_pack_id: 'pack-elmax-fy2025-h1',
    updated_at: '2026-08-27T11:10:00.000Z',
  },
  {
    id: 'analysis-greenpack-costs',
    title: 'GreenPack Logistics — Analiza kosztów operacyjnych 2023',
    status: 'APPROVED',
    analysis_type: 'comprehensive',
    currency: 'PLN',
    periods: ['2022', '2023'],
    source_statement_pack_id: 'pack-greenpack-fy2023',
    updated_at: '2026-04-12T09:30:00.000Z',
  },
];

// ── Wyceny (zakładka „Wycena przedsiębiorstwa") ─────────────────────────────
const MOCK_VALUATIONS = [
  {
    id: 'valuation-techflow-dcf',
    title: 'TechFlow Solutions — Wycena DCF FCFF 2026–2030',
    status: 'APPROVED',
    source_type: 'prediction',
    method: 'DCF_FCFF',
    currency: 'PLN',
    horizon_years: 5,
    updated_at: '2026-08-26T12:00:00.000Z',
  },
  {
    id: 'valuation-silvertree-comparables',
    title: 'Silvertree Consulting Group — Wycena porównawcza (mnożniki rynkowe)',
    status: 'REVIEW',
    source_type: 'financial_model',
    method: 'COMPARABLES',
    currency: 'GBP',
    horizon_years: 3,
    updated_at: '2026-08-20T14:10:00.000Z',
  },
  {
    id: 'valuation-greenpack-exit',
    title: 'GreenPack Logistics — Wycena wyjścia inwestora',
    status: 'DRAFT',
    source_type: 'manual',
    method: 'DCF_FCFF',
    currency: 'PLN',
    horizon_years: 5,
    updated_at: '2026-08-14T09:50:00.000Z',
  },
];

// ── Podmiana metod V8FinanceApi (wzorzec: finance-model-workspace.tsx) ──────
// `V8FinanceApi` jest zwykłym eksportowanym obiektem — podmiana jego metod
// patchuje ten sam singleton, którego `useFinanceData` używa do KAŻDEGO
// wywołania `/finance/*`. Bez tego hub uderzyłby w realny (nieistniejący w
// dev-render) backend i pokazał pusty/błędny stan zamiast danych atrap.
V8FinanceApi.getStatementPacks = (async () => ({
  statementPacks: MOCK_STATEMENT_PACKS,
  count: MOCK_STATEMENT_PACKS.length,
})) as typeof V8FinanceApi.getStatementPacks;

const modelsForTab = [...MOCK_BASELINE_MODELS, ...MOCK_PREDICTION_MODELS];
V8FinanceApi.getModels = (async () => ({
  models: modelsForTab,
  count: modelsForTab.length,
})) as typeof V8FinanceApi.getModels;

V8FinanceApi.getAnalyses = (async () => ({
  analyses: MOCK_ANALYSES,
  count: MOCK_ANALYSES.length,
})) as typeof V8FinanceApi.getAnalyses;

V8FinanceApi.getValuations = (async () => ({
  valuations: MOCK_VALUATIONS,
  count: MOCK_VALUATIONS.length,
})) as typeof V8FinanceApi.getValuations;

V8FinanceApi.getBudgets = (async () => ({
  budgets: MOCK_BUDGETS,
  count: MOCK_BUDGETS.length,
})) as typeof V8FinanceApi.getBudgets;

// Dashboard normalnie nie jest wołany (isV8FinanceEnabled zależy od
// `/v8/admin/flags`, które w dev-render 404-uje bez backendu -> flaga
// zostaje OFF) — patchujemy mimo to, defensywnie, żeby nic się nie wywaliło
// gdyby ta ścieżka kiedyś zaczęła być wołana bezwarunkowo.
V8FinanceApi.getDashboard = (async () => ({
  dashboard: {
    statementPacks: { total: MOCK_STATEMENT_PACKS.length, ready: 3 },
    models: { total: MOCK_BASELINE_MODELS.length },
    analyses: { total: MOCK_ANALYSES.length },
    valuations: { total: MOCK_VALUATIONS.length },
  },
})) as unknown as typeof V8FinanceApi.getDashboard;

const FinanceHubLazy = React.lazy(() =>
  import('../../src/components/Economics/FinanceHub').then((m) => ({ default: m.FinanceHub }))
);

export function FinanceHubScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div className="min-h-screen bg-c-bg">
          <React.Suspense fallback={null}>
            <FinanceHubLazy />
          </React.Suspense>
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default FinanceHubScreen;
