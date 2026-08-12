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
 */
import React from 'react';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';

const PredictionWorkspaceLazy = React.lazy(() =>
  import('../../src/components/Finance/Prediction/PredictionWorkspace').then((m) => ({ default: m.PredictionWorkspace }))
);

const params = new URLSearchParams(window.location.search);
const MODE = params.get('mode') === 'B' ? 'DRIVER_OVERRIDE' : params.get('mode') === 'C' ? 'FUNDAMENTAL_INITIATIVE' : 'STANDARD_BASE';

// Shapes taken directly from predictionScenarioModel.ts's own exported types (createEmptyScenarioDraft +
// manual demo rows) — not invented ad hoc.
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
  initiatives: MODE === 'FUNDAMENTAL_INITIATIVE' ? [demoInitiative] : [],
  impacts: MODE === 'FUNDAMENTAL_INITIATIVE' ? [demoImpact] : [],
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
