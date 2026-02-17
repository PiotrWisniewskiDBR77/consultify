import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/auditLog.routes.ts';
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

describe('Audit log routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/audit-logs', router);
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
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['u-2', 'test-org-id', 'u2@example.com', 'x', 'USER', 'active', 'U', 'Two']
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
      url: '/api/audit-logs',
      user: nonAdminUser,
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Admin access required' }));
  });

  it('GET / supports filters (action,userId,resource,from,to) and pagination', async () => {
    await dbRun(`DELETE FROM audit_log WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))`,
      ['al-1', 'test-org-id', 'u-2', 'LOGIN', 'USER', 'u-2', '{"ok":true}', '1.1.1.1', 'UA']
    );
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['al-2', 'test-org-id', 'u-2', 'UPDATE', 'PROJECT', 'p-1', '{"x":1}', '2.2.2.2', 'UA2']
    );

    const res = await dispatch({
      method: 'GET',
      url: '/api/audit-logs',
      user: adminUser,
      query: {
        page: '1',
        limit: '1',
        action: 'UPDATE',
        userId: 'u-2',
        resource: 'PROJECT',
        from: '2000-01-01',
        to: '2999-01-01',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual(
      expect.objectContaining({ page: 1, limit: 1, total: 1, totalPages: 1 })
    );
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: 'al-2',
        action_type: 'UPDATE',
        resource_type: 'PROJECT',
        resource_id: 'p-1',
        email: 'u2@example.com',
      })
    );
  });

  it('GET / returns empty page when offset is beyond total', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/audit-logs',
      user: adminUser,
      query: { page: '2', limit: '50' },
    });
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /actions returns distinct actions with counts', async () => {
    await dbRun(`DELETE FROM audit_log WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['al-a', 'test-org-id', 'u-2', 'LOGIN', 'USER', 'u-2', '{}', '1.1.1.1', 'UA']
    );
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['al-b', 'test-org-id', 'u-2', 'LOGIN', 'USER', 'u-2', '{}', '1.1.1.1', 'UA']
    );
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['al-c', 'test-org-id', 'u-2', 'UPDATE', 'PROJECT', 'p-1', '{}', '1.1.1.1', 'UA']
    );

    const res = await dispatch({ method: 'GET', url: '/api/audit-logs/actions', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body[0]).toEqual(expect.objectContaining({ action_type: 'LOGIN', count: 2 }));
    expect(res.body[1]).toEqual(expect.objectContaining({ action_type: 'UPDATE', count: 1 }));
  });

  it('GET /export returns JSON by default (supports from/to filters)', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/audit-logs/export',
      user: adminUser,
      query: { from: '2000-01-01', to: '2999-01-01' },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /export?format=csv returns CSV with download headers', async () => {
    await dbRun(`DELETE FROM audit_log WHERE organization_id = ?`, ['test-org-id']);
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['al-csv', 'test-org-id', 'u-2', 'EXPORT', 'AUDIT', 'x', '{}', '9.9.9.9', 'UA']
    );
    const res = await dispatch({
      method: 'GET',
      url: '/api/audit-logs/export',
      user: adminUser,
      query: { format: 'csv' },
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.headers['content-disposition']).toContain('audit-log.csv');
    expect(res.text.split('\n')[0]).toBe('id,action_type,resource_type,resource_id,user_id,ip_address,created_at');
    expect(res.text).toContain('al-csv,EXPORT,AUDIT,x,u-2,9.9.9.9');
  });

  it('GET /:id returns 404 when entry does not exist', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/audit-logs/missing-id',
      user: adminUser,
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Audit log entry not found' }));
  });

  it('GET /:id returns entry with joined user fields', async () => {
    await dbRun(`DELETE FROM audit_log WHERE id = ?`, ['al-one']);
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['al-one', 'test-org-id', 'u-2', 'LOGIN', 'USER', 'u-2', '{"ok":true}', '1.2.3.4', 'UA']
    );

    const res = await dispatch({ method: 'GET', url: '/api/audit-logs/al-one', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: 'al-one',
        action_type: 'LOGIN',
        email: 'u2@example.com',
        first_name: 'U',
        last_name: 'Two',
      })
    );
  });

  it('GET / only returns entries for the current organization', async () => {
    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['other-org-id', 'Other Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action_type, resource_type, resource_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['al-other', 'other-org-id', 'u-2', 'LOGIN', 'USER', 'u-2', '{}', '7.7.7.7', 'UA']
    );
    const res = await dispatch({ method: 'GET', url: '/api/audit-logs', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: any) => l.id)).not.toContain('al-other');
  });
});
