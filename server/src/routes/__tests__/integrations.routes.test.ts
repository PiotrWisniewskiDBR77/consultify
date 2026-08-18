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
  mockBuildGovernedExternalAuthSession,
  mockSetConnectorAuthState,
  mockVerifyToken,
} = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
  mockGetTableColumns: vi.fn(),
  mockListGovernedIntegrations: vi.fn(),
  mockBuildGovernedExternalAuthSession: vi.fn(),
  mockSetConnectorAuthState: vi.fn(),
  // Controllable per-test so the membership-wall tests below can simulate
  // missing/foreign/super-admin identities without touching the real
  // auth.middleware.ts (owned elsewhere). Default behaviour (set in
  // beforeEach) authenticates as an ordinary org-1 member.
  mockVerifyToken: vi.fn(),
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

vi.mock('../../services/v8/pmSyncExternalAuthMaterializationService.js', () => ({
  buildGovernedExternalAuthSession: (...args: unknown[]) =>
    mockBuildGovernedExternalAuthSession(...args),
  getGovernedExternalAuthConfigFields: (connectorId: string, baseFields: string[]) =>
    connectorId === 'jira' ? [...baseFields, 'client_id', 'client_secret'] : baseFields,
}));

vi.mock('../../services/v8/pmSyncTruthService.js', () => ({
  setConnectorAuthState: (...args: unknown[]) => mockSetConnectorAuthState(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => mockVerifyToken(req, res, next),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

// Real module — NOT mocked. The membership-wall tests below rely on the
// actual `requireActiveAuditsMembership` guard running against the mocked
// `DbPromise.get` above, so the route-under-test exercises the real
// middleware object that Gateway.ts wires in, not a stand-in.

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

// Populated by the wrapped write/service mocks below so the ordering tests
// can assert the approved-provider guard runs strictly before every write,
// instead of trusting the module-boundary mock to prove ordering (it would
// pass identically with or without the route-level fix).
let callOrder: string[] = [];

const DEFAULT_ACTIVE_USER = Object.freeze({ id: 'user-1', organizationId: 'org-1' });

/**
 * Arranges the mocked `verifyToken` for exactly the next request. Pass `null`
 * to simulate a request verifyToken itself rejects (no usable identity,
 * mirroring its real 401-before-`next()` behaviour); pass a user object to
 * simulate an authenticated identity with an arbitrary claimed org/role.
 */
function authenticateAsOnce(user: Record<string, unknown> | null): void {
  mockVerifyToken.mockImplementationOnce((req: any, res: any, next: () => void) => {
    if (user === null) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = user;
    next();
  });
}

/**
 * Every negative membership-wall test must prove the route performed no
 * side effect at all: no approval-guard/session build, no integration row
 * insert, no connector auth-state transition. Asserting only the HTTP status
 * would pass even if the wall were bypassed after the writes already ran.
 */
function expectNoWritesOccurred(): void {
  expect(mockBuildGovernedExternalAuthSession).not.toHaveBeenCalled();
  expect(mockDbRun).not.toHaveBeenCalled();
  expect(mockSetConnectorAuthState).not.toHaveBeenCalled();
}

const VALID_JIRA_CONFIG = Object.freeze({
  site_url: 'https://acme.atlassian.net',
  cloud_id: 'cloud-1',
  client_id: 'jira-client-id',
  client_secret: 'jira-client-secret',
});

const GOVERNED_CONNECT_ROUTES = [
  { label: 'POST /api/integrations/connect/:provider (canonical)', path: '/api/integrations/connect/jira' },
  { label: 'POST /api/integrations/:provider/connect (alias)', path: '/api/integrations/jira/connect' },
];

describe('canonical integrations readback continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder = [];
    mockVerifyToken.mockImplementation((req: any, _res: any, next: () => void) => {
      req.user = { ...DEFAULT_ACTIVE_USER };
      next();
    });
    // Authoritative ACTIVE-membership default: every existing test in this
    // file predates the membership wall and expects org-1/user-1 to be let
    // through, so the baseline lookup must resolve ACTIVE.
    mockDbGet.mockResolvedValue({ status: 'ACTIVE' });
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
          configFields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        },
      },
    ]);
    // These three mocks keep their original return shapes but also record
    // their call order in `callOrder`, so ordering tests can assert the
    // approved-provider guard (buildGovernedExternalAuthSession) runs before
    // every write (dbRun insert, setConnectorAuthState) rather than assuming
    // it from the source alone.
    mockBuildGovernedExternalAuthSession.mockImplementation(() => {
      callOrder.push('buildGovernedExternalAuthSession');
      return {
        authUrl: 'https://auth.atlassian.com/authorize?state=state-1',
        callbackUrl: 'https://example.test/api/sync-hub/external-auth/callback?state=state-1',
        state: 'state-1',
        expiresAt: '2026-03-27T20:11:00.000Z',
      };
    });
    mockDbRun.mockImplementation(() => {
      callOrder.push('dbRun:insertIntegration');
      return undefined;
    });
    mockSetConnectorAuthState.mockImplementation(() => {
      callOrder.push('setConnectorAuthState');
      return Promise.resolve({
        recordId: 'auth-1',
        connectorId: 'jira',
        organizationId: 'org-1',
        authState: 'connecting',
        previousState: null,
        transitionedAt: '2026-03-27T20:10:00.000Z',
        transitionedBy: 'user-1',
        reason: 'canonical_integrations_connect_initiated',
      });
    });
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
        required_fields: ['site_url', 'cloud_id', 'client_id', 'client_secret'],
        config: { site_url: 'https://acme.atlassian.net' },
      }),
    ]);
  });

  it('POST /api/integrations/connect/:provider creates governed pending connect truth on canonical entrypoint', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationsRoutes);

    const res = await request(app)
      .post('/api/integrations/connect/jira')
      .send({
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.authUrl).toContain('https://auth.atlassian.com/authorize?state=');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connecting',
      transitionedBy: 'user-1',
      reason: 'canonical_integrations_connect_initiated',
    });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO integrations'),
      expect.arrayContaining(['org-1', 'jira', 'Jira', 'project_management', 'pending'])
    );
    expect(mockBuildGovernedExternalAuthSession).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        connectorId: 'jira',
        organizationId: 'org-1',
        mode: 'connect',
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      })
    );
  });

  it('POST /api/integrations/:provider/connect reuses governed connect authority on alias entrypoint', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationsRoutes);

    const res = await request(app)
      .post('/api/integrations/jira/connect')
      .send({
        config: {
          site_url: 'https://acme.atlassian.net',
          cloud_id: 'cloud-1',
          client_id: 'jira-client-id',
          client_secret: 'jira-client-secret',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.onboardingStatus).toBe('pending_external_auth');
    expect(res.body.authUrl).toContain('https://auth.atlassian.com/authorize?state=');
    expect(mockSetConnectorAuthState).toHaveBeenCalledWith({
      connectorId: 'jira',
      organizationId: 'org-1',
      targetState: 'connecting',
      transitionedBy: 'user-1',
      reason: 'canonical_integrations_connect_initiated',
    });
  });

  // SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: authoritative
  // ACTIVE-membership + approved-provider wall at the route layer. These
  // exercise the REAL `requireActiveAuditsMembership` guard (not mocked)
  // through the mocked `DbPromise.get`, so the assertions cover the actual
  // middleware Gateway.ts wires in, wired at the actual route order.
  describe.each(GOVERNED_CONNECT_ROUTES)('membership + approval wall — $label', ({ path }) => {
    it('denies when there is no usable identity, before any write', async () => {
      authenticateAsOnce(null);
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBe(401);
      expectNoWritesOccurred();
    });

    it('denies a revoked membership, before any write', async () => {
      mockDbGet.mockResolvedValueOnce({ status: 'REVOKED' });
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expectNoWritesOccurred();
    });

    it('denies a foreign-org claim with no membership row for that org, before any write', async () => {
      authenticateAsOnce({ id: 'user-1', organizationId: 'org-999' });
      mockDbGet.mockResolvedValueOnce(undefined);
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBe(403);
      expectNoWritesOccurred();
    });

    it('denies an unmembered platform SUPERADMIN — no platform-role bypass — before any write', async () => {
      authenticateAsOnce({ id: 'user-1', organizationId: 'org-1', isSuperAdmin: true });
      mockDbGet.mockResolvedValueOnce(undefined);
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBe(403);
      // Proves the guard actually consulted the membership table for the
      // super-admin instead of short-circuiting the way the bypass:true
      // sibling guards (`requireActiveTenantMembership`) would.
      expect(mockDbGet).toHaveBeenCalledWith(
        expect.stringContaining('organization_members'),
        ['user-1', 'org-1'],
        expect.anything()
      );
      expectNoWritesOccurred();
    });

    it('denies when the membership lookup fails, before any write', async () => {
      mockDbGet.mockRejectedValueOnce(new Error('connection reset'));
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBe(403);
      expectNoWritesOccurred();
    });

    it('still succeeds for an ACTIVE member connecting an approved connector, guard strictly before writes', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.authUrl).toContain('https://auth.atlassian.com/authorize?state=');
      // Ordering proof, not just "was called": the approved-provider guard
      // must run before the integration row is inserted and before the
      // connector auth-state transition.
      expect(callOrder).toEqual([
        'buildGovernedExternalAuthSession',
        'dbRun:insertIntegration',
        'setConnectorAuthState',
      ]);
    });
  });

  // `connected_by` is a required immutable audit identity: server/migrations/
  // 256_integrations_system.sql declares `connected_by TEXT NOT NULL` with no
  // default. On a real Postgres database the pre-fix INSERT (which omitted the
  // column entirely) would fail with "null value in column connected_by
  // violates not-null constraint". These tests can't hit real Postgres, so
  // they instead inspect the exact arguments the route hands to the mocked
  // DB-layer `dbRun` call — proving the value bound is the authenticated
  // actor id, never a body-supplied identity and never a synthetic fallback.
  describe.each(GOVERNED_CONNECT_ROUTES)('connected_by audit identity binding — $label', ({ path }) => {
    function findIntegrationInsertCall(): [string, unknown[]] {
      const call = mockDbRun.mock.calls.find(
        (args) => typeof args[0] === 'string' && args[0].includes('INSERT INTO integrations')
      );
      expect(call).toBeDefined();
      return call as [string, unknown[]];
    }

    it('binds the INSERT connected_by to the authenticated actor id, verified via the real mock call arguments', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBe(201);
      const [, params] = findIntegrationInsertCall();
      // Positional: connected_by is bound as the final placeholder value
      // (see the INSERT column list in integrations.routes.ts).
      expect(params[params.length - 1]).toBe('user-1');
    });

    it('cannot be overridden by a spoofed identity in the request body', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({
          config: VALID_JIRA_CONFIG,
          connected_by: 'attacker-connected-by',
          connectedBy: 'attacker-connectedBy',
          actorId: 'attacker-actorId',
          userId: 'attacker-userId',
          connected_by_id: 'attacker-connected-by-id',
        });

      expect(res.status).toBe(201);
      const [, params] = findIntegrationInsertCall();
      expect(params[params.length - 1]).toBe('user-1');

      // None of the attacker-supplied identity values reached ANY database-
      // layer call — not just that the "wrong" position was checked.
      for (const [, callParams] of mockDbRun.mock.calls) {
        expect(callParams).not.toContain('attacker-connected-by');
        expect(callParams).not.toContain('attacker-connectedBy');
        expect(callParams).not.toContain('attacker-actorId');
        expect(callParams).not.toContain('attacker-userId');
        expect(callParams).not.toContain('attacker-connected-by-id');
      }
    });

    it('fails closed with zero writes and no synthetic "system" identity when req.user.id is absent', async () => {
      // Simulates an authenticated request whose upstream identity signal
      // (req.userId, consulted by the membership guard's fallback) is present
      // — so it clears requireActiveAuditsMembership — but whose req.user.id
      // (the field this route binds connected_by from) is absent. This is the
      // regression guard for the removed `req.user?.id || 'system'` fallback:
      // the route itself must refuse to synthesize an identity, independent
      // of what any other layer accepts as "authenticated".
      mockVerifyToken.mockImplementationOnce((req: any, _res: any, next: () => void) => {
        req.user = { organizationId: 'org-1' };
        req.userId = 'user-1';
        next();
      });
      const app = express();
      app.use(express.json());
      app.use('/api/integrations', integrationsRoutes);

      const res = await request(app)
        .post(path)
        .send({ config: VALID_JIRA_CONFIG });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(mockDbRun).not.toHaveBeenCalled();
      expect(mockBuildGovernedExternalAuthSession).not.toHaveBeenCalled();
      expect(mockSetConnectorAuthState).not.toHaveBeenCalled();

      // The literal string 'system' must never appear in any database-layer
      // call argument — proof the removed fallback has no surviving effect.
      for (const call of mockDbRun.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('system');
      }
      for (const call of mockSetConnectorAuthState.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('system');
      }
    });
  });
});
