/**
 * @vitest-environment node
 *
 * HISTORY (SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002):
 *
 * This suite previously ran with zero references to
 * `OAUTH_APPROVED_PROVIDER_REGISTRY` and zero mocks of the pmSync governed
 * external-auth service (`pmSyncExternalAuthMaterializationService.ts`), so
 * every test exercised the REAL `buildGovernedExternalAuthSession` code path
 * with no registry approval configured. The suite was fully green under
 * that condition. Six of those green tests were, at the time, asserting
 * that calling POST /integrations/:integrationId/configure or
 * POST /integrations/:integrationId/reauth for an UNAPPROVED connector
 * (gmail, asana, teams, slack, jira) produced a real, usable provider
 * consent URL (a live authUrl pointed at the real Google/Asana/Microsoft/
 * Slack/Atlassian authorize endpoint) and transitioned connector auth state
 * to 'connecting' — with no approval registry consulted at all. That green
 * was certifying the fail-open defect: external OAuth is excluded from MVP,
 * so an unapproved connector must never reach a live consent URL. The green
 * was the bug, not a regression.
 *
 * Once the service-layer guard (`requireApprovedGovernedConnector` inside
 * `pmSyncExternalAuthMaterializationService.ts`) and the route-layer
 * reordering/membership wall in `sync.routes.ts` were put in place, those
 * six tests failed (6 failed / 33 passed) because they no longer seeded an
 * approved registry entry. They have been INVERTED here, honestly: each now
 * seeds `OAUTH_APPROVED_PROVIDER_REGISTRY` with that connector's exact
 * pmSync registry key and exact required scopes before asserting the
 * previously-implicit positive path, and negative-path siblings were added
 * asserting denial (with zero writes) when the registry is absent,
 * disapproved, scope-mismatched, or residency-empty. The six inverted
 * tests (identified by their original names, unchanged) are:
 *
 *   1. "prepares a real Gmail provider auth URL"
 *   2. "prepares a real Asana provider auth URL"
 *   3. "prepares a real Teams provider auth URL"
 *   4. "prepares a real Slack provider auth URL"
 *   5. "saves pending setup fields on the governed seam" (jira / configure)
 *   6. "starts a governed reauth flow" (jira / reauth)
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_SYNC_RUNTIME_MUTATION_CONTRACT,
  V8_SYNC_RUNTIME_READ_CONTRACT,
} from '../sync.routes.js';

/**
 * Copied verbatim from
 * `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`
 * (`GOVERNED_CONNECTOR_REQUIRED_SCOPES` / `DEFAULT_*_SCOPES`, lines 32,
 * 41-47, 51, 57) — this is the scope set `requireApprovedGovernedConnector`
 * actually checks the registry against for the pmSync governed sync flow.
 * Deliberately NOT sourced from `integrationOAuthEngine.ts`'s
 * `CONNECTOR_OAUTH_CONFIGS` scope table: that module keys the SAME
 * connector ids (jira/gmail/teams/slack/asana) to a DIFFERENT, broader
 * scope list for a different OAuth surface (login/generic connect), so
 * approving against it would approve a scope set pmSync never actually
 * requests — false governance, not real governance.
 */
const DEFAULT_JIRA_SCOPES = ['offline_access', 'read:jira-work'];
const DEFAULT_ASANA_SCOPES = ['default'];
const DEFAULT_GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const DEFAULT_SLACK_SCOPES = ['channels:read', 'users:read', 'chat:write'];
const DEFAULT_TEAMS_SCOPES = ['offline_access', 'openid', 'profile', 'email', 'User.Read'];

/**
 * Builds a value for `process.env.OAUTH_APPROVED_PROVIDER_REGISTRY`
 * matching the shape `getRegistryApprovalDecision` (server/src/services/
 * oauthService.ts) parses: `{ [registryKey]: { approved, scopes, residency } }`.
 * The pmSync governed flow keys the registry with its own normalized
 * connector id ('jira' | 'gmail' | 'asana' | 'teams' | 'slack'), which is
 * exactly the connector id used below.
 */
function buildApprovedRegistry(
  entries: Record<
    string,
    { approved?: boolean; scopes: readonly string[]; residency?: string }
  >
): string {
  const registry: Record<string, unknown> = {};
  for (const [connectorId, entry] of Object.entries(entries)) {
    registry[connectorId] = {
      approved: entry.approved ?? true,
      scopes: [...entry.scopes],
      residency: entry.residency ?? 'EU',
    };
  }
  return JSON.stringify(registry);
}

const mockGetCredentialHealth = vi.fn();
const mockGetActiveEscalations = vi.fn();
const mockResolveAuthEscalation = vi.fn();
const mockGetRefreshTimingPolicy = vi.fn();
const mockSetRefreshTimingPolicy = vi.fn();
const mockGetCredential = vi.fn();
const mockRecordAuthEscalation = vi.fn();
const mockRecordRefreshResult = vi.fn();
const mockResolveAuthEscalationsForConnector = vi.fn();
const mockStoreCredential = vi.fn();
const mockGetConnectorHealth = vi.fn();
const mockGetIntegrationHealth = vi.fn();
const mockGetUnresolvedErrors = vi.fn();
const mockResolveError = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockRecordRequest = vi.fn();
const mockLogSyncError = vi.fn();
const mockSetConnectorAuthState = vi.fn();
const mockGetUnresolvedConflicts = vi.fn();
const mockListGovernedIntegrations = vi.fn();
const mockResolveConflict = vi.fn();
const mockGetConnectedIntegrations = vi.fn();
const mockSyncIntegration = vi.fn();
const mockUpdateIntegrationStatus = vi.fn();
const mockDisconnectIntegration = vi.fn();
const mockStoreRefreshExecutionSecret = vi.fn();
const mockExecuteRefreshExecution = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../../services/v8/pmSyncAuthService.js', () => ({
  getCredentialHealth: (...args: unknown[]) => mockGetCredentialHealth(...args),
  getActiveEscalations: (...args: unknown[]) => mockGetActiveEscalations(...args),
  resolveAuthEscalation: (...args: unknown[]) => mockResolveAuthEscalation(...args),
  getRefreshTimingPolicy: (...args: unknown[]) => mockGetRefreshTimingPolicy(...args),
  setRefreshTimingPolicy: (...args: unknown[]) => mockSetRefreshTimingPolicy(...args),
  getCredential: (...args: unknown[]) => mockGetCredential(...args),
  recordAuthEscalation: (...args: unknown[]) => mockRecordAuthEscalation(...args),
  recordRefreshResult: (...args: unknown[]) => mockRecordRefreshResult(...args),
  resolveAuthEscalationsForConnector: (...args: unknown[]) =>
    mockResolveAuthEscalationsForConnector(...args),
  storeCredential: (...args: unknown[]) => mockStoreCredential(...args),
}));

