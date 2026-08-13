import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreCredential = vi.fn();
const mockStoreRefreshExecutionSecret = vi.fn();
const mockIssueSyncExternalAuthSession = vi.fn();

vi.mock('../../../config/Config.js', () => ({
  default: {
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    ASANA_CLIENT_ID: 'asana-client-id',
    ASANA_CLIENT_SECRET: 'asana-client-secret',
    MICROSOFT_CLIENT_ID: 'microsoft-client-id',
    MICROSOFT_CLIENT_SECRET: 'microsoft-client-secret',
    SLACK_CLIENT_ID: 'slack-client-id',
    SLACK_CLIENT_SECRET: 'slack-client-secret',
  },
}));

vi.mock('../../syncExternalAuthSessionService.js', () => ({
  issueSyncExternalAuthSession: (...args: unknown[]) => mockIssueSyncExternalAuthSession(...args),
}));

vi.mock('../pmSyncAuthService.js', () => ({
  storeCredential: (...args: unknown[]) => mockStoreCredential(...args),
}));

vi.mock('../pmSyncRefreshExecutionService.js', () => ({
  storeRefreshExecutionSecret: (...args: unknown[]) => mockStoreRefreshExecutionSecret(...args),
}));

import {
  buildGovernedExternalAuthSession,
  materializeGovernedExternalAuthCallback,
  shouldMaterializeCallbackDrivenAuth,
} from '../pmSyncExternalAuthMaterializationService.js';
import type { Request } from 'express';

/**
 * `Request['get']` is overloaded (`'set-cookie'` resolves to `string[]`), so an
 * arrow returning `string | undefined` does not satisfy it. Provide a real
 * overloaded double with the same behaviour the suite relied on.
 */
function makeHostGetter(host: string): Request['get'] {
  function get(name: 'set-cookie'): string[] | undefined;
  function get(name: string): string | undefined;
  function get(name: string): string[] | string | undefined {
    return name === 'host' ? host : undefined;
  }
  return get;
}


describe('pmSyncExternalAuthMaterializationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockIssueSyncExternalAuthSession.mockReturnValue({
      state: 'state-1',
      expiresAt: Date.parse('2026-03-27T20:10:00.000Z'),
    });
    mockStoreCredential.mockResolvedValue({
      credentialId: 'cred-1',
    });
    mockStoreRefreshExecutionSecret.mockResolvedValue({
      connectorId: 'gmail',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'google-client-id',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    });
  });

  it('builds a real Gmail provider authorization URL on the governed path', () => {
    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-1',
        organizationId: '00000000-0000-4000-8000-000000000099',
        connectorId: 'gmail',
        mode: 'connect',
        config: { domain: 'acme.com' },
      }
    );

    expect(session.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    expect(session.authUrl).toContain('client_id=google-client-id');
    expect(session.authUrl).toContain('access_type=offline');
    expect(session.authUrl).toContain('prompt=consent');
    expect(session.callbackUrl).toBe(
      'https://consultify.test/api/sync-hub/external-auth/callback?state=state-1'
    );
  });

  it('materializes Gmail governed callback auth truth and stores refresh material', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'google-access-1',
          refresh_token: 'google-refresh-1',
          expires_in: 3600,
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-user-1',
          email: 'alice@acme.com',
          hd: 'acme.com',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await materializeGovernedExternalAuthCallback({
      req: {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      session: {
        state: 'state-1',
        connectorId: 'gmail',
        organizationId: '00000000-0000-4000-8000-000000000099',
      },
      config: {
        domain: 'acme.com',
      },
      code: 'google-code-1',
    });

    expect(result.credentialStored).toBe(true);
    expect(result.refreshSecretStored).toBe(true);
    expect(result.scopesGranted).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://www.googleapis.com/oauth2/v3/userinfo',
      expect.objectContaining({
        headers: { Authorization: 'Bearer google-access-1' },
      })
    );
    expect(mockStoreCredential).toHaveBeenCalledWith({
      connectorId: 'gmail',
      organizationId: '00000000-0000-4000-8000-000000000099',
      providerAccountId: 'alice@acme.com',
      workspaceOrTenantId: 'acme.com',
      scopesGranted: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'gmail',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      refreshToken: 'google-refresh-1',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    });
  });

  it('marks gmail as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('gmail')).toBe(true);
  });

  it('builds a real Asana provider authorization URL on the governed path', () => {
    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-asana-1',
        organizationId: '00000000-0000-4000-8000-000000000099',
        connectorId: 'asana',
        mode: 'connect',
        config: { workspace_gid: 'workspace-123' },
      }
    );

    expect(session.authUrl).toContain('https://app.asana.com/-/oauth_authorize?');
    expect(session.authUrl).toContain('client_id=asana-client-id');
    expect(session.authUrl).toContain('response_type=code');
  });

  it('materializes Asana governed callback auth truth and stores refresh material', async () => {
    mockStoreRefreshExecutionSecret.mockResolvedValueOnce({
      connectorId: 'asana',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'asana-client-id',
      tokenEndpoint: 'https://app.asana.com/-/oauth_token',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'asana-access-1',
          refresh_token: 'asana-refresh-1',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            gid: 'user-123',
            email: 'alice@acme.com',
            name: 'Alice',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await materializeGovernedExternalAuthCallback({
      req: {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      session: {
        state: 'state-1',
        connectorId: 'asana',
        organizationId: '00000000-0000-4000-8000-000000000099',
      },
      config: {
        workspace_gid: 'workspace-123',
      },
      code: 'asana-code-1',
    });

    expect(result.credentialStored).toBe(true);
    expect(result.refreshSecretStored).toBe(true);
    expect(result.scopesGranted).toEqual(['default']);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://app.asana.com/-/oauth_token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://app.asana.com/api/1.0/users/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer asana-access-1' },
      })
    );
    expect(mockStoreCredential).toHaveBeenCalledWith({
      connectorId: 'asana',
      organizationId: '00000000-0000-4000-8000-000000000099',
      providerAccountId: 'alice@acme.com',
      workspaceOrTenantId: 'workspace-123',
      scopesGranted: ['default'],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'asana',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'asana-client-id',
      clientSecret: 'asana-client-secret',
      refreshToken: 'asana-refresh-1',
      tokenEndpoint: 'https://app.asana.com/-/oauth_token',
    });
  });

  it('marks asana as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('asana')).toBe(true);
  });

  it('builds a real Teams provider authorization URL on the governed path', () => {
    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-2',
        organizationId: '00000000-0000-4000-8000-000000000099',
        connectorId: 'teams',
        mode: 'connect',
        config: { tenant_id: 'tenant-123' },
      }
    );

    expect(session.authUrl).toContain(
      'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize?'
    );
    expect(session.authUrl).toContain('client_id=microsoft-client-id');
    expect(session.authUrl).toContain('response_mode=query');
    expect(session.authUrl).toContain('offline_access');
  });

  it('materializes Teams governed callback auth truth and stores refresh material', async () => {
    mockStoreRefreshExecutionSecret.mockResolvedValueOnce({
      connectorId: 'teams',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'microsoft-client-id',
      tokenEndpoint: 'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'microsoft-access-1',
          refresh_token: 'microsoft-refresh-1',
          expires_in: 3600,
          scope: 'offline_access openid profile email User.Read',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'microsoft-user-1',
          userPrincipalName: 'alice@acme.onmicrosoft.com',
          mail: 'alice@acme.com',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await materializeGovernedExternalAuthCallback({
      req: {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      session: {
        state: 'state-1',
        connectorId: 'teams',
        organizationId: '00000000-0000-4000-8000-000000000099',
      },
      config: {
        tenant_id: 'tenant-123',
      },
      code: 'microsoft-code-1',
    });

    expect(result.credentialStored).toBe(true);
    expect(result.refreshSecretStored).toBe(true);
    expect(result.scopesGranted).toContain('User.Read');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://graph.microsoft.com/v1.0/me?$select=id,userPrincipalName,mail',
      expect.objectContaining({
        headers: { Authorization: 'Bearer microsoft-access-1' },
      })
    );
    expect(mockStoreCredential).toHaveBeenCalledWith({
      connectorId: 'teams',
      organizationId: '00000000-0000-4000-8000-000000000099',
      providerAccountId: 'alice@acme.onmicrosoft.com',
      workspaceOrTenantId: 'tenant-123',
      scopesGranted: ['offline_access', 'openid', 'profile', 'email', 'User.Read'],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'teams',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'microsoft-client-id',
      clientSecret: 'microsoft-client-secret',
      refreshToken: 'microsoft-refresh-1',
      tokenEndpoint: 'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token',
    });
  });

  it('marks teams as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('teams')).toBe(true);
  });

  it('builds a real Slack provider authorization URL on the governed path', () => {
    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-3',
        organizationId: '00000000-0000-4000-8000-000000000099',
        connectorId: 'slack',
        mode: 'connect',
        config: { workspace_id: 'workspace-123' },
      }
    );

    expect(session.authUrl).toContain('https://slack.com/oauth/v2/authorize?');
    expect(session.authUrl).toContain('client_id=slack-client-id');
    expect(session.authUrl).toContain('channels%3Aread%2Cusers%3Aread%2Cchat%3Awrite');
  });

  it('materializes Slack governed callback auth truth and stores refresh material', async () => {
    mockStoreRefreshExecutionSecret.mockResolvedValueOnce({
      connectorId: 'slack',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'slack-client-id',
      tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        access_token: 'slack-access-1',
        refresh_token: 'slack-refresh-1',
        expires_in: 3600,
        scope: 'channels:read,users:read,chat:write',
        team: { id: 'T123', name: 'Acme' },
        authed_user: { id: 'U123' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await materializeGovernedExternalAuthCallback({
      req: {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      session: {
        state: 'state-1',
        connectorId: 'slack',
        organizationId: '00000000-0000-4000-8000-000000000099',
      },
      config: {
        workspace_id: 'workspace-123',
      },
      code: 'slack-code-1',
    });

    expect(result.credentialStored).toBe(true);
    expect(result.refreshSecretStored).toBe(true);
    expect(result.scopesGranted).toEqual(['channels:read', 'users:read', 'chat:write']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.com/api/oauth.v2.access',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
    expect(mockStoreCredential).toHaveBeenCalledWith({
      connectorId: 'slack',
      organizationId: '00000000-0000-4000-8000-000000000099',
      providerAccountId: 'U123',
      workspaceOrTenantId: 'T123',
      scopesGranted: ['channels:read', 'users:read', 'chat:write'],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'slack',
      organizationId: '00000000-0000-4000-8000-000000000099',
      clientId: 'slack-client-id',
      clientSecret: 'slack-client-secret',
      refreshToken: 'slack-refresh-1',
      tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    });
  });

  it('marks slack as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('slack')).toBe(true);
  });
});
