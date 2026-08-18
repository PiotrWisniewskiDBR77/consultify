import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const savedEnv = { ...process.env };

// ── Mocks for the pmSync governed external-auth flow (SET-MVP-OAUTH-001) ──
// pmSyncExternalAuthMaterializationService.ts's only non-pure side effects are
// (a) issuing/writing an in-memory external-auth session/state entry and
// (b) storing credentials/refresh secrets (which hit the DB). Both are
// mocked so the "zero side-effect on denial" assertions below need no
// database, and so a positive (approved) build test doesn't require a real
// session store.
const mockIssueSyncExternalAuthSession = vi.fn();
const mockStoreCredential = vi.fn();
const mockStoreRefreshExecutionSecret = vi.fn();

vi.mock('../../../server/src/services/syncExternalAuthSessionService.js', () => ({
  issueSyncExternalAuthSession: (...args: unknown[]) => mockIssueSyncExternalAuthSession(...args),
}));

vi.mock('../../../server/src/services/v8/pmSyncAuthService.js', () => ({
  storeCredential: (...args: unknown[]) => mockStoreCredential(...args),
}));

vi.mock('../../../server/src/services/v8/pmSyncRefreshExecutionService.js', () => ({
  storeRefreshExecutionSecret: (...args: unknown[]) => mockStoreRefreshExecutionSecret(...args),
}));

function makeHostGetter(host: string) {
  function get(name: 'set-cookie'): string[] | undefined;
  function get(name: string): string | undefined;
  function get(name: string): string[] | string | undefined {
    return name === 'host' ? host : undefined;
  }
  return get;
}

describe('OAuth approved-provider registry', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.GOOGLE_CLIENT_ID = 'configured-google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'configured-google-secret';
    process.env.LINKEDIN_CLIENT_ID = 'configured-linkedin-client';
    process.env.LINKEDIN_CLIENT_SECRET = 'configured-linkedin-secret';
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('keeps every provider disabled when no approval decision exists, despite credentials', async () => {
    const { oauthService } = await import('../../../server/src/services/oauthService.ts');

    expect(oauthService.getProviderStatus()).toEqual({
      google: { configured: false, approved: false, loginUrl: '' },
      microsoft: { configured: false, approved: false, loginUrl: '' },
      linkedin: { configured: false, approved: false, loginUrl: '' },
    });
    expect(oauthService.generateAuthUrl('google')).toBeNull();
    expect(oauthService.generateAuthUrl('linkedin')).toBeNull();
  });

  it('rejects malformed, partial, over-broad, or residency-free decisions', async () => {
    const { getApprovedOAuthProviderDecision } =
      await import('../../../server/src/services/oauthService.ts');

    for (const decision of [
      '{not-json',
      JSON.stringify({ google: { approved: true, scopes: ['openid', 'email', 'profile'] } }),
      JSON.stringify({
        google: {
          approved: true,
          scopes: ['openid', 'email', 'profile', 'drive.readonly'],
          residency: 'EU',
        },
      }),
    ]) {
      process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = decision;
      expect(getApprovedOAuthProviderDecision('google')).toBeNull();
    }
  });

  it('enables only the exactly approved provider and publishes no secret material', async () => {
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      google: {
        approved: true,
        scopes: ['openid', 'email', 'profile'],
        residency: 'EU',
      },
    });
    const { oauthService } = await import('../../../server/src/services/oauthService.ts');

    const status = oauthService.getProviderStatus();
    expect(status.google).toEqual({
      configured: true,
      approved: true,
      loginUrl: '/api/auth/google',
      residency: 'EU',
    });
    expect(status.linkedin).toEqual({ configured: false, approved: false, loginUrl: '' });
    expect(JSON.stringify(status)).not.toContain('configured-google-secret');
    expect(oauthService.generateAuthUrl('google')?.url).toContain('scope=openid+email+profile');
    expect(oauthService.generateAuthUrl('linkedin')).toBeNull();
  });
});

/**
 * SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: pmSync's governed
 * external-auth session/callback builder (jira, gmail, asana, teams, slack)
 * must fail closed on the same `OAUTH_APPROVED_PROVIDER_REGISTRY` unless the
 * connector is explicitly approved. Its own vocabulary is
 * {'jira','gmail','asana','teams','slack'} (normalized: trim + lowercase) —
 * DIFFERENT from oauthService's own login-OAuth vocabulary
 * ({'google','linkedin'}) tested above. An approval for 'google' must NOT
 * leak into pmSync's 'gmail' key, and vice versa.
 */
