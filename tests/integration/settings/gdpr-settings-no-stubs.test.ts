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
  let dbPromiseModule: typeof import('../../../server/src/utils/DbPromise.js');
  let realDatabaseReady = false;

  const userId = 'f9ddc79d-2fb4-4557-8ff0-08db960b1255';
  const orgId = '1373318f-aab6-476e-8299-993d4eb4086a';
  const foreignUserId = '00000000-0000-4000-8000-000000000099';
  const foreignOrgId = '00000000-0000-4000-8000-000000000199';
  const userPassword = 'Sup3rSecret!';
  const passwordHash = bcrypt.hashSync(userPassword, 4);
  const jwtSecret = 'test-secret-min-32-chars-1234567890-abcdef';

  const makeToken = (claims: { id?: string; organizationId?: string; role?: string } = {}) =>
    jwt.sign(
      {
        id: claims.id || userId,
        organizationId: claims.organizationId || orgId,
        email: 'u1@test.local',
        role: claims.role || 'ADMIN',
      },
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
    dbPromiseModule = await import('../../../server/src/utils/DbPromise.js');
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
      await db?.run(`DELETE FROM user_data_export_receipts WHERE user_id IN (?, ?)`, [
        userId,
        foreignUserId,
      ]);
      await db?.run(`DELETE FROM data_export_requests WHERE user_id IN (?, ?)`, [
        userId,
        foreignUserId,
      ]);
      await db?.run(`DELETE FROM gdpr_requests WHERE user_id IN (?, ?)`, [userId, foreignUserId]);
      await db?.run(`DELETE FROM account_deletion_requests WHERE user_id IN (?, ?)`, [
        userId,
        foreignUserId,
      ]);
      await db?.run(`DELETE FROM organization_members WHERE user_id IN (?, ?)`, [
        userId,
        foreignUserId,
      ]);
      await db?.run(`DELETE FROM users WHERE id IN (?, ?)`, [userId, foreignUserId]);
      await db?.run(`DELETE FROM organizations WHERE id IN (?, ?)`, [orgId, foreignOrgId]);
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
    await db.run(`DELETE FROM organization_members WHERE user_id IN (?, ?)`, [
      userId,
      foreignUserId,
    ]);
    await db.run(`DELETE FROM users WHERE id IN (?, ?)`, [userId, foreignUserId]);
    await db.run(`DELETE FROM organizations WHERE id IN (?, ?)`, [orgId, foreignOrgId]);
    await db.run(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [
      orgId,
      'GDPR Test',
      foreignOrgId,
      'GDPR Foreign',
    ]);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, password, role)
       VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        orgId,
        'u1@test.local',
        'U',
        'One',
        passwordHash,
        'ADMIN',
        foreignUserId,
        foreignOrgId,
        'foreign@test.local',
        'Foreign',
        'User',
        passwordHash,
        'ADMIN',
      ]
    );
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, 'ADMIN', 'ACTIVE'), (?, ?, ?, 'ADMIN', 'ACTIVE')`,
      [`member-${userId}`, orgId, userId, `member-${foreignUserId}`, foreignOrgId, foreignUserId]
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
    expect(first.body.user).toEqual(
      expect.objectContaining({ id: userId, email: 'u1@test.local' })
    );
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
      `SELECT artifact_json, artifact_sha256, artifact_bytes FROM user_data_export_receipts WHERE request_id = ?`,
      [requestId]
    );
    expect(JSON.parse(String(receipt.artifact_json)).user).toEqual(
      expect.objectContaining({ id: userId, email: 'u1@test.local' })
    );
    expect(receipt.artifact_sha256).toBe(expectedHash);
    expect(Number(receipt.artifact_bytes)).toBe(Buffer.byteLength(firstBody, 'utf8'));

    const otherToken = makeToken({ id: foreignUserId, organizationId: foreignOrgId });
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

  it('enforces ACTIVE membership per request and fails closed without export writes', async () => {
    const app = makeApp();
    const countRows = async () => ({
      requests: Number(
        (await db.get(`SELECT count(*) AS n FROM data_export_requests WHERE user_id = ?`, [userId]))
          ?.n
      ),
      receipts: Number(
        (
          await db.get(`SELECT count(*) AS n FROM user_data_export_receipts WHERE user_id = ?`, [
            userId,
          ])
        )?.n
      ),
    });
    const before = await countRows();

    expect((await request(app).post('/api/gdpr/export-request').send({})).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/gdpr/export-request')
          .set('Authorization', 'Bearer invalid')
          .send({})
      ).status
    ).toBe(401);

    await db.run(
      `UPDATE organization_members SET status = 'REVOKED' WHERE user_id = ? AND organization_id = ?`,
      [userId, orgId]
    );
    const revoked = await request(app)
      .post('/api/gdpr/export-request')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(revoked.status).toBe(403);
    expect(revoked.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });

    const superAdminWithoutMembership = await request(app)
      .post('/api/gdpr/export-request')
      .set(
        'Authorization',
        `Bearer ${makeToken({ id: '00000000-0000-4000-8000-000000000299', role: 'SUPERADMIN' })}`
      )
      .send({});
    expect(superAdminWithoutMembership.status).toBe(403);
    expect(await countRows()).toEqual(before);

    await db.run(
      `UPDATE organization_members SET status = 'ACTIVE' WHERE user_id = ? AND organization_id = ?`,
      [userId, orgId]
    );
    const originalGet = dbPromiseModule.get;
    const membershipFailure = vi
      .spyOn(dbPromiseModule, 'get')
      .mockImplementation(async (sql: string, params?: unknown[], options?: unknown) => {
        if (/FROM\s+organization_members/i.test(sql))
          throw new Error('forced membership lookup failure');
        return originalGet(sql, params as any[], options as any);
      });
    try {
      const unavailable = await request(app)
        .post('/api/gdpr/export-request')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(unavailable.status).toBe(503);
      expect(unavailable.body).toMatchObject({ code: 'ORG_MEMBERSHIP_UNVERIFIABLE' });
      expect(membershipFailure).toHaveBeenCalled();
      expect(await countRows()).toEqual(before);
    } finally {
      membershipFailure.mockRestore();
    }

    const recovered = await request(app)
      .post('/api/gdpr/export-request')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(recovered.status).toBe(200);
    expect((await countRows()).requests).toBe(before.requests + 1);
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
