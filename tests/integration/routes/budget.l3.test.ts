import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/budget.routes.ts';
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
  process.env.SQLITE_PATH = `./test-l3-budget-${workerId}-${runId}.db`;
});

describe('Budget routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as any).user = { id: 'test-user-id', organizationId: 'test-org-id', role: 'ADMIN' };
    next();
  });

  app.use('/api/budget', router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  });

  const dispatch = async ({
    method,
    url,
    body,
    headers = {},
    query,
  }: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
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
      `CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        category TEXT,
        planned_amount REAL DEFAULT 0,
        actual_amount REAL DEFAULT 0,
        currency TEXT,
        period_start TEXT,
        period_end TEXT,
        created_at TEXT
      )`
    );

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

  beforeEach(async () => {
    await dbRun(`DELETE FROM budgets`);
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET / returns [] when org has no budgets', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/budget' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET / returns 401 when auth bypass is disabled and no token provided', async () => {
    const prev = process.env.ENABLE_TEST_AUTH_BYPASS;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    try {
      const anonymousApp = express();
      anonymousApp.use(express.json());
      anonymousApp.use('/api/budget', router);
      anonymousApp.use((err: any, _req: any, res: any, _next: any) =>
        res.status(500).json({ success: false, error: err?.message || 'Internal error' })
      );

      const req = new EventEmitter();
      Object.assign(req, {
        method: 'GET',
        url: '/api/budget',
        headers: {},
        body: undefined,
        cookies: {},
        path: '/api/budget',
        query: {},
        socket: { remoteAddress: '127.0.0.1' },
      });

      const res = new EventEmitter();
      const chunks: Buffer[] = [];
      const out = { status: 200, body: undefined as any, text: '' };
      Object.assign(res, {
        statusCode: 200,
        headers: {} as Record<string, string>,
        setHeader(name: string, value: any) {
          (res as any).headers[String(name).toLowerCase()] = String(value);
        },
        getHeader(name: string) {
          return (res as any).headers[String(name).toLowerCase()];
        },
        writeHead(code: number, hdrs?: Record<string, any>) {
          (res as any).statusCode = code;
          out.status = code;
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
          out.status = (res as any).statusCode || 200;
          out.text = Buffer.concat(chunks).toString('utf8');
          try {
            out.body = out.text ? JSON.parse(out.text) : undefined;
          } catch {
            out.body = undefined;
          }
          res.emit('finish');
          return res;
        },
        json(obj: any) {
          (res as any).setHeader('content-type', 'application/json');
          (res as any).end(JSON.stringify(obj));
        },
        status(code: number) {
          (res as any).statusCode = code;
          out.status = code;
          return res;
        },
      });

      const result = await new Promise<typeof out>((resolve) => {
        res.on('finish', () => resolve(out));
        anonymousApp.handle(req as any, res as any, () => resolve(out));
      });

      expect(result.status).toBe(401);
    } finally {
      process.env.ENABLE_TEST_AUTH_BYPASS = prev;
    }
  });

  it('POST / creates a budget and returns id', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/budget',
      body: {
        projectId: 'p-1',
        category: 'capex',
        plannedAmount: 123,
        currency: 'USD',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));

    const rows = await dbAll<any>(`SELECT * FROM budgets WHERE id = ?`, [res.body.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].planned_amount).toBe(123);
  });

  it('GET / supports filtering by projectId', async () => {
    await dbRun(
      `INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, actual_amount, currency, period_start, period_end, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['b-1', 'test-org-id', 'p-1', 'general', 100, 0, 'USD', '2026-01-01', '2026-12-31']
    );
    await dbRun(
      `INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, actual_amount, currency, period_start, period_end, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['b-2', 'test-org-id', 'p-2', 'general', 200, 0, 'USD', '2026-01-01', '2026-12-31']
    );

    const res = await dispatch({ method: 'GET', url: '/api/budget', query: { projectId: 'p-2' } });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(expect.objectContaining({ id: 'b-2', project_id: 'p-2' }));
  });

  it('GET /summary aggregates planned/actual totals and count', async () => {
    await dbRun(
      `INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, actual_amount, currency, period_start, period_end, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['b-1', 'test-org-id', 'p-1', 'general', 100, 40, 'USD', '2026-01-01', '2026-12-31']
    );
    await dbRun(
      `INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, actual_amount, currency, period_start, period_end, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['b-2', 'test-org-id', 'p-1', 'general', 50, 10, 'USD', '2026-01-01', '2026-12-31']
    );

    const res = await dispatch({ method: 'GET', url: '/api/budget/summary' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        total_planned: 150,
        total_actual: 50,
        budget_count: 2,
      })
    );
  });

  it('GET /summary returns zeros when org has no budgets', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/budget/summary' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      // SQLite SUM() returns NULL for empty result sets; COUNT(*) returns 0.
      expect.objectContaining({ total_planned: null, total_actual: null, budget_count: 0 })
    );
  });

  it('POST / applies defaults when optional fields are missing', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/budget',
      body: { projectId: 'p-1' },
    });
    expect(res.status).toBe(201);

    const rows = await dbAll<any>(`SELECT * FROM budgets WHERE id = ?`, [res.body.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].category).toBe('general');
    expect(rows[0].planned_amount).toBe(0);
    expect(rows[0].actual_amount).toBe(0);
    expect(rows[0].currency).toBe('USD');
  });

  it('PUT /:id returns 400 when body contains no updates', async () => {
    await dbRun(
      `INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, actual_amount, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['b-1', 'test-org-id', 'p-1', 'general', 10, 0, 'USD']
    );

    const res = await dispatch({ method: 'PUT', url: '/api/budget/b-1', body: {} });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'No updates' }));
  });

  it('PUT /:id updates fields and DELETE /:id removes the budget', async () => {
    await dbRun(
      `INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, actual_amount, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['b-1', 'test-org-id', 'p-1', 'general', 10, 0, 'USD']
    );

    const updated = await dispatch({
      method: 'PUT',
      url: '/api/budget/b-1',
      body: { plannedAmount: 99, actualAmount: 33, category: 'updated' },
    });
    expect(updated.status).toBe(200);

    const list = await dispatch({ method: 'GET', url: '/api/budget' });
    expect(list.status).toBe(200);
    expect(list.body[0]).toEqual(
      expect.objectContaining({ id: 'b-1', planned_amount: 99, actual_amount: 33, category: 'updated' })
    );

    const del = await dispatch({ method: 'DELETE', url: '/api/budget/b-1' });
    expect(del.status).toBe(200);

    const after = await dispatch({ method: 'GET', url: '/api/budget' });
    expect(after.body).toEqual([]);
  });
});
