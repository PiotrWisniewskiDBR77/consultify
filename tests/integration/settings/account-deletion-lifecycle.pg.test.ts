import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

describe('SET-MVP-DELETE-001 approved request/cancel/status lifecycle', () => {
  const previousEnv = { ...process.env };
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = 'settings-delete-test-secret-1234567890';
  const orgId = '10000000-0000-4000-8000-000000000001';
  const userId = '10000000-0000-4000-8000-000000000002';
  const foreignOrgId = '10000000-0000-4000-8000-000000000003';
  const foreignUserId = '10000000-0000-4000-8000-000000000004';
  const password = 'SettingsDelete1!';
  let pool: pg.Pool;
  let client: pg.PoolClient;
  let resetConnection: () => Promise<void>;
  let settingsRouter: any;

  const token = (id = userId, organizationId = orgId) =>
    jwt.sign({ id, organizationId, email: `${id}@test.local`, role: 'ADMIN' }, jwtSecret, {
      expiresIn: '1h',
    });

  const app = () => {
    const instance = express();
    instance.use(express.json());
    instance.use('/api/settings', settingsRouter);
    return instance;
  };

  const cleanup = async () => {
    await client.query('BEGIN');
    try {
      await client.query(
        'ALTER TABLE account_deletion_request_receipts DISABLE TRIGGER trg_account_deletion_request_receipts_immutable'
      );
      await client.query(
        'DELETE FROM account_deletion_request_receipts WHERE user_id = ANY($1::text[])',
        [[userId, foreignUserId]]
      );
      await client.query("DELETE FROM gdpr_requests WHERE user_id = ANY($1::text[]) AND type = 'deletion'", [
        [userId, foreignUserId],
      ]);
      await client.query('DELETE FROM organization_members WHERE user_id = ANY($1::text[])', [
        [userId, foreignUserId],
      ]);
      await client.query('DELETE FROM users WHERE id = ANY($1::text[])', [[userId, foreignUserId]]);
      await client.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [
        [orgId, foreignOrgId],
      ]);
      await client.query(
        'ALTER TABLE account_deletion_request_receipts ENABLE TRIGGER trg_account_deletion_request_receipts_immutable'
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('DATABASE_URL is required');
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    process.env.JWT_SECRET = jwtSecret;
    const allowedPrefix = process.env.SET_DELETE_DISPOSABLE_DB_PREFIX;
    if (!allowedPrefix) throw new Error('SET_DELETE_DISPOSABLE_DB_PREFIX is required');
    pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    client = await pool.connect();
    const databaseName = (await client.query<{ current_database: string }>('SELECT current_database()'))
      .rows[0]!.current_database;
    expect(databaseName.startsWith(allowedPrefix)).toBe(true);
    await client.query("SELECT pg_advisory_lock(hashtext('SET-MVP-DELETE-001'))");
    vi.resetModules();
    const databaseModule = await import('../../../server/src/database/Database.js');
    resetConnection = databaseModule.resetConnection;
    await resetConnection();
    settingsRouter = (await import('../../../server/src/routes/settings.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await cleanup();
      await resetConnection?.();
      expect(
        (await client.query<{ unlocked: boolean }>("SELECT pg_advisory_unlock(hashtext('SET-MVP-DELETE-001')) unlocked"))
          .rows[0]!.unlocked
      ).toBe(true);
    } finally {
      client?.release();
      await pool?.end();
      process.env = previousEnv;
    }
  });

  beforeEach(async () => {
    await cleanup();
    const hash = bcrypt.hashSync(password, 4);
    await client.query('INSERT INTO organizations (id, name) VALUES ($1, $2), ($3, $4)', [
      orgId,
      'Delete Lifecycle',
      foreignOrgId,
      'Foreign Delete Lifecycle',
    ]);
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, password, role)
       VALUES ($1, $2, $3, 'Delete', 'Owner', $4, 'ADMIN'),
              ($5, $6, $7, 'Foreign', 'Owner', $4, 'ADMIN')`,
      [userId, orgId, 'delete@test.local', hash, foreignUserId, foreignOrgId, 'foreign-delete@test.local']
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (gen_random_uuid(), $1, $2, 'ADMIN', 'ACTIVE'),
              (gen_random_uuid(), $3, $4, 'ADMIN', 'ACTIVE')`,
      [orgId, userId, foreignOrgId, foreignUserId]
    );
  });

  it('reauthenticates, deduplicates retry, survives cold status and records immutable receipts', async () => {
    const first = await request(app())
      .post('/api/settings/gdpr/deletion-request')
      .set('Authorization', `Bearer ${token()}`)
      .send({ password });
    expect(first.status).toBe(200);
    expect(first.body.request).toMatchObject({ id: expect.any(String), status: 'pending', scheduledAt: null });

    const retry = await request(app())
      .post('/api/settings/gdpr/deletion-request')
      .set('Authorization', `Bearer ${token()}`)
      .send({ password });
    expect(retry.status).toBe(200);
    expect(retry.body.request.id).toBe(first.body.request.id);

    const cold = await request(app())
      .get('/api/settings/gdpr/deletion-status')
      .set('Authorization', `Bearer ${token()}`);
    expect(cold.status).toBe(200);
    expect(cold.body.request.id).toBe(first.body.request.id);

    const counts = await client.query<{ requests: number; receipts: number }>(
      `SELECT
        (SELECT count(*)::int FROM gdpr_requests WHERE user_id = $1 AND type = 'deletion') requests,
        (SELECT count(*)::int FROM account_deletion_request_receipts WHERE user_id = $1) receipts`,
      [userId]
    );
    expect(counts.rows[0]).toEqual({ requests: 1, receipts: 1 });
    await expect(
      client.query('UPDATE account_deletion_request_receipts SET event_type = event_type WHERE user_id = $1', [userId])
    ).rejects.toThrow(/immutable/);
  });

  it('cancels only the exact owned request and cold read-back becomes empty', async () => {
    const created = await request(app())
      .post('/api/settings/gdpr/deletion-request')
      .set('Authorization', `Bearer ${token()}`)
      .send({ password });
    const requestId = created.body.request.id;

    const foreignAttempt = await request(app())
      .post('/api/settings/gdpr/cancel-deletion')
      .set('Authorization', `Bearer ${token(foreignUserId, foreignOrgId)}`)
      .send({ requestId });
    expect(foreignAttempt.status).toBe(404);

    const cancelled = await request(app())
      .post('/api/settings/gdpr/cancel-deletion')
      .set('Authorization', `Bearer ${token()}`)
      .send({ requestId });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.request).toEqual({ id: requestId, status: 'cancelled' });

    const cold = await request(app())
      .get('/api/settings/gdpr/deletion-status')
      .set('Authorization', `Bearer ${token()}`);
    expect(cold.body).toEqual({ request: null });
    const events = await client.query<{ event_type: string }>(
      'SELECT event_type FROM account_deletion_request_receipts WHERE request_id = $1 ORDER BY occurred_at',
      [requestId]
    );
    expect(events.rows.map((row) => row.event_type)).toEqual(['requested', 'cancelled']);
  });

  it('fails closed for revoked membership and writes nothing', async () => {
    await client.query('UPDATE organization_members SET status = $1 WHERE user_id = $2', ['REVOKED', userId]);
    const denied = await request(app())
      .post('/api/settings/gdpr/deletion-request')
      .set('Authorization', `Bearer ${token()}`)
      .send({ password });
    expect(denied.status).toBe(403);
    const count = await client.query<{ n: number }>(
      "SELECT count(*)::int n FROM gdpr_requests WHERE user_id = $1 AND type = 'deletion'",
      [userId]
    );
    expect(count.rows[0]!.n).toBe(0);
  });

  it('has no destructive executor and cannot mutate the user through a guessed route', async () => {
    const created = await request(app())
      .post('/api/settings/gdpr/deletion-request')
      .set('Authorization', `Bearer ${token()}`)
      .send({ password });
    expect(created.status).toBe(200);

    for (const path of [
      '/api/settings/gdpr/execute-deletion',
      `/api/settings/gdpr/deletion-request/${created.body.request.id}/execute`,
      '/api/settings/gdpr/purge-account',
    ]) {
      const denied = await request(app())
        .post(path)
        .set('Authorization', `Bearer ${token()}`)
        .send({});
      expect(denied.status, path).toBe(404);
    }
    const user = await client.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
    expect(user.rows).toEqual([{ id: userId }]);
    const requestRow = await client.query<{ status: string; scheduled_at: string | null }>(
      'SELECT status, scheduled_at FROM gdpr_requests WHERE id = $1',
      [created.body.request.id]
    );
    expect(requestRow.rows).toEqual([{ status: 'pending', scheduled_at: null }]);
  });
});
