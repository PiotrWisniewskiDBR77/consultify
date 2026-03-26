import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8AdminApi } from '@/services/api/v8/admin';
import { v8Get, v8Put } from '@/services/api/v8/client';

describe('V8AdminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads org-scoped V8 flags', async () => {
    vi.mocked(v8Get).mockResolvedValue({ v8_enabled: true, prompt_os_enabled: true } as any);

    await V8AdminApi.getFlags();

    expect(v8Get).toHaveBeenCalledWith('/admin/flags');
  });

  it('loads all org flags for superadmin surfaces', async () => {
    vi.mocked(v8Get).mockResolvedValue([{ organizationId: 'org-1', v8_enabled: true }] as any);

    await V8AdminApi.getAllFlags();

    expect(v8Get).toHaveBeenCalledWith('/admin/flags/all');
  });

  it('updates an org flag through the bounded V8 route', async () => {
    vi.mocked(v8Put).mockResolvedValue({ v8_enabled: false } as any);

    await V8AdminApi.setFlag('prompt_os_enabled', false);

    expect(v8Put).toHaveBeenCalledWith('/admin/flags/prompt_os_enabled', {
      enabled: false,
    });
  });

  it('loads platform health and metrics from governed admin routes', async () => {
    vi.mocked(v8Get)
      .mockResolvedValueOnce({ health: { overall: 'healthy' } } as any)
      .mockResolvedValueOnce({ requests: 12, avgLatencyMs: 142 } as any);

    await V8AdminApi.getHealth();
    await V8AdminApi.getMetrics();

    expect(v8Get).toHaveBeenNthCalledWith(1, '/admin/health');
    expect(v8Get).toHaveBeenNthCalledWith(2, '/admin/metrics');
  });

  it('loads shadow diagnostics from governed admin routes', async () => {
    vi.mocked(v8Get)
      .mockResolvedValueOnce({ comparedRequests: 12, mismatchRate: 0 } as any)
      .mockResolvedValueOnce({ comparisons: [{ comparisonId: 'cmp-1' }] } as any)
      .mockResolvedValueOnce({ ready: true, blockers: [] } as any);

    await V8AdminApi.getShadowStats();
    await V8AdminApi.getShadowComparisons(5);
    await V8AdminApi.getShadowPromotionReadiness();

    expect(v8Get).toHaveBeenNthCalledWith(1, '/admin/shadow/stats');
    expect(v8Get).toHaveBeenNthCalledWith(2, '/admin/shadow/comparisons', { limit: '5' });
    expect(v8Get).toHaveBeenNthCalledWith(3, '/admin/shadow/promotion-readiness');
  });
});