describe('pmSync governed external-auth registry guard', () => {
  const DEFAULT_JIRA_SCOPES = ['offline_access', 'read:jira-work'];
  const DEFAULT_GMAIL_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];
  const DEFAULT_ASANA_SCOPES = ['default'];
  const DEFAULT_TEAMS_SCOPES = ['offline_access', 'openid', 'profile', 'email', 'User.Read'];
  const DEFAULT_SLACK_SCOPES = ['channels:read', 'users:read', 'chat:write'];

  const REQUEST_STUB = {
    protocol: 'https',
    get: makeHostGetter('consultify.test'),
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.NODE_ENV = 'test';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.ASANA_CLIENT_ID = 'asana-client-id';
    process.env.ASANA_CLIENT_SECRET = 'asana-client-secret';
    process.env.MICROSOFT_CLIENT_ID = 'microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'microsoft-client-secret';
    process.env.SLACK_CLIENT_ID = 'slack-client-id';
    process.env.SLACK_CLIENT_SECRET = 'slack-client-secret';
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
    mockIssueSyncExternalAuthSession.mockReturnValue({
      state: 'state-1',
      expiresAt: Date.parse('2026-03-27T20:10:00.000Z'),
    });
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  async function loadService() {
    return import(
      '../../../server/src/services/v8/pmSyncExternalAuthMaterializationService.ts'
    );
  }

  function approve(registryKey: string, scopes: string[], residency = 'EU') {
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      [registryKey]: { approved: true, scopes, residency },
    });
  }

  it('fails closed when the registry env var is unset', async () => {
    const { buildGovernedExternalAuthSession } = await loadService();
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();
    expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();
  });

  it('fails closed when the provider is absent from an otherwise-populated registry', async () => {
    approve('jira', DEFAULT_JIRA_SCOPES);
    const { buildGovernedExternalAuthSession } = await loadService();
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();
    expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();
  });

  it('fails closed when the decision is explicitly approved:false', async () => {
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      gmail: { approved: false, scopes: DEFAULT_GMAIL_SCOPES, residency: 'EU' },
    });
    const { buildGovernedExternalAuthSession } = await loadService();
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();
    expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();
  });

  it('fails closed on scope mismatch (missing a required scope)', async () => {
    approve('gmail', DEFAULT_GMAIL_SCOPES.slice(0, -1)); // drop gmail.readonly
    const { buildGovernedExternalAuthSession } = await loadService();
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();
    expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();
  });

  it('fails closed on scope mismatch (extra, over-broad scope)', async () => {
    approve('gmail', [...DEFAULT_GMAIL_SCOPES, 'https://www.googleapis.com/auth/drive.readonly']);
    const { buildGovernedExternalAuthSession } = await loadService();
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();
    expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();
  });

  it('fails closed on empty or missing residency', async () => {
    const { buildGovernedExternalAuthSession } = await loadService();

    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      gmail: { approved: true, scopes: DEFAULT_GMAIL_SCOPES, residency: '' },
    });
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();

    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      gmail: { approved: true, scopes: DEFAULT_GMAIL_SCOPES },
    });
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();
    expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown/unmappable provider key, even when THAT key is approved', async () => {
    const { buildGovernedExternalAuthSession } = await loadService();

    // 'google' is oauthService's own vocabulary for the same Google OAuth
    // infra — approving it must not leak into pmSync's 'gmail' connector.
    approve('google', ['openid', 'email', 'profile']);
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: 'gmail',
        mode: 'connect',
        config: {},
      })
    ).toThrow();

    // A plausible alternate spelling for jira/teams must not silently pass.
    approve('atlassian', DEFAULT_JIRA_SCOPES);
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-2',
        organizationId: 'org-1',
        connectorId: 'jira',
        mode: 'connect',
        config: { site_url: 'https://acme.atlassian.net', cloud_id: 'cloud-1', client_id: 'c', client_secret: 's' },
      })
    ).toThrow();

    approve('microsoft', DEFAULT_TEAMS_SCOPES);
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-3',
        organizationId: 'org-1',
        connectorId: 'teams',
        mode: 'connect',
        config: { tenant_id: 'tenant-1' },
      })
    ).toThrow();

    // An entirely unrecognized connector id must also be denied, not passed
    // through — even when nothing in the registry references it at all.
    expect(() =>
      buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-4',
        organizationId: 'org-1',
        connectorId: 'notion',
        mode: 'connect',
        config: {},
      })
    ).toThrow();

    expect(mockIssueSyncExternalAuthSession).not.toHaveBeenCalled();
  });

  it('resolves connector-id casing/whitespace variants to the same lowercase registry key', async () => {
    approve('gmail', DEFAULT_GMAIL_SCOPES);
    const { buildGovernedExternalAuthSession } = await loadService();

    for (const connectorId of ['gmail', 'Gmail', 'GMAIL', '  gmail  ']) {
      const session = buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId,
        mode: 'connect',
        config: {},
      });
      expect(session.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    }
  });

  it('approves and builds a real authorize URL for every one of pmSync own connector keys', async () => {
    const cases: Array<{
      connectorId: string;
      scopes: string[];
      config: Record<string, unknown>;
      expectedUrlPrefix: string;
    }> = [
      {
        connectorId: 'jira',
        scopes: DEFAULT_JIRA_SCOPES,
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
        expectedUrlPrefix: 'https://auth.atlassian.com/authorize?',
      },
      {
        connectorId: 'gmail',
        scopes: DEFAULT_GMAIL_SCOPES,
        config: {},
        expectedUrlPrefix: 'https://accounts.google.com/o/oauth2/v2/auth?',
      },
      {
        connectorId: 'asana',
        scopes: DEFAULT_ASANA_SCOPES,
        config: {},
        expectedUrlPrefix: 'https://app.asana.com/-/oauth_authorize?',
      },
      {
        connectorId: 'teams',
        scopes: DEFAULT_TEAMS_SCOPES,
        config: { tenant_id: 'tenant-123' },
        expectedUrlPrefix: 'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize?',
      },
      {
        connectorId: 'slack',
        scopes: DEFAULT_SLACK_SCOPES,
        config: { workspace_id: 'workspace-123' },
        expectedUrlPrefix: 'https://slack.com/oauth/v2/authorize?',
      },
    ];

    for (const testCase of cases) {
      approve(testCase.connectorId, testCase.scopes);
      const { buildGovernedExternalAuthSession } = await loadService();
      const session = buildGovernedExternalAuthSession(REQUEST_STUB, {
        integrationId: 'int-1',
        organizationId: 'org-1',
        connectorId: testCase.connectorId,
        mode: 'connect',
        config: testCase.config,
      });
      expect(session.authUrl.startsWith(testCase.expectedUrlPrefix)).toBe(true);
      expect(mockIssueSyncExternalAuthSession).toHaveBeenCalled();
      mockIssueSyncExternalAuthSession.mockClear();
    }
  });

  it('fails closed in the callback-materialization path BEFORE any token exchange or credential write', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { materializeGovernedExternalAuthCallback } = await loadService();

    await expect(
      materializeGovernedExternalAuthCallback({
        req: REQUEST_STUB,
        session: {
          state: 'state-1',
          connectorId: 'gmail',
          organizationId: 'org-1',
        },
        config: { domain: 'acme.com' },
        code: 'some-code',
      })
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockStoreCredential).not.toHaveBeenCalled();
    expect(mockStoreRefreshExecutionSecret).not.toHaveBeenCalled();
  });

  it('still materializes a real callback for an approved provider (regression guard)', async () => {
    approve('gmail', DEFAULT_GMAIL_SCOPES);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'google-access-1',
          refresh_token: 'google-refresh-1',
          expires_in: 3600,
          scope: DEFAULT_GMAIL_SCOPES.join(' '),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'google-user-1', email: 'alice@acme.com', hd: 'acme.com' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    mockStoreCredential.mockResolvedValue({ credentialId: 'cred-1' });
    mockStoreRefreshExecutionSecret.mockResolvedValue({});

    const { materializeGovernedExternalAuthCallback } = await loadService();
    const result = await materializeGovernedExternalAuthCallback({
      req: REQUEST_STUB,
      session: { state: 'state-1', connectorId: 'gmail', organizationId: 'org-1' },
      config: { domain: 'acme.com' },
      code: 'google-code-1',
    });

    expect(result.credentialStored).toBe(true);
    expect(mockStoreCredential).toHaveBeenCalled();
  });
});
