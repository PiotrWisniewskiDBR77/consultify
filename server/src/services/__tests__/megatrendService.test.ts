import { describe, expect, it, vi } from 'vitest';

vi.mock('../../models/megatrend.js', () => ({
  getBaselineTrends: vi.fn(),
  getRadarData: vi.fn(),
  getTrendDetail: vi.fn(),
  createCustomTrend: vi.fn(),
  updateCustomTrend: vi.fn(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn() },
}));

describe('megatrend startup control', () => {
  it('reports the statically imported model as available', async () => {
    const module = await import('../megatrendService.js');

    expect(module.megatrendsAvailable).toBe(true);
    expect(module.missingMegatrendMethods).toEqual([]);
    expect(module.megatrendService).not.toBeNull();
  });
});
