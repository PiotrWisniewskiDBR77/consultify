import os from 'node:os';
import path from 'node:path';

import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

describe('Trial routes (no mocks, honest availability)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-trial-${workerId}.db`);
  const basePath = '/api/trial';

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let router: any;

  const tokenFor = (user: { id: string; role?: string; organizationId?: string }) => {
    const secret = process.env.JWT_SECRET || 'test-secret';
    return jwt.sign(
      {
        id: user.id,
        role: user.role || 'ADMIN',
        organizationId: user.organizationId || 'o-1',
      },
      secret
    );
  };

  const mount = () =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

    vi.resetModules();
    const dbMod = await import('../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        actor_type TEXT,
        actor_id TEXT,
        actor_email TEXT,
        actor_name TEXT,
        actor_ip TEXT,
        actor_user_agent TEXT,
        action TEXT,
        action_category TEXT,
        action_description TEXT,
        resource_type TEXT,
        resource_id TEXT,
        resource_name TEXT,
        organization_id TEXT,
        project_id TEXT,
        previous_values TEXT,
        new_values TEXT,
        changed_fields TEXT,
        metadata TEXT,
        request_id TEXT,
        result TEXT,
        error_message TEXT,
        retention_category TEXT
      );
    `);

    router = (await import('../../server/src/routes/trial.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  it('POST /:trialId/convert returns 400 when newOrgName is missing', async () => {
    const token = tokenFor({ id: 'u1' });
    const res = await request(mount())
      .post(`${basePath}/t1/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /:trialId/convert returns 401 when token is missing', async () => {
    const res = await request(mount()).post(`${basePath}/t1/convert`).send({ newOrgName: 'X' });
    expect(res.status).toBe(401);
  });

  it('POST /:trialId/convert returns 503 when TrialService is unavailable', async () => {
    const token = tokenFor({ id: 'u1' });
    const res = await request(mount())
      .post(`${basePath}/t1/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newOrgName: 'Acme' });
    expect(res.status).toBe(503);
  });

  it('POST /confirm-transition returns 400 when confirmations are incomplete', async () => {
    const token = tokenFor({ id: 'u1' });
    const res = await request(mount())
      .post(`${basePath}/confirm-transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmations: { timeCommitment: true, teamScope: true },
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ required: expect.any(Array) }));
  });

  it('POST /confirm-transition writes audit_log when confirmations are valid', async () => {
    const token = tokenFor({ id: 'u1' });
    const res = await request(mount())
      .post(`${basePath}/confirm-transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmations: { timeCommitment: true, teamScope: true, memoryAware: true },
        confirmedAt: '2026-01-01T00:00:00.000Z',
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, nextStep: 'ORG_SETUP_WIZARD' })
    );

    const row = await db.get<{ c: number }>(`SELECT COUNT(*) as c FROM audit_log`, []);
    expect(row?.c).toBeGreaterThan(0);
  });
});
