import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';

import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';
  process.env.MOCK_REDIS = 'true';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only-min-32-chars';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('Stabilization routes integration (L3)', () => {
  const db = getDatabase();
  const makeApp = async () => {
    const app = express();
    app.use(express.json());
    const router = (await import('../../../server/src/routes/stabilization.routes.ts')).default;
    app.use('/api/stabilization', router);
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ success: false, error: err?.message || 'Internal error' });
    });
    return app;
  };

  const tokenFor = (payload: any) =>
    jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1h' });

  const dispatch = async (
    app: express.Express,
    {
      method,
      url,
      headers = {},
      body,
      query,
    }: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, any>;
    }
  ) => {
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
      ['sa-user', 'test-org-id', 'sa@example.com', 'x', 'SUPERADMIN', 'active', 'Super', 'Admin']
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET /status returns 403 when no token provided (verifySuperAdmin)', async () => {
    const app = await makeApp();
    const res = await dispatch(app, { method: 'GET', url: '/api/stabilization/status' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'No token provided' }));
  });

  it('GET /status returns 401 for invalid token', async () => {
    const app = await makeApp();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/stabilization/status',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Unauthorized' }));
  });

  it('GET /status returns 403 when not superadmin (token role + DB role)', async () => {
    const token = tokenFor({ id: 'not-sa', role: 'USER', organizationId: 'test-org-id' });
    const app = await makeApp();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/stabilization/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Requires Super Admin privileges' }));
  });

  it('GET /status returns 200 stable payload for superadmin token', async () => {
    await dbRun(`DELETE FROM error_logs`);
    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeApp();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/stabilization/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'stable',
        uptime: expect.any(Number),
        database: expect.objectContaining({ tables: expect.any(Number), status: 'connected' }),
        recentErrors: 0,
        memory: expect.any(Object),
      })
    );
  });

  it('GET /status counts recent errors from last hour', async () => {
    await dbRun(`DELETE FROM error_logs`);
    await dbRun(
      `INSERT INTO error_logs (id, message, created_at) VALUES (?, ?, datetime('now', '-30 minutes'))`,
      ['e-1', 'boom']
    );
    await dbRun(
      `INSERT INTO error_logs (id, message, created_at) VALUES (?, ?, datetime('now', '-2 hours'))`,
      ['e-2', 'old']
    );

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeApp();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/stabilization/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.body.recentErrors).toBe(1);
  });

  it('GET /status returns recentErrors=0 when error_logs table is missing (DbPromise fallback)', async () => {
    await dbRun(`ALTER TABLE error_logs RENAME TO error_logs_tmp`);
    try {
      const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
      const app = await makeApp();
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/stabilization/status',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(res.body.recentErrors).toBe(0);
    } finally {
      await dbRun(`ALTER TABLE error_logs_tmp RENAME TO error_logs`);
    }
  });

  it('GET /health-history returns [] when no rows exist', async () => {
    await dbRun(`DELETE FROM system_health_history`);
    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeApp();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/stabilization/health-history',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /health-history returns rows ordered by date DESC and limited to 30', async () => {
    await dbRun(`DELETE FROM system_health_history`);
    for (let i = 0; i < 35; i++) {
      await dbRun(
        `INSERT INTO system_health_history (date, avg_response_ms, error_rate, uptime_pct)
         VALUES (date('now', ?), ?, ?, ?)`,
        [`-${i} day`, 100 + i, i / 100, 99.9]
      );
    }

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeApp();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/stabilization/health-history',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(30);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ avg_response_ms: 100, error_rate: 0, uptime_pct: 99.9 })
    );
  });

  it('GET /health-history returns [] when system_health_history table is missing (DbPromise fallback)', async () => {
    await dbRun(`ALTER TABLE system_health_history RENAME TO system_health_history_tmp`);
    try {
      const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
      const app = await makeApp();
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/stabilization/health-history',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    } finally {
      await dbRun(`ALTER TABLE system_health_history_tmp RENAME TO system_health_history`);
    }
  });

  it('GET /status reports database tables=0 when DB status query returns null', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/utils/DbPromise.js', () => ({
      get: async (sql: string) => {
        if (String(sql).includes('sqlite_master')) return null;
        if (String(sql).includes('error_logs')) return { count: 0 };
        return null;
      },
      all: async () => [],
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeApp();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/stabilization/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.body.database.tables).toBe(0);

    vi.doUnmock('../../../server/src/utils/DbPromise.js');
    vi.resetModules();
  });
});
