import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres';

describe('Settings/GDPR routes (no stub responses)', () => {
  const prevEnv = { ...process.env };
  let pool: Pool;
  let db: any;
  let settingsRouter: any;
  let gdprRouter: any;
  let userControlsRouter: any;

  const userId = 'u-gdpr-1';
  const orgId = 'org-gdpr-settings-1';
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
    process.env.DB_TYPE = 'postgres';
    process.env.JWT_SECRET = jwtSecret;

    vi.resetModules();
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const bind = (sql: string) => {
      let i = 0;
      return sql.replace(/\?/g, () => `$${++i}`);
    };
    db = {
      get: async (sql: string, params: unknown[] = []) =>
        (await pool.query(bind(sql), params)).rows[0] ?? null,
      run: async (sql: string, params: unknown[] = []) => pool.query(bind(sql), params),
    };

    settingsRouter = (await import('../../../server/src/routes/settings.routes.ts')).default;
    gdprRouter = (await import('../../../server/src/routes/gdpr.routes.ts')).default;
    userControlsRouter = (
      await import('../../../server/src/routes/user/user-data-controls.routes.ts')
    ).default;
  });

  afterAll(async () => {
    try {
      await pool?.query(`DELETE FROM gdpr_requests WHERE user_id = $1`, [userId]);
      await pool?.query(`DELETE FROM data_export_requests WHERE user_id = $1`, [userId]);
      await pool?.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await pool?.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
      await pool?.end();
    } finally {
      process.env = prevEnv;
    }
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM gdpr_requests WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM data_export_requests WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
      [orgId, 'GDPR Settings Org']
    );
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

  it('POST /api/settings/gdpr/deletion-request creates a real request', async () => {
    // The passwordless duplicate POST /api/settings/request-deletion was removed
    // (M25 L-02). The canonical bcrypt-gated endpoint writes to gdpr_requests.
    const res = await request(makeApp())
      .post('/api/settings/gdpr/deletion-request')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ reason: 'test', password: userPassword });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
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
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ exportDate: expect.any(String) }));
    expect(res.body.user).toEqual(expect.objectContaining({ id: userId }));
  });
});
