import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

import router from '../../../server/src/routes/apiKeys.routes.ts';
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

describe('API keys routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/api-keys', router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  });

  const dispatch = async ({
    method,
    url,
    body,
    headers = {},
    user,
    params,
  }: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    user?: any;
    params?: Record<string, any>;
  }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers,
      body,
      cookies: {},
      path: url,
      params: params || {},
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

  const adminUser = {
    id: 'u-admin',
    organizationId: 'org-1',
    role: 'administrator',
  };
  const ownerUser = { id: 'u-owner', organizationId: 'org-1', role: 'owner' };
  const guestUser = { id: 'u-guest', organizationId: 'org-1', role: 'guest' };

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status, is_active) VALUES (?, ?, ?, ?, 1)`,
      ['org-1', 'Org', 'enterprise', 'active']
    );
    for (const u of [adminUser, ownerUser, guestUser]) {
      await dbRun(
        `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, 'org-1', `${u.id}@example.com`, 'x', u.role.toUpperCase(), 'active', 'U', u.id]
      );
      await dbRun(
        `INSERT OR REPLACE INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [`om-${u.id}`, 'org-1', u.id, u.role.toUpperCase()]
      );
    }
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET /permissions returns permissions with descriptions', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/api-keys/permissions', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body.permissions.length).toBeGreaterThan(5);
    expect(res.body.permissions[0]).toEqual(
      expect.objectContaining({ name: expect.any(String), value: expect.any(String), description: expect.any(String) })
    );
  });

  it('GET /permissions returns 401 when no token and auth bypass is disabled', async () => {
    const prev = process.env.ENABLE_TEST_AUTH_BYPASS;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    try {
      const res = await dispatch({ method: 'GET', url: '/api/api-keys/permissions' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(expect.objectContaining({ error: 'No token provided' }));
    } finally {
      process.env.ENABLE_TEST_AUTH_BYPASS = prev;
    }
  });

  it('GET / returns 403 for guest role', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/api-keys', user: guestUser });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Insufficient role' }));
  });

  it('GET / returns keys list and available permissions for admin', async () => {
    await dbRun(`DELETE FROM api_keys WHERE organization_id = ?`, ['org-1']);
    await dbRun(
      `INSERT INTO api_keys (id, organization_id, name, key_prefix, key_hash, permissions, ip_whitelist, rate_limit,
                             expires_at, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), datetime('now', '-2 days'))`,
      [
        'k-old',
        'org-1',
        'Old',
        'abcd1234',
        crypto.createHash('sha256').update('x').digest('hex'),
        '["read:projects"]',
        null,
        100,
        null,
        'active',
        adminUser.id,
      ]
    );
    await dbRun(
      `INSERT INTO api_keys (id, organization_id, name, key_prefix, key_hash, permissions, ip_whitelist, rate_limit,
                             expires_at, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        'k-new',
        'org-1',
        'New',
        'zzzz9999',
        crypto.createHash('sha256').update('y').digest('hex'),
        '["read:projects"]',
        null,
        100,
        null,
        'active',
        adminUser.id,
      ]
    );

    const res = await dispatch({ method: 'GET', url: '/api/api-keys', user: adminUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        keys: expect.any(Array),
        permissions: expect.any(Array),
      })
    );
    expect(res.body.keys.map((k: any) => k.id)).toEqual(['k-new', 'k-old']);
  });

  it('POST / returns 400 when name is missing', async () => {
    const res = await dispatch({ method: 'POST', url: '/api/api-keys', user: ownerUser, body: {} });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Name is required' }));
  });

  it('POST / returns 403 for guest role', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys',
      user: guestUser,
      body: { name: 'Nope' },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Insufficient role' }));
  });

  it('POST / returns 400 for invalid permissions', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys',
      user: ownerUser,
      body: { name: 'Key', permissions: ['nope'] },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Invalid permissions' }));
  });

  it('POST / returns 500 when permissions is not an array', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys',
      user: ownerUser,
      body: { name: 'Bad', permissions: { nope: true } },
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));
  });

  it('POST / creates key with defaults (permissions, rateLimit) and returns plainTextKey once', async () => {
    await dbRun(`DELETE FROM api_keys WHERE organization_id = ?`, ['org-1']);
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys',
      user: ownerUser,
      body: { name: 'My Key' },
    });
    expect(res.status).toBe(201);
    expect(res.body.plainTextKey).toMatch(/^ck_/);
    expect(res.body.key).toEqual(expect.objectContaining({ name: 'My Key', keyPrefix: expect.any(String) }));

    const row = await dbGet<any>(`SELECT * FROM api_keys WHERE id = ?`, [res.body.key.id]);
    expect(row.organization_id).toBe('org-1');
    expect(JSON.parse(row.permissions)).toEqual(['read:projects']);
    expect(row.rate_limit).toBe(100);
  });

  it('POST / sets expiresAt=null when expiresInDays=0', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys',
      user: ownerUser,
      body: { name: 'NoExpiry', expiresInDays: 0 },
    });
    expect(res.status).toBe(201);
    expect(res.body.key.expiresAt).toBe(null);

    const row = await dbGet<any>(`SELECT expires_at FROM api_keys WHERE id = ?`, [res.body.key.id]);
    expect(row.expires_at).toBe(null);
  });

  it('POST / persists ipWhitelist, rateLimit and expiresInDays', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys',
      user: ownerUser,
      body: {
        name: 'Restricted',
        ipWhitelist: ['127.0.0.1'],
        rateLimit: 5,
        expiresInDays: 1,
        permissions: ['read:projects', 'read:tasks'],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.key.rateLimit).toBe(5);
    expect(res.body.key.permissions).toEqual(['read:projects', 'read:tasks']);
    expect(res.body.key.expiresAt).toBeTruthy();

    const row = await dbGet<any>(`SELECT * FROM api_keys WHERE id = ?`, [res.body.key.id]);
    expect(JSON.parse(row.ip_whitelist)).toEqual(['127.0.0.1']);
    expect(row.rate_limit).toBe(5);
    expect(row.expires_at).toBeTruthy();
  });

  it('POST /:keyId/rotate returns 403 for guest role', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys/k-rotate/rotate',
      user: guestUser,
      body: { gracePeriodHours: 1 },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Insufficient role' }));
  });

  it('POST /:keyId/rotate returns 500 when key does not exist', async () => {
    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys/k-missing/rotate',
      user: ownerUser,
      body: { gracePeriodHours: 1 },
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));
  });

  it('POST /:keyId/rotate rotates an active key and marks old key as rotated', async () => {
    await dbRun(`DELETE FROM api_keys WHERE organization_id = ?`, ['org-1']);
    await dbRun(
      `INSERT INTO api_keys (id, organization_id, name, key_prefix, key_hash, permissions, ip_whitelist, rate_limit,
                             expires_at, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`,
      [
        'k-rotate',
        'org-1',
        'Rot',
        'rot12345',
        crypto.createHash('sha256').update('z').digest('hex'),
        '["read:projects"]',
        null,
        100,
        null,
        ownerUser.id,
      ]
    );

    const res = await dispatch({
      method: 'POST',
      url: '/api/api-keys/k-rotate/rotate',
      user: ownerUser,
      body: { gracePeriodHours: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'API key rotated successfully',
        gracePeriodHours: 1,
        newKey: expect.objectContaining({
          id: expect.any(String),
          name: 'Rot',
          keyPrefix: expect.any(String),
          permissions: ['read:projects'],
          rateLimit: 100,
        }),
        plainTextKey: expect.stringMatching(/^ck_/),
      })
    );

    const oldRow = await dbGet<any>(`SELECT status, expires_at FROM api_keys WHERE id = ?`, ['k-rotate']);
    expect(oldRow.status).toBe('rotated');
    expect(oldRow.expires_at).toBeTruthy();
  });

  it('DELETE /:keyId returns 403 for guest role', async () => {
    const res = await dispatch({ method: 'DELETE', url: '/api/api-keys/k-revoke', user: guestUser });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Insufficient role' }));
  });

  it('DELETE /:keyId is idempotent for a missing key', async () => {
    const res = await dispatch({
      method: 'DELETE',
      url: '/api/api-keys/k-does-not-exist',
      user: ownerUser,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ message: 'API key revoked successfully', keyId: 'k-does-not-exist' })
    );
  });

  it('DELETE /:keyId revokes a key', async () => {
    await dbRun(
      `INSERT OR REPLACE INTO api_keys (id, organization_id, name, key_prefix, key_hash, permissions, rate_limit, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`,
      [
        'k-revoke',
        'org-1',
        'Revoke',
        'rev12345',
        crypto.createHash('sha256').update('w').digest('hex'),
        '["read:projects"]',
        100,
        ownerUser.id,
      ]
    );

    const res = await dispatch({ method: 'DELETE', url: '/api/api-keys/k-revoke', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ message: 'API key revoked successfully', keyId: 'k-revoke' }));

    const row = await dbGet<any>(`SELECT status FROM api_keys WHERE id = ?`, ['k-revoke']);
    expect(row.status).toBe('revoked');
  });
});
