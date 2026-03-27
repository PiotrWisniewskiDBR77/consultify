/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbAll, mockGetConnectorHealth, mockGetCredential } = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockGetConnectorHealth: vi.fn(),
  mockGetCredential: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: mockDbAll,
}));

vi.mock('../pmSyncTruthService.js', () => ({
  getConnectorHealth: mockGetConnectorHealth,
}));

vi.mock('../pmSyncAuthService.js', () => ({
  getCredential: mockGetCredential,
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

  it('includes governed credential readback when credential truth exists', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          id: 'int-1',
          organization_id: 'org-1',
          connector_id: 'jira',
          name: 'Jira',
          category: 'project_management',
          status: 'connected',
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
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: 'org-1',
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });

    const rows = await listGovernedIntegrations('org-1');

    expect(rows[0]?.credential?.providerAccountId).toBe('acct-123');
    expect(rows[0]?.credential?.workspaceOrTenantId).toBe('tenant-456');
    expect(rows[0]?.credential?.scopesGranted).toEqual(['read:jira-work']);
  });
});
