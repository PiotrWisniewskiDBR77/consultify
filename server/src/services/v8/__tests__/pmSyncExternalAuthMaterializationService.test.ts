import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreCredential = vi.fn();
const mockStoreRefreshExecutionSecret = vi.fn();
const mockIssueSyncExternalAuthSession = vi.fn();

vi.mock('../../../config/Config.js', () => ({
  default: {
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    MICROSOFT_CLIENT_ID: undefined,
    MICROSOFT_CLIENT_SECRET: undefined,
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
        get: (header: string) => {
          if (header === 'host') return 'consultify.test';
          return undefined;
        },
      },
      {
        integrationId: 'int-1',
        organizationId: '00000000-0000-4000-8000-000000000099',
        connectorId: 'gmail',
        mode: 'connect',
        config: { domain: 'acme.com' },
      },
    );

    expect(session.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    expect(session.authUrl).toContain('client_id=google-client-id');
    expect(session.authUrl).toContain('access_type=offline');
    expect(session.authUrl).toContain('prompt=consent');
    expect(session.callbackUrl).toBe(
      'https://consultify.test/api/sync-hub/external-auth/callback?state=state-1',
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
        get: (header: string) => {
          if (header === 'host') return 'consultify.test';
          return undefined;
        },
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
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://www.googleapis.com/oauth2/v3/userinfo',
      expect.objectContaining({
        headers: { Authorization: 'Bearer google-access-1' },
      }),
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
});
