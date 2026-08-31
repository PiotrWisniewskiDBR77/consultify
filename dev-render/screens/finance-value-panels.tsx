/**
 * Mock host for the two M16 Finance panels wired to real data in section B:
 *   - <ValueOfficePanel>    (value bridge + decision portfolio)
 *   - <DriverPlannerPanel>  (EBIT driver tree + what-if)
 *
 * Purpose: prove BOTH states of each panel BEFORE the owner sees them —
 *   (a) POPULATED — realistic real-data props → renders real content;
 *   (b) EMPTY     — no real data → renders the empty state, NEVER demo rows.
 *
 * Reuses the REAL presentational components (no re-implementation). The panels
 * accept injectable data (initiatives + fetchers for ValueOffice; driverTree
 * for DriverPlanner), so this host needs no backend/DB/login.
 *
 * URL params (in addition to the harness-wide ?lang= & ?theme=):
 *   &panel=value|driver|monte-carlo|real-options|frontier|sensitivity|scenarios
 *   &state=populated|empty  which state (default: populated)
 */
import React, { useEffect } from 'react';

import { EfficientFrontierPanel } from '../../src/components/Economics/panels/EfficientFrontierPanel';
import { MonteCarloNpvPanel } from '../../src/components/Economics/panels/MonteCarloNpvPanel';
import { RealOptionsPanel } from '../../src/components/Economics/panels/RealOptionsPanel';
import { ScenarioComputePanel } from '../../src/components/Economics/panels/ScenarioComputePanel';
import { WhatIfSensitivityPanel } from '../../src/components/Economics/panels/WhatIfSensitivityPanel';
import {
  type DriverNode,
  DriverPlannerPanel,
} from '../../src/components/Economics/panels/DriverPlannerPanel';
import {
  type PortfolioResponse,
  type ValueBridgeResponse,
  type ValueOfficeInitiative,
  ValueOfficePanel,
} from '../../src/components/Economics/panels/ValueOfficePanel';

// ── ValueOffice — realistic REAL-shaped initiatives (mapped from a real org's
// initiatives, DBR77-scale numbers). These stand in for what FinanceHub's
// mapInitiativesToValueOffice() produces from GET /api/initiatives. ──────────
const MOCK_INITIATIVES: ValueOfficeInitiative[] = [
  {
    id: 'i1',
    name: 'Automatyzacja zamówień',
    value: 1_200_000,
    stage: 'realized',
    npv: 940_000,
    risk: 0.2,
    effort: 3,
  },
  {
    id: 'i2',
    name: 'Konsolidacja systemów ERP',
    value: 820_000,
    stage: 'in_flight',
    npv: 610_000,
    risk: 0.55,
    effort: 6,
  },
  {
    id: 'i3',
    name: 'Optymalizacja energii',
    value: 460_000,
    stage: 'committed',
    npv: 300_000,
    risk: 0.35,
    effort: 2,
  },
  {
    id: 'i4',
    name: 'Nowy kanał sprzedaży B2B',
    value: 610_000,
    stage: 'identified',
    npv: 210_000,
    risk: 0.7,
    effort: 8,
  },
  {
    id: 'i5',
    name: 'Program retencji klientów',
    value: 380_000,
    stage: 'realized',
    npv: 260_000,
    risk: 0.3,
    effort: 4,
  },
];

// Injected fetchers return the exact server-envelope shape the panel unwraps
// (mirrors valueBridgeService.buildValueBridge / portfolioPrioritizationService).
const mockValueBridgeFetcher = async (): Promise<ValueBridgeResponse> => ({
  data: {
    steps: [
      { label: 'Baseline', value: 0, kind: 'start' },
      { label: 'Identified', value: 610_000, kind: 'increase' },
      { label: 'Committed', value: 150_000, kind: 'decrease' },
      { label: 'In-flight', value: 360_000, kind: 'increase' },
      { label: 'Realized', value: 760_000, kind: 'increase' },
      { label: 'Banked', value: 1_580_000, kind: 'decrease' },
      { label: 'Net Value', value: 0, kind: 'total' },
    ],
    totalRealized: 1_580_000,
    totalIdentified: 610_000,
  },
});

