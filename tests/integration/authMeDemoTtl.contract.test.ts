/**
 * OPS-DEMO-002 — `GET /api/auth/me` must not mint credentials for a lapsed
 * public demo principal (real Express app, real DB, no mocks).
 *
 * `/me` is a THIRD credential-issuing door next to `login` and `refresh`, and it
 * was the only one without a demo TTL gate: on a role mismatch or a user re-map
 * it called `RefreshTokenService.generateTokenPair`, which carries no gate of its
 * own (the gates added earlier live in `refreshAccessToken` and
 * `AuthController.login`). A GET therefore handed out a brand-new refresh
 * family — 30 days by default, 7 on staging.
 *
 * Two layers now stand between a lapsed principal and that mint, and the tests
 * below exercise them SEPARATELY on purpose:
 *
 *   1. `attachUser` refuses the request outright — but it keys on the id inside
 *      the TOKEN;
 *   2. the `/me` handler re-asks the question about the row it actually
 *      resolved — which, after the email re-map fallback, is not necessarily the
 *      same account.
 *
 * The `token id no longer resolves` case reaches the handler with layer 1
 * satisfied, so it pins layer 2 on its own. That is the case the negative
 * control moves.
 *
 * Fixtures are namespaced (`ops-demo-002-me+<case>@fixture.invalid`, RFC 2606
 * `.invalid`) and never use a real address. Passwords exist only as local
 * constants.
 */
import path from 'path';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const nodePath = require('path');
  const nodeFs = require('fs');
  const dbFile = nodePath.resolve(__dirname, 'auth-me-demo-ttl.integration.db');
  // Fresh file every run: a leftover DB makes namespaced fixtures collide with
  // the previous run's rows, and refresh-token COUNT assertions are exactly the
  // kind that a stale row turns into a confusing red.
  try {
    nodeFs.rmSync(dbFile, { force: true });
  } catch {
    /* best effort */
  }
  process.env.SQLITE_PATH = dbFile;
  process.env.MOCK_DB = 'false';
  process.env.DEMO_USE_BASE_ORG = 'false';
  process.env.DEMO_ORG_ID = 'demo-org';
});

import jwt from 'jsonwebtoken';

import app, { databaseInitPromise } from '../../server/src/index';
import config from '../../server/src/config/Config.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { dbProxy, resetConnection } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';
import { get as dbGet, run as dbRun } from '../../server/src/utils/DbPromise.js';
import { __resetDemoPrincipalCache } from '../../server/src/services/demo/demoPrincipalGuard.js';

const FIXTURE_PASSWORD = 'ops-demo-002-fixture-pass';
const DB_FILE = 'auth-me-demo-ttl.integration.db';

const RUN_ID = `${process.pid.toString(36)}${Date.now().toString(36)}`;
let caseCounter = 0;
function fixtureEmail(label: string): string {
  caseCounter += 1;
  return `ops-demo-002-me+${label}-${RUN_ID}-${caseCounter}@fixture.invalid`;
}

async function registerDemo(email: string, password = FIXTURE_PASSWORD) {
  return request(app)
    .post('/api/auth/register-demo')
    .send({ email, password, firstName: 'Fixture', acceptedLegalDocs: ['TOS', 'PRIVACY'] });
}

async function registerRegularUser(email: string, password = FIXTURE_PASSWORD) {
  return request(app).post('/api/auth/register').send({
    email,
    password,
    firstName: 'Fixture',
    lastName: 'User',
    companyName: `Fixture Co ${RUN_ID}-${caseCounter}`,
    acceptedLegalDocs: ['TOS', 'PRIVACY'],
  });
}

function getMe(token: string) {
  return request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
}

/** Force the TTL to have elapsed without waiting 24h for it. */
async function expireSessionOf(userId: string): Promise<void> {
  await dbRun(
    `UPDATE demo_sessions SET expires_at = ? WHERE user_id = ?`,
    [new Date(Date.now() - 60_000).toISOString(), userId],
    { fallback: false }
  );
  __resetDemoPrincipalCache();
}

