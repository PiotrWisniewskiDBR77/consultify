import os from 'node:os';
import path from 'node:path';

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

  const userId = 'u-gdpr-1';
  const orgId = 'o-gdpr-1';
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
    process.env.SQLITE_PATH = sqlitePath;
    process.env.JWT_SECRET = jwtSecret;

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
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
    userControlsRouter = (await import('../../../server/src/routes/user/user-data-controls.routes.ts'))
      .default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  beforeEach(async () => {
    await db.exec(`
      DELETE FROM account_deletion_requests;
      DELETE FROM data_export_requests;
      DELETE FROM users;
    `);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, orgId, 'u1@test.local', 'U', 'One', 'ADMIN']
    );
  });

  it('POST /api/settings/export-data creates a real request (no fake eta)', async () => {
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

  it('POST /api/settings/request-deletion creates a real request', async () => {
    const res = await request(makeApp())
      .post('/api/settings/request-deletion')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ reason: 'test' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        request: expect.objectContaining({
          id: expect.any(String),
          status: expect.any(String),
          scheduledFor: expect.any(String),
        }),
      })
    );

    const row = await db.get(
      `SELECT id, status FROM account_deletion_requests WHERE user_id = ?`,
      [userId]
    );
    expect(row?.id).toBeTruthy();
    expect(row?.status).toBeTruthy();
  });

  it('GET /api/user/data-export returns JSON payload', async () => {
    const res = await request(makeApp())
      .get('/api/user/data-export')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ exportDate: expect.any(String) }));
    expect(res.body.user).toEqual(expect.objectContaining({ id: userId }));
  });
});
