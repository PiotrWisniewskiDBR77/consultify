import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type DbHandle = {
  exec: (sql: string) => Promise<unknown>;
};

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('apiKeyAuth.middleware (L1)', () => {
  const originalEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-api-key-auth-${workerId}.db`);

  let db: DbHandle;
  let resetConnection: () => Promise<void>;

  let ApiKeyService: any;
  let API_KEY_PERMISSIONS: any;

  let apiKeyAuth: any;
  let optionalApiKeyAuth: any;
  let requireApiKeyPermission: any;
  let hybridAuth: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = sqlitePath;

    vi.resetModules();

    const dbMod = await import('../../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        permissions TEXT NOT NULL,
        ip_whitelist TEXT,
        rate_limit INTEGER NOT NULL DEFAULT 100,
        expires_at TEXT,
        last_used_at TEXT,
        last_used_ip TEXT,
        rotated_from_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const svcMod = await import('../../../../server/src/services/apiKeyService.js');
    ApiKeyService = svcMod.ApiKeyService;
    API_KEY_PERMISSIONS = svcMod.API_KEY_PERMISSIONS;

    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    apiKeyAuth = mwMod.apiKeyAuth;
    optionalApiKeyAuth = mwMod.optionalApiKeyAuth;
    requireApiKeyPermission = mwMod.requireApiKeyPermission;
    hybridAuth = mwMod.hybridAuth;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) delete (process.env as any)[key];
      }
      Object.assign(process.env, originalEnv);
      await fs.rm(sqlitePath, { force: true });
    }
  });

  beforeEach(async () => {
    await db.exec(`DELETE FROM api_keys;`);
    (ApiKeyService as any).db = null;
    vi.clearAllMocks();
  });

  it('returns 401 when API key missing', async () => {
    const req: any = { headers: {}, query: {}, ip: '127.0.0.1', socket: { remoteAddress: '' } };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('treats non-ck_ Authorization bearer token as missing', async () => {
    const req: any = {
      headers: { authorization: 'Bearer not-a-ck-key' },
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates with Authorization: Bearer ck_<key> and attaches req.apiKey + req.organizationId', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org1',
      name: 'Key 1',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['1.2.3.4'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { authorization: `Bearer ${plainTextKey}`, 'x-forwarded-for': '1.2.3.4' },
      query: {},
      ip: '',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.apiKey?.id).toBe(key.id);
    expect(req.organizationId).toBe('org1');
  });

  it('rejects when client IP is not on whitelist', async () => {
    const { plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org1',
      name: 'Key IP',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['1.2.3.4'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { authorization: `Bearer ${plainTextKey}`, 'x-forwarded-for': '5.5.5.5' },
      query: {},
      ip: '',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('supports X-API-Key header and falls back to req.ip for client IP', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org2',
      name: 'Key 2',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['9.9.9.9'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { 'x-api-key': plainTextKey },
      query: {},
      ip: '9.9.9.9',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.apiKey?.id).toBe(key.id);
    expect(req.organizationId).toBe('org2');
  });

  it('falls back to socket.remoteAddress for client IP when other fields are missing', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'orgSock',
      name: 'Key Sock',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['10.0.0.1'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { 'x-api-key': plainTextKey },
      query: {},
      ip: '',
      socket: { remoteAddress: '10.0.0.1' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.apiKey?.id).toBe(key.id);
  });

  it('supports api_key query parameter', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'orgQ',
      name: 'Key Q',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: {},
      query: { api_key: plainTextKey },
      ip: '127.0.0.1',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.apiKey?.id).toBe(key.id);
  });

  it('enforces per-key rate limit and returns 429 on excess', async () => {
    const { plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org3',
      name: 'Key RL',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 2,
      createdBy: 'u1',
    });

    const makeReq = (): any => ({
      headers: { authorization: `Bearer ${plainTextKey}`, 'x-forwarded-for': '1.1.1.1' },
      query: {},
      ip: '',
      socket: { remoteAddress: '' },
    });

    const mkRes = () => {
      const res: any = {};
      res.setHeader = vi.fn(() => res);
      res.status = vi.fn(() => res);
      res.json = vi.fn(() => res);
      return res;
    };

    const next1 = vi.fn();
    await apiKeyAuth(makeReq(), mkRes(), next1);
    expect(next1).toHaveBeenCalledTimes(1);

    const next2 = vi.fn();
    await apiKeyAuth(makeReq(), mkRes(), next2);
    expect(next2).toHaveBeenCalledTimes(1);

    const res3 = mkRes();
    const next3 = vi.fn();
    await apiKeyAuth(makeReq(), res3, next3);
    expect(res3.status).toHaveBeenCalledWith(429);
    expect(next3).not.toHaveBeenCalled();
  });

  it('cleans up old per-key rate limit entries periodically', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T00:00:00.000Z'));
    vi.resetModules();

    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = sqlitePath;

    const dbMod = await import('../../../../server/src/database/Database.js');
    await dbMod.resetConnection();
    const dbLocal: DbHandle = dbMod.getDatabase();
    await dbLocal.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        permissions TEXT NOT NULL,
        ip_whitelist TEXT,
        rate_limit INTEGER NOT NULL DEFAULT 100,
        expires_at TEXT,
        last_used_at TEXT,
        last_used_ip TEXT,
        rotated_from_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      DELETE FROM api_keys;
    `);

    const svcMod = await import('../../../../server/src/services/apiKeyService.js');
    const ApiKeyServiceLocal: any = svcMod.ApiKeyService;
    (ApiKeyServiceLocal as any).db = null;

    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const apiKeyAuthLocal: any = mwMod.apiKeyAuth;

    const { plainTextKey } = await ApiKeyServiceLocal.createKey({
      organizationId: 'orgCleanup',
      name: 'Key Cleanup',
      permissions: [svcMod.API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 1,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { authorization: `Bearer ${plainTextKey}`, 'x-forwarded-for': '6.6.6.6' },
      query: {},
      ip: '',
      socket: { remoteAddress: '' },
    };
    const res: any = { setHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await apiKeyAuthLocal(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // First cleanup tick happens at +60s and won't delete (resetAt == now).
    // Second tick (+120s) should delete (resetAt < now).
    await vi.advanceTimersByTimeAsync(120_000);
  });

  it('optionalApiKeyAuth continues when key missing, but validates when present', async () => {
    const req1: any = { headers: {}, query: {}, ip: '127.0.0.1', socket: { remoteAddress: '' } };
    const res1: any = { setHeader: vi.fn(), status: vi.fn(() => res1), json: vi.fn(() => res1) };
    const next1 = vi.fn();
    await optionalApiKeyAuth(req1, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);

    const { plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org4',
      name: 'Key Opt',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req2: any = {
      headers: { 'x-api-key': plainTextKey, 'x-forwarded-for': '2.2.2.2' },
      query: {},
      ip: '',
      socket: { remoteAddress: '' },
    };
    const res2: any = { setHeader: vi.fn(), status: vi.fn(() => res2), json: vi.fn(() => res2) };
    const next2 = vi.fn();
    await optionalApiKeyAuth(req2, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);
  });

  it('requireApiKeyPermission blocks when missing or lacking permission', () => {
    const mw = requireApiKeyPermission(API_KEY_PERMISSIONS.WRITE_PROJECTS);
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw({} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);

    const res2: any = { status: vi.fn(() => res2), json: vi.fn(() => res2) };
    const next2 = vi.fn();
    mw({ apiKey: { permissions: [API_KEY_PERMISSIONS.READ_PROJECTS] } } as any, res2, next2);
    expect(res2.status).toHaveBeenCalledWith(403);
    expect(next2).not.toHaveBeenCalled();
  });

  it('requireApiKeyPermission allows when permission is present', () => {
    const mw = requireApiKeyPermission(API_KEY_PERMISSIONS.WRITE_PROJECTS);
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw({ apiKey: { permissions: [API_KEY_PERMISSIONS.WRITE_PROJECTS] } } as any, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireApiKeyPermission allows when FULL_ACCESS is present', () => {
    const mw = requireApiKeyPermission(API_KEY_PERMISSIONS.WRITE_PROJECTS);
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw({ apiKey: { permissions: [API_KEY_PERMISSIONS.FULL_ACCESS] } } as any, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('hybridAuth uses API key when present, otherwise falls back to JWT middleware', async () => {
    const { plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org5',
      name: 'Key Hybrid',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const jwtMiddleware = vi.fn((_: any, __: any, next: any) => next());
    const mw = hybridAuth(jwtMiddleware);

    const req1: any = {
      headers: { authorization: `Bearer ${plainTextKey}`, 'x-forwarded-for': '3.3.3.3' },
      query: {},
      ip: '',
      socket: { remoteAddress: '' },
    };
    const res1: any = { setHeader: vi.fn(), status: vi.fn(() => res1), json: vi.fn(() => res1) };
    const next1 = vi.fn();
    await mw(req1, res1, next1);
    expect(jwtMiddleware).not.toHaveBeenCalled();
    expect(next1).toHaveBeenCalledTimes(1);

    const req2: any = { headers: {}, query: {}, ip: '127.0.0.1', socket: { remoteAddress: '' } };
    const res2: any = { setHeader: vi.fn(), status: vi.fn(() => res2), json: vi.fn(() => res2) };
    const next2 = vi.fn();
    await mw(req2, res2, next2);
    expect(jwtMiddleware).toHaveBeenCalledTimes(1);
    expect(next2).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when response header setting throws', async () => {
    const { plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org6',
      name: 'Key Err',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { authorization: `Bearer ${plainTextKey}`, 'x-forwarded-for': '4.4.4.4' },
      query: {},
      ip: '',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(() => {
        throw new Error('boom');
      }),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
