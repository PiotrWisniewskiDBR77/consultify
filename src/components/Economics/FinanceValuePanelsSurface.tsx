import React, { lazy, Suspense, useState } from 'react';

import { isFinanceValuePanelsEnabled } from '@/utils/financeValuePanelsFlag';

const PANELS = {
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
