/**
 * Pakiet G (Prediction) — dev-render host for the REAL `<PredictionWorkspace>`
 * (src/components/Finance/Prediction/PredictionWorkspace.tsx).
 *
 * CLAUDE.md rule #7: renders the real component with mock data so the author can screenshot it
 * BEFORE the owner sees anything — this harness is never wired into any production route, and the
 * feature is behind `financePredictionWorkspaceV1` (default OFF).
 *
 * URL params:
 *   &mode=A|B|C   which build track to start on (A=standard, B=driver override, C=fundamental) —
 *                 negative-control knob: changing this changes the initially-active tab, proving
 *                 the harness renders the REAL component, not a static image.
 *   &view=assumptions|results
 *   &bridge=ok|missing|notfound|error   ID_BRIDGE (Gate E) anti-cicha-pustka states:
 *     ok       (default) — businessVersionId resolved + confirmed by GET .../versions/:id — real
 *              workspace mounts, honest "nowy szkic" banner shown (no scenario-content GET exists).
 *     missing  — ID_BRIDGE could not resolve a canonical id at all (businessVersionId=null) —
 *                honest "brak połączenia z realnym rekordem" state, ZERO network calls.
 *     notfound — businessVersionId set, but GET .../versions/:id returns 404 — honest
 *                "nie znaleziono tej wersji" state.
 *     error    — businessVersionId set, GET .../versions/:id fails (500) — honest error state
 *                with "Spróbuj ponownie".
 */
import React from 'react';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';

// AP_MOUNT §A: `PredictionWorkspace` now reads `financePredictionWorkspaceV1`
// itself (not just its caller) and renders `null` when OFF — force it ON via
// the same localStorage-backed local override the hook reads at init
// (STORAGE_KEY = 'consultify_feature_flags'), same pattern as
// `dev-render/screens/assessment-menu3-status-chips.tsx`.
try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem('consultify_feature_flags', JSON.stringify({ ...existing, financePredictionWorkspaceV1: true }));
} catch {
  // ignore — harness-only convenience
}

const PredictionWorkspaceLazy = React.lazy(() =>
  import('../../src/components/Finance/Prediction/PredictionWorkspace').then((m) => ({ default: m.PredictionWorkspace }))
);

const params = new URLSearchParams(window.location.search);
const MODE = params.get('mode') === 'B' ? 'DRIVER_OVERRIDE' : params.get('mode') === 'C' ? 'FUNDAMENTAL_INITIATIVE' : 'STANDARD_BASE';
const BRIDGE = (params.get('bridge') as 'ok' | 'missing' | 'notfound' | 'error' | null) ?? 'ok';
const BV_ID = 'bv-prediction-demo-1';

// ID_BRIDGE (Gate E) — window.fetch mock for GET /api/v8/finance-v2/versions/:id
// (`getFinanceBusinessVersion`, called on mount by the REAL PredictionWorkspace
// to verify the resolved businessVersionId before rendering anything). Same
// mock-on-window.fetch pattern as finance-baseline-workspace.tsx (named-function
// imports from financeV2.api.ts can't be swapped from outside the module).
const g = window as unknown as { __PREDICTION_WORKSPACE_FETCH__?: boolean };
if (!g.__PREDICTION_WORKSPACE_FETCH__) {
  g.__PREDICTION_WORKSPACE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (data: unknown, status = 200): Response =>
      new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
    // Error envelope shape is `{error, code}` at the TOP LEVEL (matches the
    // real server's `sendError()` — `_shared.ts` — and what
    // `handleResponse()`/`baseClient.ts` reads as `err.data.code`), NOT
    // wrapped in `{data: ...}` like a success body.
    const errorJson = (error: string, code: string, status: number): Response =>
      new Response(JSON.stringify({ error, code }), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes(`/versions/${BV_ID}`)) {
      if (BRIDGE === 'notfound') return errorJson('Business version not found', 'NOT_FOUND', 404);
      if (BRIDGE === 'error') return errorJson('Internal error', 'INTERNAL_ERROR', 500);
      return json({
        businessVersionId: BV_ID,
        artifactId: 'artifact-prediction-demo-1',
        versionNo: 1,
        version: 1,
        status: 'DRAFT',
        freshness: 'NEVER_COMPUTED',
        freshnessReason: null,
        staleSince: null,
        riskTier: 'LOW',
        versionKind: 'MAIN',
        parentVersionId: null,
        supersededByVersionId: null,
        computeSnapshotId: null,
        computeRunId: null,
        contentSemanticHash: null,
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        reopenReason: null,
        reopenedBy: null,
        reopenedAt: null,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      });
    }

    if (url.includes('/api/')) return json([]);
    return realFetch(input as RequestInfo, init);
  };
}

