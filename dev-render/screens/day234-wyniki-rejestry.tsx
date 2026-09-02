/**
 * Day 234 evidence switchboard for the three real Results registries.
 *
 * This file deliberately composes the existing per-domain dev-render hosts.
 * Those hosts mount the production route-entry components and own their
 * deterministic API fixtures. `domain` only selects which isolated host is
 * active, preventing their global fetch stubs from contaminating one another.
 *
 * Query: domain=kpi|roi|okr, ff=off to prove the domain flag's disabled state.
 */
import React from 'react';

import ResultsVNextKpiRegistryScreen from './results-vnext-kpi-registry';
import ResultsVNextOkrRegistryScreen from './results-vnext-okr-registry';
import ResultsVNextRoiRegistryScreen from './results-vnext-roi-registry';

export default function Day234WynikiRejestryScreen() {
  const domain = new URLSearchParams(window.location.search).get('domain') ?? 'kpi';

  if (domain === 'roi') return <ResultsVNextRoiRegistryScreen />;
  if (domain === 'okr') return <ResultsVNextOkrRegistryScreen />;
  return <ResultsVNextKpiRegistryScreen />;
}
