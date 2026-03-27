/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDbAll,
  mockDbGet,
  mockDbRun,
  mockGetTableColumns,
  mockListGovernedIntegrations,
} = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
  mockGetTableColumns: vi.fn(),
  mockListGovernedIntegrations: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../services/v8/pmSyncInventoryService.js', () => ({
  listGovernedIntegrations: (...args: unknown[]) => mockListGovernedIntegrations(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/integrations/jiraOrgClient.js', () => ({
  createIssueFromTask: vi.fn(),
  parseJiraConfig: vi.fn(),
}));

vi.mock('../../services/integrations/communicationSyncService.js', () => ({
  dispatchProjectCommunicationEvent: vi.fn(),
}));

vi.mock('../../services/slackService.js', () => ({
  SlackServiceClass: vi.fn().mockImplementation(() => ({
    sendSystemAlert: vi.fn(),
  })),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import integrationsRoutes from '../integrations/integrations.routes.js';

describe('canonical integrations readback continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue(new Set(['connector_id', 'config']));
    mockDbAll.mockResolvedValue([
      {
        id: 'int-1',
        config: JSON.stringify({ site_url: 'https://acme.atlassian.net' }),
        created_at: '2026-03-27T20:00:00.000Z',
        updated_at: '2026-03-27T20:05:00.000Z',
      },
    ]);
    mockListGovernedIntegrations.mockResolvedValue([
      {
        id: 'int-1',
        connectorId: 'jira',
        name: 'Jira',
        category: 'project_management',
        status: 'pending',
        lastSyncAt: null,
        lastError: null,
        health: 'degraded',
        errorRate: 25,
        unresolvedErrors: 0,
        lastRun: null,
        configuredFields: ['site_url'],
        onboardingStatus: 'pending_external_auth_or_configuration',
        credential: null,
        connector: {
          id: 'jira',
          name: 'Jira',
          category: 'project_management',
          capabilities: ['issues'],
          authType: 'oauth2',
          configFields: ['site_url', 'cloud_id'],
        },
      },
    ]);
  });

  it('GET /api/integrations exposes governed pending sync truth on canonical org surface', async () => {
    const app = express();
    app.use('/api/integrations', integrationsRoutes);

    const res = await request(app).get('/api/integrations');

    expect(res.status).toBe(200);
    expect(mockListGovernedIntegrations).toHaveBeenCalledWith('org-1');
    expect(res.body).toEqual([
      expect.objectContaining({
        id: 'int-1',
        provider: 'jira',
        status: 'pending',
        onboarding_status: 'pending_external_auth_or_configuration',
        configured_fields: ['site_url'],
        required_fields: ['site_url', 'cloud_id'],
        config: { site_url: 'https://acme.atlassian.net' },
      }),
    ]);
  });
});
