/**
 * HISTORICAL RECORD — read before touching this file.
 *
 * This suite previously passed 12/12 on canonical while asserting that an
 * UNAPPROVED connector produced a real provider authorization URL and, on
 * callback, exchanged a code for real tokens and stored refresh material —
 * all with `OAUTH_APPROVED_PROVIDER_REGISTRY` never mentioned and no
 * approval env set anywhere in the file. That 12/12 green was the fail-open
 * defect: SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002 requires every
 * governed external-auth path to fail closed absent explicit registry
 * approval, and this suite instead encoded "always succeeds" as the
 * intended behaviour.
 *
 * The 8 originally-passing tests that asserted the defect (unapproved
 * connector -> real authUrl / real token storage) were:
 *   - "builds a real Gmail provider authorization URL on the governed path"
 *   - "materializes Gmail governed callback auth truth and stores refresh material"
 *   - "builds a real Asana provider authorization URL on the governed path"
 *   - "materializes Asana governed callback auth truth and stores refresh material"
 *   - "builds a real Teams provider authorization URL on the governed path"
 *   - "materializes Teams governed callback auth truth and stores refresh material"
 *   - "builds a real Slack provider authorization URL on the governed path"
 *   - "materializes Slack governed callback auth truth and stores refresh material"
 *
 * A guard (`requireApprovedGovernedConnector`, called first thing in both
 * `buildGovernedExternalAuthSession` and `materializeGovernedExternalAuthCallback`
 * in ../pmSyncExternalAuthMaterializationService.ts) now fails closed unless
 * the registry explicitly approves the connector with the exact required
 * scope set and a non-empty residency. The 8 tests above are kept below,
 * unchanged in what they assert, but now seed that approval first — they
 * prove the guard is a GATE (approved traffic still gets a real URL/token
 * exchange), not a wall. New tests were added alongside them to prove the
 * unapproved path fails closed, and Jira coverage (previously absent from
 * this file entirely) was added so all five governed connectors are
 * exercised on both the positive and negative path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const ORG_ID = '00000000-0000-4000-8000-000000000099';

const CONNECTOR_IDS = ['jira', 'gmail', 'asana', 'teams', 'slack'] as const;
type ConnectorId = (typeof CONNECTOR_IDS)[number];

/**
 * Exact required scope sets per connector, copied from
 * server/src/services/v8/pmSyncExternalAuthMaterializationService.ts:
 *   DEFAULT_JIRA_SCOPES   (line 32)  -> GOVERNED_CONNECTOR_REQUIRED_SCOPES.jira
 *   DEFAULT_ASANA_SCOPES  (line 41)  -> GOVERNED_CONNECTOR_REQUIRED_SCOPES.asana
 *   DEFAULT_GMAIL_SCOPES  (lines 42-47) -> GOVERNED_CONNECTOR_REQUIRED_SCOPES.gmail
 *   DEFAULT_SLACK_SCOPES  (line 51)  -> GOVERNED_CONNECTOR_REQUIRED_SCOPES.slack
 *   DEFAULT_TEAMS_SCOPES  (line 57)  -> GOVERNED_CONNECTOR_REQUIRED_SCOPES.teams
 * `GOVERNED_CONNECTOR_REQUIRED_SCOPES` itself (lines 110-116) maps each of
 * these five connector keys 1:1 onto these arrays — that map is what
 * `requireApprovedGovernedConnector` checks the registry entry against, so
 * the registry entries seeded below must match these arrays exactly (same
 * length, same members) or the guard denies.
 */
const REQUIRED_SCOPES: Record<ConnectorId, readonly string[]> = {
  jira: ['offline_access', 'read:jira-work'],
  gmail: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
  asana: ['default'],
  teams: ['offline_access', 'openid', 'profile', 'email', 'User.Read'],
  slack: ['channels:read', 'users:read', 'chat:write'],
};