// Shapes taken directly from predictionScenarioModel.ts's own exported types (createEmptyScenarioDraft +
// manual demo rows) — not invented ad hoc.
//
// ★ FIXC (martwa przestrzeń, gate-e): tryb C (FUNDAMENTAL_INITIATIVE) had exactly ONE initiative +
// ONE impact in this harness — a real "łańcuch: inicjatywa → założenie → driver/KPI → linia
// sprawozdania → prognoza" scenario realistically carries several concurrent initiatives (that is
// the whole point of the mode — see FundamentalInitiativePanel's own header text). Added two more,
// same DraftInitiative/DraftImpact shape, driver codes taken from ALREADY-EXISTING server test
// fixtures (`predictionPreflightOrderDeterminism.test.ts`: REVENUE_GROWTH_YOY under revenue_pvm;
// `baseline.routes.pg.test.ts`/`coldReopen.pg.test.ts`: DIO_DAYS under wc_dso_dio_dpo) — not
// invented driver vocabulary — narratively consistent with the manufacturing/DBR77 story already
// used elsewhere in this demo set (Analysis harness's INVENTORY_DAYS KPI).
const demoInitiative = {
  id: 'init-demo-1',
  initiativeCode: 'PROD-EFF-5PCT',
  name: 'Poprawa efektywności produkcji o 5%',
  description: 'Redukcja COGS przez optymalizację linii produkcyjnej',
  source: 'MANAGEMENT_PLAN',
  owner: 'Jan Kowalski (COO)',
  confidencePct: 70,
  defaultStartPeriodId: 'p-2026-03',
  defaultRampMonths: 3,
  defaultDurationMonths: null,
  implementationCostDecimal: 150000,
  status: 'CONFIRMED' as const,
};

const demoInitiative2 = {
  id: 'init-demo-2',
  initiativeCode: 'REV-B2B-CONTRACT',
  name: 'Nowy kontrakt B2B — wzrost przychodów',
  description: 'Podpisany list intencyjny z klientem strategicznym, wdrożenie od Q2',
  source: 'MANAGEMENT_PLAN',
  owner: 'Anna Nowak (Dyrektor Sprzedaży)',
  confidencePct: 60,
  defaultStartPeriodId: 'p-2026-04',
  defaultRampMonths: 4,
  defaultDurationMonths: null,
  implementationCostDecimal: 40000,
  status: 'CONFIRMED' as const,
};

const demoInitiative3 = {
  id: 'init-demo-3',
  initiativeCode: 'WC-INVENTORY-OPT',
  name: 'Optymalizacja zapasów magazynowych',
  description: 'Wdrożenie systemu prognozowania popytu, redukcja dni zapasów',
  source: 'MANAGEMENT_PLAN',
  owner: 'Jan Kowalski (COO)',
  confidencePct: 55,
  defaultStartPeriodId: 'p-2026-05',
  defaultRampMonths: 6,
  defaultDurationMonths: null,
  implementationCostDecimal: 90000,
  status: 'DRAFT' as const,
};

const demoImpact = {
  id: 'impact-demo-1',
  initiativeId: 'init-demo-1',
  assumptionLabel: '5% redukcja COGS od miesiąca 3 ramp-up',
  driverScheduleType: 'cogs_opex' as const,
  driverCode: 'COGS_PCT_OF_REVENUE',
  kpiCatalogId: null,
  statementLineCode: 'COGS',
  entityId: 'entity-1',
  amountKind: 'PERCENT_OF_BASE' as const,
  amountDecimal: -0.05,
  amountUnit: 'RATIO',
  sign: 'NEGATIVE' as const,
  startPeriodId: 'p-2026-03',
  rampMonths: 3,
  durationMonths: null,
  decayPctPerPeriod: null,
  implementationCostDecimal: 150000,
  confidencePct: 70,
  probabilityPct: 85,
  cannibalizesImpactId: null,
};

