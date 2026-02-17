import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

import router from '../../../server/src/routes/loginHistory.routes.ts';
import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('Login history routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use('/api/auth/login-history', router);

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

  const renameLoginHistoryTable = async (tmpName: string) => {
    await dbRun(`ALTER TABLE login_history RENAME TO ${tmpName}`);
  };

  const restoreLoginHistoryTable = async (tmpName: string) => {
    await dbRun(`ALTER TABLE ${tmpName} RENAME TO login_history`);
  };

  const seedUser = async (userId: string) => {
    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['test-org-id', 'Test Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'test-org-id', `${userId}@example.com`, 'x', 'ADMIN', 'active', 'Test', 'User']
    );
  };

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;
    await seedUser('test-user-id');
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('POST / returns 400 when userId is missing', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/auth/login-history',
      body: { status: 'failed' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));
  });

  it('POST / records a login attempt with default status=success', async () => {
    const userId = `u-${randomUUID()}`;
    await seedUser(userId);

    const res = await dispatch({
      method: 'POST',
      url: '/api/auth/login-history',
      body: { userId, ipAddress: '1.2.3.4', userAgent: 'Chrome Mac', location: 'EU' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, data: { id: expect.any(String) } })
    );
  });

  it('GET / returns history entries with parsed device and time fields', async () => {
    await dbRun(
      `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['lh-1', 'test-user-id', '9.9.9.9', 'Chrome Mac', 'EU', 'success']
    );

    const res = await dispatch({
      method: 'GET',
      url: '/api/auth/login-history',
      user: { id: 'test-user-id', organizationId: 'test-org-id' },
      query: { limit: '50' },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({ device: expect.any(String), time: expect.any(String) })
    );
  });

  it('GET / returns "Unknown Device" when user agent is missing', async () => {
    await dbRun(
      `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['lh-ua-null', 'test-user-id', null, null, null, 'success']
    );

    const res = await dispatch({
      method: 'GET',
      url: '/api/auth/login-history',
      user: { id: 'test-user-id', organizationId: 'test-org-id' },
      query: { limit: '50' },
    });
    expect(res.status).toBe(200);
    const entry = res.body.data.find((e: any) => e.id === 'lh-ua-null');
    expect(entry.device).toBe('Unknown Device');
  });

  it('GET / respects limit param', async () => {
    const userId = `u-${randomUUID()}`;
    await seedUser(userId);

    await dbRun(
      `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['lh-a', userId, '1.1.1.1', 'Edge', 'EU', 'success']
    );
    await dbRun(
      `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['lh-b', userId, '2.2.2.2', 'Firefox Mac', 'EU', 'success']
    );

    const res = await dispatch({
      method: 'GET',
      url: '/api/auth/login-history',
      user: { id: userId, organizationId: 'test-org-id' },
      query: { limit: '1' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('GET / returns 401 when req.user exists but id is missing (bypass does not override)', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/auth/login-history',
      user: { organizationId: 'test-org-id' },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ success: false, error: 'Unauthorized' }));
  });

  it('GET / formats device strings across common user agents', async () => {
    const userId = `u-${randomUUID()}`;
    await seedUser(userId);

    const cases = [
      ['ua-chrome-win', 'Chrome Windows', 'Chrome on Windows'],
      ['ua-chrome-linux', 'Chrome Linux', 'Chrome on Linux'],
      ['ua-chrome-generic', 'Chrome', 'Chrome'],
      ['ua-firefox-win', 'Firefox Windows', 'Firefox on Windows'],
      ['ua-firefox-generic', 'Firefox', 'Firefox'],
      ['ua-safari-ipad', 'Safari iPad', 'Safari on iPad'],
      ['ua-safari-mac', 'Safari Mac', 'Safari on MacOS'],
      ['ua-unknown', 'Opera', 'Unknown Browser'],
    ] as const;

    let minutesAgo = 10;
    for (const [id, ua] of cases) {
      await dbRun(
        `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`,
        [id, userId, '1.1.1.1', ua, 'EU', 'success', `-${minutesAgo--} minutes`]
      );
    }

    const res = await dispatch({
      method: 'GET',
      url: '/api/auth/login-history',
      user: { id: userId, organizationId: 'test-org-id' },
      query: { limit: '50' },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    for (const [id, _ua, expected] of cases) {
      const entry = res.body.data.find((e: any) => e.id === id);
      expect(entry).toBeTruthy();
      expect(entry.device).toBe(expected);
    }
  });

  it('GET /suspicious returns only failed entries', async () => {
    const userId = `u-${randomUUID()}`;
    await seedUser(userId);
    await dbRun(
      `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['lh-ok', userId, '1.1.1.1', 'Safari iPhone', 'EU', 'success']
    );
    await dbRun(
      `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['lh-fail', userId, '1.1.1.1', 'Safari iPhone', 'EU', 'failed']
    );

    const res = await dispatch({
      method: 'GET',
      url: '/api/auth/login-history/suspicious',
      user: { id: userId, organizationId: 'test-org-id' },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every((e: any) => e.status === 'failed')).toBe(true);
  });

  it('GET /suspicious returns 401 when req.user exists but id is missing (bypass does not override)', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/auth/login-history/suspicious',
      user: { organizationId: 'test-org-id' },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ success: false, error: 'Unauthorized' }));
  });

  it('GET / returns 500 when DB read fails (table missing)', async () => {
    const tmp = 'login_history_tmp';
    await renameLoginHistoryTable(tmp);
    try {
      const res = await dispatch({
        method: 'GET',
        url: '/api/auth/login-history',
        user: { id: 'test-user-id', organizationId: 'test-org-id' },
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual(
        expect.objectContaining({ success: false, error: 'Failed to fetch login history' })
      );
    } finally {
      await restoreLoginHistoryTable(tmp);
    }
  });

  it('GET /suspicious returns 500 when DB read fails (table missing)', async () => {
    const tmp = 'login_history_tmp';
    await renameLoginHistoryTable(tmp);
    try {
      const res = await dispatch({
        method: 'GET',
        url: '/api/auth/login-history/suspicious',
        user: { id: 'test-user-id', organizationId: 'test-org-id' },
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual(
        expect.objectContaining({ success: false, error: 'Failed to fetch suspicious logins' })
      );
    } finally {
      await restoreLoginHistoryTable(tmp);
    }
  });

  it('POST / returns 500 when DB write fails (table missing)', async () => {
    const tmp = 'login_history_tmp';
    await renameLoginHistoryTable(tmp);
    try {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/login-history',
        body: { userId: 'test-user-id', status: 'failed' },
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual(
        expect.objectContaining({ success: false, error: 'Failed to record login' })
      );
    } finally {
      await restoreLoginHistoryTable(tmp);
    }
  });

  it('GET / returns 401 when auth bypass is disabled and no token is provided', async () => {
    const orig = process.env.ENABLE_TEST_AUTH_BYPASS;
    try {
      process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
      const res = await dispatch({ method: 'GET', url: '/api/auth/login-history' });
      expect(res.status).toBe(401);
    } finally {
      process.env.ENABLE_TEST_AUTH_BYPASS = orig;
    }
  });
});
