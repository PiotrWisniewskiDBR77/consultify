import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Security guard: every route that can schedule an irreversible account deletion
 * MUST require the user's password.
 *
 *   1. POST /api/settings/gdpr/deletion-request  (gdpr_requests)            - gated (canonical)
 *   2. POST /api/gdpr/deletion-request           (account_deletion_requests) - gated
 *
 * POST /api/settings/request-deletion has been removed (M25 L-02 fix) — it was a
 * duplicate that wrote to account_deletion_requests with no downstream processor.
 *
 * This test pins the remaining routes to the contract: missing password -> 400,
 * wrong password -> 403, and NO deletion row is written unless the correct password
 * is supplied.
 */
describe('Account deletion routes are uniformly password-gated', () => {
  const prevEnv = { ...process.env };
  const databaseUrl = process.env.DATABASE_URL;

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let settingsRouter: any;
  let gdprRouter: any;
  let realDatabaseReady = false;

  const userId = '8ac9bb4f-8331-40fd-9970-4c3e51df09d1';
  const orgId = '9c37ac09-151f-4aa9-bc0b-58cd87106342';
  const correctPassword = 'C0rrectHorse!';
  const wrongPassword = 'definitely-not-it';
  const passwordHash = bcrypt.hashSync(correctPassword, 4);
  const jwtSecret = 'test-secret-min-32-chars-1234567890-abcdef';

  const makeToken = () =>
    jwt.sign(
      { id: userId, organizationId: orgId, email: 'del@test.local', role: 'ADMIN' },
      jwtSecret,
      { expiresIn: '1h' }
    );

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    app.use('/api/gdpr', gdprRouter);
    return app;
  };

  const countGdprDeletionRows = async (): Promise<number> => {
    const row = await db.get(
      `SELECT COUNT(*) AS n FROM gdpr_requests WHERE user_id = ? AND type = 'deletion'`,
      [userId]
    );
    return Number(row?.n ?? 0);
  };

  const countAccountDeletionRows = async (): Promise<number> => {
    const row = await db.get(
      `SELECT COUNT(*) AS n FROM account_deletion_requests WHERE user_id = ?`,
      [userId]
    );
    return Number(row?.n ?? 0);
  };

  // (endpoint path, app prefix, success status, row counter) for each guarded route.
  const routes = [
    {
      label: 'POST /api/settings/gdpr/deletion-request',
      method: () => request(makeApp()).post('/api/settings/gdpr/deletion-request'),
      successStatus: 200,
      countRows: () => countGdprDeletionRows(),
    },
    {
      label: 'POST /api/gdpr/deletion-request',
      method: () => request(makeApp()).post('/api/gdpr/deletion-request'),
      successStatus: 200,
      countRows: () => countAccountDeletionRows(),
    },
  ];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    process.env.DB_TYPE = 'postgres';
    if (!databaseUrl) {
      throw new Error('This security suite requires a disposable PostgreSQL DATABASE_URL.');
    }
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = jwtSecret;

    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = await dbMod.getDatabaseAsync();
    await db.get('SELECT 1 AS ok');
    realDatabaseReady = true;

    settingsRouter = (await import('../../../server/src/routes/settings.routes.ts')).default;
    gdprRouter = (await import('../../../server/src/routes/gdpr.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  beforeEach(async () => {
    expect(realDatabaseReady).toBe(true);
    await db.run(`DELETE FROM gdpr_requests WHERE user_id = ?`, [userId]);
    await db.run(`DELETE FROM account_deletion_requests WHERE user_id = ?`, [userId]);
    await db.run(`DELETE FROM users WHERE id = ?`, [userId]);
    await db.run(`DELETE FROM organizations WHERE id = ?`, [orgId]);
    await db.run(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Deletion Guard']);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, password, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, orgId, 'del@test.local', 'Del', 'Guard', passwordHash, 'ADMIN']
    );
  });

  for (const route of routes) {
    describe(route.label, () => {
      it('rejects with 400 and writes no deletion row when password is missing', async () => {
        const res = await route
          .method()
          .set('Authorization', `Bearer ${makeToken()}`)
          .send({ reason: 'no-password' });

        expect(res.status).toBe(400);
        expect(await route.countRows()).toBe(0);
      });

      it('rejects with 403 and writes no deletion row when password is wrong', async () => {
        const res = await route
          .method()
          .set('Authorization', `Bearer ${makeToken()}`)
          .send({ reason: 'wrong-password', password: wrongPassword });

        expect(res.status).toBe(403);
        expect(await route.countRows()).toBe(0);
      });

      it('schedules deletion only when the correct password is supplied', async () => {
        const res = await route
          .method()
          .set('Authorization', `Bearer ${makeToken()}`)
          .send({ reason: 'correct-password', password: correctPassword });

        expect(res.status).toBe(route.successStatus);
        expect(res.body).toEqual(expect.objectContaining({ success: true }));
        expect(await route.countRows()).toBe(1);
      });
    });
  }
});
