import os from 'node:os';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

describe('Settings/GDPR routes (no stub responses)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-gdpr-settings-${workerId}.db`);

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let settingsRouter: any;
  let gdprRouter: any;
  let userControlsRouter: any;
  let canRunIsolatedSqlite = true;

  const userId = 'u-gdpr-1';
  const orgId = null;
  const userPassword = 'Sup3rSecret!';
  const passwordHash = bcrypt.hashSync(userPassword, 4);
  const jwtSecret = 'test-secret-min-32-chars-1234567890-abcdef';

  const makeToken = () =>
    jwt.sign(
      { id: userId, organizationId: orgId, email: 'u1@test.local', role: 'ADMIN' },
      jwtSecret,
      { expiresIn: '1h' }
    );

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    app.use('/api/gdpr', gdprRouter);
    app.use('/api/user', userControlsRouter);
    return app;
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    delete process.env.DATABASE_URL;
    process.env.SQLITE_PATH = sqlitePath;
    process.env.JWT_SECRET = jwtSecret;

    vi.resetModules();
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
        phone TEXT,
        password TEXT,
        role TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      );
      CREATE TABLE IF NOT EXISTS data_export_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        download_url TEXT
      );
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scheduled_for DATETIME,
        completed_at DATETIME
      );
    `);

    settingsRouter = (await import('../../../server/src/routes/settings.routes.ts')).default;
    gdprRouter = (await import('../../../server/src/routes/gdpr.routes.ts')).default;
    userControlsRouter = (
      await import('../../../server/src/routes/user/user-data-controls.routes.ts')
    ).default;
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
      DELETE FROM data_export_requests WHERE user_id = '${userId}';
      DELETE FROM users WHERE id = '${userId}';
    `);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, orgId, 'u1@test.local', 'U', 'One', passwordHash, 'ADMIN']
    );
  });

  it('POST /api/settings/export-data creates a real request (no fake eta)', async () => {
    if (!canRunIsolatedSqlite) return;

    const res = await request(makeApp())
      .post('/api/settings/export-data')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ format: 'json', include: { profile: true } });
    expect(res.status).toBe(202);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        request: expect.objectContaining({
          id: expect.any(String),
          status: expect.any(String),
          downloadUrl: expect.any(String),
        }),
      })
    );

    const row = await db.get(`SELECT id, status FROM data_export_requests WHERE user_id = ?`, [
      userId,
    ]);
    expect(row?.id).toBeTruthy();
    expect(row?.status).toBeTruthy();
  });

  it('POST /api/settings/gdpr/deletion-request creates a real request', async () => {
    if (!canRunIsolatedSqlite) return;

    // The passwordless duplicate POST /api/settings/request-deletion was removed
    // (M25 L-02). The canonical bcrypt-gated endpoint writes to gdpr_requests.
    const res = await request(makeApp())
      .post('/api/settings/gdpr/deletion-request')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ reason: 'test', password: userPassword });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        request: expect.objectContaining({
          id: expect.any(String),
          status: expect.any(String),
          scheduledAt: expect.any(String),
        }),
      })
    );

    const row = await db.get(
      `SELECT id, status FROM gdpr_requests WHERE user_id = ? AND type = 'deletion'`,
      [userId]
    );
    expect(row?.id).toBeTruthy();
    expect(row?.status).toBeTruthy();
  });

  it('GET /api/user/data-export returns JSON payload', async () => {
    if (!canRunIsolatedSqlite) return;

    const res = await request(makeApp())
      .get('/api/user/data-export')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ exportDate: expect.any(String) }));
    expect(res.body.user).toEqual(expect.objectContaining({ id: userId }));
  });
});