/** Minimal valid `config` payload each connector's schema accepts. */
const CONNECTOR_CONFIGS: Record<ConnectorId, Record<string, unknown>> = {
  jira: {
    site_url: 'https://acme.atlassian.net',
    cloud_id: 'cloud-123',
    client_id: 'jira-client-id',
    client_secret: 'jira-client-secret',
  },
  gmail: { domain: 'acme.com' },
  asana: { workspace_gid: 'workspace-123' },
  teams: { tenant_id: 'tenant-123' },
  slack: { workspace_id: 'workspace-123' },
};

let originalRegistryEnv: string | undefined;

/** Seed the registry with a single, correctly-approved connector entry. */
function approveOnly(connectorId: ConnectorId, residency = 'eu'): void {
  process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
    [connectorId]: {
      approved: true,
      scopes: [...REQUIRED_SCOPES[connectorId]],
      residency,
    },
  });
}

/** Set the raw registry env var (or clear it entirely when `registry` is null). */
function setRegistry(registry: Record<string, unknown> | null): void {
  if (registry === null) {
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  } else {
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify(registry);
  }
}

describe('pmSyncExternalAuthMaterializationService', () => {
  beforeEach(() => {
    // Env hygiene: capture whatever was there (including "unset") and start
    // every test from "no approval registry at all" — leaked approval state
    // between tests would recreate exactly the fail-open bug this suite now
    // guards against.
    originalRegistryEnv = process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;

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
      organizationId: ORG_ID,
      clientId: 'google-client-id',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    });
  });

  afterEach(() => {
    if (originalRegistryEnv === undefined) {
      delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
    } else {
      process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = originalRegistryEnv;
    }
  });

  // ---------------------------------------------------------------------
  // APPROVED PATH — the guard is a gate: correct registry approval still
  // produces the real provider authorize URL and still exchanges/stores
  // real token material, unchanged from before the guard landed.
  // ---------------------------------------------------------------------

  it('builds a real Jira provider authorization URL on the governed path when jira is approved', () => {
    approveOnly('jira');

    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-jira-1',
        organizationId: ORG_ID,
        connectorId: 'jira',
        mode: 'connect',
        config: CONNECTOR_CONFIGS.jira,
      }
    );

    expect(session.authUrl).toContain('https://auth.atlassian.com/authorize?');
    expect(session.authUrl).toContain('client_id=jira-client-id');
    expect(session.authUrl).toContain('response_type=code');
    expect(session.authUrl).toContain('prompt=consent');
    expect(session.authUrl).toContain('scope=offline_access+read%3Ajira-work');
    expect(session.callbackUrl).toBe(
      'https://consultify.test/api/sync-hub/external-auth/callback?state=state-1'
    );
  });

  it('materializes Jira governed callback auth truth and stores refresh material when jira is approved', async () => {
    approveOnly('jira');
    mockStoreRefreshExecutionSecret.mockResolvedValueOnce({
      connectorId: 'jira',
      organizationId: ORG_ID,
      clientId: 'jira-client-id',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'jira-access-1',
        refresh_token: 'jira-refresh-1',
        expires_in: 3600,
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
        connectorId: 'jira',
        organizationId: ORG_ID,
      },
      config: CONNECTOR_CONFIGS.jira,
      code: 'jira-code-1',
    });

    expect(result.credentialStored).toBe(true);
    expect(result.refreshSecretStored).toBe(true);
    expect(result.scopesGranted).toEqual(['offline_access', 'read:jira-work']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.atlassian.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      })
    );
    expect(mockStoreCredential).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG_ID,
      providerAccountId: 'https://acme.atlassian.net',
      workspaceOrTenantId: 'cloud-123',
      scopesGranted: ['offline_access', 'read:jira-work'],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG_ID,
      clientId: 'jira-client-id',
      clientSecret: 'jira-client-secret',
      refreshToken: 'jira-refresh-1',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    });
  });

  it('builds a real Gmail provider authorization URL on the governed path when gmail is approved', () => {
    approveOnly('gmail');

    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-1',
        organizationId: ORG_ID,
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

  it('materializes Gmail governed callback auth truth and stores refresh material when gmail is approved', async () => {
    approveOnly('gmail');
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
        organizationId: ORG_ID,
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
      organizationId: ORG_ID,
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
      organizationId: ORG_ID,
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      refreshToken: 'google-refresh-1',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    });
  });

  it('marks gmail as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('gmail')).toBe(true);
  });

  it('builds a real Asana provider authorization URL on the governed path when asana is approved', () => {
    approveOnly('asana');

    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-asana-1',
        organizationId: ORG_ID,
        connectorId: 'asana',
        mode: 'connect',
        config: { workspace_gid: 'workspace-123' },
      }
    );

    expect(session.authUrl).toContain('https://app.asana.com/-/oauth_authorize?');
    expect(session.authUrl).toContain('client_id=asana-client-id');
    expect(session.authUrl).toContain('response_type=code');
  });

  it('materializes Asana governed callback auth truth and stores refresh material when asana is approved', async () => {
    approveOnly('asana');
    mockStoreRefreshExecutionSecret.mockResolvedValueOnce({
      connectorId: 'asana',
      organizationId: ORG_ID,
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
        organizationId: ORG_ID,
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
      organizationId: ORG_ID,
      providerAccountId: 'alice@acme.com',
      workspaceOrTenantId: 'workspace-123',
      scopesGranted: ['default'],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'asana',
      organizationId: ORG_ID,
      clientId: 'asana-client-id',
      clientSecret: 'asana-client-secret',
      refreshToken: 'asana-refresh-1',
      tokenEndpoint: 'https://app.asana.com/-/oauth_token',
    });
  });

  it('marks asana as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('asana')).toBe(true);
  });

  it('builds a real Teams provider authorization URL on the governed path when teams is approved', () => {
    approveOnly('teams');

    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-2',
        organizationId: ORG_ID,
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

  it('materializes Teams governed callback auth truth and stores refresh material when teams is approved', async () => {
    approveOnly('teams');
    mockStoreRefreshExecutionSecret.mockResolvedValueOnce({
      connectorId: 'teams',
      organizationId: ORG_ID,
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
        organizationId: ORG_ID,
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
      organizationId: ORG_ID,
      providerAccountId: 'alice@acme.onmicrosoft.com',
      workspaceOrTenantId: 'tenant-123',
      scopesGranted: ['offline_access', 'openid', 'profile', 'email', 'User.Read'],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'teams',
      organizationId: ORG_ID,
      clientId: 'microsoft-client-id',
      clientSecret: 'microsoft-client-secret',
      refreshToken: 'microsoft-refresh-1',
      tokenEndpoint: 'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token',
    });
  });

  it('marks teams as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('teams')).toBe(true);
  });

  it('builds a real Slack provider authorization URL on the governed path when slack is approved', () => {
    approveOnly('slack');

    const session = buildGovernedExternalAuthSession(
      {
        protocol: 'https',
        get: makeHostGetter('consultify.test'),
      },
      {
        integrationId: 'int-3',
        organizationId: ORG_ID,
        connectorId: 'slack',
        mode: 'connect',
        config: { workspace_id: 'workspace-123' },
      }
    );

    expect(session.authUrl).toContain('https://slack.com/oauth/v2/authorize?');
    expect(session.authUrl).toContain('client_id=slack-client-id');
    expect(session.authUrl).toContain('channels%3Aread%2Cusers%3Aread%2Cchat%3Awrite');
  });

  it('materializes Slack governed callback auth truth and stores refresh material when slack is approved', async () => {
    approveOnly('slack');
    mockStoreRefreshExecutionSecret.mockResolvedValueOnce({
      connectorId: 'slack',
      organizationId: ORG_ID,
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
        organizationId: ORG_ID,
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
      organizationId: ORG_ID,
      providerAccountId: 'U123',
      workspaceOrTenantId: 'T123',
      scopesGranted: ['channels:read', 'users:read', 'chat:write'],
      tokenExpiresAt: expect.any(String),
    });
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'slack',
      organizationId: ORG_ID,
      clientId: 'slack-client-id',
      clientSecret: 'slack-client-secret',
      refreshToken: 'slack-refresh-1',
      tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    });
  });

  it('marks slack as eligible for callback-driven materialization', () => {
    expect(shouldMaterializeCallbackDrivenAuth('slack')).toBe(true);
  });

  // ---------------------------------------------------------------------
  // UNAPPROVED PATH — this is the actual regression coverage for the
  // fail-open defect. For each connector and each way a registry entry can
  // fail to grant approval (absent entirely / approved:false / scope
  // mismatch / empty residency), both entry points must fail BEFORE any
  // side effect. The boundaries asserted at 0 calls are exactly the ones
  // the product code's own doc comment names as what the guard must
  // precede: `mockIssueSyncExternalAuthSession` (session/state row write +
  // authUrl construction, in buildGovernedExternalAuthSession), and
  // `fetch` / `mockStoreCredential` / `mockStoreRefreshExecutionSecret`
  // (token exchange and credential/refresh-secret storage, in
  // materializeGovernedExternalAuthCallback). A rejected promise alone
  // would not prove a URL was never built or a row never written — a
  // buggy guard could construct the URL or write the row and only then
  // throw — so each boundary's own call count is asserted directly rather
  // than inferred from the thrown error.
  // ---------------------------------------------------------------------

  for (const connectorId of CONNECTOR_IDS) {
    const requiredScopes = REQUIRED_SCOPES[connectorId];
    const config = CONNECTOR_CONFIGS[connectorId];

    const denialVariants: Array<{ label: string; registry: Record<string, unknown> | null }> = [
      {
        label: 'no approval registry is set at all',
        registry: null,
      },
      {
        label: 'the registry entry is present but approved is false',
        registry: {
          [connectorId]: { approved: false, scopes: [...requiredScopes], residency: 'eu' },
        },
      },
      {
        label: 'the registry entry is approved but its scopes do not exactly match the required scopes',
        registry: {
          [connectorId]: {
            approved: true,
            scopes: [...requiredScopes, 'unexpected-extra-scope'],
            residency: 'eu',
          },
        },
      },
      {
        label: 'the registry entry is approved with the correct scopes but an empty residency',
        registry: {
          [connectorId]: { approved: true, scopes: [...requiredScopes], residency: '' },
        },
      },
    ];

    for (const variant of denialVariants) {
      it(`denies governed external auth for ${connectorId} when ${variant.label}`, async () => {
        setRegistry(variant.registry);

        expect(() =>
          buildGovernedExternalAuthSession(
            {
              protocol: 'https',
              get: makeHostGetter('consultify.test'),
            },
            {
              integrationId: `int-${connectorId}-guard`,
              organizationId: ORG_ID,
              connectorId,
              mode: 'connect',
              config,
            }
          )
        ).toThrow(`Governed external auth provider is not approved: ${connectorId}`);

        // Before any URL/session-state row is constructed.
        expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();

        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(
          materializeGovernedExternalAuthCallback({
            req: {
              protocol: 'https',
              get: makeHostGetter('consultify.test'),
            },
            session: {
              state: 'state-1',
              connectorId,
              organizationId: ORG_ID,
            },
            config,
            code: `${connectorId}-code-guard`,
          })
        ).rejects.toThrow(`Governed external auth provider is not approved: ${connectorId}`);

        // Before any token fetch and before any credential/session storage.
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockStoreCredential).not.toHaveBeenCalled();
        expect(mockStoreRefreshExecutionSecret).not.toHaveBeenCalled();
      });
    }
  }
});
