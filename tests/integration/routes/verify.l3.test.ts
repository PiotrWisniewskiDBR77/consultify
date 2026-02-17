import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/verify.routes.ts';
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

describe('Verify routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/verify', router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  });

  const dispatch = async ({
    method,
    url,
    body,
    headers = {},
  }: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
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
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'test-user-id',
        'test-org-id',
        'test@example.com',
        'x',
        'ADMIN',
        'active',
        'Test',
        'User',
        0,
      ]
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET /:token returns 404 for missing token record', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/verify/nope' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({ error: 'Invalid or expired verification token' })
    );
  });

  it('GET /:token returns 410 for expired token', async () => {
    await dbRun(`DELETE FROM verification_tokens WHERE token = ?`, ['expired-token']);
    await dbRun(
      `INSERT INTO verification_tokens (token, user_id, type, expires_at, used)
       VALUES (?, ?, ?, datetime('now', '-1 day'), 0)`,
      ['expired-token', 'test-user-id', 'email']
    );

    const res = await dispatch({ method: 'GET', url: '/api/verify/expired-token' });
    expect(res.status).toBe(410);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Verification token expired' }));
  });

  it('GET /:token returns 404 for token already used', async () => {
    await dbRun(`DELETE FROM verification_tokens WHERE token = ?`, ['used-token']);
    await dbRun(
      `INSERT INTO verification_tokens (token, user_id, type, expires_at, used)
       VALUES (?, ?, ?, datetime('now', '+1 day'), 1)`,
      ['used-token', 'test-user-id', 'email']
    );

    const res = await dispatch({ method: 'GET', url: '/api/verify/used-token' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({ error: 'Invalid or expired verification token' })
    );
  });

  it('GET /:token marks token used and verifies email for type=email', async () => {
    await dbRun(`UPDATE users SET email_verified = 0 WHERE id = ?`, ['test-user-id']);
    await dbRun(`DELETE FROM verification_tokens WHERE token = ?`, ['valid-email-token']);
    await dbRun(
      `INSERT INTO verification_tokens (token, user_id, type, expires_at, used)
       VALUES (?, ?, ?, datetime('now', '+1 day'), 0)`,
      ['valid-email-token', 'test-user-id', 'email']
    );

    const res = await dispatch({ method: 'GET', url: '/api/verify/valid-email-token' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, type: 'email', message: 'Verification successful' })
    );

    const token = await dbGet<any>(
      `SELECT used, used_at FROM verification_tokens WHERE token = ?`,
      ['valid-email-token']
    );
    expect(token).toEqual(expect.objectContaining({ used: 1 }));
    expect(token.used_at).toBeTruthy();

    const user = await dbGet<any>(`SELECT email_verified FROM users WHERE id = ?`, ['test-user-id']);
    expect(user?.email_verified).toBe(1);
  });

  it('GET /:token does not set email_verified for non-email token type', async () => {
    await dbRun(`UPDATE users SET email_verified = 0 WHERE id = ?`, ['test-user-id']);
    await dbRun(`DELETE FROM verification_tokens WHERE token = ?`, ['valid-account-token']);
    await dbRun(
      `INSERT INTO verification_tokens (token, user_id, type, expires_at, used)
       VALUES (?, ?, ?, datetime('now', '+1 day'), 0)`,
      ['valid-account-token', 'test-user-id', 'account']
    );

    const res = await dispatch({ method: 'GET', url: '/api/verify/valid-account-token' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, type: 'account' }));

    const user = await dbGet<any>(`SELECT email_verified FROM users WHERE id = ?`, ['test-user-id']);
    expect(user?.email_verified).toBe(0);
  });

  it('GET /:token succeeds when expires_at is null', async () => {
    await dbRun(`DELETE FROM verification_tokens WHERE token = ?`, ['no-expiry-token']);
    await dbRun(
      `INSERT INTO verification_tokens (token, user_id, type, expires_at, used)
       VALUES (?, ?, ?, NULL, 0)`,
      ['no-expiry-token', 'test-user-id', 'email']
    );

    const res = await dispatch({ method: 'GET', url: '/api/verify/no-expiry-token' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
  });

  it('POST /resend returns 400 when email is missing', async () => {
    const res = await dispatch({ method: 'POST', url: '/api/verify/resend', body: {} });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Email required' }));
  });

  it('POST /resend returns 404 when user is not found', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/verify/resend',
      body: { email: 'missing@example.com' },
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'User not found' }));
  });

  it('POST /resend returns success when email is already verified', async () => {
    await dbRun(`UPDATE users SET email_verified = 1 WHERE id = ?`, ['test-user-id']);
    const res = await dispatch({
      method: 'POST',
      url: '/api/verify/resend',
      body: { email: 'test@example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, message: 'Email already verified' }));
  });

  it('POST /resend returns success when user exists and is unverified', async () => {
    await dbRun(`UPDATE users SET email_verified = 0 WHERE id = ?`, ['test-user-id']);
    const res = await dispatch({
      method: 'POST',
      url: '/api/verify/resend',
      body: { email: 'test@example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, message: 'Verification email sent' })
    );
  });
});

