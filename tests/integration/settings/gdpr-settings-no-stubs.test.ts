import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

describe('Settings/GDPR routes (no stub responses)', () => {
  const prevEnv = { ...process.env };
  const databaseUrl = process.env.DATABASE_URL;

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let settingsRouter: any;
  let gdprRouter: any;
  let userControlsRouter: any;
  let realDatabaseReady = false;

  const userId = 'f9ddc79d-2fb4-4557-8ff0-08db960b1255';
  const orgId = '1373318f-aab6-476e-8299-993d4eb4086a';
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
    process.env.RUN_DB_TESTS = '1';
    process.env.DB_TYPE = 'postgres';
    if (!databaseUrl) {
      throw new Error('This GDPR suite requires a disposable PostgreSQL DATABASE_URL.');
    }
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = jwtSecret;

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = await dbMod.getDatabaseAsync();
    await db.get('SELECT 1 AS ok');
    realDatabaseReady = true;

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
    expect(realDatabaseReady).toBe(true);
    await db.run(`DELETE FROM gdpr_requests WHERE user_id = ?`, [userId]);
    await db.run(`DELETE FROM account_deletion_requests WHERE user_id = ?`, [userId]);
    await db.run(`DELETE FROM user_data_export_receipts WHERE user_id = ?`, [userId]);
    await db.run(`DELETE FROM data_export_requests WHERE user_id = ?`, [userId]);
    await db.run(`DELETE FROM users WHERE id = ?`, [userId]);
    await db.run(`DELETE FROM organizations WHERE id = ?`, [orgId]);
    await db.run(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'GDPR Test']);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, orgId, 'u1@test.local', 'U', 'One', passwordHash, 'ADMIN']
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

  it('materializes one immutable hash-bound download and denies a different user', async () => {
    const created = await request(makeApp())
      .post('/api/settings/export-data')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ format: 'json', include: { profile: true } });
    expect(created.status).toBe(202);
    const requestId = created.body.request.id as string;
    await db.run(`UPDATE data_export_requests SET status = 'ready' WHERE id = ?`, [requestId]);

    const first = await request(makeApp())
      .get(`/api/gdpr/download-export/${requestId}`)
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(first.status).toBe(200);
    const firstBody = JSON.stringify(first.body, null, 2);
    const expectedHash = createHash('sha256').update(firstBody, 'utf8').digest('hex');
    expect(first.headers['x-export-receipt-sha256']).toBe(expectedHash);

    const second = await request(makeApp())
      .get(`/api/gdpr/download-export/${requestId}`)
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(second.status).toBe(200);
    expect(second.headers['x-export-receipt-sha256']).toBe(expectedHash);
    expect(second.body).toEqual(first.body);

    const receipt = await db.get(
      `SELECT artifact_sha256, artifact_bytes FROM user_data_export_receipts WHERE request_id = ?`,
      [requestId]
    );
    expect(receipt.artifact_sha256).toBe(expectedHash);
    expect(Number(receipt.artifact_bytes)).toBe(Buffer.byteLength(firstBody, 'utf8'));

    const otherToken = jwt.sign(
      { id: '00000000-0000-4000-8000-000000000099', organizationId: orgId, email: 'other@test.local', role: 'ADMIN' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const denied = await request(makeApp())
      .get(`/api/gdpr/download-export/${requestId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(denied.status).toBe(404);

    await expect(
      db.run(`UPDATE user_data_export_receipts SET artifact_sha256 = ? WHERE request_id = ?`, [
        '0'.repeat(64),
        requestId,
      ])
    ).rejects.toThrow('user data export receipts are immutable');
  });

  it('POST /api/settings/gdpr/deletion-request creates a real request', async () => {
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
    const res = await request(makeApp())
      .get('/api/user/data-export')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ exportDate: expect.any(String) }));
    expect(res.body.user).toEqual(expect.objectContaining({ id: userId }));
  });
});
