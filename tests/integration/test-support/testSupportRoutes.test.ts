import os from 'node:os';
import path from 'node:path';

import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';
import config from '../../../server/src/config/Config.js';

type DbHandle = {
  exec: (sql: string) => Promise<unknown>;
  run: (sql: string, params?: unknown[]) => Promise<unknown>;
  get: (sql: string, params?: unknown[]) => Promise<any>;
};

describe('Test-support routes', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-test-support-${workerId}.db`);
  const basePath = '/api/test-support';

  let db: DbHandle;
  let resetConnection: () => Promise<void>;
  let router: any;

  const mount = () => makeTestApp({ mountPath: basePath, router });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;

    vi.resetModules();

    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    // Minimal schema required by bootstrap/cleanup
    await db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT,
        plan TEXT,
        status TEXT,
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        email TEXT,
        password TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        permission_scope TEXT
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT
      );
    `);

    router = (await import('../../../server/src/routes/testSupport.routes.ts')).default;
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
      DELETE FROM projects;
      DELETE FROM organization_members;
      DELETE FROM users;
      DELETE FROM organizations;
      DROP TABLE IF EXISTS test_support_runs;
    `);
    delete process.env.ENABLE_TEST_SUPPORT;
    delete process.env.TEST_SUPPORT_KEY;
  });

  it('returns 404 when not enabled', async () => {
    const res = await request(mount()).post(`${basePath}/bootstrap`).send({ runId: 'r1' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when key missing/invalid', async () => {
    process.env.ENABLE_TEST_SUPPORT = 'true';
    process.env.TEST_SUPPORT_KEY = 'super-secret-key-123';

    const res1 = await request(mount()).post(`${basePath}/bootstrap`).send({ runId: 'r1' });
    expect(res1.status).toBe(404);

    const res2 = await request(mount())
      .post(`${basePath}/bootstrap`)
      .set('x-test-support-key', 'wrong')
      .send({ runId: 'r1' });
    expect(res2.status).toBe(404);
  });

  it('bootstrap creates tenant, returns token, and cleanup purges org-scoped rows', async () => {
    process.env.ENABLE_TEST_SUPPORT = 'true';
    process.env.TEST_SUPPORT_KEY = 'super-secret-key-123';

    const boot = await request(mount())
      .post(`${basePath}/bootstrap`)
      .set('x-test-support-key', process.env.TEST_SUPPORT_KEY)
      .send({ runId: 'run-1' });
    expect(boot.status).toBe(200);
    expect(boot.body).toEqual(
      expect.objectContaining({
        runId: 'run-1',
        organizationId: expect.any(String),
        userId: expect.any(String),
        token: expect.any(String),
      })
    );

    const orgId = String(boot.body.organizationId);
    const userId = String(boot.body.userId);
    const token = String(boot.body.token);

    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    expect(decoded).toEqual(
      expect.objectContaining({
        id: userId,
        organizationId: orgId,
        role: 'ADMIN',
      })
    );

    // Seed an org-scoped table to prove cleanup uses the org column scan.
    await db.run(`INSERT INTO projects (id, organization_id, name) VALUES (?, ?, ?)`, [
      'p1',
      orgId,
      'Test Project',
    ]);

    const before = await db.get(`SELECT COUNT(*) as c FROM projects WHERE organization_id = ?`, [
      orgId,
    ]);
    expect(Number(before?.c || 0)).toBe(1);

    const cleanup = await request(mount())
      .post(`${basePath}/cleanup`)
      .set('x-test-support-key', process.env.TEST_SUPPORT_KEY)
      .send({ runId: 'run-1' });
    expect(cleanup.status).toBe(200);
    expect(cleanup.body).toEqual(expect.objectContaining({ ok: true, runId: 'run-1', deleted: true }));

    const org = await db.get(`SELECT id FROM organizations WHERE id = ?`, [orgId]);
    const user = await db.get(`SELECT id FROM users WHERE id = ?`, [userId]);
    const after = await db.get(`SELECT COUNT(*) as c FROM projects WHERE organization_id = ?`, [
      orgId,
    ]);
    expect(org).toBeUndefined();
    expect(user).toBeUndefined();
    expect(Number(after?.c || 0)).toBe(0);

    const cleanup2 = await request(mount())
      .post(`${basePath}/cleanup`)
      .set('x-test-support-key', process.env.TEST_SUPPORT_KEY)
      .send({ runId: 'run-1' });
    expect(cleanup2.status).toBe(200);
    expect(cleanup2.body).toEqual(expect.objectContaining({ ok: true, deleted: false }));
  });
});
