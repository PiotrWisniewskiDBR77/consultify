/**
 * /results/okr — RN-G2 P0 route entry. See ResultsVNextRegistryRouteBase.tsx
 * for what this renders; P3 (OKR vertical, RN_G2_UI_SCOPE.md §G) replaces the
 * empty `table`/`preview` here with real columns/data/rowMenu.
 */
import React from 'react';

import { ResultsVNextRegistryRouteBase } from './ResultsVNextRegistryRouteBase';

export const ResultsOkrRegistryPage: React.FC = () => (
  <ResultsVNextRegistryRouteBase
    domain="okr"
    flag="okrRegistry"
    titlePl="Rejestr OKR"
    titleEn="OKR registry"
  />
);

export default ResultsOkrRegistryPage;
