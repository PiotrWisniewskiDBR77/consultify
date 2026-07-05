/**
 * ResultsSummaryView — stub retained for test compatibility.
 * The functionality has been merged into ResultsHub.
 */
import React from 'react';

export function getFinanceConsequenceTab({
  hasRoiPlan,
  hasRoiRealized,
}: {
  hasRoiPlan: boolean;
  hasRoiRealized: boolean;
}): 'analysis' | 'prediction' | 'valuation' {
  if (hasRoiPlan && hasRoiRealized) return 'valuation';
  if (hasRoiPlan) return 'prediction';
  return 'analysis';
}

export const ResultsSummaryView: React.FC<{
  searchQuery: string;
  activeFilters: any[];
  onFilterChange: (filters: any[]) => void;
}> = () => null;

export default ResultsSummaryView;
