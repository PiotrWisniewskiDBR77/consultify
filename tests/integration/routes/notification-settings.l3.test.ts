import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/notifications/notificationSettings.routes.ts';
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

describe('Notification settings routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use('/api/notification-settings', router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    // Deterministic error surface for tests (router throws on DB failures).
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

    // Seed org + user to satisfy FK constraints.
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

  it('GET / returns defaults when no row exists', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/notification-settings' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ email: expect.any(Object) }));
  });

  it('PUT / returns 400 when body is missing', async () => {
    const res = await dispatch({ method: 'PUT', url: '/api/notification-settings' });
    expect(res.status).toBe(400);
  });

  it('PUT / returns 400 when body is not an object (string)', async () => {
    const res = await dispatch({
      method: 'PUT',
      url: '/api/notification-settings',
      body: 'nope',
    });
    expect(res.status).toBe(400);
  });

  it('PUT / returns 400 when body is an array', async () => {
    const res = await dispatch({
      method: 'PUT',
      url: '/api/notification-settings',
      body: [{ email: { enabled: false } }],
    });
    expect(res.status).toBe(400);
  });

  it('PUT / returns 400 when body is an empty object', async () => {
    const res = await dispatch({
      method: 'PUT',
      url: '/api/notification-settings',
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it('PUT / returns 400 when top-level keys are unknown', async () => {
    const res = await dispatch({
      method: 'PUT',
      url: '/api/notification-settings',
      body: { nope: true },
    });
    expect(res.status).toBe(400);
  });

  it('PUT / persists settings and GET / returns stored settings', async () => {
    const put = await dispatch({
      method: 'PUT',
      url: '/api/notification-settings',
      body: { email: { enabled: false } },
    });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ success: true });

    const get = await dispatch({ method: 'GET', url: '/api/notification-settings' });
    expect(get.status).toBe(200);
    expect(get.body).toEqual(
      expect.objectContaining({ email: expect.objectContaining({ enabled: false }) })
    );
  });

  it('GET / falls back to defaults when stored JSON is invalid', async () => {
    await dbRun(
      `INSERT OR REPLACE INTO notification_settings (user_id, settings, updated_at)
       VALUES (?, ?, datetime('now'))`,
      ['test-user-id', '{']
    );

    const res = await dispatch({ method: 'GET', url: '/api/notification-settings' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ email: expect.any(Object) }));
  });

  it('PATCH /:channel returns 400 for invalid channel', async () => {
    const res = await dispatch({
      method: 'PATCH',
      url: '/api/notification-settings/nope',
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it('PATCH /:channel merges into defaults when no row exists', async () => {
    await dbRun(`DELETE FROM notification_settings WHERE user_id = ?`, ['test-user-id']);

    const res = await dispatch({
      method: 'PATCH',
      url: '/api/notification-settings/email',
      body: { enabled: false },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, email: expect.objectContaining({ enabled: false }) })
    );
  });

  it('PATCH /:channel merges into existing settings when row exists', async () => {
    await dispatch({
      method: 'PUT',
      url: '/api/notification-settings',
      body: { slack: { enabled: false, webhookUrl: null } },
    });

    const res = await dispatch({
      method: 'PATCH',
      url: '/api/notification-settings/slack',
      body: { enabled: true, webhookUrl: 'https://example.test/webhook' },
    });
    expect(res.status).toBe(200);
    expect(res.body.slack).toEqual(
      expect.objectContaining({ enabled: true, webhookUrl: 'https://example.test/webhook' })
    );
  });

  it('PATCH /:channel uses defaults when existing settings JSON is invalid', async () => {
    await dbRun(
      `INSERT OR REPLACE INTO notification_settings (user_id, settings, updated_at)
       VALUES (?, ?, datetime('now'))`,
      ['test-user-id', '{']
    );

    const res = await dispatch({
      method: 'PATCH',
      url: '/api/notification-settings/quiet',
      body: { enabled: true },
    });
    expect(res.status).toBe(200);
    expect(res.body.quiet).toEqual(expect.objectContaining({ enabled: true }));
  });

  it('POST /reset deletes row and returns defaults', async () => {
    await dispatch({
      method: 'PUT',
      url: '/api/notification-settings',
      body: { email: { enabled: false } },
    });

    const res = await dispatch({
      method: 'POST',
      url: '/api/notification-settings/reset',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        settings: expect.objectContaining({ email: expect.any(Object) }),
      })
    );
  });

  it('POST /test/:channel returns 400 for invalid channel', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/notification-settings/test/nope',
    });
    expect(res.status).toBe(400);
  });

  it('POST /test/:channel returns success payload for valid channel', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/notification-settings/test/email',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, message: expect.any(String) })
    );
  });

  it('PUT / returns 500 when DB write fails (table missing)', async () => {
    await dbRun(`ALTER TABLE notification_settings RENAME TO notification_settings_tmp`);
    try {
      const res = await dispatch({
        method: 'PUT',
        url: '/api/notification-settings',
        body: { email: { enabled: true } },
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual(expect.objectContaining({ success: false }));
    } finally {
      await dbRun(`ALTER TABLE notification_settings_tmp RENAME TO notification_settings`);
    }
  });

  it('PATCH /:channel returns 500 when DB write fails (table missing)', async () => {
    await dbRun(`ALTER TABLE notification_settings RENAME TO notification_settings_tmp`);
    try {
      const res = await dispatch({
        method: 'PATCH',
        url: '/api/notification-settings/email',
        body: { enabled: true },
      });
      expect(res.status).toBe(500);
    } finally {
      await dbRun(`ALTER TABLE notification_settings_tmp RENAME TO notification_settings`);
    }
  });

  it('POST /reset returns 500 when DB delete fails (table missing)', async () => {
    await dbRun(`ALTER TABLE notification_settings RENAME TO notification_settings_tmp`);
    try {
      const res = await dispatch({
        method: 'POST',
        url: '/api/notification-settings/reset',
      });
      expect(res.status).toBe(500);
    } finally {
      await dbRun(`ALTER TABLE notification_settings_tmp RENAME TO notification_settings`);
    }
  });
});
