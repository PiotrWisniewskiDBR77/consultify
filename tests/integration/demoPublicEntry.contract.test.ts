/**
 * OPS-DEMO-002 — public `Try demo` entry contract (real Express app, real DB).
 *
 * Covers the canonical public path end to end at the API level, with no browser
 * mock: landing modal contract -> POST /api/auth/register-demo -> POST
 * /api/auth/login -> POST /api/demo/toggle -> GET /api/demo/status.
 *
 * Fixtures are namespaced (`ops-demo-002+<case>@fixture.invalid`) and never use a
 * real person's address. Passwords exist only as local constants; nothing here
 * writes a credential into documentation, a seed or a log assertion.
 */
import path from 'path';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { vi } from 'vitest';

vi.hoisted(() => {
  const nodePath = require('path');
  const nodeFs = require('fs');
  const dbFile = nodePath.resolve(__dirname, 'demo-public-entry.integration.db');
  // Start from an empty file every run. A leftover DB makes the namespaced
  // fixtures collide with the previous run's rows, and `retry: 1` would then hide
  // the collision behind a green second attempt.
  try {
    nodeFs.rmSync(dbFile, { force: true });
  } catch {
    /* best effort */
  }
  process.env.SQLITE_PATH = dbFile;
  process.env.MOCK_DB = 'false';
  // Keep the isolated-session model under test: DEMO_USE_BASE_ORG=true is the
  // curated shared read-only variant and would make the isolation assertions vacuous.
  process.env.DEMO_USE_BASE_ORG = 'false';
  process.env.DEMO_ORG_ID = 'demo-org';
});

import app from '../../server/src/index';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { dbProxy, resetConnection } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';
import { get as dbGet, run as dbRun } from '../../server/src/utils/DbPromise.js';
import { __resetDemoPrincipalCache } from '../../server/src/services/demo/demoPrincipalGuard.js';

const FIXTURE_PASSWORD = 'ops-demo-002-fixture-pass';
const PRIVILEGED_ROLES = ['SUPERADMIN', 'SUPER_ADMIN', 'OWNER', 'ADMIN'];

// Run-scoped so a leftover fixture DB can never make a fresh case look like a
// duplicate. `.invalid` is reserved by RFC 2606 — these addresses cannot resolve.
const RUN_ID = `${process.pid.toString(36)}${Date.now().toString(36)}`;
let caseCounter = 0;
function fixtureEmail(label: string): string {
  caseCounter += 1;
  return `ops-demo-002+${label}-${RUN_ID}-${caseCounter}@fixture.invalid`;
}

async function registerDemo(email: string, password = FIXTURE_PASSWORD) {
  return request(app)
    .post('/api/auth/register-demo')
    .send({ email, password, firstName: 'Fixture', acceptedLegalDocs: ['TOS', 'PRIVACY'] });
}

