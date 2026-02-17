import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/audit.routes.ts';
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

describe('Audit routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/audit', router);
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
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['test-user-id', 'test-org-id', 'test@example.com', 'x', 'ADMIN', 'active', 'Test', 'User']
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  const adminUser = { id: 'test-user-id', organizationId: 'test-org-id', role: 'admin' };
  const nonAdminUser = { id: 'test-user-id', organizationId: 'test-org-id', role: 'user' };

  it('GET / returns 403 for non-admin role', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/audit',
      user: nonAdminUser,
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Admin access required' }));
  });

  it('GET / returns [] when there are no audits', async () => {
    await dbRun(`DELETE FROM audits WHERE organization_id = ?`, ['test-org-id']);
    const res = await dispatch({ method: 'GET', url: '/api/audit', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST / returns 400 when name is missing', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/audit',
      user: adminUser,
      body: { type: 'internal' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Name required' }));
  });

  it('POST / creates an audit with defaults (type=internal, auditor="")', async () => {
    await dbRun(`DELETE FROM audits WHERE organization_id = ?`, ['test-org-id']);
    const res = await dispatch({
      method: 'POST',
      url: '/api/audit',
      user: adminUser,
      body: { name: 'Q1 Audit', scheduledDate: '2026-02-17' },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));

    const rows = await dbAll<any>(`SELECT * FROM audits WHERE id = ?`, [res.body.id]);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: res.body.id,
        organization_id: 'test-org-id',
        name: 'Q1 Audit',
        type: 'internal',
        status: 'planned',
        auditor: '',
        scheduled_date: '2026-02-17',
      })
    );
  });

  it('POST / persists provided type and auditor', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/audit',
      user: adminUser,
      body: { name: 'External Audit', type: 'external', auditor: 'Big4', scheduledDate: null },
    });
    expect(res.status).toBe(201);

    const rows = await dbAll<any>(`SELECT * FROM audits WHERE id = ?`, [res.body.id]);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        type: 'external',
        auditor: 'Big4',
      })
    );
  });

  it('PUT /:id returns 400 when no updates are provided', async () => {
    const res = await dispatch({
      method: 'PUT',
      url: '/api/audit/does-not-matter',
      user: adminUser,
      body: {},
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'No updates' }));
  });

  it('PUT /:id updates status and sets completed_date when status=completed', async () => {
    await dbRun(`DELETE FROM audits WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO audits (id, organization_id, name, type, status, auditor, scheduled_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))`,
      ['a-1', 'test-org-id', 'A1', 'internal', 'planned', '', null]
    );

    const res = await dispatch({
      method: 'PUT',
      url: '/api/audit/a-1',
      user: adminUser,
      body: { status: 'completed' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));

    const rows = await dbAll<any>(`SELECT status, completed_date FROM audits WHERE id = ?`, ['a-1']);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].completed_date).toBeTruthy();
  });

  it('PUT /:id updates score and findings (JSON)', async () => {
    await dbRun(
      `INSERT OR REPLACE INTO audits (id, organization_id, name, type, status, auditor, scheduled_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['a-2', 'test-org-id', 'A2', 'internal', 'planned', '', null]
    );

    const findings = [{ id: 'f1', severity: 'high' }];
    const res = await dispatch({
      method: 'PUT',
      url: '/api/audit/a-2',
      user: adminUser,
      body: { score: 88, findings },
    });
    expect(res.status).toBe(200);

    const rows = await dbAll<any>(`SELECT score, findings FROM audits WHERE id = ?`, ['a-2']);
    expect(rows[0].score).toBe(88);
    expect(JSON.parse(rows[0].findings)).toEqual(findings);
  });

  it('PUT /:id can update multiple fields at once', async () => {
    await dbRun(
      `INSERT OR REPLACE INTO audits (id, organization_id, name, type, status, auditor, scheduled_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['a-3', 'test-org-id', 'A3', 'internal', 'planned', '', null]
    );

    const res = await dispatch({
      method: 'PUT',
      url: '/api/audit/a-3',
      user: adminUser,
      body: { status: 'in_progress', score: 50, findings: { ok: true } },
    });
    expect(res.status).toBe(200);

    const rows = await dbAll<any>(`SELECT status, score, findings FROM audits WHERE id = ?`, ['a-3']);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        score: 50,
      })
    );
    expect(JSON.parse(rows[0].findings)).toEqual({ ok: true });
  });

  it('GET / returns audits ordered by created_at DESC', async () => {
    await dbRun(`DELETE FROM audits WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO audits (id, organization_id, name, type, status, auditor, scheduled_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))`,
      ['a-old', 'test-org-id', 'Old', 'internal', 'planned', '', null]
    );
    await dbRun(
      `INSERT INTO audits (id, organization_id, name, type, status, auditor, scheduled_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['a-new', 'test-org-id', 'New', 'internal', 'planned', '', null]
    );

    const res = await dispatch({ method: 'GET', url: '/api/audit', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body.map((a: any) => a.id)).toEqual(['a-new', 'a-old']);
  });
});

