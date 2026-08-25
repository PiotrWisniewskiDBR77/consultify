/**
 * Compatibility mount for the historical Results hub.
 *
 * The screen is intentionally a composition adapter, not a second scorecard
 * implementation: the complete vNext registry owns selection, filters,
 * PreviewPane, row actions, create flow and detail navigation. This file keeps
 * the old hub's component contract while removing all legacy scorecard API
 * callers. Historical GET endpoints remain available separately as read-only
 * archive surfaces.
 */
import React from 'react';

import { ResultsKpiRegistryPage } from '@/components/ResultsVNext/ResultsKpiRegistryPage';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { ResultsTrackedInitiative } from './kpiDomain';

export interface ResultsKpiScorecardsViewProps {
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  createNonce?: number;
  initiatives?: ResultsTrackedInitiative[];
}

export const ResultsKpiScorecardsView: React.FC<ResultsKpiScorecardsViewProps> = ({
  createNonce,
}) => (
  // `initialTab="scorecards"` IS the enablement signal — see the FIX-6 note
  // on `ResultsKpiRegistryPage`'s `enabled` computation. There is no
  // separate bypass prop to pass here anymore.
  <ResultsKpiRegistryPage initialTab="scorecards" createNonce={createNonce} />
);

export default ResultsKpiScorecardsView;
