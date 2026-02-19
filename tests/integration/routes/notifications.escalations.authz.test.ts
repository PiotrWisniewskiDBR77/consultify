import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Notifications escalations authz (no placeholder logic)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-notifications-escalations-${workerId}.db`);
  const basePath = '/api/notifications';

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let router: any;

  const mount = (user: any, canFn?: (perm: string) => boolean) =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = user;
          if (canFn) (req as any).can = canFn;
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        status TEXT,
        deadline TEXT,
        priority TEXT,
        impact TEXT,
        escalation_level TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await db.run(
      `INSERT OR REPLACE INTO decisions (id, project_id, status, deadline, priority, impact, escalation_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['d-1', 'p-1', 'pending', tenDaysAgo, null, null, null]
    );

    router = (await import('../../../server/src/routes/notifications/notifications.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  it('rejects non-admin user without permission', async () => {
    const app = mount({ id: 'u-1', organizationId: 'o-1', role: 'USER' });
    const res = await request(app).post(`${basePath}/escalations/p-1/run`);
    expect(res.status).toBe(403);
  });

  it('allows admin and updates escalation level', async () => {
    const app = mount({ id: 'u-2', organizationId: 'o-1', role: 'ADMIN' });
    const res = await request(app).post(`${basePath}/escalations/p-1/run`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ projectId: 'p-1' }));

    const row = await db.get(`SELECT escalation_level, status FROM decisions WHERE id = ?`, ['d-1']);
    expect(row?.escalation_level).toBeTruthy();
  });

  it('allows user with explicit permission function', async () => {
    const app = mount(
      { id: 'u-3', organizationId: 'o-1', role: 'USER' },
      (perm) => perm === 'edit_project_settings'
    );
    const res = await request(app).post(`${basePath}/escalations/p-1/run`);
    expect(res.status).toBe(200);
  });
});

