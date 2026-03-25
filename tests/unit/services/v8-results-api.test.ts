import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8ResultsApi } from '@/services/api/v8/results';
import { v8Get } from '@/services/api/v8/client';

describe('V8ResultsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the governed results dashboard from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      snapshot: {
        organizationId: 'org-1',
        kpiScorecard: {
          organizationId: 'org-1',
          totalKpis: 5,
          byStatus: { active: 5 },
          byCategory: { count: 5 },
          averageTargetAchievementRate: 0.75,
        },
        activeDeviationsCount: 2,
        roiDashboard: {
          organizationId: 'org-1',
          totalEntries: 3,
          totalRealized: 1200,
          projectedFromKpiTargets: 2400,
          overallRealizationRate: 0.5,
          byInitiative: [],
        },
        reconciliationHealth: {
          organizationId: 'org-1',
          total: 1,
          byStatus: { pending: 1 },
          unresolvedCount: 1,
          averageResolutionHours: null,
        },
        recentReviewPacks: [],
      },
    });

    const data = await V8ResultsApi.getDashboard();

    expect(v8Get).toHaveBeenCalledWith('/results/dashboard');
    expect(data.snapshot.kpiScorecard.totalKpis).toBe(5);
    expect(data.snapshot.roiDashboard.totalRealized).toBe(1200);
  });
});
