/**
 * Super Admin MFA methods — real PostgreSQL regression.
 *
 * WHAT WAS BROKEN (three independent defects on one path):
 *
 *  1. `user_mfa_methods` was created by no executed migration. Its only DDL is
 *     `015_enterprise_customers_module.sql`, numbered < 500 and therefore
 *     excluded by `isSqliteOnlyMigration()`, and it is not promoted. The table
 *     existed in no environment, so `GET /api/superadmin/users/:id/mfa` — which
 *     IS wired end-to-end to `src/views/superadmin/security/MFAView.tsx` —
 *     failed with 42P01.
 *  2. `verifyTOTP` compared `method_type = "totp"`. Double quotes are a string
 *     literal in SQLite but an IDENTIFIER in Postgres, so the predicate
 *     resolved to a column named `totp` and failed with 42703.
 *  3. Both TOTP handlers called `require('speakeasy')` inside an ESM module
 *     with no `createRequire`, so they threw ReferenceError before touching
 *     any SQL.
 *
 * `datetime("now")` is deliberately NOT treated as a defect: `adaptQuery`
 * rewrites it to `NOW()` for either quote style. It was normalised for
 * readability only.
 *
 * Feature posture is unchanged: this file proves storage and query
 * correctness. It does not enable MFA, and asserts no product behaviour beyond
 * what the handlers already promised.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('Super Admin MFA methods — real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let controller: typeof import('../SuperAdminController.js');

  const orgId = `org-samfa-${randomUUID()}`;
  const superAdminId = `user-samfa-sa-${randomUUID()}`;
  const plainUserId = `user-samfa-plain-${randomUUID()}`;
  const targetUserId = `user-samfa-target-${randomUUID()}`;
  const createdUsers = [superAdminId, plainUserId, targetUserId];

  let superAdminToken = '';
  let plainUserToken = '';

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [
      orgId,
    ]);
    for (const [id, role] of [
      [superAdminId, 'SUPERADMIN'],
      [plainUserId, 'user'],
      [targetUserId, 'user'],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)`,
        [id, orgId, `${id}@example.test`, role]
      );
    }

    const { default: config } = await import('../../config/Config.js');
    // `Config` does not declare JWT_ISSUER / JWT_AUDIENCE, but
    // `superAdmin.middleware.ts:39` reads them as optional strings off the same
    // object. Mirror that declared shape so the token this suite signs stays in
    // sync with what the guard verifies.
    const jwtClaims = config as unknown as { JWT_ISSUER?: string; JWT_AUDIENCE?: string };
    const sign = (id: string, role: string) =>
      jwt.sign({ id, role, organizationId: orgId }, config.JWT_SECRET, {
        expiresIn: '10m',
        ...(jwtClaims.JWT_ISSUER ? { issuer: jwtClaims.JWT_ISSUER } : {}),
        ...(jwtClaims.JWT_AUDIENCE ? { audience: jwtClaims.JWT_AUDIENCE } : {}),
      });
    superAdminToken = sign(superAdminId, 'SUPERADMIN');
    plainUserToken = sign(plainUserId, 'user');

    controller = await import('../SuperAdminController.js');
    const { verifyToken } = await import('../../middleware/auth.middleware.js');
    const { verifySuperAdmin } = await import('../../middleware/superAdmin.middleware.js');

    // The real guards, in the real order the router applies them
    // (superadmin.routes.ts:345 then :348), in front of the real handlers.
    app = express();
    app.use(express.json());
    const guarded = express.Router();
    guarded.use(verifyToken as express.RequestHandler);
    guarded.use(verifySuperAdmin as express.RequestHandler);
    guarded.get('/users/:id/mfa', (req, res, next) =>
      (controller.getMFAMethods as any)(req, res, next)
    );
    guarded.post('/users/:id/mfa/totp/setup', (req, res, next) =>
      (controller.setupTOTP as any)(req, res, next)
    );
    guarded.post('/users/:id/mfa/totp/verify', (req, res, next) =>
      (controller.verifyTOTP as any)(req, res, next)
    );
    app.use('/api/superadmin', guarded);
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(err?.statusCode || 500).json({ error: err?.message || 'error' })
    );
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM user_mfa_methods WHERE user_id = ANY($1)`, [createdUsers]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUsers]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    const residue = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE id = ANY($1)`, [
      createdUsers,
    ]);
    if (residue.rows[0]?.n !== 0) throw new Error('superadmin mfa fixture cleanup left residue');
    await pool.end();
  });

  const asSuperAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${superAdminToken}`);

  it('the panel read returns a stored factor instead of failing on a missing table', async () => {
    const methodId = `mfa-${randomUUID()}`;
    await pool.query(
      `INSERT INTO user_mfa_methods (id, user_id, method_type, secret, is_enabled, is_primary)
       VALUES ($1, $2, 'totp', $3, 1, 1)`,
      [methodId, targetUserId, 'SEEDEDSECRET']
    );

    const res = await asSuperAdmin(request(app).get(`/api/superadmin/users/${targetUserId}/mfa`));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].method_type).toBe('totp');
  });

  it('setup persists an enrolment row and it survives a fresh read', async () => {
    const res = await asSuperAdmin(
      request(app).post(`/api/superadmin/users/${targetUserId}/mfa/totp/setup`).send({})
    );

    expect(res.status).toBe(200);
    expect(res.body.secret).toBeTruthy();

    // Straight from Postgres, not from the response body.
    const row = await pool.query(
      `SELECT secret, is_enabled FROM user_mfa_methods
        WHERE user_id = $1 AND secret = $2`,
      [targetUserId, res.body.secret]
    );
    expect(row.rowCount).toBe(1);
    // Setup enrols but must NOT enable — the feature stays off until verified.
    expect(row.rows[0].is_enabled).toBe(0);

    // Fresh reopen: a cold controller instance reads the same row back.
    vi.resetModules();
    const cold = await import('../SuperAdminController.js');
    const coldApp = express();
    coldApp.use(express.json());
    const { verifyToken } = await import('../../middleware/auth.middleware.js');
    const { verifySuperAdmin } = await import('../../middleware/superAdmin.middleware.js');
    const r = express.Router();
    r.use(verifyToken as express.RequestHandler);
    r.use(verifySuperAdmin as express.RequestHandler);
    r.get('/users/:id/mfa', (rq, rs, nx) => (cold.getMFAMethods as any)(rq, rs, nx));
    coldApp.use('/api/superadmin', r);

    const reread = await request(coldApp)
      .get(`/api/superadmin/users/${targetUserId}/mfa`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(reread.status).toBe(200);
    expect(
      (reread.body as Array<{ secret: string }>).some((m) => m.secret === res.body.secret)
    ).toBe(true);
  });

  it('verify reads the primary TOTP factor — the predicate must be a literal, not an identifier', async () => {
    // A dedicated user so the "exactly one primary" assumption holds.
    const userId = `user-samfa-v-${randomUUID()}`;
    createdUsers.push(userId);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, 'user')`,
      [userId, orgId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO user_mfa_methods (id, user_id, method_type, secret, is_enabled, is_primary)
       VALUES ($1, $2, 'totp', $3, 0, 1)`,
      [`mfa-${randomUUID()}`, userId, 'JBSWY3DPEHPK3PXP']
    );

    const res = await asSuperAdmin(
      request(app)
        .post(`/api/superadmin/users/${userId}/mfa/totp/verify`)
        .send({ token: '000000' })
    );

    // The point is that the QUERY resolved and the handler reached a verdict.
    // A wrong code is a legitimate `verified: false`; a broken predicate would
    // have produced 'MFA not set up' (400) or a 42703 error instead.
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('verified');
    expect(res.body.verified).toBe(false);
  });

  it('a refused write does not report a successful enrolment', async () => {
    const dbModule = await import('../../database/Database.js');
    const db = dbModule.getDatabaseInstance();
    const spy = vi
      .spyOn(db as unknown as { run: (...a: unknown[]) => unknown }, 'run')
      .mockImplementation((...args: unknown[]) => {
        const cb = args.find((a) => typeof a === 'function') as
          | ((err: Error | null) => void)
          | undefined;
        cb?.(new Error('simulated_write_failure'));
        return db as never;
      });

    const res = await asSuperAdmin(
      request(app).post(`/api/superadmin/users/${targetUserId}/mfa/totp/setup`).send({})
    );

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.secret).toBeUndefined();

    spy.mockRestore();
  });

  it('a non-superadmin cannot reach any of the three endpoints', async () => {
    for (const call of [
      request(app).get(`/api/superadmin/users/${targetUserId}/mfa`),
      request(app).post(`/api/superadmin/users/${targetUserId}/mfa/totp/setup`).send({}),
      request(app)
        .post(`/api/superadmin/users/${targetUserId}/mfa/totp/verify`)
        .send({ token: '000000' }),
    ]) {
      const res = await call.set('Authorization', `Bearer ${plainUserToken}`);
      expect(res.status).toBeGreaterThanOrEqual(401);
      expect(res.status).toBeLessThan(500);
    }
  });

  it('an unauthenticated caller cannot reach the panel read', async () => {
    const res = await request(app).get(`/api/superadmin/users/${targetUserId}/mfa`);
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });
});