const demoImpact2 = {
  id: 'impact-demo-2',
  initiativeId: 'init-demo-2',
  assumptionLabel: '8% wzrost przychodów rok-do-roku od kontraktu B2B',
  driverScheduleType: 'revenue_pvm' as const,
  driverCode: 'REVENUE_GROWTH_YOY',
  kpiCatalogId: null,
  statementLineCode: 'REVENUE',
  entityId: 'entity-1',
  amountKind: 'PERCENT_OF_BASE' as const,
  amountDecimal: 0.08,
  amountUnit: 'RATIO',
  sign: 'POSITIVE' as const,
  startPeriodId: 'p-2026-04',
  rampMonths: 4,
  durationMonths: null,
  decayPctPerPeriod: null,
  implementationCostDecimal: 40000,
  confidencePct: 60,
  probabilityPct: 70,
  cannibalizesImpactId: null,
};

const demoImpact3 = {
  id: 'impact-demo-3',
  initiativeId: 'init-demo-3',
  assumptionLabel: 'Redukcja dni zapasów (DIO) o 12 dni',
  driverScheduleType: 'wc_dso_dio_dpo' as const,
  driverCode: 'DIO_DAYS',
  kpiCatalogId: null,
  statementLineCode: 'INVENTORY',
  entityId: 'entity-1',
  amountKind: 'ABSOLUTE_AMOUNT' as const,
  amountDecimal: -12,
  amountUnit: 'DAYS',
  sign: 'NEGATIVE' as const,
  startPeriodId: 'p-2026-05',
  rampMonths: 6,
  durationMonths: null,
  decayPctPerPeriod: null,
  implementationCostDecimal: 90000,
  confidencePct: 55,
  probabilityPct: 65,
  cannibalizesImpactId: null,
};

const demoDriverOverride = {
  id: 'ovr-demo-1',
  scheduleType: 'cogs_opex' as const,
  driverCode: 'COGS_PCT_OF_REVENUE',
  entityId: 'entity-1',
  periodId: 'p-2026-03',
  overrideSource: 'MANUAL' as const,
  valueStatus: 'PRESENT_NONZERO' as const,
  valueDecimal: 0.58,
  unit: 'RATIO',
  baselineValueDecimal: 0.6,
  rationale: 'Negocjacje z dostawcą surowca',
  canonicalLineCode: 'COGS',
};

const initialDraft = {
  businessVersionId: null,
  scenarioMode: MODE as 'STANDARD_BASE' | 'DRIVER_OVERRIDE' | 'FUNDAMENTAL_INITIATIVE',
  name: 'DBR77 — Scenariusz FY2026 (demo)',
  driverOverrides: MODE === 'DRIVER_OVERRIDE' ? [demoDriverOverride] : [],
  initiatives: MODE === 'FUNDAMENTAL_INITIATIVE' ? [demoInitiative, demoInitiative2, demoInitiative3] : [],
  impacts: MODE === 'FUNDAMENTAL_INITIATIVE' ? [demoImpact, demoImpact2, demoImpact3] : [],
  financing: [],
  lastAssumptionChangeAt: '2026-08-12T09:00:00Z',
  lastComputeAt: '2026-08-11T09:00:00Z',
};

const demoScenarioValues = {
  'REVENUE::p-2026-03': 1_240_000,
  'EBITDA::p-2026-03': 312_000,
  'EBITDA::latest': 312_000,
  'LONG_TERM_DEBT::latest': 1_000_000,
  'CASH::latest': 540_000,
};
const demoBaselineValues = {
  'REVENUE::p-2026-03': 1_240_000,
  'EBITDA::p-2026-03': 298_000,
};

export function FinancePredictionWorkspaceScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          <React.Suspense fallback={null}>
            <PredictionWorkspaceLazy
              artifactId="artifact-prediction-demo-1"
              businessVersionId={BRIDGE === 'missing' ? null : BV_ID}
              initialDraft={initialDraft as never}
              scenarioValues={demoScenarioValues}
              baselineValues={demoBaselineValues}
              onNavigateBack={() => {}}
            />
          </React.Suspense>
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default FinancePredictionWorkspaceScreen;