async function countRefreshTokens(userId: string): Promise<{ total: number; unrevoked: number }> {
  const total = await dbGet<{ c: number }>(
    `SELECT COUNT(*) as c FROM refresh_tokens WHERE user_id = ?`,
    [userId],
    { fallback: false }
  );
  const unrevoked = await dbGet<{ c: number }>(
    `SELECT COUNT(*) as c FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
    { fallback: false }
  );
  return { total: Number(total?.c || 0), unrevoked: Number(unrevoked?.c || 0) };
}

/**
 * A genuine, correctly signed access token whose `id` claim names an account
 * that does not exist, while its `email` claim names one that does.
 *
 * This is not a synthetic curiosity — it is precisely the state `/me`'s email
 * fallback was written for (`remappedUserId`), and it is the one shape that
 * clears `attachUser` (which resolves the demo principal from the TOKEN's id,
 * finds no marker, and waves it through) and still reaches the minting branch
 * inside the handler.
 */
function signTokenForUnknownId(email: string, organizationId: string, role = 'USER'): string {
  return jwt.sign(
    {
      id: `missing-${RUN_ID}-${caseCounter}-${Math.random().toString(36).slice(2, 10)}`,
      email,
      role,
      organizationId,
      isSuperAdmin: false,
      isDemo: false,
      jti: `jti-${RUN_ID}-${Math.random().toString(36).slice(2, 10)}`,
    },
    (config as unknown as { JWT_SECRET: string }).JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/** Every Set-Cookie value that carries a non-empty auth token. */
function authCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.filter((cookie) =>
    /(?:^|;\s*)(access_token|refresh_token)=(?!;|\s*$)[^;]+/.test(String(cookie))
  );
}

describe('OPS-DEMO-002 — GET /api/auth/me credential issuance', () => {
  beforeAll(async () => {
    await databaseInitPromise;
    await resetConnection();
    const init = await initializeDatabase();
    if (!init.success) throw new Error(`DB init failed: ${init.message}`);
    await setDependencies({ db: dbProxy });
  }, 120_000);

  afterAll(async () => {
    await resetConnection();
    try {
      const fs = await import('fs');
      fs.rmSync(path.resolve(__dirname, DB_FILE), { force: true });
    } catch {
      /* best effort */
    }
  });

  describe('ACTIVE public demo principal', () => {
    it('answers the normal /me contract and keeps working afterwards', async () => {
      const email = fixtureEmail('active');
      const a = await registerDemo(email);
      expect(a.status).toBe(200);
      const userId = a.body.user.id as string;
      const token = a.body.token as string;

      const me = await getMe(token);
      expect(me.status).toBe(200);
      expect(me.body.user).toBeTruthy();
      expect(me.body.user.id).toBe(userId);
      expect(me.body.user.email).toBe(email.trim().toLowerCase());
      expect(me.body.user.isAuthenticated).toBe(true);
      expect(typeof me.body.user.role).toBe('string');
      expect(typeof me.body.user.organizationId).toBe('string');
      expect(me.body.user.organizationId.length).toBeGreaterThan(0);

      // The session is untouched: the credential handed out at signup still works.
      const again = await getMe(token);
      expect(again.status).toBe(200);
      expect(again.body.user.id).toBe(userId);
    }, 180_000);

    it('does not open a new refresh family on every /me', async () => {
      // The old handler called generateTokenPair whenever the effective role
      // disagreed with the token claim — which is the standing state for a demo
      // principal, so EVERY /me inserted another full-length family row.
      const a = await registerDemo(fixtureEmail('active-family'));
      const userId = a.body.user.id as string;

      const before = await countRefreshTokens(userId);
      const first = await getMe(a.body.token as string);
      const second = await getMe(a.body.token as string);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const after = await countRefreshTokens(userId);
      expect(after.total).toBe(before.total);
      expect(after.unrevoked).toBe(before.unrevoked);
      expect(first.body.refreshToken).toBeUndefined();
      expect(second.body.refreshToken).toBeUndefined();
    }, 180_000);
  });

  describe('LAPSED public demo principal', () => {
    it('is refused with NO prior protected request, and gets no credentials', async () => {
      const a = await registerDemo(fixtureEmail('ttl-me-direct'));
      const userId = a.body.user.id as string;
      const token = a.body.token as string;

      // Deliberately NO authenticated request before this one: the lazy
      // retirement has not run, so users.status still reads 'active' and any
      // gate that trusted that flag would mint here.
      const statusBefore = await dbGet<{ status: string }>(
        `SELECT status FROM users WHERE id = ?`,
        [userId],
        { fallback: false }
      );
      await expireSessionOf(userId);
      expect(String(statusBefore?.status || '')).toBe('active');

      const before = await countRefreshTokens(userId);
      const me = await getMe(token);

      expect(me.status).toBe(403);
      expect(me.body.code).toBe('DEMO_SESSION_EXPIRED');
      expect(me.body.token).toBeUndefined();
      expect(me.body.refreshToken).toBeUndefined();
      expect(authCookies(me)).toEqual([]);

      const after = await countRefreshTokens(userId);
      expect(after.total).toBe(before.total);
      expect(after.unrevoked).toBe(0);
    }, 180_000);

    it('is refused inside the handler when the token id no longer resolves', async () => {
      // Layer 1 (`attachUser`) resolves the demo principal from the TOKEN's id.
      // With an id that names nothing, it finds no demo marker and lets the
      // request through — and `/me` then re-attaches it to the lapsed demo
      // account by email and used to mint a fresh refresh family for THAT account.
      // Nothing but the handler's own gate stands here.
      const email = fixtureEmail('ttl-me-remap');
      const a = await registerDemo(email);
      const userId = a.body.user.id as string;
      const sessionOrgId = a.body.demoSession.organizationId as string;

      await expireSessionOf(userId);

      const before = await countRefreshTokens(userId);
      const strayToken = signTokenForUnknownId(email.trim().toLowerCase(), sessionOrgId);
      const me = await getMe(strayToken);

      expect(me.status).toBe(403);
      expect(me.body.code).toBe('DEMO_SESSION_EXPIRED');
      expect(me.body.token).toBeUndefined();
      expect(me.body.refreshToken).toBeUndefined();
      expect(authCookies(me)).toEqual([]);

      // The load-bearing assertion: no refresh row was written for the demo
      // account, revoked or not. A revoked-only check would pass even when the
      // family was minted and then swept.
      const after = await countRefreshTokens(userId);
      expect(after.total).toBe(before.total);
      expect(after.unrevoked).toBe(0);
    }, 180_000);
  });

  describe('non-demo callers are unaffected', () => {
    it('answers the normal /me contract', async () => {
      const email = fixtureEmail('regular');
      const created = await registerRegularUser(email);
      expect(created.status).toBe(200);
      const token = created.body.token as string;
      const userId = created.body.user.id as string;

      const me = await getMe(token);
      expect(me.status).toBe(200);
      expect(me.body.user.id).toBe(userId);
      expect(me.body.user.email).toBe(email.trim().toLowerCase());
      expect(me.body.user.isAuthenticated).toBe(true);
      expect(me.body.code).toBeUndefined();
    }, 180_000);

    it('still re-issues a working ACCESS token on re-map — without a new family', async () => {
      // The re-mint path is kept for non-demo callers, minus the refresh family:
      // a re-map is a lookup correction, not a re-authentication.
      const email = fixtureEmail('regular-remap');
      const created = await registerRegularUser(email);
      expect(created.status).toBe(200);
      const userId = created.body.user.id as string;
      const organizationId = created.body.user.organizationId as string;

      const before = await countRefreshTokens(userId);
      const strayToken = signTokenForUnknownId(email.trim().toLowerCase(), organizationId);
      const me = await getMe(strayToken);

      expect(me.status).toBe(200);
      expect(me.body.userRemapped).toBe(true);
      expect(me.body.user.id).toBe(userId);
      expect(typeof me.body.token).toBe('string');
      expect(me.body.refreshToken).toBeUndefined();

      // No new family, and none of the caller's existing ones were disturbed.
      const after = await countRefreshTokens(userId);
      expect(after.total).toBe(before.total);
      expect(after.unrevoked).toBe(before.unrevoked);

      // The re-issued access token is real: it authenticates as the mapped user.
      const withNewToken = await getMe(me.body.token as string);
      expect(withNewToken.status).toBe(200);
      expect(withNewToken.body.user.id).toBe(userId);
    }, 180_000);
  });
});
