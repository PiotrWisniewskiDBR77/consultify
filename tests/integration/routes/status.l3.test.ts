import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/status.routes.ts';
import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';
  process.env.MOCK_REDIS = 'true';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('Status routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/status', router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  });

  const dispatch = async ({
    method,
    url,
    body,
    headers = {},
    user,
    query,
  }: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    user?: any;
    query?: Record<string, any>;
  }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers,
      body,
      cookies: {},
      path: url,
      query: query || {},
      socket: { remoteAddress: '127.0.0.1' },
    });
    if (user) (req as any).user = user;

    const res = new EventEmitter();
    const chunks: Buffer[] = [];
    const response = {
      status: 200,
      headers: {} as Record<string, string>,
      body: undefined as any,
      text: '',
    };

    Object.assign(res, {
      statusCode: 200,
      setHeader(name: string, value: any) {
        response.headers[String(name).toLowerCase()] = String(value);
      },
      getHeader(name: string) {
        return response.headers[String(name).toLowerCase()];
      },
      writeHead(code: number, hdrs?: Record<string, any>) {
        (res as any).statusCode = code;
        response.status = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) (res as any).setHeader(k, v);
        }
        return res;
      },
      write(chunk: any) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        return true;
      },
      end(chunk: any) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        response.status = (res as any).statusCode || 200;
        response.text = Buffer.concat(chunks).toString('utf8');
        try {
          response.body = response.text ? JSON.parse(response.text) : undefined;
        } catch {
          response.body = undefined;
        }
        res.emit('finish');
        return res;
      },
      json(obj: any) {
        (res as any).setHeader('content-type', 'application/json');
        (res as any).end(JSON.stringify(obj));
      },
      send(obj: any) {
        (res as any).end(obj);
      },
      status(code: number) {
        (res as any).statusCode = code;
        response.status = code;
        return res;
      },
      set(name: string, value: any) {
        (res as any).setHeader(name, value);
        return res;
      },
    });

    return await new Promise<typeof response>((resolve, reject) => {
      res.on('finish', () => resolve(response));
      app.handle(req as any, res as any, (err: any) => {
        if (err) reject(err);
      });
    });
  };

  const dbRun = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
    });

  const dbAll = <T,>(sql: string, params: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err: any, rows: any[]) => (err ? reject(err) : resolve(rows || [])));
    });

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['test-org-id', 'Test Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['other-org-id', 'Other Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['test-user-id', 'test-org-id', 'test@example.com', 'x', 'ADMIN', 'active', 'Test', 'User']
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET / returns 401 when test auth bypass is disabled and no token provided', async () => {
    const prev = process.env.ENABLE_TEST_AUTH_BYPASS;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    try {
      const res = await dispatch({ method: 'GET', url: '/api/status' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(expect.objectContaining({ error: 'No token provided' }));
    } finally {
      process.env.ENABLE_TEST_AUTH_BYPASS = prev;
    }
  });

  it('GET / returns [] when org has no projects', async () => {
    await dbRun(`DELETE FROM projects WHERE organization_id = ?`, ['test-org-id']);
    const res = await dispatch({ method: 'GET', url: '/api/status' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET / returns project rows with open_tasks count', async () => {
    await dbRun(`DELETE FROM tasks`);
    await dbRun(`DELETE FROM projects WHERE organization_id = ?`, ['test-org-id']);

    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, health, progress_pct, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-1', 'test-org-id', 'Project 1', 'active', 'green', 25]
    );

    await dbRun(
      `INSERT INTO tasks (id, organization_id, project_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['t-1', 'test-org-id', 'p-1', 'Open task', 'TODO']
    );
    await dbRun(
      `INSERT INTO tasks (id, organization_id, project_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['t-2', 'test-org-id', 'p-1', 'Done task', 'completed']
    );
    await dbRun(
      `INSERT INTO tasks (id, organization_id, project_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['t-3', 'test-org-id', 'p-1', 'In progress', 'IN_PROGRESS']
    );

    const res = await dispatch({ method: 'GET', url: '/api/status' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: 'p-1',
        name: 'Project 1',
        status: 'active',
        health: 'green',
        progress_pct: 25,
        open_tasks: 2,
      })
    );
  });

  it('GET / returns only the current org projects and orders by updated_at DESC', async () => {
    await dbRun(`DELETE FROM projects`);
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, health, progress_pct, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '-2 days'))`,
      ['p-old', 'test-org-id', 'Old', 'active', 'green', 10]
    );
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, health, progress_pct, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-new', 'test-org-id', 'New', 'active', 'yellow', 20]
    );
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-other', 'other-org-id', 'Other', 'active']
    );

    const res = await dispatch({ method: 'GET', url: '/api/status' });
    expect(res.status).toBe(200);
    expect(res.body.map((p: any) => p.id)).toEqual(['p-new', 'p-old']);
  });

  it('GET / returns [] when organizationId is undefined', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/status',
      user: { id: 'test-user-id' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /overview returns defaults when projects table is missing (DbPromise get fallback)', async () => {
    await dbRun(`ALTER TABLE projects RENAME TO projects_tmp_status`);
    try {
      const res = await dispatch({ method: 'GET', url: '/api/status/overview' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 0,
        active: 0,
        completed: 0,
        at_risk: 0,
        avg_progress: 0,
      });
    } finally {
      await dbRun(`ALTER TABLE projects_tmp_status RENAME TO projects`);
    }
  });

  it('GET /overview returns counts and avg_progress for org projects', async () => {
    await dbRun(`DELETE FROM projects WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, health, progress_pct, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-a', 'test-org-id', 'A', 'active', 'red', 10]
    );
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, health, progress_pct, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-b', 'test-org-id', 'B', 'completed', 'green', 90]
    );
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, health, progress_pct, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-c', 'test-org-id', 'C', 'active', 'green', 50]
    );

    const res = await dispatch({ method: 'GET', url: '/api/status/overview' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        total: 3,
        active: 2,
        completed: 1,
        at_risk: 1,
      })
    );
    expect(Number(res.body.avg_progress)).toBeGreaterThan(0);
  });

  it('PUT /:id updates status, health, progressPct and updated_at', async () => {
    await dbRun(`DELETE FROM projects WHERE id = ?`, ['p-upd']);
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, health, progress_pct, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '-5 days'))`,
      ['p-upd', 'test-org-id', 'Upd', 'active', 'green', 10]
    );

    const res = await dispatch({
      method: 'PUT',
      url: '/api/status/p-upd',
      body: { status: 'completed', health: 'red', progressPct: 0 },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const rows = await dbAll<any>(
      `SELECT status, health, progress_pct, updated_at FROM projects WHERE id = ?`,
      ['p-upd']
    );
    expect(rows[0]).toEqual(
      expect.objectContaining({ status: 'completed', health: 'red', progress_pct: 0 })
    );
    expect(rows[0].updated_at).toBeTruthy();
  });

  it('PUT /:id succeeds even when body is empty (updated_at only)', async () => {
    await dbRun(`DELETE FROM projects WHERE id = ?`, ['p-upd2']);
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '-5 days'))`,
      ['p-upd2', 'test-org-id', 'Upd2', 'active']
    );
    const res = await dispatch({ method: 'PUT', url: '/api/status/p-upd2', body: {} });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});
