import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateAuthUrl,
  getConnectorAvailability,
  getConnectorConfig,
  isConnectorApproved,
  isConnectorConfigured,
} from '../../../server/src/services/integrationOAuthEngine.ts';

const savedEnv = { ...process.env };

describe('Settings integration OAuth approval boundary', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'gmail-client';
    process.env.GOOGLE_CLIENT_SECRET = 'gmail-secret';
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('does not configure or start an OAuth connector from credentials alone', () => {
    expect(isConnectorApproved('gmail')).toBe(false);
    expect(isConnectorConfigured('gmail')).toBe(false);
    expect(generateAuthUrl('gmail', 'user-1', 'org-1')).toBeNull();
    expect(getConnectorAvailability().gmail).toEqual(
      expect.objectContaining({ configured: false, approved: false, authType: 'oauth2' })
    );
  });

  it('rejects a scope expansion and enables only an exact scoped residency decision', () => {
    const scopes = getConnectorConfig('gmail')?.scopes || [];
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      gmail: {
        approved: true,
        scopes: [...scopes, 'https://www.googleapis.com/auth/drive'],
        residency: 'EU',
      },
    });
    expect(isConnectorApproved('gmail')).toBe(false);

    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      gmail: { approved: true, scopes, residency: 'EU' },
    });
    expect(isConnectorApproved('gmail')).toBe(true);
    expect(isConnectorConfigured('gmail')).toBe(true);
    const generated = generateAuthUrl('gmail', 'user-1', 'org-1');
    expect(generated?.url).toContain('scope=');
    expect(generated?.url).not.toContain('gmail-secret');
    expect(getConnectorAvailability().gmail).toEqual(
      expect.objectContaining({ configured: true, approved: true, residency: 'EU' })
    );
  });
});

// SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002 — route + auth consequences
// of the boundary proven above. `integrationOAuthEngine.ts` is one of three
// consent-URL producers; this suite exercises the THIRD one, reachable at
// POST /api/settings/integrations/:provider/connect
// (server/src/routes/settings.routes.ts:1732-1833), which builds its session
// via `buildGovernedExternalAuthSession`
// (server/src/services/v8/pmSyncExternalAuthMaterializationService.ts:227-339).
// That function's FIRST line is `requireApprovedGovernedConnector(context.connectorId)`
// (same file, :124-135), which throws before touching
// `issueSyncExternalAuthSession` (server/src/services/syncExternalAuthSessionService.ts:23-42)
// — the earliest side-effecting call in the governed flow, and the only call
// every one of the five provider branches (jira/gmail/asana/teams/slack) makes
// unconditionally before assembling a single URLSearchParams. That is the
// boundary this suite spies on for "zero consent-URL construction": it is
// closer to the source than the four provider-specific `new URLSearchParams(...)`
// call sites (spying on all four would be needed to catch every provider,
// fragile against a fifth being added) and closer than the response body
// (which only proves the URL didn't reach the client, not that it was never
// built — the packet explicitly asks for more than that).
//
// Real PostgreSQL is required (RUN_DB_TESTS=1) rather than MOCK_DB: per-session
// membership rescue logic in server/src/middleware/auth.middleware.ts reads
// `organization_members` live on every request, and a mocked DB would silently
// no-op that query and hide the exact re-scoping behavior these tests exist to
// pin down.
describe('POST /api/settings/integrations/:provider/connect — OAuth approval gate (real PostgreSQL)', () => {
  const previousEnv = { ...process.env };
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = 'oauth-connect-realdb-secret-minimum-32-characters-long';
  const suffix = randomUUID();
  const userId = randomUUID();
  const orgId = randomUUID();
  // Org the caller is NEVER a member of (no organization_members row at all) —
  // used to prove a claimed/forged foreign org id cannot be used to write there.
  const foreignOrgId = randomUUID();

  let db: any;
  let resetConnection: (() => Promise<void>) | undefined;
  let fixturePool: pg.Pool | undefined;
  let fixtureClient: pg.PoolClient | undefined;
  let fixtureLockHeld = false;

  const signToken = (claims: Record<string, unknown> = {}) =>
    jwt.sign(
      {
        id: userId,
        organizationId: orgId,
        email: `oauth-connect-${suffix}@test.local`,
        role: 'ADMIN',
        ...claims,
      },
      jwtSecret,
      { expiresIn: '5m', jwtid: randomUUID() }
    );

  // Fresh module registry per call: Config.ts (server/src/config/Config.ts)
  // snapshots process.env at import time, so ASANA_CLIENT_ID/SECRET and
  // OAUTH_APPROVED_PROVIDER_REGISTRY must be set BEFORE this runs, not after.
  // Spying on the real module instance the freshly-imported router will call
  // (not a separate vi.mock registration) is what makes the zero-call
  // assertion trustworthy — this is the actual function reference
  // settings.routes.ts's bundled import resolves to.
  const buildApp = async (): Promise<{
    app: Express;
    sessionSpy: ReturnType<typeof vi.spyOn>;
  }> => {
    vi.resetModules();
    // Imported with the SAME '.js' specifier pmSyncExternalAuthMaterializationService.ts
    // itself uses (its line 6) — Vite/Vitest resolve module identity from the
    // resolved absolute path, so this and the router's internal import land on
    // the identical cached module object; matching the specifier exactly is
    // belt-and-braces so the spy is provably intercepting the call the route
    // actually makes, not a second, differently-cached instance.
    const sessionModule = await import(
      '../../../server/src/services/syncExternalAuthSessionService.js'
    );
    const sessionSpy = vi.spyOn(sessionModule, 'issueSyncExternalAuthSession');
    const settingsRouter = (await import('../../../server/src/routes/settings.routes.ts'))
      .default;
    const { errorHandler } = await import('../../../server/src/middleware/errorHandler.ts');

    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    app.use(errorHandler);
    return { app, sessionSpy };
  };

  const countIntegrations = async (organizationId: string): Promise<number> =>
    Number(
      (
        await db.get(`SELECT count(*)::int AS n FROM integrations WHERE organization_id = ?`, [
          organizationId,
        ])
      )?.n ?? 0
    );

  const EXTERNAL_HOSTS = [
    'accounts.google.com',
    'app.asana.com',
    'slack.com',
    'login.microsoftonline.com',
    'auth.atlassian.com',
  ];

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error(
        'SET-MVP-OAUTH-001 connect-route suite requires a disposable PostgreSQL DATABASE_URL.'
      );
    }
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = jwtSecret;
    // A no-token request must actually reach verifyToken's 401 branch, not the
    // NODE_ENV=test auth bypass — that bypass would silently turn the
    // unauthenticated-negative test into a false pass.
    delete process.env.ENABLE_TEST_AUTH_BYPASS;

    if (process.env.SET_OAUTH_ALLOW_FIXTURE_CLEANUP !== '1') {
      throw new Error('SET_OAUTH_ALLOW_FIXTURE_CLEANUP=1 is required');
    }
    const expectedDatabase = new URL(databaseUrl).pathname.replace(/^\//, '');
    if (!expectedDatabase.startsWith('oauth_')) {
      throw new Error(`SET_OAUTH_DISPOSABLE_DATABASE_REQUIRED:${expectedDatabase}`);
    }
    fixturePool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    fixtureClient = await fixturePool.connect();
    const current = await fixtureClient.query<{ name: string }>('SELECT current_database() AS name');
    if (current.rows[0]?.name !== expectedDatabase) {
      throw new Error('SET_OAUTH_DATABASE_IDENTITY_MISMATCH');
    }
    await fixtureClient.query(`SELECT pg_advisory_lock(hashtext('set-mvp-oauth-realpg'))`);
    fixtureLockHeld = true;

    const database = await import('../../../server/src/database/Database.ts');
    resetConnection = database.resetConnection;
    await resetConnection();
    db = await database.getDatabaseAsync();

    await db.run(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'OAuth Connect Org']);
    await db.run(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [foreignOrgId, 'OAuth Connect Foreign Org']);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, orgId, `oauth-connect-${suffix}@test.local`, 'Connect', 'Tester', 'ADMIN']
    );
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')`,
      [`member-${userId}`, orgId, userId]
    );
  }, 30_000);

  afterAll(async () => {
    try {
      if (fixtureClient) {
        await fixtureClient.query('BEGIN');
        try {
          await fixtureClient.query(`DELETE FROM integrations WHERE organization_id = ANY($1::text[])`, [[orgId, foreignOrgId]]);
          await fixtureClient.query(`DELETE FROM organization_members WHERE user_id = $1`, [userId]);
          await fixtureClient.query(`DELETE FROM users WHERE id = $1`, [userId]);
          await fixtureClient.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgId, foreignOrgId]]);
          const residue = await fixtureClient.query<{ n: number }>(
            `SELECT
               (SELECT count(*) FROM integrations WHERE organization_id = ANY($1::text[])) +
               (SELECT count(*) FROM organization_members WHERE user_id = $2) +
               (SELECT count(*) FROM users WHERE id = $2) +
               (SELECT count(*) FROM organizations WHERE id = ANY($1::text[])) AS n`,
            [[orgId, foreignOrgId], userId]
          );
          expect(Number(residue.rows[0]?.n)).toBe(0);
          await fixtureClient.query('COMMIT');
        } catch (error) {
          await fixtureClient.query('ROLLBACK');
          throw error;
        }
      }
      await resetConnection?.();
    } finally {
      try {
        if (fixtureClient && fixtureLockHeld) {
          const unlocked = await fixtureClient.query<{ unlocked: boolean }>(
            `SELECT pg_advisory_unlock(hashtext('set-mvp-oauth-realpg')) AS unlocked`
          );
          expect(unlocked.rows[0]?.unlocked).toBe(true);
          fixtureLockHeld = false;
        }
      } finally {
        fixtureClient?.release();
        fixtureClient = undefined;
        await fixturePool?.end();
        fixturePool = undefined;
        process.env = previousEnv;
      }
    }
  }, 30_000);

  beforeEach(async () => {
    // Every lever a single test might flip, reset to the neutral baseline
    // BEFORE that test runs — this is the false-green vector the RULES call
    // out explicitly: one test's OAUTH_APPROVED_PROVIDER_REGISTRY or REVOKED
    // membership row must never leak into the next test.
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
    delete process.env.ASANA_CLIENT_ID;
    delete process.env.ASANA_CLIENT_SECRET;
    await db.run(
      `UPDATE organization_members SET status = 'ACTIVE' WHERE user_id = ? AND organization_id = ?`,
      [userId, orgId]
    );
    await db.run(`DELETE FROM integrations WHERE organization_id IN (?, ?)`, [
      orgId,
      foreignOrgId,
    ]);
  });

  afterEach(async () => {
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
    delete process.env.ASANA_CLIENT_ID;
    delete process.env.ASANA_CLIENT_SECRET;
    await db.run(
      `UPDATE organization_members SET status = 'ACTIVE' WHERE user_id = ? AND organization_id = ?`,
      [userId, orgId]
    );
  });

  it('fails closed for an unapproved connector: non-2xx, stable code, no authUrl, no external host', async () => {
    // Registry unset (beforeEach). asana IS a recognized governed connector
    // (GOVERNED_CONNECTOR_REQUIRED_SCOPES.asana in pmSyncExternalAuthMaterializationService.ts)
    // but has no approval decision, so requireApprovedGovernedConnector throws
    // synchronously before any URLSearchParams/session work.
    const { app, sessionSpy } = await buildApp();
    const before = await countIntegrations(orgId);

    const res = await request(app)
      .post('/api/settings/integrations/asana/connect')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ config: { workspace_gid: `wg-${suffix}` } });

    // asyncHandler (server/src/utils/asyncHandler.ts) forwards the thrown
    // Error to Express's error chain; nothing in the connect route wraps this
    // specific call in its own try/catch, so it lands on the generic
    // errorHandler (server/src/middleware/errorHandler.ts) classifyError()
    // default branch: a plain Error with no .statusCode/.code becomes
    // {statusCode: 500, code: 'INTERNAL_ERROR'} deterministically — that IS
    // the stable code this route actually produces today, not a designed
    // "provider not approved" contract like the sibling
    // GET /integrations/oauth/start/:connectorId route has (409
    // OAUTH_PROVIDER_NOT_APPROVED, settings.routes.ts:1969-1977). If that gap
    // is later closed, this assertion is the one to update.
    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false, code: 'INTERNAL_ERROR' })
    );
    expect(res.body).not.toHaveProperty('authUrl');
    const serialized = JSON.stringify(res.body);
    for (const host of EXTERNAL_HOSTS) {
      expect(serialized).not.toContain(host);
    }

    // Zero writes: the connect route now calls buildGovernedExternalAuthSession
    // (whose requireApprovedGovernedConnector guard throws for an unapproved
    // connector) BEFORE the `INSERT INTO integrations` — the route was
    // reordered so the approval gate runs ahead of every write, not after it.
    // The throw therefore happens strictly before any pending row is created.
    expect(await countIntegrations(orgId)).toBe(before);
    sessionSpy.mockRestore();
  });

  it('never invokes issueSyncExternalAuthSession for an unapproved connector — zero consent-URL construction', async () => {
    const { app, sessionSpy } = await buildApp();
    expect(sessionSpy).not.toHaveBeenCalled();

    await request(app)
      .post('/api/settings/integrations/asana/connect')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ config: { workspace_gid: `wg-${suffix}` } });

    // The central negative: requireApprovedGovernedConnector
    // (pmSyncExternalAuthMaterializationService.ts:124-135) throws before
    // reaching issueSyncExternalAuthSession, so a consent URL is never even
    // assembled for an unapproved provider — not merely absent from the
    // response.
    expect(sessionSpy).not.toHaveBeenCalled();
    sessionSpy.mockRestore();
  });

  it('denies an unauthenticated caller: 401, zero integration writes, zero consent-URL construction', async () => {
    const { app, sessionSpy } = await buildApp();
    const before = await countIntegrations(orgId);

    const res = await request(app)
      .post('/api/settings/integrations/asana/connect')
      .send({ config: { workspace_gid: `wg-${suffix}` } });

    // verifyToken's no-token branch (server/src/middleware/auth.middleware.ts:1160)
    // returns before the route handler runs at all, so this IS a genuine
    // zero-writes guarantee (unlike the unapproved-provider case above).
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'No token provided' });
    expect(await countIntegrations(orgId)).toBe(before);
    expect(sessionSpy).not.toHaveBeenCalled();
    sessionSpy.mockRestore();
  });

  it(
    'ignores a foreign-org claim: a JWT naming an org the caller does not belong to is re-scoped ' +
      'back to their own ACTIVE org, and the foreign org receives zero writes',
    async () => {
      // What this route does NOT do: there is no :orgId route param, so
      // there is no 403/404 keyed off a mismatched route param to assert
      // here. What actually happens is upstream, in attachUser()
      // (server/src/middleware/auth.middleware.ts:803-835): when the token's
      // organizationId has no ACTIVE organization_members row, and the caller
      // DOES have exactly one other ACTIVE membership, req.organizationId is
      // silently rewritten to that real org — the foreign id the token
      // claimed is never adopted. `requireActiveAuditsMembership`
      // (settings.routes.ts:1736) then evaluates that rescoped, own org,
      // where the caller IS ACTIVE, so it passes through to the handler.
      // Combined with the registry staying unset here, this proves the
      // foreign org gets neither a write nor a consent-URL attempt,
      // regardless of what the JWT claims.
      const { app, sessionSpy } = await buildApp();
      const foreignBefore = await countIntegrations(foreignOrgId);
      const ownBefore = await countIntegrations(orgId);

      const res = await request(app)
        .post('/api/settings/integrations/asana/connect')
        .set('Authorization', `Bearer ${signToken({ organizationId: foreignOrgId })}`)
        .send({ config: { workspace_gid: `wg-foreign-${suffix}` } });

      // Registry is unset (beforeEach) so this still 500s on the OAuth gate —
      // kept unapproved here specifically so "zero consent-URL construction"
      // is provable in the same test as the org re-scoping.
      expect(res.status).toBe(500);
      expect(await countIntegrations(foreignOrgId)).toBe(foreignBefore);
      // The approval gate (buildGovernedExternalAuthSession) now runs before
      // any write, so even under the caller's own, rescoped, ACTIVE org the
      // denial leaves an exact zero row delta — never foreignOrgId, and never
      // orgId either.
      expect(await countIntegrations(orgId)).toBe(ownBefore);
      expect(sessionSpy).not.toHaveBeenCalled();
      sessionSpy.mockRestore();
    }
  );

  it(
    'denies a REVOKED membership even when the provider IS approved: exact 403 ' +
      'ORG_MEMBERSHIP_REVOKED, zero integration writes, zero consent-URL construction',
    async () => {
      // requireActiveAuditsMembership (server/src/middleware/auditsStrictMembership.middleware.ts)
      // is mounted on this route (settings.routes.ts:1736, imported at :9)
      // AFTER verifyToken and BEFORE the handler, built with
      // allowPlatformSuperAdminBypass:false. The ONLY org membership this
      // user has anywhere is REVOKED, so attachUser's rescue
      // (auth.middleware.ts:803-835) finds no alternate ACTIVE org to fall
      // back to and keeps req.organizationId pinned to the revoked org. The
      // guard then reads that row live (no cache), finds status !== 'ACTIVE',
      // and denies before the handler — and therefore before
      // buildGovernedExternalAuthSession or the `INSERT INTO integrations` —
      // ever run.
      await db.run(
        `UPDATE organization_members SET status = 'REVOKED' WHERE user_id = ? AND organization_id = ?`,
        [userId, orgId]
      );
      process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
        asana: { approved: true, scopes: ['default'], residency: 'EU' },
      });
      process.env.ASANA_CLIENT_ID = `asana-client-${suffix}`;
      process.env.ASANA_CLIENT_SECRET = `asana-secret-${suffix}`;
      const { app, sessionSpy } = await buildApp();
      const before = await countIntegrations(orgId);

      const res = await request(app)
        .post('/api/settings/integrations/asana/connect')
        .set('Authorization', `Bearer ${signToken()}`)
        .send({ config: { workspace_gid: `wg-revoked-${suffix}` } });

      // Exact denial, not merely non-2xx: the literal status/body
      // `deny()` in auditsStrictMembership.middleware.ts produces.
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'You no longer have access to this organization',
        code: 'ORG_MEMBERSHIP_REVOKED',
      });
      expect(res.body).not.toHaveProperty('authUrl');
      expect(await countIntegrations(orgId)).toBe(before);
      expect(sessionSpy).not.toHaveBeenCalled();
      sessionSpy.mockRestore();

      await db.run(
        `UPDATE organization_members SET status = 'ACTIVE' WHERE user_id = ? AND organization_id = ?`,
        [userId, orgId]
      );
    }
  );

  it('denies an unmembered platform SUPERADMIN with exact current 403 and zero writes', async () => {
    await db.run(
      `DELETE FROM organization_members WHERE user_id = ? AND organization_id = ?`,
      [userId, orgId]
    );
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      asana: { approved: true, scopes: ['default'], residency: 'EU' },
    });
    process.env.ASANA_CLIENT_ID = `asana-client-${suffix}`;
    process.env.ASANA_CLIENT_SECRET = `asana-secret-${suffix}`;
    try {
      const { app, sessionSpy } = await buildApp();
      const before = await countIntegrations(orgId);
      const res = await request(app)
        .post('/api/settings/integrations/asana/connect')
        .set('Authorization', `Bearer ${signToken({ role: 'SUPERADMIN', isSuperAdmin: true })}`)
        .send({ config: { workspace_gid: `wg-superadmin-${suffix}` } });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(await countIntegrations(orgId)).toBe(before);
      expect(sessionSpy).not.toHaveBeenCalled();
      sessionSpy.mockRestore();
    } finally {
      await db.run(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')`,
        [`member-${userId}`, orgId, userId]
      );
    }
  });

  it('preserves the approved path: a registry-approved connector with matching scopes/residency still connects', async () => {
    // The gate must be a GATE, not a WALL — a packet that only proves denial
    // could be satisfied by deleting the feature outright. This is the
    // control: exact required scopes (DEFAULT_ASANA_SCOPES = ['default'],
    // pmSyncExternalAuthMaterializationService.ts:41) and a non-empty
    // residency, real ASANA_CLIENT_ID/SECRET, ACTIVE membership.
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      asana: { approved: true, scopes: ['default'], residency: 'EU' },
    });
    process.env.ASANA_CLIENT_ID = `asana-client-${suffix}`;
    process.env.ASANA_CLIENT_SECRET = `asana-secret-${suffix}`;
    const { app, sessionSpy } = await buildApp();
    const before = await countIntegrations(orgId);

    const res = await request(app)
      .post('/api/settings/integrations/asana/connect')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ config: { workspace_gid: `wg-approved-${suffix}` } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.authUrl).toBe('string');
    expect(res.body.authUrl).toMatch(/^https:\/\/app\.asana\.com\/-\/oauth_authorize\?/);
    expect(res.body.authUrl).not.toContain(process.env.ASANA_CLIENT_SECRET as string);
    expect(sessionSpy).toHaveBeenCalledTimes(1);

    const row = await db.get(
      `SELECT organization_id, connector_id, status FROM integrations
       WHERE organization_id = ? AND connector_id = 'asana' ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    expect(row).toEqual(
      expect.objectContaining({ organization_id: orgId, connector_id: 'asana' })
    );
    expect(await countIntegrations(orgId)).toBe(before + 1);
    sessionSpy.mockRestore();
  });
});
