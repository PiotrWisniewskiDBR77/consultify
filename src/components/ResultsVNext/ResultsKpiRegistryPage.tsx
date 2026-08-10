/**
 * /results/kpi — RN-G2 P0 route entry. See ResultsVNextRegistryRouteBase.tsx
 * for what this renders; P1 (KPI vertical, RN_G2_UI_SCOPE.md §G) replaces the
 * empty `table`/`preview` here with real columns/data/rowMenu.
 */
import React from 'react';

import { ResultsVNextRegistryRouteBase } from './ResultsVNextRegistryRouteBase';

export const ResultsKpiRegistryPage: React.FC = () => (
  <ResultsVNextRegistryRouteBase
    domain="kpi"
    flag="kpiRegistry"
    titlePl="Rejestr KPI"
    titleEn="KPI registry"
  />
);

export default ResultsKpiRegistryPage;
