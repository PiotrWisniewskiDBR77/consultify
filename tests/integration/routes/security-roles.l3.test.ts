import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import rolesRouter from '../../../server/src/routes/security/roles.routes.ts';
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

describe('Security roles routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/security/roles', rolesRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  });

  const dispatch = async ({
    method,
    url,
    body,
    headers = {},
    user,
  }: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    user?: any;
  }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers,
      body,
      cookies: {},
      path: url,
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

  const ownerUser = { id: 'u-owner', organizationId: 'org-1', role: 'owner' };
  const otherOrgUser = { id: 'u-owner-2', organizationId: 'org-2', role: 'owner' };

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    for (const orgId of ['org-1', 'org-2']) {
      await dbRun(
        `INSERT OR IGNORE INTO organizations (id, name, plan, status, is_active) VALUES (?, ?, ?, ?, 1)`,
        [orgId, `Org ${orgId}`, 'enterprise', 'active']
      );
    }

    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ownerUser.id, 'org-1', 'owner1@example.com', 'x', 'OWNER', 'active', 'Owner', 'One']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [otherOrgUser.id, 'org-2', 'owner2@example.com', 'x', 'OWNER', 'active', 'Owner', 'Two']
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET / returns empty list initially', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/security/roles', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual([]);
  });

  it('POST / creates role and returns id', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/security/roles',
      user: ownerUser,
      body: { name: 'Auditor', permissions: ['read:users'] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
  });

  it('GET / lists created role with permissions array', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/security/roles', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body.roles.length).toBe(1);
    expect(res.body.roles[0]).toEqual(
      expect.objectContaining({
        name: 'Auditor',
        permissions: ['read:users'],
      })
    );
  });

  it('PUT /:id updates name and permissions', async () => {
    const row = await dbGet<{ id: string }>(
      `SELECT id FROM security_roles WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
      ['org-1']
    );
    expect(row?.id).toBeTruthy();

    const res = await dispatch({
      method: 'PUT',
      url: `/api/security/roles/${row!.id}`,
      user: ownerUser,
      body: { name: 'Auditor++', permissions: ['read:users', 'admin:settings'] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));

    const list = await dispatch({ method: 'GET', url: '/api/security/roles', user: ownerUser });
    expect(list.body.roles[0]).toEqual(
      expect.objectContaining({ name: 'Auditor++', permissions: ['read:users', 'admin:settings'] })
    );
  });

  it('PUT /:id returns 404 when role belongs to another org', async () => {
    const row = await dbGet<{ id: string }>(
      `SELECT id FROM security_roles WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
      ['org-1']
    );
    const res = await dispatch({
      method: 'PUT',
      url: `/api/security/roles/${row!.id}`,
      user: otherOrgUser,
      body: { name: 'Nope' },
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Role not found' }));
  });

  it('DELETE /:id removes role', async () => {
    const row = await dbGet<{ id: string }>(
      `SELECT id FROM security_roles WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
      ['org-1']
    );
    const res = await dispatch({
      method: 'DELETE',
      url: `/api/security/roles/${row!.id}`,
      user: ownerUser,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));

    const list = await dispatch({ method: 'GET', url: '/api/security/roles', user: ownerUser });
    expect(list.body.roles).toEqual([]);
  });

  it('GET / tolerates invalid permissions_json by returning []', async () => {
    await dbRun(
      `INSERT INTO security_roles (id, organization_id, name, permissions_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['r-bad', 'org-1', 'Broken', 'not-json']
    );
    const res = await dispatch({ method: 'GET', url: '/api/security/roles', user: ownerUser });
    expect(res.status).toBe(200);
    const broken = res.body.roles.find((r: any) => r.id === 'r-bad');
    expect(broken).toEqual(expect.objectContaining({ permissions: [] }));
  });

  it('POST / defaults name and normalizes permissions when missing/invalid', async () => {
    const res = await dispatch({ method: 'POST', url: '/api/security/roles', user: ownerUser, body: {} });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));

    const list = await dispatch({ method: 'GET', url: '/api/security/roles', user: ownerUser });
    const created = list.body.roles.find((r: any) => r.id === res.body.id);
    expect(created).toEqual(expect.objectContaining({ name: 'Custom Role', permissions: [] }));
  });
});

