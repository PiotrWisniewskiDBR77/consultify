/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDbAll,
  mockDbRun,
  mockConsumeSyncExternalAuthSession,
  mockSetConnectorAuthState,
  mockShouldMaterializeCallbackDrivenAuth,
  mockMaterializeGovernedExternalAuthCallback,
  mockResolveError,
} = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockDbRun: vi.fn(),
  mockConsumeSyncExternalAuthSession: vi.fn(),
  mockSetConnectorAuthState: vi.fn(),
  mockShouldMaterializeCallbackDrivenAuth: vi.fn(),
  mockMaterializeGovernedExternalAuthCallback: vi.fn(),
  mockResolveError: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: mockDbAll,
  run: mockDbRun,
}));

vi.mock('../../services/syncExternalAuthSessionService.js', () => ({
  consumeSyncExternalAuthSession: mockConsumeSyncExternalAuthSession,
}));

vi.mock('../../services/v8/pmSyncTruthService.js', () => ({
  setConnectorAuthState: mockSetConnectorAuthState,
}));

vi.mock('../../services/syncGuardrailsService.js', () => ({
  resolveError: (...args: unknown[]) => mockResolveError(...args),
}));

vi.mock('../../services/v8/pmSyncExternalAuthMaterializationService.js', () => ({
  shouldMaterializeCallbackDrivenAuth: mockShouldMaterializeCallbackDrivenAuth,
  materializeGovernedExternalAuthCallback: mockMaterializeGovernedExternalAuthCallback,
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: { user?: { id: string; organizationId: string } }, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import syncHubRoutes from '../syncHub.routes.js';

describe('Sync Hub external auth callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveError.mockResolvedValue(true);
    mockShouldMaterializeCallbackDrivenAuth.mockReturnValue(true);
    mockDbAll.mockResolvedValue([{ config: '{"site_url":"https://example.atlassian.net"}' }]);
    mockMaterializeGovernedExternalAuthCallback.mockResolvedValue({
      credentialStored: true,
      refreshSecretStored: true,
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
      scopesGranted: ['offline_access', 'read:jira-work'],
    });
  });

  it('materializes governed callback auth truth and keeps verification pending', async () => {
    mockConsumeSyncExternalAuthSession.mockReturnValue({
      state: 'state-1',
      integrationId: 'int-1',
      organizationId: 'org-1',
      connectorId: 'jira',
      mode: 'reauth',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    const app = express();
    app.use('/api/sync-hub', syncHubRoutes);

    const res = await request(app).get(
      '/api/sync-hub/external-auth/callback?state=state-1&code=code-1'
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain('Authorization callback received');
    expect(mockMaterializeGovernedExternalAuthCallback).toHaveBeenCalledWith({
      req: expect.any(Object),
      session: expect.objectContaining({
        state: 'state-1',
        connectorId: 'jira',
        organizationId: 'org-1',
      }),
      config: { site_url: 'https://example.atlassian.net' },
      code: 'code-1',
    });
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connected_pending_verification',
      transitionedBy: 'external_auth_callback',
      reason: 'external_auth_callback_received',
    });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.arrayContaining([
        'org-1',
        'int-1',
        'external_auth_callback_received',
        'external_auth_callback',
        'external_auth_callback',
      ])
    );
  });

  it('returns 400 for blank errorId on resolve route', async () => {
    const app = express();
    app.use('/api/sync-hub', syncHubRoutes);

    const res = await request(app).post('/api/sync-hub/errors/%20/resolve').send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAM');
    expect(mockResolveError).not.toHaveBeenCalled();
  });

  it('passes scoped params to resolveError and returns 404 when missing in tenant scope', async () => {
    mockResolveError.mockResolvedValueOnce(false);
    const app = express();
    app.use('/api/sync-hub', syncHubRoutes);

    const res = await request(app).post('/api/sync-hub/errors/err-1/resolve').send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(mockResolveError).toHaveBeenCalledWith('err-1', 'org-1');
  });
});
