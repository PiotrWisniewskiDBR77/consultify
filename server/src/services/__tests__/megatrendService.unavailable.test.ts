import { describe, expect, it, vi } from 'vitest';

const loggerError = vi.fn();

vi.mock('../../models/megatrend.js', () => ({
  getBaselineTrends: vi.fn(),
  getRadarData: vi.fn(),
  getTrendDetail: vi.fn(),
  createCustomTrend: vi.fn(),
  // Deliberately non-callable: the startup control must fail closed.
  updateCustomTrend: undefined,
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: loggerError },
}));

describe('megatrend startup control failure', () => {
  it('publishes unavailable and logs the missing model export as an error', async () => {
    const module = await import('../megatrendService.js');

    expect(module.megatrendsAvailable).toBe(false);
    expect(module.megatrendService).toBeNull();
    expect(module.missingMegatrendMethods).toEqual(['updateCustomTrend']);
    expect(loggerError).toHaveBeenCalledWith(
      '[Megatrend] Startup control failed: model exports are incomplete',
      { missingMethods: ['updateCustomTrend'] }
    );
  });
});
