import { v8Get } from './client';

export interface V8ResultsDashboardSnapshot {
  organizationId: string;
  kpiScorecard: {
    organizationId: string;
    totalKpis: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    averageTargetAchievementRate: number | null;
  };
  activeDeviationsCount: number;
  roiDashboard: {
    organizationId: string;
    totalEntries: number;
    totalRealized: number;
    projectedFromKpiTargets: number;
    overallRealizationRate: number | null;
    byInitiative: Array<{
      initiativeId: string | null;
      entryCount: number;
      realizedSum: number;
    }>;
  };
  reconciliationHealth: {
    organizationId: string;
    total: number;
    byStatus: Record<string, number>;
    unresolvedCount: number;
    averageResolutionHours: number | null;
  };
  recentReviewPacks: Array<{
    packId: string;
    reviewPeriod: string;
    status: string;
    createdAt: string;
    kpiSummaryCount: number;
    deviationHighlightCount: number;
    roiSnapshotTotalRealized: number;
    roiSnapshotEntriesCount: number;
  }>;
}

export const V8ResultsApi = {
  getDashboard: () => v8Get<{ snapshot: V8ResultsDashboardSnapshot }>('/results/dashboard'),
};