vi.mock('../../../services/v8/pmSyncTruthService.js', () => ({
  getConnectorHealth: (...args: unknown[]) => mockGetConnectorHealth(...args),
  setConnectorAuthState: (...args: unknown[]) => mockSetConnectorAuthState(...args),
  getUnresolvedConflicts: (...args: unknown[]) => mockGetUnresolvedConflicts(...args),
  resolveConflict: (...args: unknown[]) => mockResolveConflict(...args),
}));

vi.mock('../../../services/syncGuardrailsService.js', async () => {
  const actual = await vi.importActual<any>('../../../services/syncGuardrailsService.js');
  return {
    ...actual,
    getIntegrationHealth: (...args: unknown[]) => mockGetIntegrationHealth(...args),
    getUnresolvedErrors: (...args: unknown[]) => mockGetUnresolvedErrors(...args),
    resolveError: (...args: unknown[]) => mockResolveError(...args),
    checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
    recordRequest: (...args: unknown[]) => mockRecordRequest(...args),
    logSyncError: (...args: unknown[]) => mockLogSyncError(...args),
  };
});

vi.mock('../../../services/v8/pmSyncInventoryService.js', () => ({
  listGovernedIntegrations: (...args: unknown[]) => mockListGovernedIntegrations(...args),
}));

vi.mock('../../../services/v8/pmSyncRefreshExecutionService.js', () => ({
  storeRefreshExecutionSecret: (...args: unknown[]) => mockStoreRefreshExecutionSecret(...args),
  executeRefreshExecution: (...args: unknown[]) => mockExecuteRefreshExecution(...args),
}));

vi.mock('../../../services/integrationHubService.js', async () => {
  const actual = await vi.importActual<any>('../../../services/integrationHubService.js');
  return {
    ...actual,
    getConnectedIntegrations: (...args: unknown[]) => mockGetConnectedIntegrations(...args),
    disconnectIntegration: (...args: unknown[]) => mockDisconnectIntegration(...args),
    syncIntegration: (...args: unknown[]) => mockSyncIntegration(...args),
    updateIntegrationStatus: (...args: unknown[]) => mockUpdateIntegrationStatus(...args),
  };
});

vi.mock('../../../utils/DbPromise.js', async () => {
  const actual = await vi.importActual<any>('../../../utils/DbPromise.js');
  return {
    ...actual,
    all: (...args: unknown[]) => mockDbAll(...args),
    run: (...args: unknown[]) => mockDbRun(...args),
    // `get` backs `requireActiveAuditsMembership` (the membership wall on
    // configure/reauth) — it reads `organization_members` directly via
    // DbPromise.get, bypassing the `all`/`run` mocks above.
    get: (...args: unknown[]) => mockDbGet(...args),
  };
});

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../config/Config.js', async () => {
  const actual = await vi.importActual<any>('../../../config/Config.js');
  return {
    default: {
      ...actual.default,
      GOOGLE_CLIENT_ID: actual.default.GOOGLE_CLIENT_ID || 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: actual.default.GOOGLE_CLIENT_SECRET || 'test-google-client-secret',
      ASANA_CLIENT_ID: actual.default.ASANA_CLIENT_ID || 'test-asana-client-id',
      ASANA_CLIENT_SECRET: actual.default.ASANA_CLIENT_SECRET || 'test-asana-client-secret',
      MICROSOFT_CLIENT_ID: actual.default.MICROSOFT_CLIENT_ID || 'test-microsoft-client-id',
      MICROSOFT_CLIENT_SECRET:
        actual.default.MICROSOFT_CLIENT_SECRET || 'test-microsoft-client-secret',
      SLACK_CLIENT_ID: actual.default.SLACK_CLIENT_ID || 'test-slack-client-id',
      SLACK_CLIENT_SECRET: actual.default.SLACK_CLIENT_SECRET || 'test-slack-client-secret',
    },
  };
});

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const UID = 'user-sync-v8';
const CONNECTOR = 'conn-jira-1';

// Captured once so every test — including ones that never touch the
// registry — restores the exact starting value (including "was never set
// at all") rather than leaking an approval into a sibling test. This is the
// "undefined case" from the capture/restore requirement: `ORIGINAL_REGISTRY_ENV`
// is `undefined` whenever the process never had the var set, and `afterEach`
// deletes the key rather than writing the string "undefined".
const ORIGINAL_REGISTRY_ENV = process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;

