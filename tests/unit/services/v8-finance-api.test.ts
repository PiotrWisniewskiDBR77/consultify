import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8FinanceApi } from '@/services/api/v8/finance';
import { v8Get } from '@/services/api/v8/client';

describe('V8FinanceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the governed finance dashboard from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      dashboard: {
        ingestionPipeline: {
          totalCount: 8,
          byState: { ready: 5, review_required: 3 },
          confidenceBands: { high: 4, medium: 2, low: 1, unknown: 1 },
          averageConfidence: 0.82,
        },
        linkageHealth: {
          totalLinkages: 11,
          byLinkageType: { initiative: 6, statement_pack: 5 },
          unlinkedInitiativesCount: 2,
        },
        unresolvedEscalationsCount: 3,
        staleSourceRefreshesCount: 1,
        promotionGatePassRate: 0.75,
      },
    });

    const data = await V8FinanceApi.getDashboard();

    expect(v8Get).toHaveBeenCalledWith('/finance/dashboard');
    expect(data.dashboard.ingestionPipeline.totalCount).toBe(8);
    expect(data.dashboard.linkageHealth.totalLinkages).toBe(11);
  });
});
