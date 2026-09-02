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
        organization_id TEXT,
        title TEXT,
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

    // Security fix (2026-09-01, AUDYT_RODZINY_TRAS_UPRAWNIENIA.md family #3):
    // GET/POST /notifications/escalations/:projectId(/run) now verify the
    // projectId belongs to the caller's organization before touching
    // `decisions` — seed a matching `projects` row so the existing
    // role-gating assertions below (unrelated to the org-boundary check)
    // keep passing. The org-boundary itself is covered against a real
    // Postgres database in notifications.escalations.idor.realdb.test.ts.
    await db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT
      );
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT
      );
    `);
    // On a real (non-sqlite) database these tables already exist with a real
    // schema/FK — CREATE TABLE IF NOT EXISTS is then a no-op, so `projects`
    // still enforces organization_id -> organizations(id). Seed the parent
    // row too, regardless of backend.
    await db.run(`INSERT OR REPLACE INTO organizations (id, name) VALUES (?, ?)`, [
      'o-1',
      'Escalations Authz Test Org',
    ]);
    await db.run(`INSERT OR REPLACE INTO projects (id, organization_id) VALUES (?, ?)`, [
      'p-1',
      'o-1',
    ]);

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    // organization_id included (in addition to project_id) so this insert
    // also succeeds against a real (non-sqlite) `decisions` table, where the
    // column is NOT NULL with no default.
    await db.run(
      `INSERT OR REPLACE INTO decisions (id, organization_id, title, project_id, status, deadline, priority, impact, escalation_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['d-1', 'o-1', 'Escalations Authz Test Decision', 'p-1', 'pending', tenDaysAgo, null, null, null]
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

