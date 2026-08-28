import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type DbHandle = {
  exec: (sql: string) => Promise<unknown>;
};

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describe('apiKeyAuth.middleware hardening (no DB)', () => {
  it('cleanup interval timer is unrefd so it does not pin the event loop', async () => {
    vi.resetModules();
    const unref = vi.fn();
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation(
        () =>
          ({
            unref,
          }) as unknown as ReturnType<typeof setInterval>
      );
    try {
      await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
      expect(unref).toHaveBeenCalledTimes(1);
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it('requireApiKeyPermission does not throw when permissions is not an array', async () => {
    vi.resetModules();
    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const { requireApiKeyPermission, API_KEY_PERMISSIONS } = mwMod;
    const mw = requireApiKeyPermission(API_KEY_PERMISSIONS.WRITE_PROJECTS);
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw({ apiKey: { permissions: 'not-an-array' } } as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Permission denied',
        code: 'API_KEY_FORBIDDEN',
        yourPermissions: [],
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireApiKeyPermission returns 500 when configured with empty permission', async () => {
    vi.resetModules();
    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const { requireApiKeyPermission } = mwMod;
    const mw = requireApiKeyPermission('   ');
    const res: any = { setHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw({ apiKey: { permissions: ['read_projects'] } } as any, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'API_KEY_PERMISSION_CONFIG',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireApiKeyPermission returns stable 401 JSON when apiKey is missing', async () => {
    vi.resetModules();
    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const { requireApiKeyPermission, API_KEY_PERMISSIONS } = mwMod;
    const mw = requireApiKeyPermission(API_KEY_PERMISSIONS.READ_PROJECTS);
    const res: any = { setHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw({} as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'API key authentication required',
        message: expect.any(String),
        code: 'API_KEY_CONTEXT_MISSING',
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer realm="consultify-api", error="invalid_token"'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireApiKeyPermission returns early when response is already committed', async () => {
    vi.resetModules();
    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const { requireApiKeyPermission, API_KEY_PERMISSIONS } = mwMod;
    const mw = requireApiKeyPermission(API_KEY_PERMISSIONS.READ_PROJECTS);
    const res: any = {
      headersSent: true,
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    mw({} as any, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth applies no-store headers on internal 500 auth error path', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockRejectedValue(new Error('db down'));
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'Bearer ck_valid-key' },
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

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth forwards error to next when 500 response body cannot be written', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockRejectedValue(new Error('db down'));
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'Bearer ck_valid-key' },
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('apiKeyAuth does not forward error to next when response is already committed', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockRejectedValue(new Error('db down'));
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'Bearer ck_valid-key' },
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      headersSent: true,
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('apiKeyAuth rejects oversized API key before validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn();
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const hugeKey = `ck_${'a'.repeat(600)}`;
    const req: any = {
      headers: { authorization: `Bearer ${hugeKey}` },
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

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'API_KEY_INVALID',
      })
    );
    expect(validateKey).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth rejects API key containing transport control characters before validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn();
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: `Bearer ck_valid${String.fromCharCode(0)}suffix` },
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

    expect(validateKey).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'API_KEY_INVALID' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth ignores pathological Authorization header length before validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn();
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: `Bearer ${' '.repeat(10_000)}not-a-key` },
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

    expect(validateKey).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'API_KEY_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth ignores pathological x-api-key header length before validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn();
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { 'x-api-key': 'x'.repeat(20_000) },
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

    expect(validateKey).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'API_KEY_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth ignores pathological api_key query length before validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn();
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: {},
      query: { api_key: 'x'.repeat(20_000) },
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

    expect(validateKey).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'API_KEY_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth accepts lowercase bearer authorization scheme', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockResolvedValue({
      kind: 'org',
      id: 'k-bearer-lower',
      organizationId: 'org-1',
      permissions: ['read_projects'],
      rateLimit: 100,
    });
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
        READ_PROJECTS: 'read_projects',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'bearer ck_valid-lower-bearer-key' },
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

    expect(validateKey).toHaveBeenCalledWith('ck_valid-lower-bearer-key', '127.0.0.1');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  it('apiKeyAuth skips downstream next when response is already committed after successful validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockResolvedValue({
      kind: 'org',
      id: 'k-committed',
      organizationId: 'org-1',
      permissions: ['read_projects'],
      rateLimit: 100,
    });
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
        READ_PROJECTS: 'read_projects',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'Bearer ck_valid-lower-bearer-key' },
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      headersSent: true,
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);

    expect(validateKey).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('hybridAuth awaits async JWT middleware and forwards synchronous completion', async () => {
    vi.resetModules();
    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const { hybridAuth } = mwMod;
    const jwtMiddleware = vi.fn(async (_req: any, _res: any, next: any) => {
      next();
    });
    const mw = hybridAuth(jwtMiddleware);
    const req: any = { headers: {}, query: {}, ip: '127.0.0.1', socket: { remoteAddress: '' } };
    const res: any = { setHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(jwtMiddleware).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('hybridAuth forwards async JWT middleware rejection to next', async () => {
    vi.resetModules();
    const mwMod = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const { hybridAuth } = mwMod;
    const jwtMiddleware = vi.fn(async () => {
      throw new Error('jwt boom');
    });
    const mw = hybridAuth(jwtMiddleware);
    const req: any = { headers: {}, query: {}, ip: '127.0.0.1', socket: { remoteAddress: '' } };
    const res: any = { setHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(jwtMiddleware).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0]?.[0] as Error).message).toBe('jwt boom');
  });

  it('apiKeyAuth rejects too-short API key before validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn();
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'Bearer ck_short' },
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'API_KEY_INVALID',
      })
    );
    expect(validateKey).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth logs only key fingerprint for invalid API key attempt', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockResolvedValue(null);
    const loggerWarn = vi.fn();
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: loggerWarn,
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const apiKey = 'ck_test-secret-key-material';
    const req: any = {
      headers: { authorization: `Bearer ${apiKey}` },
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

    const expectedFingerprint = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    expect(loggerWarn).toHaveBeenCalledWith(
      '[APIKeyAuth] Invalid API key attempt',
      expect.objectContaining({
        ip: '127.0.0.1',
        keyFingerprint: expectedFingerprint,
      })
    );
    expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain('test-secret-key-material');
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth rejects malformed resolved API key shape from service', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockResolvedValue({
      id: '',
      organizationId: 'org-1',
      permissions: ['read_projects'],
      rateLimit: 100,
    });
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'Bearer ck_valid-key' },
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'API_KEY_INVALID',
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.apiKey).toBeUndefined();
  });

  it('apiKeyAuth sets no-store headers when API key is missing', async () => {
    vi.resetModules();
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = { headers: {}, query: {}, ip: '127.0.0.1', socket: { remoteAddress: '' } };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer realm="consultify-api", error="invalid_token"'
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth does not write auth error response when headers are already sent', async () => {
    vi.resetModules();
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = { headers: {}, query: {}, ip: '127.0.0.1', socket: { remoteAddress: '' } };
    const res: any = {
      headersSent: true,
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('apiKeyAuth clamps invalid service rate limit to default limit header', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockResolvedValue({
      kind: 'org',
      id: 'key-invalid-rate',
      organizationId: 'org-1',
      permissions: ['read_projects'],
      rateLimit: Number.NaN,
    });
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
        READ_PROJECTS: 'read_projects',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: { authorization: 'Bearer ck_valid-key', 'x-forwarded-for': '1.2.3.4' },
      query: {},
      ip: '1.2.3.4',
      socket: { remoteAddress: '' },
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await apiKeyAuth(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '60');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('apiKeyAuth caps forwarded header scan before extracting client ip', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockResolvedValue({
      kind: 'org',
      id: 'key-forwarded-capped',
      organizationId: 'org-forwarded',
      permissions: ['read_projects'],
      rateLimit: 100,
    });
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
        READ_PROJECTS: 'read_projects',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: {
        authorization: 'Bearer ck_valid-length-key',
        'x-forwarded-for': `1.2.3.4,${'a'.repeat(20_000)}`,
      },
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

    expect(validateKey).toHaveBeenCalledWith('ck_valid-length-key', '1.2.3.4');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('apiKeyAuth strips ipv4 port suffix from x-forwarded-for before validation', async () => {
    vi.resetModules();
    const validateKey = vi.fn().mockResolvedValue({
      kind: 'org',
      id: 'key-forwarded-port',
      organizationId: 'org-forwarded-port',
      permissions: ['read_projects'],
      rateLimit: 100,
    });
    vi.doMock('../../../../server/src/services/apiKeyService.js', () => ({
      API_KEY_PERMISSIONS: {
        FULL_ACCESS: 'full_access',
        READ_PROJECTS: 'read_projects',
      },
      ApiKeyService: {
        validateKey,
      },
    }));
    const { apiKeyAuth } = await import('../../../../server/src/middleware/apiKeyAuth.middleware.ts');
    const req: any = {
      headers: {
        authorization: 'Bearer ck_valid-length-key',
        'x-forwarded-for': '1.2.3.4:5678',
      },
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

    expect(validateKey).toHaveBeenCalledWith('ck_valid-length-key', '1.2.3.4');
    expect(next).toHaveBeenCalledTimes(1);
  });
});

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
    vi.doUnmock('../../../../server/src/services/apiKeyService.js');

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
      INSERT INTO organizations (id, name, plan, status) VALUES
        ('orgW', 'API Key orgW', 'pro', 'active'),
        ('org1', 'API Key org1', 'pro', 'active'),
        ('org2', 'API Key org2', 'pro', 'active'),
        ('org3', 'API Key org3', 'pro', 'active'),
        ('org4', 'API Key org4', 'pro', 'active'),
        ('org5', 'API Key org5', 'pro', 'active'),
        ('org6', 'API Key org6', 'pro', 'active'),
        ('orgQ', 'API Key orgQ', 'pro', 'active'),
        ('orgSock', 'API Key orgSock', 'pro', 'active'),
        ('orgCleanup', 'API Key orgCleanup', 'pro', 'active'),
        ('orgHeaderThrow', 'API Key orgHeaderThrow', 'pro', 'active'),
        ('org-array-auth', 'API Key array', 'pro', 'active'),
        ('org-forwarded', 'API Key forwarded', 'pro', 'active'),
        ('org-forwarded-port', 'API Key forwarded port', 'pro', 'active'),
        ('org-ipv4mapped', 'API Key mapped', 'pro', 'active'),
        ('org-rate-no-store', 'API Key rate', 'pro', 'active')
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO users (id, organization_id, email, password, role, status)
      VALUES ('u1', 'org1', 'api-key-u1@test.local', 'hash', 'ADMIN', 'active')
      ON CONFLICT (id) DO NOTHING;
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
      await db.exec(`
        DELETE FROM api_keys;
        DELETE FROM users WHERE id = 'u1';
        DELETE FROM organizations WHERE id IN (
          'orgW', 'org1', 'org2', 'org3', 'org4', 'org5', 'org6', 'orgQ', 'orgSock',
          'orgCleanup', 'orgHeaderThrow', 'org-array-auth', 'org-forwarded',
          'org-forwarded-port', 'org-ipv4mapped', 'org-rate-no-store'
        );
      `);
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
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'API key required',
        message: expect.any(String),
        code: 'API_KEY_REQUIRED',
      })
    );
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

  it('accepts Authorization bearer token with surrounding whitespace around ck key', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'orgW',
      name: 'Key WS',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['1.2.3.4'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { authorization: `Bearer   ${plainTextKey}   `, 'x-forwarded-for': '1.2.3.4' },
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

  it('accepts IPv4-mapped IPv6 forwarded IP when whitelist contains plain IPv4', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org-ipv4mapped',
      name: 'Key IPv4 mapped',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['9.9.9.9'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: { 'x-api-key': plainTextKey, 'x-forwarded-for': '::ffff:9.9.9.9' },
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
    expect(res3.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(next3).not.toHaveBeenCalled();
  });

  it('cleans up old per-key rate limit entries periodically', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T00:00:00.000Z'));
    vi.resetModules();
    vi.doUnmock('../../../../server/src/services/apiKeyService.js');

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
    const res: any = { setHeader: vi.fn(), status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw({} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');

    const res2: any = { setHeader: vi.fn(), status: vi.fn(() => res2), json: vi.fn(() => res2) };
    const next2 = vi.fn();
    mw({ apiKey: { permissions: [API_KEY_PERMISSIONS.READ_PROJECTS] } } as any, res2, next2);
    expect(res2.status).toHaveBeenCalledWith(403);
    expect(res2.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res2.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
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
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to query api_key when headers accessor throws', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'orgHeaderThrow',
      name: 'Key Header Throw',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '' },
    };
    Object.defineProperty(req, 'headers', {
      configurable: true,
      get: () => {
        throw new Error('headers getter failed');
      },
    });
    // Keep a backup path available through query to verify middleware continues safely
    req.query.api_key = plainTextKey;

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

  it('accepts API key from Authorization header array and x-forwarded-for array', async () => {
    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org-array-auth',
      name: 'Key Array Auth',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['7.7.7.7'],
      rateLimit: 10,
      createdBy: 'u1',
    });

    const req: any = {
      headers: {
        authorization: ['Bearer', `Bearer ${plainTextKey}`],
        'x-forwarded-for': ['7.7.7.7, 10.0.0.1'],
      },
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
    expect(req.organizationId).toBe('org-array-auth');
  });

  it('rate-limited response includes no-store cache headers', async () => {
    const { plainTextKey } = await ApiKeyService.createKey({
      organizationId: 'org-rate-no-store',
      name: 'Key RL no-store',
      permissions: [API_KEY_PERMISSIONS.READ_PROJECTS],
      ipWhitelist: ['*'],
      rateLimit: 1,
      createdBy: 'u1',
    });

    const makeReq = (): any => ({
      headers: { authorization: `Bearer ${plainTextKey}`, 'x-forwarded-for': '8.8.8.8' },
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

    await apiKeyAuth(makeReq(), mkRes(), vi.fn()); // allow #1
    const res2 = mkRes();
    const next2 = vi.fn();
    await apiKeyAuth(makeReq(), res2, next2); // reject #2

    expect(res2.status).toHaveBeenCalledWith(429);
    expect(res2.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res2.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res2.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(next2).not.toHaveBeenCalled();
  });
});
