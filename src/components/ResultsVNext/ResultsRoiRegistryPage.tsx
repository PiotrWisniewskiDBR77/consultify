/**
 * /results/roi — RN-G2 P0 route entry. See ResultsVNextRegistryRouteBase.tsx
 * for what this renders; P2 (ROI vertical, RN_G2_UI_SCOPE.md §G) replaces the
 * empty `table`/`preview` here with real columns/data/rowMenu.
 */
import React from 'react';

import { ResultsVNextRegistryRouteBase } from './ResultsVNextRegistryRouteBase';

export const ResultsRoiRegistryPage: React.FC = () => (
  <ResultsVNextRegistryRouteBase
    domain="roi"
    flag="roiRegistry"
    titlePl="Rejestr ROI"
    titleEn="ROI registry"
  />
);

export default ResultsRoiRegistryPage;