describe('OPS-DEMO-002 public demo entry contract', () => {
  beforeAll(async () => {
    await resetConnection();
    const init = await initializeDatabase();
    if (!init.success) throw new Error(`DB init failed: ${init.message}`);
    await setDependencies({ db: dbProxy });
  }, 120_000);

  afterAll(async () => {
    await resetConnection();
    try {
      const fs = await import('fs');
      fs.rmSync(path.resolve(__dirname, 'demo-public-entry.integration.db'), { force: true });
    } catch {
      /* best effort */
    }
  });

  describe('register-demo — success contract', () => {
    it('provisions an account plus an isolated seeded demo tenant', async () => {
      const email = fixtureEmail('happy');
      const res = await registerDemo(email);

      expect(res.status).toBe(200);
      expect(res.body.isDemo).toBe(true);
      expect(typeof res.body.token).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');

      // The session org must be the caller's OWN tenant, not the curated base org.
      expect(res.body.demoSession).toBeTruthy();
      expect(typeof res.body.demoSession.organizationId).toBe('string');
      expect(res.body.demoSession.organizationId).not.toBe('demo-org');
      expect(res.body.demoSession.organizationId.startsWith('demo-org-session-')).toBe(true);
      expect(typeof res.body.demoSession.expiresAt).toBe('string');
    }, 120_000);

    it('stores the address in the same normalized form the login lookup uses', async () => {
      // Root cause of the staging dead end: register stored the raw mixed-case
      // address while login queried the lowercased one, so the account existed
      // but could never authenticate.
      const email = fixtureEmail('MixedCase').replace('ops-demo-002', 'OPS-Demo-002');
      const created = await registerDemo(email);
      expect(created.status).toBe(200);

      const stored = await dbGet<{ email: string; role: string }>(
        'SELECT email, role FROM users WHERE id = ?',
        [created.body.user.id]
      );
      expect(stored?.email).toBe(email.trim().toLowerCase());

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: FIXTURE_PASSWORD });
      expect(login.status).toBe(200);
      expect(typeof login.body.token).toBe('string');
    }, 120_000);

    it('grants the smallest sufficient role — never SUPERADMIN/OWNER/ADMIN', async () => {
      const email = fixtureEmail('role');
      const res = await registerDemo(email);
      expect(res.status).toBe(200);

      const stored = await dbGet<{ role: string }>('SELECT role FROM users WHERE id = ?', [
        res.body.user.id,
      ]);
      expect(PRIVILEGED_ROLES).not.toContain(String(stored?.role || '').toUpperCase());
      expect(PRIVILEGED_ROLES).not.toContain(String(res.body.user.role || '').toUpperCase());
      expect(res.body.user.isSuperAdmin).toBeFalsy();

      // NOT `if (membership)`. The membership INSERT is exactly the write that
      // fails silently when the role violates the organization_members CHECK
      // constraint, so a conditional assertion is vacuous precisely when the bug
      // is present. Assert the row exists.
      const membership = await dbGet<{ role: string }>(
        'SELECT role FROM organization_members WHERE user_id = ?',
        [res.body.user.id]
      );
      expect(membership).toBeTruthy();
      expect(PRIVILEGED_ROLES).not.toContain(String(membership?.role || '').toUpperCase());
    }, 120_000);

    it('grants a role that is not pilot-restricted, so the demo is not crippled', async () => {
      // A role in the USER band (MEMBER / TEAM_MEMBER / bare USER / GUEST) makes
      // `isPilotRestrictedRole` true, which bounces the visitor off every route
      // outside PILOT_ALLOWED_ROUTE_PREFIXES and collapses the sidebar to six
      // items. That turns a working demo into an apparently broken product.
      const PILOT_RESTRICTED = ['USER', 'MEMBER', 'TEAM_MEMBER', 'GUEST', 'VIEWER', 'CLIENT'];
      const res = await registerDemo(fixtureEmail('pilot'));
      expect(res.status).toBe(200);

      const stored = await dbGet<{ role: string }>('SELECT role FROM users WHERE id = ?', [
        res.body.user.id,
      ]);
      expect(PILOT_RESTRICTED).not.toContain(String(stored?.role || '').toUpperCase());
    }, 120_000);

    it('refuses the super-admin lane with the demo token', async () => {
      const email = fixtureEmail('adminpanel');
      const res = await registerDemo(email);
      const token = res.body.token as string;

      const superAdmin = await request(app)
        .get('/api/superadmin/organizations')
        .set('Authorization', `Bearer ${token}`);
      expect(superAdmin.status).not.toBe(200);
      expect([401, 403, 404]).toContain(superAdmin.status);
    }, 120_000);
  });

  describe('register-demo — duplicate / retry behaviour', () => {
    it('answers a duplicate address with a body that does not disclose existence', async () => {
      const email = fixtureEmail('dup');
      const first = await registerDemo(email);
      expect(first.status).toBe(200);

      const second = await registerDemo(email);
      expect(second.status).toBe(409);
      // One neutral outcome for every non-seed signup rejection: the caller cannot
      // tell a registered address from an unknown one by status, code or wording.
      expect(second.body.code).toBe('DEMO_SIGNUP_UNAVAILABLE');
      expect(second.body.code).not.toBe('EMAIL_IN_USE');
      expect(second.body.error).toBe(
        'We could not start a demo with those details. Log in if you already have an account, or use a different email address.'
      );
      const message = String(second.body.error || '').toLowerCase();
      expect(message).not.toContain('already in use');
      expect(message).not.toContain('exists');
      expect(message).not.toContain(email.toLowerCase());
    }, 120_000);

    it('is case-insensitive about duplicates, so retries cannot fork an account', async () => {
      const email = fixtureEmail('dupcase');
      expect((await registerDemo(email)).status).toBe(200);

      const upper = await registerDemo(email.toUpperCase());
      expect(upper.status).toBe(409);
      expect(upper.body.code).toBe('DEMO_SIGNUP_UNAVAILABLE');
    }, 120_000);

    it('never returns a credential or password hash in the signup payload', async () => {
      const email = fixtureEmail('nosecret');
      const res = await registerDemo(email);
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain(FIXTURE_PASSWORD);
      expect(res.body.user.password).toBeUndefined();
    }, 120_000);
  });

  describe('tenant isolation between two demo accounts', () => {
    it('positive: each account resolves to its own seeded tenant', async () => {
      const a = await registerDemo(fixtureEmail('tenant-a'));
      const b = await registerDemo(fixtureEmail('tenant-b'));
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);

      const orgA = a.body.demoSession.organizationId as string;
      const orgB = b.body.demoSession.organizationId as string;
      expect(orgA).not.toBe(orgB);

      const statusA = await request(app)
        .get('/api/demo/status')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', orgA);
      expect(statusA.status).toBe(200);
      expect(statusA.body.demoSession?.organizationId).toBe(orgA);
    }, 180_000);

    it('negative: account A presenting account B session org is REFUSED, not degraded', async () => {
      const a = await registerDemo(fixtureEmail('cross-a'));
      const b = await registerDemo(fixtureEmail('cross-b'));
      const orgB = b.body.demoSession.organizationId as string;

      // Fail closed. The old behaviour silently downgraded a forged header to the
      // shared curated org and answered 200, which made a cross-tenant probe
      // indistinguishable from a legitimate request.
      const forged = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', orgB);

      expect(forged.status).toBe(403);
      expect(forged.body.code).toBe('DEMO_SESSION_INVALID');
      expect(JSON.stringify(forged.body)).not.toContain(orgB);
    }, 180_000);

    it('negative: a made-up session org is refused rather than degraded', async () => {
      const a = await registerDemo(fixtureEmail('bogus-org'));
      const forged = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', 'demo-org-session-does-not-exist');

      expect(forged.status).toBe(403);
      expect(forged.body.code).toBe('DEMO_SESSION_INVALID');
    }, 180_000);

    it('negative: omitting the header does NOT silently seat the caller in the base org', async () => {
      const a = await registerDemo(fixtureEmail('noheader'));
      const orgA = a.body.demoSession.organizationId as string;

      // No X-Demo-Mode, no X-Demo-Session-Org. The server derives the tenant from
      // the active session, so the caller stays in their own copy instead of
      // being re-seated in the curated base org by the membership fallback.
      const bare = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`);

      expect(bare.status).toBe(200);
      expect(bare.body.organization?.id).toBe(orgA);
      expect(bare.body.organization?.id).not.toBe('demo-org');
    }, 180_000);

    it('negative: a demo write is refused inside the demo tenant', async () => {
      const a = await registerDemo(fixtureEmail('readonly'));
      const orgA = a.body.demoSession.organizationId as string;

      const write = await request(app)
        .post('/api/initiatives')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', orgA)
        .send({ title: 'ops-demo-002 should never persist' });

      expect(write.status).toBe(403);
      expect(write.body.code).toBe('DEMO_READ_ONLY');
    }, 180_000);
  });

  describe('read-only is not negotiable by the client', () => {
    /**
     * The whole point: NO demo headers. `demoWriteProtection` is mounted globally
     * before authentication, so its only usable signal is `X-Demo-Mode` — a bare
     * write used to sail past it entirely.
     */
    const BARE_WRITES: Array<{ label: string; method: 'post' | 'put' | 'delete'; path: string; body?: unknown }> = [
      { label: 'assessment create', method: 'post', path: '/api/assessments', body: { name: 'ops-demo-002 must not persist' } },
      { label: 'initiative create', method: 'post', path: '/api/initiatives', body: { title: 'ops-demo-002 must not persist' } },
      { label: 'project create', method: 'post', path: '/api/projects', body: { name: 'ops-demo-002 must not persist' } },
      { label: 'task create', method: 'post', path: '/api/tasks', body: { title: 'ops-demo-002 must not persist' } },
      { label: 'invite', method: 'post', path: '/api/invitations', body: { email: 'ops-demo-002+invitee@fixture.invalid', role: 'ADMIN' } },
      { label: 'admin org update', method: 'put', path: '/api/admin/organization', body: { name: 'ops-demo-002 must not persist' } },
      { label: 'access code verify', method: 'post', path: '/api/organizations/verify-access-code', body: { accessCode: 'APLIX-2026' } },
      { label: 'organization update', method: 'put', path: '/api/organizations/demo-org', body: { name: 'ops-demo-002 must not persist' } },
      { label: 'initiative delete', method: 'delete', path: '/api/initiatives/whatever' },
    ];

    it.each(BARE_WRITES)(
      'refuses a bare $label with 403 DEMO_READ_ONLY and no headers at all',
      async ({ method, path, body }) => {
        const a = await registerDemo(fixtureEmail('bare-write'));
        const req = request(app)[method](path).set('Authorization', `Bearer ${a.body.token}`);
        const res = body ? await req.send(body as object) : await req.send();

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DEMO_READ_ONLY');
      },
      180_000
    );

    it('read-back proves a bare write persisted nothing', async () => {
      const a = await registerDemo(fixtureEmail('bare-readback'));
      const orgA = a.body.demoSession.organizationId as string;
      const marker = `ops-demo-002-bare-${RUN_ID}`;

      const before = await dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM initiatives WHERE title = ?`,
        [marker]
      );

      const write = await request(app)
        .post('/api/initiatives')
        .set('Authorization', `Bearer ${a.body.token}`)
        .send({ title: marker, organizationId: orgA });
      expect(write.status).toBe(403);

      const after = await dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM initiatives WHERE title = ?`,
        [marker]
      );
      expect(Number(after?.c || 0)).toBe(Number(before?.c || 0));
      expect(Number(after?.c || 0)).toBe(0);
    }, 180_000);

    it('reads still work — this is read-only, not locked out', async () => {
      const a = await registerDemo(fixtureEmail('bare-read'));
      const read = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`);
      expect(read.status).toBe(200);
    }, 180_000);

    it('leaving demo mode is still permitted, so the client can wind down', async () => {
      const a = await registerDemo(fixtureEmail('bare-exit'));
      const exit = await request(app)
        .post('/api/demo/toggle')
        .set('Authorization', `Bearer ${a.body.token}`)
        .send({ enabled: false });
      expect(exit.status).not.toBe(403);
    }, 180_000);

    it('the refusal is not cacheable', async () => {
      const a = await registerDemo(fixtureEmail('bare-cache'));
      const res = await request(app)
        .post('/api/initiatives')
        .set('Authorization', `Bearer ${a.body.token}`)
        .send({ title: 'x' });
      expect(res.status).toBe(403);
      expect(String(res.headers['cache-control'] || '')).toContain('no-store');
    }, 180_000);
  });

  describe('session lifetime — access must end with the session', () => {
    /** Force the TTL to have elapsed without waiting 24h for it. */
    async function expireSessionOf(userId: string): Promise<void> {
      await dbRun(
        `UPDATE demo_sessions SET expires_at = ? WHERE user_id = ?`,
        [new Date(Date.now() - 60_000).toISOString(), userId],
        { fallback: false }
      );
      __resetDemoPrincipalCache();
    }

    it('expires_at in the past ends access on the very next request', async () => {
      const a = await registerDemo(fixtureEmail('ttl-access'));
      const userId = a.body.user.id as string;
      const orgA = a.body.demoSession.organizationId as string;

      const before = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', orgA);
      expect(before.status).toBe(200);

      await expireSessionOf(userId);

      const after = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', orgA);
      expect(after.status).toBe(403);
      expect(after.body.code).toBe('DEMO_SESSION_EXPIRED');
    }, 180_000);

    it('an expired principal cannot fall back to the shared base org', async () => {
      const a = await registerDemo(fixtureEmail('ttl-baseorg'));
      await expireSessionOf(a.body.user.id as string);

      // No demo headers at all — the path that used to re-seat the caller in
      // DEMO_ORG_ID via the "any ACTIVE membership" rescue.
      const bare = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`);
      expect(bare.status).toBe(403);
      expect(bare.body.code).toBe('DEMO_SESSION_EXPIRED');
    }, 180_000);

    it('an expired principal cannot mint a fresh session by re-reading status', async () => {
      const a = await registerDemo(fixtureEmail('ttl-renew'));
      const userId = a.body.user.id as string;
      await expireSessionOf(userId);

      // GET /api/demo/status used to call resolveOrCreateDemoSession and hand out
      // a brand new 24h session, because `demo:enabled` survives expiry.
      const status = await request(app)
        .get('/api/demo/status')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true');
      expect(status.status).toBe(403);

      const active = await dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM demo_sessions WHERE user_id = ? AND status = 'active' AND expires_at > ?`,
        [userId, new Date().toISOString()]
      );
      expect(Number(active?.c || 0)).toBe(0);
    }, 180_000);

    it('DIRECT login after expiry is refused with no prior protected request', async () => {
      const email = fixtureEmail('ttl-login-direct');
      const a = await registerDemo(email);

      // Deliberately NO authenticated GET first. The lazy retirement never ran, so
      // users.status is still 'active' — a gate that trusted that flag would mint
      // a fresh token right here.
      await expireSessionOf(a.body.user.id as string);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: FIXTURE_PASSWORD });
      expect(login.status).toBe(403);
      expect(login.body.code).toBe('DEMO_SESSION_EXPIRED');
      expect(login.body.token).toBeUndefined();
    }, 180_000);

    it('DIRECT refresh after expiry is refused with no prior protected request', async () => {
      const a = await registerDemo(fixtureEmail('ttl-refresh-direct'));
      const refreshToken = a.body.refreshToken as string;

      await expireSessionOf(a.body.user.id as string);

      const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
      expect(refreshed.status).toBe(401);
      expect(refreshed.body.token).toBeUndefined();
    }, 180_000);

    it('the refused login retires the account and revokes the token family', async () => {
      const email = fixtureEmail('ttl-retire');
      const a = await registerDemo(email);
      const userId = a.body.user.id as string;
      await expireSessionOf(userId);

      await request(app).post('/api/auth/login').send({ email, password: FIXTURE_PASSWORD });

      const user = await dbGet<{ status: string }>('SELECT status FROM users WHERE id = ?', [
        userId,
      ]);
      expect(String(user?.status || '').toLowerCase()).toBe('demo_expired');

      const live = await dbGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL`,
        [userId]
      );
      expect(Number(live?.c || 0)).toBe(0);
    }, 180_000);

    it('a second refresh attempt after the first refusal is still refused', async () => {
      const a = await registerDemo(fixtureEmail('ttl-refresh-twice'));
      const refreshToken = a.body.refreshToken as string;
      await expireSessionOf(a.body.user.id as string);

      const first = await request(app).post('/api/auth/refresh').send({ refreshToken });
      expect(first.status).toBe(401);
      // Guards against a rotation/grace path handing out credentials on retry.
      const second = await request(app).post('/api/auth/refresh').send({ refreshToken });
      expect(second.status).toBe(401);
      expect(second.body.token).toBeUndefined();
    }, 180_000);

    it('a live session is untouched by the guard', async () => {
      const a = await registerDemo(fixtureEmail('ttl-live'));
      const orgA = a.body.demoSession.organizationId as string;
      const still = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', orgA);
      expect(still.status).toBe(200);
      expect(still.body.organization?.id).toBe(orgA);
    }, 180_000);
  });

  describe('deprecated anonymous entry', () => {
    it('does not resurrect /demo-login outside the test gateway', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      const previousE2E = process.env.E2E_MODE;
      const previousGateway = process.env.ENABLE_TEST_GATEWAY;
      process.env.NODE_ENV = 'production';
      process.env.E2E_MODE = 'false';
      process.env.ENABLE_TEST_GATEWAY = 'false';
      try {
        const res = await request(app).post('/api/auth/demo-login').send({});
        expect(res.status).toBe(410);
        expect(res.body.code).toBe('DEMO_LOGIN_DEPRECATED');
      } finally {
        process.env.NODE_ENV = previousNodeEnv;
        process.env.E2E_MODE = previousE2E;
        process.env.ENABLE_TEST_GATEWAY = previousGateway;
      }
    }, 120_000);
  });
});
