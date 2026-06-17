import os from 'node:os';
import path from 'node:path';

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
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-deletion-guard-${workerId}.db`);

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let settingsRouter: any;
  let gdprRouter: any;
  let canRunIsolatedSqlite = true;

  const userId = 'u-del-guard-1';
  const orgId = null;
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
    process.env.DB_TYPE = 'sqlite';
    delete process.env.DATABASE_URL;
    process.env.SQLITE_PATH = sqlitePath;
    process.env.JWT_SECRET = jwtSecret;

    const dbMod = await import('../../../server/src/database/Database.js');
    canRunIsolatedSqlite = !process.env.DATABASE_URL;
    if (!canRunIsolatedSqlite) {
      return;
    }
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        password TEXT,
        role TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        notes TEXT,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scheduled_for DATETIME,
        completed_at DATETIME
      );
    `);

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
    if (!canRunIsolatedSqlite) return;

    await db.exec(`
      DELETE FROM account_deletion_requests WHERE user_id = '${userId}';
      DELETE FROM users WHERE id = '${userId}';
    `);
    // gdpr_requests is created lazily by the settings route; clean it best-effort.
    await db
      .run(`DELETE FROM gdpr_requests WHERE user_id = ?`, [userId])
      .catch(() => undefined);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, password, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, orgId, 'del@test.local', 'Del', 'Guard', passwordHash, 'ADMIN']
    );
  });

  for (const route of routes) {
    describe(route.label, () => {
      it('rejects with 400 and writes no deletion row when password is missing', async () => {
        if (!canRunIsolatedSqlite) return;

        const res = await route
          .method()
          .set('Authorization', `Bearer ${makeToken()}`)
          .send({ reason: 'no-password' });

        expect(res.status).toBe(400);
        expect(await route.countRows()).toBe(0);
      });

      it('rejects with 403 and writes no deletion row when password is wrong', async () => {
        if (!canRunIsolatedSqlite) return;

        const res = await route
          .method()
          .set('Authorization', `Bearer ${makeToken()}`)
          .send({ reason: 'wrong-password', password: wrongPassword });

        expect(res.status).toBe(403);
        expect(await route.countRows()).toBe(0);
      });

      it('schedules deletion only when the correct password is supplied', async () => {
        if (!canRunIsolatedSqlite) return;

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
