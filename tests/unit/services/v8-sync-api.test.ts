import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8SyncApi } from '@/services/api/v8/sync';
import { v8Get } from '@/services/api/v8/client';

describe('V8SyncApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests sync auth health from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      summary: {
        total: 12,
        healthy: 9,
        failing: 2,
        escalated: 1,
      },
    });

    const data = await V8SyncApi.getAuthHealth();

    expect(v8Get).toHaveBeenCalledWith('/sync/auth/health');
    expect(data.summary.total).toBe(12);
    expect(data.summary.escalated).toBe(1);
  });

  it('requests per-connector health from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      connectorId: 'salesforce',
      health: {
        healthy: true,
        syncStatus: 'synced',
        conflictCount: 0,
        lastSyncAt: '2026-03-25T10:00:00.000Z',
        authState: 'healthy',
      },
    });

    const data = await V8SyncApi.getConnectorHealth('salesforce');

    expect(v8Get).toHaveBeenCalledWith('/sync/connectors/salesforce/health');
    expect(data.health.syncStatus).toBe('synced');
    expect(data.health.authState).toBe('healthy');
  });
});
