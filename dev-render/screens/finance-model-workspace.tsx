/**
 * PKG_M (Finance v3 UI/API Inventory) — dev-render host for the REAL
 * `<FinancialModelWorkspace>` (src/components/Finance/FinancialModelWorkspace.tsx),
 * the "Models" detail workspace opened from FinanceHub's Models/Prediction
 * tabs (`FinanceHub.tsx` fullView → `isModelWorkspace` branch).
 *
 * Purpose (CLAUDE.md rule #7 — Piotr is never the first visual tester): render
 * the REAL production component with server-shaped mock data so the PKG_M
 * report can attach an actual screenshot as evidence for OWN-FIN-011/016/018
 * (duplicate header, no Finance Workspace Bar, "Wycen model" still in the
 * main Models flow) — not a description of the code.
 *
 * `V8FinanceApi` is a plain exported object (`export const V8FinanceApi = {...}`
 * in src/services/api/v8/finance.ts), so reassigning its methods patches the
 * same singleton every module imports — same pattern as
 * dev-render/screens/decision-record.tsx (`Api.getDecision = ...`).
 *
 * Mock shape is taken directly from the frontend/backend contract types the
 * component itself imports and reads (`V8FinanceModelDetail`,
 * `V8FinanceModelOutputsResult`, `V8FinanceModelValidationResult` —
 * src/services/api/v8/finance.ts:44-107), not invented ad hoc.
 *
 * URL params (in addition to the harness-wide ?lang= & ?theme=):
 *   &status=draft|approved   selectedModel.status (default: draft) — drives
 *                             the Approve button vs the static "Approved"
 *                             label with no lifecycle action (OWN-FIN-013).
 *   &name=<string>            selectedModel.name — negative-control knob:
 *                             change this and the header text in the
 *                             screenshot must change, proving the harness
 *                             renders the REAL component (not a static image).
 */
import React from 'react';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { V8FinanceApi } from '../../src/services/api/v8/finance';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const MODEL_ID = 'model-dbr77-demo-1';
const MOCK_STATUS = params.get('status') === 'approved' ? 'approved' : 'draft';
const MOCK_NAME = params.get('name') || 'DBR77 — Model bazowy FY2026';

// ── Shape: V8FinanceModelDetail (src/services/api/v8/finance.ts:67-73) ─────
const MOCK_MODEL = {
  id: MODEL_ID,
  name: MOCK_NAME,
  description: 'Model bazowy wyprowadzony z zatwierdzonego pakietu sprawozdań FY2025.',
  project_id: null,
  initiative_id: null,
  currency: 'PLN',
  horizon_months: 36,
  start_date: '2026-01-01',
  granularity: 'quarterly',
  scenario: 'base',
  status: MOCK_STATUS,
  version: MOCK_STATUS === 'approved' ? 2 : 1,
  source_statement_id: 'stmt-dbr77-fy2025',
  source_statement_pack_id: 'pack-dbr77-fy2025',
  case_id: null,
  is_baseline: true,
  created_at: '2026-07-20T09:00:00Z',
  updated_at: '2026-08-05T11:30:00Z',
  // Shape read by the component itself: `assumptions?.baseline` (driver
  // amounts shown in "Seed source and baseline", FinancialModelWorkspace.tsx:805)
  // and `assumptions_json.seedSource` (grounded-banner, line 803).
  assumptions_json: {
    baseline: {
      revenue: 12_400_000,
      cogs: 7_100_000,
      opex: 3_050_000,
      depreciation: 430_000,
      interest: 180_000,
      tax: 410_000,
      capex: 560_000,
    },
    seedSource: {
      type: 'statement',
      statement_type: 'PL',
      currency: 'PLN',
      status: 'approved',
      periodLabel: 'FY2025',
    },
  },
  source_statement: {
    id: 'stmt-dbr77-fy2025',
    statement_type: 'PL',
    currency: 'PLN',
    status: 'approved',
  },
  source_statement_pack: {
    id: 'pack-dbr77-fy2025',
    entity_name: 'DBR77 Sp. z o.o.',
    period_label: 'FY2025',
  },
  events: [],
};

// ── Shape: V8FinanceModelOutputsResult (finance.ts:104-107) ────────────────
const MOCK_OUTPUTS = {
  raw: [],
  grouped: {
    PL: {
      '2026-Q1': [
        { lineCode: 'revenue', lineName: 'Revenue', value: 3_120_000 },
        { lineCode: 'cogs', lineName: 'COGS', value: -1_784_000 },
        { lineCode: 'ebitda', lineName: 'EBITDA', value: 612_000 },
      ],
      '2026-Q2': [
        { lineCode: 'revenue', lineName: 'Revenue', value: 3_260_000 },
        { lineCode: 'cogs', lineName: 'COGS', value: -1_865_000 },
        { lineCode: 'ebitda', lineName: 'EBITDA', value: 641_000 },
      ],
    },
  },
};

// ── Shape: V8FinanceModelValidationResult (finance.ts:88-96) ───────────────
const MOCK_VALIDATIONS = {
  validations: [
    {
      check_code: 'BS_TIE_OUT',
      check_name: 'Balance sheet ties out',
      status: 'pass',
      expected_value: 0,
      actual_value: 0,
      difference: 0,
      message: null,
      period_date: '2026-Q1',
    },
  ],
  summary: { total: 1, pass: 1, fail: 0, warning: 0 },
};

V8FinanceApi.getModels = (async () => ({
  models: [MOCK_MODEL],
  count: 1,
})) as typeof V8FinanceApi.getModels;
V8FinanceApi.getModel = (async () => ({ model: MOCK_MODEL })) as typeof V8FinanceApi.getModel;
V8FinanceApi.getModelOutputs = (async () =>
  MOCK_OUTPUTS) as typeof V8FinanceApi.getModelOutputs;
V8FinanceApi.getModelValidations = (async () =>
  MOCK_VALIDATIONS) as typeof V8FinanceApi.getModelValidations;
V8FinanceApi.getCaseScenarios = (async () => ({
  scenarios: [],
  count: 0,
  baselineModelId: null,
})) as typeof V8FinanceApi.getCaseScenarios;

// `getModelAssumptionsStatusWithFallback` calls this legacy route directly
// (no V8 attempt) — stub it so the assumptions tab doesn't error.
const realApiGet = Api.get.bind(Api);
Api.get = (async (url: string, ...rest: unknown[]) => {
  if (url.includes('/assumptions-status')) return { assumptions: [] };
  if (url.includes('/financial-modeling/')) return {};
  return (realApiGet as any)(url, ...rest);
}) as typeof Api.get;

const FinancialModelWorkspaceLazy = React.lazy(() =>
  import('../../src/components/Finance/FinancialModelWorkspace').then((m) => ({
    default: m.FinancialModelWorkspace,
  }))
);

export function FinanceModelWorkspaceScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-c-bg"
        >
          <React.Suspense fallback={null}>
            <FinancialModelWorkspaceLazy
              key={`model-${MODEL_ID}-${MOCK_STATUS}-${MOCK_NAME}`}
              initialModelId={MODEL_ID}
              hideSidebar
              onModelChanged={() => {}}
            />
          </React.Suspense>
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default FinanceModelWorkspaceScreen;
