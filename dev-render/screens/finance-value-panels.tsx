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
import React from 'react';

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

export default function FinanceValuePanelsScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const panel = params.get('panel') || 'value';
  const state = params.get('state') || 'populated';

  let body: React.ReactElement;
  if (panel === 'monte-carlo') {
    body = <MonteCarloNpvPanel />;
  } else if (panel === 'real-options') {
    body = <RealOptionsPanel />;
  } else if (panel === 'frontier') {
    body = <EfficientFrontierPanel />;
  } else if (panel === 'sensitivity') {
    body = <WhatIfSensitivityPanel />;
  } else if (panel === 'scenarios') {
    body = <ScenarioComputePanel />;
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
      <div
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
