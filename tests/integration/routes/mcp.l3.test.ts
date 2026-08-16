import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/mcp.routes.ts';
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

describe('MCP routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/mcp', router);
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

  const renameTable = async (from: string, to: string) => {
    await dbRun(`ALTER TABLE ${from} RENAME TO ${to}`);
  };

  const restoreTable = async (from: string, to: string) => {
    await dbRun(`ALTER TABLE ${from} RENAME TO ${to}`);
  };

  const adminUser = {
    id: 'test-user-id',
    organizationId: 'test-org-id',
    role: 'ADMIN',
  };

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

  it('GET /providers returns 401 when no token and auth bypass is disabled', async () => {
    const prev = process.env.ENABLE_TEST_AUTH_BYPASS;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    try {
      const res = await dispatch({ method: 'GET', url: '/api/mcp/providers' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(expect.objectContaining({ error: 'No token provided' }));
    } finally {
      process.env.ENABLE_TEST_AUTH_BYPASS = prev;
    }
  });

  it('GET /providers returns [] when no providers exist for the org', async () => {
    await dbRun(`DELETE FROM mcp_providers WHERE organization_id = ?`, ['test-org-id']);
    const res = await dispatch({ method: 'GET', url: '/api/mcp/providers', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /providers filters by organization and sorts by name', async () => {
    await dbRun(`DELETE FROM mcp_providers`);
    await dbRun(
      `INSERT INTO mcp_providers (id, organization_id, name, type, status, config, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['p-1', 'test-org-id', 'Zeta', 'openai', 'active', '{"k":"v"}']
    );
    await dbRun(
      `INSERT INTO mcp_providers (id, organization_id, name, type, status, config, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['p-2', 'test-org-id', 'Alpha', 'anthropic', 'active', '{"k":"v2"}']
    );
    await dbRun(
      `INSERT INTO mcp_providers (id, organization_id, name, type, status, config, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['p-3', 'other-org-id', 'Other', 'openai', 'active', '{"x":1}']
    );

    const res = await dispatch({ method: 'GET', url: '/api/mcp/providers', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body.map((p: any) => p.id)).toEqual(['p-2', 'p-1']);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ id: 'p-2', name: 'Alpha', type: 'anthropic', status: 'active' })
    );
  });

  it('GET /providers respects req.user.organizationId when set (bypass does not override)', async () => {
    await dbRun(`DELETE FROM mcp_providers`);
    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['org-x', 'Org X', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT INTO mcp_providers (id, organization_id, name, type, status, config, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['p-orgx', 'org-x', 'OnlyOrgX', 'openai', 'active', '{}']
    );
    const res = await dispatch({
      method: 'GET',
      url: '/api/mcp/providers',
      user: { id: 'test-user-id', organizationId: 'org-x', role: 'ADMIN' },
    });
    expect(res.status).toBe(200);
    expect(res.body.map((p: any) => p.id)).toEqual(['p-orgx']);
  });

  it('GET /providers returns [] when organizationId is undefined', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/mcp/providers',
      user: { id: 'test-user-id', role: 'ADMIN' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /context returns basic context with empty activeProjects when no membership exists', async () => {
    await dbRun(`DELETE FROM project_members WHERE user_id = ?`, ['test-user-id']);
    const res = await dispatch({ method: 'GET', url: '/api/mcp/context' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        user: { id: 'test-user-id' },
        organization: { id: 'test-org-id' },
        activeProjects: [],
        timestamp: expect.any(String),
      })
    );
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('GET /context returns up to 3 active projects for the user', async () => {
    await dbRun(`DELETE FROM project_members WHERE user_id = ?`, ['test-user-id']);
    await dbRun(`DELETE FROM projects WHERE organization_id = ?`, ['test-org-id']);

    const projects = [
      ['p-a', 'A', 'active'],
      ['p-b', 'B', 'active'],
      ['p-c', 'C', 'active'],
      ['p-d', 'D', 'active'],
      ['p-x', 'X', 'archived'],
    ] as const;

    for (const [id, name, status] of projects) {
      await dbRun(
        `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, 'test-org-id', name, status]
      );
    }

    for (const [id] of projects) {
      await dbRun(
        `INSERT OR IGNORE INTO project_members (id, project_id, user_id, project_role)
         VALUES (?, ?, ?, ?)`,
        [`pm-${id}`, id, 'test-user-id', 'TASK_ASSIGNEE']
      );
    }

    const res = await dispatch({ method: 'GET', url: '/api/mcp/context' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activeProjects)).toBe(true);
    expect(res.body.activeProjects.length).toBe(3);
    const ids = res.body.activeProjects.map((p: any) => p.id);
    for (const id of ids) {
      expect(['p-a', 'p-b', 'p-c', 'p-d']).toContain(id);
    }
    expect(ids).not.toContain('p-x');
  });

  it('GET /context only returns projects with status=active', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/mcp/context' });
    expect(res.status).toBe(200);
    for (const p of res.body.activeProjects) {
      expect(['p-a', 'p-b', 'p-c', 'p-d']).toContain(p.id);
    }
  });

  it('GET /providers returns [] when mcp_providers table is missing (DbPromise fallback)', async () => {
    await dbRun(`DELETE FROM mcp_providers`);
    await renameTable('mcp_providers', 'mcp_providers_tmp');
    try {
      const res = await dispatch({ method: 'GET', url: '/api/mcp/providers', user: adminUser });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    } finally {
      await restoreTable('mcp_providers_tmp', 'mcp_providers');
    }
  });

  it('GET /context returns empty activeProjects when projects table is missing (DbPromise fallback)', async () => {
    await renameTable('projects', 'projects_tmp_mcp');
    try {
      const res = await dispatch({ method: 'GET', url: '/api/mcp/context' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          user: { id: 'test-user-id' },
          organization: { id: 'test-org-id' },
          activeProjects: [],
          timestamp: expect.any(String),
        })
      );
    } finally {
      await restoreTable('projects_tmp_mcp', 'projects');
    }
  });
});