const mockPortfolioFetcher = async (): Promise<PortfolioResponse> => ({
  data: [
    {
      id: 'i1',
      name: 'Automatyzacja zamówień',
      npv: 940_000,
      risk: 0.2,
      effort: 3,
      quadrant: 'fund',
      rank: 1,
    },
    {
      id: 'i5',
      name: 'Program retencji klientów',
      npv: 260_000,
      risk: 0.3,
      effort: 4,
      quadrant: 'quick_win',
      rank: 2,
    },
    {
      id: 'i2',
      name: 'Konsolidacja systemów ERP',
      npv: 610_000,
      risk: 0.55,
      effort: 6,
      quadrant: 'evaluate',
      rank: 3,
    },
    {
      id: 'i3',
      name: 'Optymalizacja energii',
      npv: 300_000,
      risk: 0.35,
      effort: 2,
      quadrant: 'quick_win',
      rank: 4,
    },
    {
      id: 'i4',
      name: 'Nowy kanał sprzedaży B2B',
      npv: 210_000,
      risk: 0.7,
      effort: 8,
      quadrant: 'defer',
      rank: 5,
    },
  ],
});

// ── DriverPlanner — real EBIT tree, exactly the shape
// FinanceHub.buildDriverTreeFromModelPreview() emits from a model's base-scenario
// P&L forecast (EBIT = (Revenue − COGS − Opex) − Depreciation). ──────────────
const MOCK_DRIVER_TREE: DriverNode = {
  id: 'ebit',
  label: 'EBIT (2026)',
  op: 'subtract',
  unit: 'PLN',
  children: [
    {
      id: 'ebitda',
      label: 'EBITDA',
      op: 'subtract',
      unit: 'PLN',
      children: [
        {
          id: 'revenue',
          label: 'Revenue',
          value: 12_400_000,
          unit: 'PLN',
          min: 0,
          max: 18_600_000,
        },
        { id: 'cogs', label: 'COGS', value: 7_100_000, unit: 'PLN', min: 0, max: 10_650_000 },
        { id: 'opex', label: 'Opex', value: 3_050_000, unit: 'PLN', min: 0, max: 4_575_000 },
      ],
    },
    {
      id: 'depreciation',
      label: 'Depreciation',
      value: 430_000,
      unit: 'PLN',
      min: 0,
      max: 645_000,
    },
  ],
};

const MOCK_MONTE_CARLO_RESULT = {
  simulation: {
    samples: [],
    mean: 1_140_000,
    p10: 420_000,
    p50: 1_090_000,
    p90: 1_920_000,
    probPositive: 0.94,
    valueAtRisk5: 180_000,
  },
  histogram: [
    { binStart: 0, binEnd: 400_000, count: 80 },
    { binStart: 400_000, binEnd: 800_000, count: 310 },
    { binStart: 800_000, binEnd: 1_200_000, count: 690 },
    { binStart: 1_200_000, binEnd: 1_600_000, count: 570 },
    { binStart: 1_600_000, binEnd: 2_000_000, count: 280 },
    { binStart: 2_000_000, binEnd: 2_400_000, count: 70 },
  ],
};

const MOCK_FRONTIER_RESULT = {
  curve: [
    { risk: 0.12, value: 320_000, mix: ['init-1'] },
    { risk: 0.2, value: 610_000, mix: ['init-1', 'init-3'] },
    { risk: 0.29, value: 940_000, mix: ['init-1', 'init-2', 'init-3'] },
    { risk: 0.38, value: 1_170_000, mix: ['init-1', 'init-2', 'init-3', 'init-4'] },
  ],
  current: {
    risk: 0.38,
    value: 1_170_000,
    mix: ['init-1', 'init-2', 'init-3', 'init-4'],
  },
  optimal: { risk: 0.29, value: 940_000, mix: ['init-1', 'init-2', 'init-3'] },
};

const MOCK_TORNADO_RESULT = {
  base: 1_080_000,
  bars: [
    { label: 'Revenue growth', low: 620_000, high: 1_560_000 },
    { label: 'Gross margin', low: 770_000, high: 1_390_000 },
    { label: 'Operating costs', low: 890_000, high: 1_270_000 },
  ],
};

const MOCK_HEATMAP_RESULT = {
  xLabels: [80, 90, 100, 110, 120],
  yLabels: [6, 8, 10, 12, 14],
  matrix: [6, 8, 10, 12, 14].flatMap((y) =>
    [80, 90, 100, 110, 120].map((x) => ({ x, y, value: 520_000 + x * 8_000 - y * 20_000 }))
  ),
};

