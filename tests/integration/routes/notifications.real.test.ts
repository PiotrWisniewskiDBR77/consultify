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
  all: (sql: string, params?: unknown[]) => Promise<any[]>;
};

const RUN_REAL_DB = process.env.RUN_DB_TESTS === '1';
const describeRealDb = RUN_REAL_DB ? describe : describe.skip;

describeRealDb('Notifications routes (real DB)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-notifications-${workerId}.db`);
  const basePath = '/api/notifications';

  let db: DbHandle;
  let resetConnection: () => Promise<void>;
  let router: any;

  const mount = () => makeTestApp({ mountPath: basePath, router });

  const orgId = 'org-notif-1';
  const userId = 'user-notif-1';
  const adminId = 'admin-notif-1';

  const makeToken = (id: string, role: string) =>
    jwt.sign(
      { id, role, organizationId: orgId, email: `${id}@local.test`, name: 'Test User' },
      config.JWT_SECRET
    );

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'postgres';

    vi.resetModules();

    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    await db.query('SELECT 1');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT,
        plan TEXT,
        status TEXT
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        email TEXT,
        password TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT,
        status TEXT
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        global_enabled BOOLEAN DEFAULT TRUE,
        quiet_hours_enabled BOOLEAN DEFAULT FALSE,
        quiet_hours_start TEXT DEFAULT '22:00',
        quiet_hours_end TEXT DEFAULT '08:00',
        quiet_hours_timezone TEXT DEFAULT 'UTC',
        quiet_hours_weekends_only BOOLEAN DEFAULT FALSE,
        email_enabled BOOLEAN DEFAULT TRUE,
        email_digest_enabled BOOLEAN DEFAULT FALSE,
        email_digest_frequency TEXT DEFAULT 'daily',
        email_digest_time TEXT DEFAULT '09:00',
        email_digest_day TEXT DEFAULT 'monday',
        type_settings TEXT DEFAULT '{}',
        slack_enabled BOOLEAN DEFAULT TRUE,
        slack_dm_enabled BOOLEAN DEFAULT TRUE,
        teams_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        message TEXT,
        priority TEXT DEFAULT 'normal',
        severity TEXT,
        category TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    router = (await import('../../../server/src/routes/notifications/notifications.routes.ts'))
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
      DELETE FROM notifications;
      DELETE FROM notification_preferences;
      DELETE FROM users;
      DELETE FROM organizations;
    `);
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      orgId,
      'Notif Org',
      'free',
      'active',
    ]);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, orgId, 'user@local.test', 'User', 'One', 'USER', 'active']
    );
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [adminId, orgId, 'admin@local.test', 'Admin', 'One', 'ADMIN', 'active']
    );
    await db.run(
      `INSERT INTO notifications (id, user_id, organization_id, type, title, body, message, priority, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['notif-1', userId, orgId, 'TASK_OVERDUE', 'Task Overdue', 'Body 1', 'Msg', 'high', false]
    );
    await db.run(
      `INSERT INTO notifications (id, user_id, organization_id, type, title, body, message, priority, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['notif-2', userId, orgId, 'SYSTEM_ALERT', 'System Alert', 'Body 2', 'Msg2', 'urgent', true]
    );
  });

  it('GET /api/notifications returns only user notifications', async () => {
    const token = makeToken(userId, 'USER');
    const res = await request(mount())
      .get(basePath)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((n: any) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['notif-1', 'notif-2']));
  });

  it('GET /api/notifications/counts returns unread counts', async () => {
    const token = makeToken(userId, 'USER');
    const res = await request(mount())
      .get(`${basePath}/counts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        unread: expect.any(Number),
      })
    );
    expect(res.body.unread).toBe(1);
  });

  it('PATCH /api/notifications/preferences updates and returns preferences', async () => {
    const token = makeToken(userId, 'USER');
    const res = await request(mount())
      .patch(`${basePath}/preferences`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emailEnabled: false, quietHoursEnabled: true, quietHoursStart: '21:00' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        emailEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: '21:00',
      })
    );
  });

  it('POST /api/notifications/broadcast sends to org users for admin', async () => {
    const token = makeToken(adminId, 'ADMIN');
    const res = await request(mount())
      .post(`${basePath}/broadcast`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'SYSTEM_ALERT', title: 'System Alert', body: 'Attention' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));

    const rows = await db.all(`SELECT id FROM notifications WHERE organization_id = ?`, [orgId]);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