describe('V8 sync read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    // Default: no registry approved. Tests that need an approved connector
    // opt in explicitly via `buildApprovedRegistry`; this keeps the default
    // posture fail-closed, matching production (SET-MVP-OAUTH-001).
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
    // Default: an ACTIVE same-tenant membership, so tests that are not
    // specifically exercising the membership wall (added to configure/reauth
    // by AMD-SET-OAUTH-APPROVED-OUT-002's ordering fix) are unaffected by it.
    mockDbGet.mockResolvedValue({ status: 'ACTIVE' });
    mockGetCredential.mockResolvedValue(null);
    mockRecordAuthEscalation.mockResolvedValue({
      escalationId: 'esc-auth-1',
      organizationId: ORG,
      connectorId: 'jira',
      reason: 'credential_expired',
      escalatedAt: '2026-03-27T19:00:00.000Z',
      resolvedAt: null,
      resolvedBy: null,
    });
    mockResolveAuthEscalationsForConnector.mockResolvedValue([]);
    mockRecordRefreshResult.mockResolvedValue(null);
    mockGetCredentialHealth.mockResolvedValue({
      total: 2,
      healthy: 1,
      failing: 1,
      escalated: 0,
    });
    mockGetActiveEscalations.mockResolvedValue([]);
    mockResolveAuthEscalation.mockResolvedValue({
      escalationId: 'esc-1',
      organizationId: ORG,
      connectorId: CONNECTOR,
      reason: 'token expired',
      escalatedAt: '2025-01-02T00:00:00.000Z',
      resolvedAt: '2025-01-03T00:00:00.000Z',
      resolvedBy: UID,
    });
    mockGetRefreshTimingPolicy.mockResolvedValue({
      policyId: 'policy-1',
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
    });
    mockSetRefreshTimingPolicy.mockResolvedValue({
      policyId: 'policy-1',
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
    });
    mockStoreRefreshExecutionSecret.mockResolvedValue({
      connectorId: 'jira',
      organizationId: ORG,
      clientId: 'client-1',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    });
    mockExecuteRefreshExecution.mockResolvedValue({
      status: 'missing_secret',
      reason: 'Governed refresh secret has not been materialized for this connector yet.',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'synced',
      conflictCount: 0,
      lastSyncAt: '2025-01-01T00:00:00.000Z',
      authState: 'healthy',
    });
    mockSetConnectorAuthState.mockResolvedValue({
      recordId: 'record-1',
      connectorId: 'jira',
      organizationId: ORG,
      authState: 'healthy',
      previousState: null,
      transitionedAt: '2025-01-03T00:00:00.000Z',
      transitionedBy: UID,
      reason: null,
    });
    mockGetUnresolvedConflicts.mockResolvedValue([]);
    mockGetIntegrationHealth.mockResolvedValue({ status: 'healthy', errorRate: 0 });
    mockResolveError.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      warnings: [],
      reason: null,
      retryAfterMs: null,
    });
    mockRecordRequest.mockResolvedValue(undefined);
    mockLogSyncError.mockResolvedValue(undefined);
    mockListGovernedIntegrations.mockResolvedValue([]);
    mockResolveConflict.mockResolvedValue({
      conflictId: 'conf-1',
      objectSyncStateId: 'sync-state-1',
      organizationId: ORG,
      conflictClass: 'field_authority_conflict',
      severity: 'degraded',
      resolutionPath: 'dismiss',
      resolutionStrategy: 'dismiss',
      resolvedAt: '2025-01-03T00:00:00.000Z',
      resolvedBy: UID,
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    mockGetConnectedIntegrations.mockResolvedValue([]);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockSyncIntegration.mockResolvedValue({ recordsSynced: 12, duration: 345 });
    mockUpdateIntegrationStatus.mockResolvedValue({ success: true });
    mockDisconnectIntegration.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    // Leaked approval state between tests is a false-green vector: restore
    // exactly what was there before this file's tests ran, including the
    // "was never set" (undefined) case.
    if (ORIGINAL_REGISTRY_ENV === undefined) {
      delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
    } else {
      process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = ORIGINAL_REGISTRY_ENV;
    }
  });

  it('GET /api/v8/sync/integrations returns governed inventory envelope', async () => {
    mockListGovernedIntegrations.mockResolvedValue([
      {
        id: 'int-1',
        connectorId: 'jira',
        name: 'Jira',
        category: 'project_management',
        status: 'connected',
        lastSyncAt: '2025-01-02T00:00:00.000Z',
        lastError: null,
        health: 'healthy',
        errorRate: 0,
        unresolvedErrors: 0,
        lastRun: null,
        connector: {
          id: 'jira',
          name: 'Jira',
          category: 'project_management',
          capabilities: ['issues'],
          authType: 'oauth2',
        },
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/integrations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.integrations?.[0]?.connectorId).toBe('jira');
    expect(mockListGovernedIntegrations).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/sync/auth/health returns credential rollup', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/auth/health');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.summary).toEqual({
      total: 2,
      healthy: 1,
      failing: 1,
      escalated: 0,
    });
    expect(mockGetCredentialHealth).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/sync/connectors returns governed catalog envelope', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/sync/connectors')
      .query({ category: 'project_management' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBeGreaterThan(0);
    expect(res.body.data?.connectors?.[0]?.category).toBe('project_management');
    expect(res.body.data?.connectors?.[0]?.configFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
  });

  it('POST /api/v8/sync/connectors/:connectorId/connect creates a governed pending integration', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/connectors/jira/connect').send({});

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.integration?.connectorId).toBe('jira');
    expect(res.body.data?.integration?.status).toBe('pending');
    expect(res.body.data?.onboardingStatus).toBe('pending_external_auth_or_configuration');
    expect(res.body.data?.integration?.configFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integrations'),
      expect.arrayContaining([ORG, 'jira', 'Jira', 'project_management', 'pending', 'oauth2'])
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.arrayContaining([ORG, expect.any(String), 'connect_initiated', UID, UID])
    );
  });

  // -------------------------------------------------------------------
  // `connected_by` audit-identity binding on the `integrations` INSERT
  // (POST /connectors/:connectorId/connect — the only route in this file
  // that runs a literal `INSERT INTO integrations`). The column is
  // `TEXT NOT NULL` with no default (server/migrations/256_integrations_
  // system.sql); it must always be the verified actor id from the token
  // (`req.user.id` / `req.userId`), never a value supplied by the caller.
  // -------------------------------------------------------------------

  it('POST /api/v8/sync/connectors/:connectorId/connect binds connected_by to the authenticated actor id on the integrations INSERT', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/connectors/jira/connect').send({});

    expect(res.status).toBe(201);

    const insertCall = mockDbRun.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO integrations')
    );
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall as [string, unknown[]];
    expect(sql).toContain('connected_by');

    // The column list and the value list must line up positionally: find
    // where `connected_by` sits among the declared columns and assert the
    // bound parameter at that same index is the authenticated actor id.
    const columnListMatch = sql.match(/INSERT INTO integrations \(([\s\S]*?)\)\s*VALUES/);
    expect(columnListMatch).not.toBeNull();
    const columns = (columnListMatch as RegExpMatchArray)[1]
      .split(',')
      .map((column) => column.trim());
    const connectedByIndex = columns.indexOf('connected_by');
    expect(connectedByIndex).toBeGreaterThanOrEqual(0);
    // Trailing columns bound to literal CURRENT_TIMESTAMP (not `?`) are not
    // present in `params`, so only columns up to and including connected_by
    // need to map 1:1 into the params array.
    expect(params[connectedByIndex]).toBe(UID);
  });

  it('POST /api/v8/sync/connectors/:connectorId/connect ignores a spoofed connected_by/actorId/userId in the request body', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/connectors/jira/connect')
      .send({
        connected_by: 'attacker-connected-by',
        connectedBy: 'attacker-connectedBy',
        actorId: 'attacker-actor-id',
        userId: 'attacker-user-id',
      });

    expect(res.status).toBe(201);

    const insertCall = mockDbRun.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO integrations')
    );
    expect(insertCall).toBeDefined();
    const [, params] = insertCall as [string, unknown[]];

    // No spoofed value from the body reached the INSERT's bound params at all.
    expect(params).not.toContain('attacker-connected-by');
    expect(params).not.toContain('attacker-connectedBy');
    expect(params).not.toContain('attacker-actor-id');
    expect(params).not.toContain('attacker-user-id');
    // The authenticated actor id is what actually landed in the params.
    expect(params).toContain(UID);
  });

  it('POST /api/v8/sync/connectors/:connectorId/connect fails closed with zero writes when there is no authenticated actor', async () => {
    mockUser = null;

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/connectors/jira/connect').send({});

    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
    expect(res.status).toBe(401);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure saves pending setup fields on the governed seam', async () => {
    // INVERTED (see file-header HISTORY): this test used to pass with no
    // registry approval configured at all. It now seeds an explicit
    // approval for 'jira' with the connector's exact required scopes before
    // asserting the positive (approved) path.
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = buildApprovedRegistry({
      jira: { scopes: DEFAULT_JIRA_SCOPES },
    });
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-pending-1',
        connector_id: 'jira',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-pending-1/configure')
      .send({
        config: {
          site_url: 'https://example.atlassian.net',
          cloud_id: 'cloud-123',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.integration?.configuredFields).toEqual([
      'site_url',
      'cloud_id',
      'client_id',
      'client_secret',
    ]);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain('https://auth.atlassian.com/authorize?');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state='
    );
    expect(res.body.data?.externalAuth?.state).toBeTruthy();
    expect(mockDbRun).toHaveBeenCalledWith(expect.stringContaining('UPDATE integrations'), [
      '{"site_url":"https://example.atlassian.net","cloud_id":"cloud-123","client_id":"jira-client-id","client_secret":"jira-client-secret"}',
      'int-pending-1',
      ORG,
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.arrayContaining([ORG, 'int-pending-1', 'configuration_updated', UID, UID])
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure prepares a real Gmail provider auth URL', async () => {
    // INVERTED (see file-header HISTORY).
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = buildApprovedRegistry({
      gmail: { scopes: DEFAULT_GMAIL_SCOPES },
    });
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-gmail-1',
        connector_id: 'gmail',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-gmail-1/configure')
      .send({
        config: {
          domain: 'acme.com',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.integration?.configuredFields).toEqual(['domain']);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain(
      'https://accounts.google.com/o/oauth2/v2/auth?'
    );
    expect(res.body.data?.externalAuth?.authUrl).toContain('access_type=offline');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state='
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'gmail',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure prepares a real Asana provider auth URL', async () => {
    // INVERTED (see file-header HISTORY).
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = buildApprovedRegistry({
      asana: { scopes: DEFAULT_ASANA_SCOPES },
    });
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-asana-1',
        connector_id: 'asana',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-asana-1/configure')
      .send({
        config: {
          workspace_gid: 'workspace-123',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.integration?.configuredFields).toEqual(['workspace_gid']);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain(
      'https://app.asana.com/-/oauth_authorize?'
    );
    expect(res.body.data?.externalAuth?.authUrl).toContain('client_id=test-asana-client-id');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state='
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'asana',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure prepares a real Teams provider auth URL', async () => {
    // INVERTED (see file-header HISTORY).
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = buildApprovedRegistry({
      teams: { scopes: DEFAULT_TEAMS_SCOPES },
    });
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-teams-1',
        connector_id: 'teams',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-teams-1/configure')
      .send({
        config: {
          tenant_id: 'tenant-123',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.integration?.configuredFields).toEqual(['tenant_id']);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain(
      'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize?'
    );
    expect(res.body.data?.externalAuth?.authUrl).toContain('response_mode=query');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state='
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'teams',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/configure prepares a real Slack provider auth URL', async () => {
    // INVERTED (see file-header HISTORY).
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = buildApprovedRegistry({
      slack: { scopes: DEFAULT_SLACK_SCOPES },
    });
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-slack-1',
        connector_id: 'slack',
        config: '{}',
        status: 'pending',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-slack-1/configure')
      .send({
        config: {
          workspace_id: 'workspace-123',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.integration?.configuredFields).toEqual(['workspace_id']);
    expect(res.body.data?.integration?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain('https://slack.com/oauth/v2/authorize?');
    expect(res.body.data?.externalAuth?.authUrl).toContain('client_id=test-slack-client-id');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state='
    );
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'slack',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'external_auth_prepared',
    });
  });

  it('GET /api/v8/sync/health returns governed hub health summary', async () => {
    mockGetConnectedIntegrations.mockResolvedValue([{ id: 'int-1' }, { id: 'int-2' }]);
    mockGetIntegrationHealth
      .mockResolvedValueOnce({ status: 'healthy', errorRate: 0 })
      .mockResolvedValueOnce({ status: 'degraded', errorRate: 20 });

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/health');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.summary).toEqual({
      total: 2,
      healthy: 1,
      degraded: 1,
      unhealthy: 0,
    });
    expect(mockGetConnectedIntegrations).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/sync/errors returns governed sync error envelope', async () => {
    mockGetUnresolvedErrors.mockResolvedValue([
      {
        id: 'err-1',
        integrationId: 'int-1',
        errorType: 'AUTH',
        errorMessage: 'token expired',
        isRetryable: false,
        retryCount: 0,
        maxRetries: 3,
        createdAt: '2025-01-02T00:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/errors');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.errors?.[0]?.integrationId).toBe('int-1');
  });

  it('POST /api/v8/sync/errors/:errorId/resolve resolves a governed sync error', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/errors/err-1/resolve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockResolveError).toHaveBeenCalledWith('err-1');
  });

  it('POST /api/v8/sync/integrations/:integrationId/pause pauses an integration through the governed mutation seam', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/pause').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledWith(expect.stringContaining('is_paused = TRUE'), [
      'int-1',
      ORG,
    ]);
  });

  it('POST /api/v8/sync/integrations/:integrationId/reauth starts a governed reauth flow', async () => {
    // INVERTED (see file-header HISTORY).
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = buildApprovedRegistry({
      jira: { scopes: DEFAULT_JIRA_SCOPES },
    });
    mockDbAll.mockResolvedValueOnce([
      {
        connector_id: 'jira',
        config:
          '{"site_url":"https://example.atlassian.net","cloud_id":"cloud-123","client_id":"jira-client-id","client_secret":"jira-client-secret"}',
      },
    ]);
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/reauth').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.data?.externalAuth?.authUrl).toContain('https://auth.atlassian.com/authorize?');
    expect(res.body.data?.externalAuth?.callbackUrl).toContain(
      '/api/sync-hub/external-auth/callback?state='
    );
    expect(mockUpdateIntegrationStatus).toHaveBeenCalledWith('int-1', 'pending');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'connecting',
      transitionedBy: UID,
      reason: 'reauth_started',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/credential stores governed credential baseline', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-1',
        connector_id: 'jira',
        status: 'connected',
      },
    ]);
    mockStoreCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
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
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
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

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/integrations/int-1/credential')
      .send({
        providerAccountId: 'acct-123',
        workspaceOrTenantId: 'tenant-456',
        scopesGranted: ['read:jira-work'],
        tokenExpiresAt: '2026-03-27T19:00:00.000Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.credential?.providerAccountId).toBe('acct-123');
    expect(mockStoreCredential).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2026-03-27T19:00:00.000Z',
    });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integration_audit_log'),
      expect.arrayContaining([ORG, 'int-1', 'credential_materialized', UID, UID])
    );
  });

  it('POST /api/v8/sync/integrations/:integrationId/refresh-result records auth-break refresh outcome', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-1',
        connector_id: 'jira',
        status: 'connected',
      },
    ]);
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: null,
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'credential_expired',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'healthy',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/refresh-result').send({
      result: 'credential_expired',
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.credential?.lastRefreshResult).toBe('credential_expired');
    expect(res.body.data?.authTransition).toBe('degraded_reauth_needed');
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'credential_expired',
    });
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'degraded_reauth_needed',
      transitionedBy: UID,
      reason: 'refresh_auth_break',
    });
    expect(mockRecordAuthEscalation).toHaveBeenCalledWith('jira', ORG, 'credential_expired');
  });

  it('POST /api/v8/sync/integrations/:integrationId/refresh-result resolves active escalations after success', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'int-1',
        connector_id: 'jira',
        status: 'connected',
      },
    ]);
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: null,
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'success',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: false,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'degraded_reauth_needed',
    });
    mockResolveAuthEscalationsForConnector.mockResolvedValue([
      {
        escalationId: 'esc-auth-1',
        organizationId: ORG,
        connectorId: 'jira',
        reason: 'credential_expired',
        escalatedAt: '2026-03-27T18:00:00.000Z',
        resolvedAt: '2026-03-27T19:00:00.000Z',
        resolvedBy: UID,
      },
    ]);

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/refresh-result').send({
      result: 'success',
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.authTransition).toBe('healthy');
    expect(mockResolveAuthEscalationsForConnector).toHaveBeenCalledWith('jira', UID, ORG);
  });

  it('POST /api/v8/sync/integrations/:integrationId/disconnect disconnects through the governed mutation seam', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/disconnect').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDisconnectIntegration).toHaveBeenCalledWith('int-1');
  });

  it('POST /api/v8/sync/integrations/:integrationId/resume resumes an integration through the governed mutation seam', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/resume').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledWith(expect.stringContaining('is_paused = FALSE'), [
      'int-1',
      ORG,
    ]);
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync triggers a governed sync run', async () => {
    mockDbAll.mockResolvedValueOnce([
      { connector_id: 'jira', is_paused: false, status: 'connected' },
    ]);

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.syncRun?.status).toBe('completed');
    expect(mockCheckRateLimit).toHaveBeenCalledWith(ORG, 'int-1', 'jira');
    expect(mockRecordRequest).toHaveBeenCalledWith(ORG, 'int-1', 'jira');
    expect(mockSyncIntegration).toHaveBeenCalledWith('int-1', {});
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync blocks expired governed credentials before sync starts', async () => {
    mockDbAll.mockResolvedValueOnce([
      { connector_id: 'jira', is_paused: false, status: 'connected' },
    ]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2020-03-27T19:00:00.000Z',
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: '2020-03-27T19:00:00.000Z',
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'credential_expired',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'healthy',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFRESH_REAUTH_REQUIRED');
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'credential_expired',
    });
    expect(mockRecordAuthEscalation).toHaveBeenCalledWith('jira', ORG, 'credential_expired');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'degraded_reauth_needed',
      transitionedBy: UID,
      reason: 'sync_preflight_credential_expired',
    });
    expect(mockRecordRequest).not.toHaveBeenCalled();
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync blocks refresh-window credentials before fake runtime sync', async () => {
    mockDbAll.mockResolvedValueOnce([
      { connector_id: 'jira', is_paused: false, status: 'connected' },
    ]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockGetRefreshTimingPolicy.mockResolvedValue({
      policyId: 'policy-1',
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFRESH_SECRET_REQUIRED');
    expect(res.body.refreshWindowMinutes).toBe(15);
    expect(mockGetRefreshTimingPolicy).toHaveBeenCalledWith('atlassian', ORG);
    expect(mockExecuteRefreshExecution).toHaveBeenCalledWith('jira', ORG);
    expect(mockRecordRefreshResult).not.toHaveBeenCalled();
    expect(mockRecordRequest).not.toHaveBeenCalled();
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/integrations/:integrationId/refresh-secret stores governed refresh material', async () => {
    mockDbAll.mockResolvedValueOnce([{ id: 'int-1', connector_id: 'jira', status: 'connected' }]);

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/refresh-secret').send({
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.refreshSecret?.clientIdPresent).toBe(true);
    expect(mockStoreRefreshExecutionSecret).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    });
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync executes real governed refresh before continuing runtime sync', async () => {
    mockDbAll.mockResolvedValueOnce([
      { connector_id: 'jira', is_paused: false, status: 'connected' },
    ]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockExecuteRefreshExecution.mockResolvedValue({
      status: 'success',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      rotatedRefreshToken: true,
    });
    mockStoreCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockSyncIntegration.mockResolvedValue({
      recordsSynced: 12,
      duration: 321,
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(200);
    expect(mockExecuteRefreshExecution).toHaveBeenCalledWith('jira', ORG);
    expect(mockStoreCredential).toHaveBeenCalled();
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'success',
    });
    expect(mockSyncIntegration).toHaveBeenCalledWith('int-1', {});
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync turns refresh auth break into governed reauth truth', async () => {
    mockDbAll.mockResolvedValueOnce([
      { connector_id: 'jira', is_paused: false, status: 'connected' },
    ]);
    mockGetCredential.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: null,
      lastRefreshResult: null,
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T18:00:00.000Z',
    });
    mockRecordRefreshResult.mockResolvedValue({
      credentialId: 'cred-1',
      connectorId: 'jira',
      organizationId: ORG,
      providerAccountId: 'acct-123',
      workspaceOrTenantId: 'tenant-456',
      scopesGranted: ['read:jira-work'],
      tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      lastVerificationAt: '2026-03-27T18:00:00.000Z',
      lastRefreshAt: '2026-03-27T19:00:00.000Z',
      lastRefreshResult: 'credential_expired',
      createdAt: '2026-03-27T18:00:00.000Z',
      updatedAt: '2026-03-27T19:00:00.000Z',
    });
    mockGetConnectorHealth.mockResolvedValue({
      healthy: true,
      syncStatus: 'unknown',
      conflictCount: 0,
      lastSyncAt: null,
      authState: 'healthy',
    });
    mockExecuteRefreshExecution.mockResolvedValue({
      status: 'credential_expired',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
      error: 'invalid_grant',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFRESH_REAUTH_REQUIRED');
    expect(mockRecordRefreshResult).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      result: 'credential_expired',
    });
    expect(mockRecordAuthEscalation).toHaveBeenCalledWith('jira', ORG, 'credential_expired');
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/integrations/:integrationId/sync preserves rate-limit guardrails', async () => {
    mockDbAll.mockResolvedValueOnce([
      { connector_id: 'jira', is_paused: false, status: 'connected' },
    ]);
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      warnings: ['backoff'],
      reason: 'Too many requests',
      retryAfterMs: 1500,
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/sync/integrations/int-1/sync').send({});

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(mockRecordRequest).not.toHaveBeenCalled();
    expect(mockSyncIntegration).not.toHaveBeenCalled();
  });

  it('GET /api/v8/sync/audit-log returns governed audit envelope', async () => {
    mockDbAll.mockResolvedValue([
      {
        id: 'audit-1',
        integration_id: 'int-1',
        action: 'sync_completed',
        actor_name: 'Ada',
        details: {},
        created_at: '2025-01-02T00:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/audit-log').query({ limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.entries?.[0]?.action).toBe('sync_completed');
  });

  it('GET /api/v8/sync/auth/escalations returns list envelope', async () => {
    mockGetActiveEscalations.mockResolvedValue([
      {
        escalationId: 'e1',
        organizationId: ORG,
        connectorId: CONNECTOR,
        reason: 'degraded',
        escalatedAt: '2025-01-02T00:00:00.000Z',
        resolvedAt: null,
        resolvedBy: null,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/sync/auth/escalations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(mockGetActiveEscalations).toHaveBeenCalledWith(ORG);
  });

  it('POST /api/v8/sync/auth/escalations/:id/resolve resolves a governed auth escalation', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/auth/escalations/esc-1/resolve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.escalation?.resolvedBy).toBe(UID);
    expect(mockResolveAuthEscalation).toHaveBeenCalledWith('esc-1', UID, ORG);
  });

  it('GET /api/v8/sync/auth/policies/:providerFamily returns provider refresh policy', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/auth/policies/atlassian');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.policy?.providerFamily).toBe('atlassian');
    expect(mockGetRefreshTimingPolicy).toHaveBeenCalledWith('atlassian', ORG);
  });

  it('POST /api/v8/sync/auth/policies/:providerFamily upserts provider refresh policy', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/auth/policies/atlassian').send({
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.policy?.maxRetryAttempts).toBe(5);
    expect(mockSetRefreshTimingPolicy).toHaveBeenCalledWith({
      providerFamily: 'atlassian',
      organizationId: ORG,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });
  });

  it('GET /api/v8/sync/connectors/:id/health delegates to pmSyncTruthService', async () => {
    const app = createApp();
    const res = await request(app).get(
      `/api/v8/sync/connectors/${encodeURIComponent(CONNECTOR)}/health`
    );

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(res.body.data?.connectorId).toBe(CONNECTOR);
    expect(res.body.data?.health?.healthy).toBe(true);
    expect(mockGetConnectorHealth).toHaveBeenCalledWith(CONNECTOR, ORG);
  });

  it('GET /api/v8/sync/connectors/:id/health rejects blank connectorId', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/connectors/%20/health');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PARAM');
    expect(mockGetConnectorHealth).not.toHaveBeenCalled();
  });

  it('POST /api/v8/sync/connectors/:id/auth-state updates governed auth state', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/connectors/jira/auth-state')
      .send({ targetState: 'healthy' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.record?.authState).toBe('healthy');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: ORG,
      targetState: 'healthy',
      transitionedBy: UID,
      reason: null,
    });
    expect(mockResolveAuthEscalationsForConnector).toHaveBeenCalledWith('jira', UID, ORG);
  });

  it('POST /api/v8/sync/connectors/:id/auth-state rejects invalid target state', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/connectors/jira/auth-state')
      .send({ targetState: 'not-real' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockSetConnectorAuthState).not.toHaveBeenCalled();
  });

  it('GET /api/v8/sync/conflicts passes limit to service', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/conflicts?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_READ_CONTRACT);
    expect(mockGetUnresolvedConflicts).toHaveBeenCalledWith(ORG, 10);
  });

  it('GET /api/v8/sync/conflicts omits limit when not provided', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/sync/conflicts');

    expect(res.status).toBe(200);
    expect(mockGetUnresolvedConflicts).toHaveBeenCalledWith(ORG, undefined);
  });

  it('POST /api/v8/sync/conflicts/:id/resolve resolves a governed conflict', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/sync/conflicts/conf-1/resolve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_SYNC_RUNTIME_MUTATION_CONTRACT);
    expect(res.body.data?.conflict?.resolutionPath).toBe('dismiss');
    expect(mockResolveConflict).toHaveBeenCalledWith('conf-1', 'dismiss', UID, ORG);
  });

  it('POST /api/v8/sync/conflicts/:id/resolve rejects invalid resolution path', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/sync/conflicts/conf-1/resolve')
      .send({ resolutionPath: 'not_real' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockResolveConflict).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // Governed external-auth approval guard — negative coverage
  //
  // Every case below must be denied BEFORE any write: no config UPDATE, no
  // audit log INSERT, no connector auth-state transition, no reauth's
  // integration-status flip, and — since `logIntegrationConnectionEvent`
  // also writes through `dbRun` — no connection-event INSERT either. A
  // single shared assertion (`mockDbRun` not called) covers all of those,
  // because every write in this file's configure/reauth handlers goes
  // through `dbRun`.
  // ---------------------------------------------------------------------

  const CONFIGURE_CONNECTOR_FIXTURES = [
    {
      connectorId: 'jira',
      integrationId: 'int-jira-neg',
      scopes: DEFAULT_JIRA_SCOPES,
      config: {
        site_url: 'https://example.atlassian.net',
        cloud_id: 'cloud-123',
        client_id: 'jira-client-id',
        client_secret: 'jira-client-secret',
      },
    },
    {
      connectorId: 'gmail',
      integrationId: 'int-gmail-neg',
      scopes: DEFAULT_GMAIL_SCOPES,
      config: { domain: 'acme.com' },
    },
    {
      connectorId: 'asana',
      integrationId: 'int-asana-neg',
      scopes: DEFAULT_ASANA_SCOPES,
      config: { workspace_gid: 'workspace-123' },
    },
    {
      connectorId: 'teams',
      integrationId: 'int-teams-neg',
      scopes: DEFAULT_TEAMS_SCOPES,
      config: { tenant_id: 'tenant-123' },
    },
    {
      connectorId: 'slack',
      integrationId: 'int-slack-neg',
      scopes: DEFAULT_SLACK_SCOPES,
      config: { workspace_id: 'workspace-123' },
    },
  ] as const;

  function approvalVariants(scopes: readonly string[]): Array<{
    label: string;
    registry: (connectorId: string) => string | undefined;
  }> {
    return [
      { label: 'no registry entry at all', registry: () => undefined },
      {
        label: 'registry entry has approved:false',
        registry: (connectorId) =>
          buildApprovedRegistry({ [connectorId]: { approved: false, scopes } }),
      },
      {
        label: 'registry scopes do not match the required scope set',
        registry: (connectorId) =>
          buildApprovedRegistry({ [connectorId]: { scopes: ['not-a-real-scope'] } }),
      },
      {
        label: 'registry residency is empty',
        registry: (connectorId) =>
          buildApprovedRegistry({ [connectorId]: { scopes, residency: '' } }),
      },
    ];
  }

  for (const fixture of CONFIGURE_CONNECTOR_FIXTURES) {
    for (const variant of approvalVariants(fixture.scopes)) {
      it(`POST /api/v8/sync/integrations/:integrationId/configure denies ${fixture.connectorId} when ${variant.label}`, async () => {
        const registryValue = variant.registry(fixture.connectorId);
        if (registryValue === undefined) {
          delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
        } else {
          process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = registryValue;
        }
        mockDbAll.mockResolvedValueOnce([
          {
            id: fixture.integrationId,
            connector_id: fixture.connectorId,
            config: '{}',
            status: 'pending',
          },
        ]);

        const app = createApp();
        const res = await request(app)
          .post(`/api/v8/sync/integrations/${fixture.integrationId}/configure`)
          .send({ config: fixture.config });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('GOVERNED_EXTERNAL_AUTH_NOT_APPROVED');
        expect(res.body.data).toBeUndefined();
        // A rejected promise alone would not prove this: assert the writes
        // this route would otherwise have made were never attempted.
        expect(mockDbRun).not.toHaveBeenCalled();
        expect(mockSetConnectorAuthState).not.toHaveBeenCalled();
      });
    }
  }

  const REAUTH_JIRA_CONFIG =
    '{"site_url":"https://example.atlassian.net","cloud_id":"cloud-123","client_id":"jira-client-id","client_secret":"jira-client-secret"}';

  // Jira is required in both positive and negative coverage on both routes
  // (configure above, reauth here).
  for (const variant of approvalVariants(DEFAULT_JIRA_SCOPES)) {
    it(`POST /api/v8/sync/integrations/:integrationId/reauth denies jira when ${variant.label}`, async () => {
      const registryValue = variant.registry('jira');
      if (registryValue === undefined) {
        delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
      } else {
        process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = registryValue;
      }
      mockDbAll.mockResolvedValueOnce([
        { connector_id: 'jira', config: REAUTH_JIRA_CONFIG },
      ]);

      const app = createApp();
      const res = await request(app).post('/api/v8/sync/integrations/int-1/reauth').send({});

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('GOVERNED_EXTERNAL_AUTH_NOT_APPROVED');
      expect(res.body.data).toBeUndefined();
      expect(mockUpdateIntegrationStatus).not.toHaveBeenCalled();
      expect(mockSetConnectorAuthState).not.toHaveBeenCalled();
      // 'reauth_started' is logged via logIntegrationAudit -> dbRun; it must
      // not fire either, since it now happens AFTER the approval guard.
      expect(mockDbRun).not.toHaveBeenCalled();
    });
  }

  // ---------------------------------------------------------------------
  // Authoritative ACTIVE same-tenant membership wall — negative coverage
  // on both routes. Mounted via `requireActiveAuditsMembership`
  // (allowPlatformSuperAdminBypass: false), so a platform SUPERADMIN with
  // no membership row is denied exactly like anyone else.
  // ---------------------------------------------------------------------

  type MembershipNegativeCase = {
    label: string;
    setup: () => void;
    expectedStatus: number;
    expectedCode?: string;
    dbGetShouldBeCalled: boolean;
  };

  function membershipNegativeCases(): MembershipNegativeCase[] {
    return [
      {
        label: 'the request has no token',
        setup: () => {
          mockUser = null;
        },
        expectedStatus: 401,
        dbGetShouldBeCalled: false,
      },
      {
        label: 'the caller’s membership was revoked',
        setup: () => {
          mockDbGet.mockResolvedValue({ status: 'REVOKED' });
        },
        expectedStatus: 403,
        expectedCode: 'ORG_MEMBERSHIP_REVOKED',
        dbGetShouldBeCalled: true,
      },
      {
        label: 'the caller has no ACTIVE membership row in this tenant (foreign org)',
        setup: () => {
          mockDbGet.mockResolvedValue(undefined);
        },
        expectedStatus: 403,
        expectedCode: 'ORG_MEMBERSHIP_REVOKED',
        dbGetShouldBeCalled: true,
      },
      {
        label: 'the caller is an unmembered platform SUPERADMIN',
        setup: () => {
          mockUser = { id: UID, role: 'SUPERADMIN', organizationId: ORG, isSuperAdmin: true };
          mockDbGet.mockResolvedValue(undefined);
        },
        expectedStatus: 403,
        expectedCode: 'ORG_MEMBERSHIP_REVOKED',
        dbGetShouldBeCalled: true,
      },
      {
        label: 'the membership lookup itself fails',
        setup: () => {
          mockDbGet.mockRejectedValue(new Error('connection terminated unexpectedly'));
        },
        expectedStatus: 403,
        expectedCode: 'ORG_MEMBERSHIP_REVOKED',
        dbGetShouldBeCalled: true,
      },
    ];
  }

  for (const testCase of membershipNegativeCases()) {
    it(`POST /api/v8/sync/integrations/:integrationId/configure denies when ${testCase.label}`, async () => {
      testCase.setup();

      const app = createApp();
      const res = await request(app)
        .post('/api/v8/sync/integrations/int-1/configure')
        .send({ config: {} });

      expect(res.status).toBe(testCase.expectedStatus);
      if (testCase.expectedCode) {
        expect(res.body.code).toBe(testCase.expectedCode);
      }
      expect(mockDbGet).toHaveBeenCalledTimes(testCase.dbGetShouldBeCalled ? 1 : 0);
      // Denied before the route handler ever runs: no integration lookup,
      // no write of any kind.
      expect(mockDbAll).not.toHaveBeenCalled();
      expect(mockDbRun).not.toHaveBeenCalled();
      expect(mockSetConnectorAuthState).not.toHaveBeenCalled();
    });
  }

  for (const testCase of membershipNegativeCases()) {
    it(`POST /api/v8/sync/integrations/:integrationId/reauth denies when ${testCase.label}`, async () => {
      testCase.setup();

      const app = createApp();
      const res = await request(app).post('/api/v8/sync/integrations/int-1/reauth').send({});

      expect(res.status).toBe(testCase.expectedStatus);
      if (testCase.expectedCode) {
        expect(res.body.code).toBe(testCase.expectedCode);
      }
      expect(mockDbGet).toHaveBeenCalledTimes(testCase.dbGetShouldBeCalled ? 1 : 0);
      expect(mockDbAll).not.toHaveBeenCalled();
      expect(mockDbRun).not.toHaveBeenCalled();
      expect(mockUpdateIntegrationStatus).not.toHaveBeenCalled();
      expect(mockSetConnectorAuthState).not.toHaveBeenCalled();
    });
  }
});
