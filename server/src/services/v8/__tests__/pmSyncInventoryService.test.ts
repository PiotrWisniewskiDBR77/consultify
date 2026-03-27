/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbAll, mockGetConnectorHealth } = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockGetConnectorHealth: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: mockDbAll,
}));

vi.mock('../pmSyncTruthService.js', () => ({
  getConnectorHealth: mockGetConnectorHealth,
}));

import { listGovernedIntegrations } from '../pmSyncInventoryService.js';

describe('pmSyncInventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes pending integrations to connected once governed auth is healthy', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          id: 'int-1',
          organization_id: 'org-1',
          connector_id: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'pending',
          config: '{"site_url":"https://example.atlassian.net","cloud_id":"cloud-123"}',
          capabilities: '["issues"]',
          auth_type: 'oauth2',
          sync_settings: null,
          last_sync_at: null,
          last_error: null,
          created_at: '2026-03-27T00:00:00.000Z',
          updated_at: '2026-03-27T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);

    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: '2026-03-27T01:00:00.000Z',
      authState: 'healthy',
    });

    const rows = await listGovernedIntegrations('org-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('connected');
    expect(rows[0]?.onboardingStatus).toBeNull();
    expect(rows[0]?.health).toBe('healthy');
  });
});
