/**
 * Day 234 evidence switchboard for representative slices of the real full
 * KPI, OKR and ROI tools. The selected existing host supplies deterministic
 * manual fixtures and mounts production components; no product logic is
 * copied into this file.
 *
 * Query: domain=kpi|roi|okr. Domain-specific tab/view params pass through to
 * the selected host (for example `view=case`, `tab=history`).
 */
import React from 'react';

import ResultsVNextKpiToolScreen from './results-vnext-kpi-tool';
import ResultsVNextOkrWorkspaceScreen from './results-vnext-okr-workspace';
import ResultsVNextRoiFullToolScreen from './results-vnext-roi-full-tool';

export default function Day234WynikiNarzedziaScreen() {
  const domain = new URLSearchParams(window.location.search).get('domain') ?? 'kpi';

  if (domain === 'roi') return <ResultsVNextRoiFullToolScreen />;
  if (domain === 'okr') return <ResultsVNextOkrWorkspaceScreen />;
  return <ResultsVNextKpiToolScreen />;
}
