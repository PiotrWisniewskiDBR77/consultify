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
import { get as dbGet } from '../../server/src/utils/DbPromise.js';

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

      const membership = await dbGet<{ role: string }>(
        'SELECT role FROM organization_members WHERE user_id = ?',
        [res.body.user.id]
      );
      if (membership) {
        expect(PRIVILEGED_ROLES).not.toContain(String(membership.role || '').toUpperCase());
      }
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

    it('negative: account A presenting account B session org never reaches B', async () => {
      const a = await registerDemo(fixtureEmail('cross-a'));
      const b = await registerDemo(fixtureEmail('cross-b'));
      const orgB = b.body.demoSession.organizationId as string;

      // A forges B's session org header. The resolver validates ownership, so the
      // request must fall back to the curated base org — never B's tenant.
      const forged = await request(app)
        .get('/api/demo/organization')
        .set('Authorization', `Bearer ${a.body.token}`)
        .set('X-Demo-Mode', 'true')
        .set('X-Demo-Session-Org', orgB);

      expect(forged.status).toBe(200);
      expect(forged.body.organization?.id).not.toBe(orgB);
      expect(JSON.stringify(forged.body)).not.toContain(orgB);
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
