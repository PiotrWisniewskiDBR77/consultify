import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/status-reports.routes.ts';
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

describe('Status reports routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/status-reports', router);
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

  const dbGet = <T,>(sql: string, params: any[] = []) =>
    new Promise<T | undefined>((resolve, reject) => {
      db.get(sql, params, (err: any, row: any) => (err ? reject(err) : resolve(row)));
    });

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['test-org-id', 'Test Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['test-user-id', 'test-org-id', 'test@example.com', 'x', 'ADMIN', 'active', 'Test', 'User']
    );
    await dbRun(
      `INSERT OR IGNORE INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-1', 'test-org-id', 'Project 1', 'active']
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET / returns [] when no reports exist', async () => {
    await dbRun(`DELETE FROM status_reports WHERE organization_id = ?`, ['test-org-id']);
    const res = await dispatch({ method: 'GET', url: '/api/status-reports' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST / creates report with defaults when optional fields are missing', async () => {
    await dbRun(`DELETE FROM status_reports WHERE organization_id = ?`, ['test-org-id']);
    const res = await dispatch({
      method: 'POST',
      url: '/api/status-reports',
      body: { projectId: 'p-1' },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));

    const row = await dbGet<any>(`SELECT * FROM status_reports WHERE id = ?`, [res.body.id]);
    expect(row).toEqual(
      expect.objectContaining({
        organization_id: 'test-org-id',
        project_id: 'p-1',
        title: 'Status Report',
        health: 'green',
        period: 'weekly',
        created_by: 'test-user-id',
      })
    );
    expect(JSON.parse(row.content)).toEqual({});
  });

  it('POST / persists provided title/content/health/period', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/status-reports',
      body: {
        projectId: 'p-1',
        title: 'Week 1',
        content: { wins: ['x'] },
        health: 'red',
        period: 'monthly',
      },
    });
    expect(res.status).toBe(201);
    const row = await dbGet<any>(`SELECT * FROM status_reports WHERE id = ?`, [res.body.id]);
    expect(row.title).toBe('Week 1');
    expect(row.health).toBe('red');
    expect(row.period).toBe('monthly');
    expect(JSON.parse(row.content)).toEqual({ wins: ['x'] });
  });

  it('GET / returns reports ordered by created_at DESC', async () => {
    await dbRun(`DELETE FROM status_reports WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO status_reports (id, organization_id, project_id, title, content, health, period, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))`,
      ['sr-old', 'test-org-id', 'p-1', 'Old', '{}', 'green', 'weekly', 'test-user-id']
    );
    await dbRun(
      `INSERT INTO status_reports (id, organization_id, project_id, title, content, health, period, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['sr-new', 'test-org-id', 'p-1', 'New', '{}', 'yellow', 'weekly', 'test-user-id']
    );

    const res = await dispatch({ method: 'GET', url: '/api/status-reports' });
    expect(res.status).toBe(200);
    expect(res.body.map((r: any) => r.id)).toEqual(['sr-new', 'sr-old']);
  });

  it('GET / supports projectId filter', async () => {
    await dbRun(`DELETE FROM status_reports WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['p-2', 'test-org-id', 'Project 2', 'active']
    );
    await dbRun(
      `INSERT INTO status_reports (id, organization_id, project_id, title, content, health, period, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['sr-p1', 'test-org-id', 'p-1', 'P1', '{}', 'green', 'weekly', 'test-user-id']
    );
    await dbRun(
      `INSERT INTO status_reports (id, organization_id, project_id, title, content, health, period, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['sr-p2', 'test-org-id', 'p-2', 'P2', '{}', 'green', 'weekly', 'test-user-id']
    );

    const res = await dispatch({
      method: 'GET',
      url: '/api/status-reports',
      query: { projectId: 'p-1' },
    });
    expect(res.status).toBe(200);
    expect(res.body.map((r: any) => r.id)).toEqual(['sr-p1']);
  });

  it('DELETE /:id deletes a report', async () => {
    await dbRun(
      `INSERT OR REPLACE INTO status_reports (id, organization_id, project_id, title, content, health, period, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['sr-del', 'test-org-id', 'p-1', 'Del', '{}', 'green', 'weekly', 'test-user-id']
    );
    const del = await dispatch({ method: 'DELETE', url: '/api/status-reports/sr-del' });
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ success: true });
    const row = await dbGet<any>(`SELECT id FROM status_reports WHERE id = ?`, ['sr-del']);
    expect(row).toBeNull();
  });

  it('GET / returns [] when status_reports table is missing (DbPromise all fallback)', async () => {
    await dbRun(`ALTER TABLE status_reports RENAME TO status_reports_tmp`);
    try {
      const res = await dispatch({ method: 'GET', url: '/api/status-reports' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    } finally {
      await dbRun(`ALTER TABLE status_reports_tmp RENAME TO status_reports`);
    }
  });

  it('POST / still returns 201 even when insert fails (DbPromise run fallback)', async () => {
    await dbRun(`ALTER TABLE status_reports RENAME TO status_reports_tmp2`);
    try {
      const res = await dispatch({
        method: 'POST',
        url: '/api/status-reports',
        body: { projectId: 'p-1', title: 'Should not persist' },
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
    } finally {
      await dbRun(`ALTER TABLE status_reports_tmp2 RENAME TO status_reports`);
    }
  });

  it('DELETE /:id fails closed when the table is missing', async () => {
    await dbRun(`ALTER TABLE status_reports RENAME TO status_reports_tmp3`);
    try {
      const res = await dispatch({ method: 'DELETE', url: '/api/status-reports/any' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Report not found' });
    } finally {
      await dbRun(`ALTER TABLE status_reports_tmp3 RENAME TO status_reports`);
    }
  });
});
