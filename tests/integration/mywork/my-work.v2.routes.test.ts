import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

describe('My Work (V2) routes', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-mywork-v2-${workerId}-${Date.now()}.db`);
  const basePath = '/api/my-work';

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let router: any;
  let makeTestApp: any;

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
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

    vi.resetModules();
    ({ makeTestApp } = await import('../_helpers/testApp'));
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    // Minimal schema required by server/src/routes/my-work.routes.ts
    await db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        email TEXT,
        role TEXT
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT
      );
      CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT,
        user_id TEXT,
        PRIMARY KEY (project_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        initiative_id TEXT,
        assignee_id TEXT,
        title TEXT,
        description TEXT,
        status TEXT,
        priority TEXT,
        due_date TEXT,
        task_type TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        title TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        title TEXT,
        message TEXT,
        body TEXT,
        read INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        severity TEXT,
        entity_type TEXT,
        entity_id TEXT,
        project_id TEXT,
        project_name TEXT,
        created_at TEXT,
        read_at TEXT
      );

      CREATE TABLE IF NOT EXISTS my_work_focus_state (
        user_id TEXT NOT NULL,
        focus_date TEXT NOT NULL,
        item_key TEXT NOT NULL,
        column_name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, focus_date, item_key)
      );

      CREATE TABLE IF NOT EXISTS notebook_pages (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        visibility TEXT NOT NULL DEFAULT 'private',
        title TEXT NOT NULL,
        content_json TEXT NOT NULL DEFAULT '{}',
        content_text TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS my_work_signal_prefs (
        user_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        muted_types_json TEXT NOT NULL DEFAULT '[]',
        quiet_hours_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS my_work_signal_snoozes (
        user_id TEXT NOT NULL,
        signal_key TEXT NOT NULL,
        snoozed_until TEXT NOT NULL,
        created_at TEXT,
        PRIMARY KEY (user_id, signal_key)
      );

      CREATE TABLE IF NOT EXISTS my_work_signal_dismissals (
        user_id TEXT NOT NULL,
        signal_key TEXT NOT NULL,
        dismissed_at TEXT NOT NULL,
        PRIMARY KEY (user_id, signal_key)
      );
    `);

    const now = new Date().toISOString();
    await db.run(`INSERT OR REPLACE INTO organizations (id, name) VALUES (?, ?)`, [
      'test-org-id',
      'Test Org',
    ]);
    await db.run(`INSERT OR REPLACE INTO users (id, organization_id, email, role) VALUES (?, ?, ?, ?)`, [
      'test-user-id',
      'test-org-id',
      'test@example.com',
      'admin',
    ]);
    await db.run(`INSERT OR REPLACE INTO projects (id, organization_id, name) VALUES (?, ?, ?)`, [
      'p-1',
      'test-org-id',
      'Project 1',
    ]);
    await db.run(`INSERT OR REPLACE INTO project_members (project_id, user_id) VALUES (?, ?)`, [
      'p-1',
      'test-user-id',
    ]);
    await db.run(`INSERT OR REPLACE INTO initiatives (id, organization_id, name) VALUES (?, ?, ?)`, [
      'i-1',
      'test-org-id',
      'Init 1',
    ]);

    await db.run(
      `INSERT OR REPLACE INTO tasks (
        id, organization_id, project_id, initiative_id, assignee_id,
        title, description, status, priority, due_date, task_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        't-1',
        'test-org-id',
        null,
        null,
        'test-user-id',
        'Personal task',
        'Do the thing',
        'todo',
        'high',
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        'personal',
        now,
        now,
      ]
    );
    await db.run(
      `INSERT OR REPLACE INTO tasks (
        id, organization_id, project_id, initiative_id, assignee_id,
        title, description, status, priority, due_date, task_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        't-2',
        'test-org-id',
        'p-1',
        'i-1',
        'test-user-id',
        'Project task (no due date)',
        '',
        'todo',
        'medium',
        null,
        'execution',
        now,
        now,
      ]
    );

    await db.run(
      `INSERT OR REPLACE INTO notebook_pages (
        id, owner_user_id, organization_id, project_id, visibility,
        title, content_json, content_text, tags_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'nb-1',
        'test-user-id',
        'test-org-id',
        'p-1',
        'project',
        'Seed note',
        JSON.stringify({ type: 'doc', content: [] }),
        'Hello notebook',
        JSON.stringify(['seed']),
        now,
        now,
      ]
    );

    await db.run(
      `INSERT OR REPLACE INTO notifications (
        id, user_id, type, title, message, body, read, is_read, severity,
        entity_type, entity_id, project_id, project_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'n-1',
        'test-user-id',
        'ai_recommendation',
        'AI Recommendation',
        'Try doing X',
        'Try doing X',
        0,
        0,
        'INFO',
        null,
        null,
        'p-1',
        'Project 1',
        now,
      ]
    );

    const today = new Date().toISOString().slice(0, 10);
    await db.run(
      `INSERT OR REPLACE INTO my_work_focus_state (
        user_id, focus_date, item_key, column_name, position, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      ['test-user-id', today, 'task:t-1', 'today', 0, now]
    );

    // Ensure clean signal state even if a previous run crashed
    await db.run(`DELETE FROM my_work_signal_prefs`, []);
    await db.run(`DELETE FROM my_work_signal_snoozes`, []);
    await db.run(`DELETE FROM my_work_signal_dismissals`, []);

    router = (await import('../../../server/src/routes/my-work.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  it('GET /focus/state returns persisted items', async () => {
    const res = await request(mount()).get(`${basePath}/focus/state`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        date: expect.any(String),
        items: [expect.objectContaining({ itemKey: 'task:t-1', column: 'today' })],
      })
    );
  });

  it('DELETE /focus/item removes item for today', async () => {
    const res = await request(mount()).delete(`${basePath}/focus/item`).query({ itemId: 'task:t-1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));

    const after = await request(mount()).get(`${basePath}/focus/state`);
    expect(after.status).toBe(200);
    expect(after.body.items).toEqual([]);
  });

  it('GET /calendar returns tasks for assignee', async () => {
    const res = await request(mount()).get(`${basePath}/calendar`).query({ source: 'all', limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        tasks: expect.arrayContaining([
          expect.objectContaining({ id: 't-1', taskType: 'personal' }),
          expect.objectContaining({ id: 't-2', projectId: 'p-1' }),
        ]),
      })
    );
  });

  it('Notebook CRUD works (private + project)', async () => {
    const list = await request(mount()).get(`${basePath}/notebook/pages`).query({ limit: 50 });
    expect(list.status).toBe(200);
    expect(list.body.pages ?? list.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'nb-1', title: 'Seed note' })])
    );

    const created = await request(mount()).post(`${basePath}/notebook/pages`).send({
      title: 'New page',
      projectId: null,
      visibility: 'private',
      tags: ['a'],
      contentJson: { type: 'doc', content: [] },
      contentText: 'abc',
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ id: expect.any(String), title: 'New page' }));

    const createdId = created.body.id;
    const fetched = await request(mount()).get(`${basePath}/notebook/pages/${encodeURIComponent(createdId)}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(expect.objectContaining({ id: createdId, contentText: 'abc' }));

    const updated = await request(mount())
      .put(`${basePath}/notebook/pages/${encodeURIComponent(createdId)}`)
      .send({ title: 'Renamed', tags: ['b'] });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({ id: createdId, title: 'Renamed', tags: ['b'] }));

    const del = await request(mount()).delete(`${basePath}/notebook/pages/${encodeURIComponent(createdId)}`);
    expect(del.status).toBe(204);
  });

  it('Signals feed derives from unread AI notifications; mute/snooze/dismiss work', async () => {
    const unread = await db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND COALESCE(read, 0) = 0`,
      ['test-user-id']
    );
    expect(Number(unread?.c || 0)).toBe(1);

    const feed = await request(mount()).get(`${basePath}/signals`).query({ limit: 20 });
    expect(feed.status).toBe(200);
    expect(feed.body.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'notification:n-1', type: 'ai_recommendation' })])
    );

    const snooze = await request(mount())
      .post(`${basePath}/signals/${encodeURIComponent('notification:n-1')}/snooze`)
      .send({ preset: '1h' });
    expect(snooze.status).toBe(200);

    const afterSnooze = await request(mount()).get(`${basePath}/signals`).query({ limit: 20 });
    expect(afterSnooze.status).toBe(200);
    expect(afterSnooze.body.signals).toEqual([]);

    // Reset notification to unread again for subsequent checks
    await db.run(`UPDATE notifications SET read = 0, is_read = 0 WHERE id = ?`, ['n-1']);
    await db.run(`DELETE FROM my_work_signal_snoozes WHERE signal_key = ? AND user_id = ?`, [
      'notification:n-1',
      'test-user-id',
    ]);

    const mute = await request(mount()).post(`${basePath}/signals/mute-type`).send({ type: 'AI_RECOMMENDATION' });
    expect(mute.status).toBe(200);
    expect(mute.body).toEqual(expect.objectContaining({ success: true, mutedTypes: ['AI_RECOMMENDATION'] }));

    const afterMute = await request(mount()).get(`${basePath}/signals`).query({ limit: 20 });
    expect(afterMute.status).toBe(200);
    expect(afterMute.body.signals).toEqual([]);

    // Unmute by clearing prefs, then dismiss should mark read
    await db.run(`DELETE FROM my_work_signal_prefs WHERE user_id = ?`, ['test-user-id']);
    await db.run(`UPDATE notifications SET read = 0, is_read = 0 WHERE id = ?`, ['n-1']);

    const dismiss = await request(mount())
      .post(`${basePath}/signals/${encodeURIComponent('notification:n-1')}/dismiss`)
      .send({});
    expect(dismiss.status).toBe(200);

    const dismissed = await db.get<{ signal_key: string }>(
      `SELECT signal_key FROM my_work_signal_dismissals WHERE user_id = ? AND signal_key = ?`,
      ['test-user-id', 'notification:n-1']
    );
    expect(dismissed?.signal_key).toBe('notification:n-1');
  });

});