function AutoRun({ testIds, children }: { testIds: string[]; children: React.ReactNode }) {
  useEffect(() => {
    for (const testId of testIds) {
      document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
    }
  }, [testIds]);
  return <>{children}</>;
}

const AUTO_RUN_MONTE_CARLO = ['mc-run'];
const AUTO_RUN_REAL_OPTIONS = ['ro-run'];
const AUTO_RUN_FRONTIER = ['frontier-run'];
const AUTO_RUN_SENSITIVITY = ['sens-run-tornado', 'sens-run-heatmap'];
const AUTO_RUN_SCENARIOS = ['scenario-run'];

export interface FinanceValuePanelsScreenProps {
  panelOverride?: string;
  stateOverride?: string;
}

export default function FinanceValuePanelsScreen({
  panelOverride,
  stateOverride,
}: FinanceValuePanelsScreenProps = {}): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const panel = panelOverride ?? params.get('panel') ?? 'value';
  const state = stateOverride ?? params.get('state') ?? 'populated';

  let body: React.ReactElement;
  if (panel === 'monte-carlo') {
    body = (
      <AutoRun testIds={AUTO_RUN_MONTE_CARLO}>
        <MonteCarloNpvPanel fetcher={async () => MOCK_MONTE_CARLO_RESULT} />
      </AutoRun>
    );
  } else if (panel === 'real-options') {
    body = (
      <AutoRun testIds={AUTO_RUN_REAL_OPTIONS}>
        <RealOptionsPanel
          fetcher={{
            defer: async () => ({
              optionValue: 285_000,
              expandedNpv: 385_000,
              recommendation: 'defer',
            }),
          }}
        />
      </AutoRun>
    );
  } else if (panel === 'frontier') {
    body = (
      <AutoRun testIds={AUTO_RUN_FRONTIER}>
        <EfficientFrontierPanel fetcher={async () => MOCK_FRONTIER_RESULT} />
      </AutoRun>
    );
  } else if (panel === 'sensitivity') {
    body = (
      <AutoRun testIds={AUTO_RUN_SENSITIVITY}>
        <WhatIfSensitivityPanel
          fetcher={{
            tornado: async () => MOCK_TORNADO_RESULT,
            dataTable: async () => MOCK_HEATMAP_RESULT,
          }}
        />
      </AutoRun>
    );
  } else if (panel === 'scenarios') {
    body = (
      <AutoRun testIds={AUTO_RUN_SCENARIOS}>
        <ScenarioComputePanel
          fetcher={{
            apply: async ({ assumptions, scenario }) => {
              const factors = { base: 1, optimistic: 1.18, conservative: 0.84 };
              const series = assumptions.revenue as number[];
              return {
                assumptions: { revenue: series.map((value) => value * factors[scenario]) },
              };
            },
            fan: async ({ scenarios }) => ({
              base: scenarios.base?.revenue ?? [],
              bands: [
                { label: 'optimistic', values: scenarios.optimistic?.revenue ?? [] },
                { label: 'conservative', values: scenarios.conservative?.revenue ?? [] },
              ],
            }),
          }}
        />
      </AutoRun>
    );
  } else if (panel === 'driver') {
    body =
      state === 'empty' ? (
        <DriverPlannerPanel />
      ) : (
        <DriverPlannerPanel driverTree={MOCK_DRIVER_TREE} />
      );
  } else {
    body =
      state === 'empty' ? (
        <ValueOfficePanel initiatives={[]} />
      ) : (
        <ValueOfficePanel
          initiatives={MOCK_INITIATIVES}
          valueBridgeFetcher={mockValueBridgeFetcher}
          portfolioFetcher={mockPortfolioFetcher}
        />
      );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, background: 'var(--c-bg)' }}>
      {/* ★ NAPRAWIONE (powtórka 08-31): pastylka harnessu bez `data-dev-render-chrome`
          — ta sama pułapka #15 co finance-statement-pack-workspace-v2.tsx. */}
      <div
        data-dev-render-chrome="true"
        style={{
          marginBottom: 12,
          fontFamily: 'system-ui',
          fontSize: 12,
          color: 'var(--c-text-muted)',
        }}
      >
        panel=<b>{panel}</b> · state=<b>{state}</b>
      </div>
      {body}
    </div>
  );
}
