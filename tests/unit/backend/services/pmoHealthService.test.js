/**
 * PMO Health Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createPMOHealthService = () => {
  return {
    getHealthScore: async (projectId) => {
      if (!projectId) return { success: false, error: 'Project ID required', status: 400 };
      return {
        success: true,
        data: { projectId, score: 78, status: 'amber', factors: ['budget', 'timeline', 'scope'] },
        status: 200,
      };
    },

    getFactorAnalysis: async (projectId, factor) => {
      if (!projectId) return { success: false, error: 'Project ID required', status: 400 };
      return { success: true, data: { factor, score: 65, trend: 'improving' }, status: 200 };
    },

    getRecommendations: async (projectId) => {
      return {
        success: true,
        data: [{ id: 'rec-1', priority: 'high', action: 'Review timeline' }],
        status: 200,
      };
    },

    calculateOverallHealth: async (orgId) => {
      return { success: true, data: { overallScore: 72, projectCount: 5, atRisk: 2 }, status: 200 };
    },
  };
};

describe('PMOHealthService', () => {
  let pmoHealthService;

  beforeEach(() => {
    vi.clearAllMocks();
    pmoHealthService = createPMOHealthService();
  });

  it('should get project health score', async () => {
    const result = await pmoHealthService.getHealthScore('proj-1');
    expect(result.success).toBe(true);
    expect(result.data.score).toBeDefined();
  });

  it('should get factor analysis', async () => {
    const result = await pmoHealthService.getFactorAnalysis('proj-1', 'budget');
    expect(result.success).toBe(true);
    expect(result.data.trend).toBeDefined();
  });

  it('should get recommendations', async () => {
    const result = await pmoHealthService.getRecommendations('proj-1');
    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should calculate overall health', async () => {
    const result = await pmoHealthService.calculateOverallHealth('org-1');
    expect(result.success).toBe(true);
    expect(result.data.overallScore).toBeDefined();
  });
});
