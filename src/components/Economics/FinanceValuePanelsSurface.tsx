import React, { lazy, Suspense, useState } from 'react';

import { isFinanceValuePanelsEnabled } from '@/utils/financeValuePanelsFlag';

const PANELS = {
  bankingValue: lazy(() =>
    import('./panels/BankingValuePanel').then((m) => ({ default: m.BankingValuePanel }))
  ),
  cashForecast: lazy(() =>
    import('./panels/CashForecastPanel').then((m) => ({ default: m.CashForecastPanel }))
  ),
  driverPlanner: lazy(() =>
    import('./panels/DriverPlannerPanel').then((m) => ({ default: m.DriverPlannerPanel }))
  ),
  driverTree: lazy(() =>
    import('./panels/DriverTreePanel').then((m) => ({ default: m.DriverTreePanel }))
  ),
  extendedRatios: lazy(() =>
    import('./panels/ExtendedRatiosPanel').then((m) => ({ default: m.ExtendedRatiosPanel }))
  ),
  headcountPlanner: lazy(() =>
    import('./panels/HeadcountPlannerPanel').then((m) => ({ default: m.HeadcountPlannerPanel }))
  ),
  investmentAppraisal: lazy(() =>
    import('./panels/InvestmentAppraisalPanel').then((m) => ({
      default: m.InvestmentAppraisalPanel,
    }))
  ),
  rollingForecast: lazy(() =>
    import('./panels/RollingForecastPanel').then((m) => ({ default: m.RollingForecastPanel }))
  ),
  valuationVisuals: lazy(() =>
    import('./panels/ValuationVisualsPanel').then((m) => ({ default: m.ValuationVisualsPanel }))
  ),
  valueAttribution: lazy(() =>
    import('./panels/ValueAttributionPanel').then((m) => ({ default: m.ValueAttributionPanel }))
  ),
  valueCapture: lazy(() =>
    import('./panels/ValueCapturePipelinePanel').then((m) => ({
      default: m.ValueCapturePipelinePanel,
    }))
  ),
  valueLedger: lazy(() =>
    import('./panels/ValueLedgerPanel').then((m) => ({ default: m.ValueLedgerPanel }))
  ),
  valueOffice: lazy(() =>
    import('./panels/ValueOfficePanel').then((m) => ({ default: m.ValueOfficePanel }))
  ),
  varianceBridge: lazy(() =>
    import('./panels/VarianceBridgePanel').then((m) => ({ default: m.VarianceBridgePanel }))
  ),
  varianceNarration: lazy(() =>
    import('./panels/VarianceNarrationPanel').then((m) => ({
      default: m.VarianceNarrationPanel,
    }))
  ),
  evBasket: lazy(() =>
    import('./panels/EvBasketFootballField').then((m) => ({ default: m.EvBasketFootballField }))
  ),
  monteCarlo: lazy(() =>
    import('./panels/MonteCarloNpvPanel').then((m) => ({ default: m.MonteCarloNpvPanel }))
  ),
  realOptions: lazy(() =>
    import('./panels/RealOptionsPanel').then((m) => ({ default: m.RealOptionsPanel }))
  ),
  frontier: lazy(() =>
    import('./panels/EfficientFrontierPanel').then((m) => ({ default: m.EfficientFrontierPanel }))
  ),
  sensitivity: lazy(() =>
    import('./panels/WhatIfSensitivityPanel').then((m) => ({ default: m.WhatIfSensitivityPanel }))
  ),
  scenarios: lazy(() =>
    import('./panels/ScenarioComputePanel').then((m) => ({ default: m.ScenarioComputePanel }))
  ),
} as const;

type PanelId = keyof typeof PANELS;

const LABELS: Record<PanelId, string> = {
  bankingValue: 'Banking value',
  cashForecast: 'Cash forecast',
  driverPlanner: 'Driver planner',
  driverTree: 'Driver tree',
  extendedRatios: 'Extended ratios',
  headcountPlanner: 'Headcount planner',
  investmentAppraisal: 'Investment appraisal',
  rollingForecast: 'Rolling forecast',
  valuationVisuals: 'Valuation visuals',
  valueAttribution: 'Value attribution',
  valueCapture: 'Value capture pipeline',
  valueLedger: 'Value ledger',
  valueOffice: 'Value office',
  varianceBridge: 'Variance bridge',
  varianceNarration: 'Variance narration',
  evBasket: 'EV basket',
  monteCarlo: 'Monte Carlo NPV',
  realOptions: 'Real options',
  frontier: 'Efficient frontier',
  sensitivity: 'What-if sensitivity',
  scenarios: 'Scenario compute',
};

export function FinanceValuePanelsSurface(): React.ReactElement | null {
  const [active, setActive] = useState<PanelId>('monteCarlo');
  if (!isFinanceValuePanelsEnabled()) return null;
  const Panel = PANELS[active];

  return (
    <section
      className="mb-3 rounded-xl border border-c-border bg-c-surface p-3"
      data-testid="finance-value-panels-surface"
    >
      <div
        className="mb-3 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Valuation analysis panels"
      >
        {(Object.keys(PANELS) as PanelId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className="rounded-lg border border-c-border px-3 py-1.5 text-sm text-c-text"
            onClick={() => setActive(id)}
          >
            {LABELS[id]}
          </button>
        ))}
      </div>
      <Suspense fallback={<div className="p-6 text-c-text-muted">Loading panel…</div>}>
        <Panel />
      </Suspense>
    </section>
  );
}

export default FinanceValuePanelsSurface;
