import { beforeEach, describe, expect, it, vi } from 'vitest';

import logger from '../../../../server/src/utils/Logger.js';
import {
  getSuperAdminCapabilities,
  requireSuperAdminCapability,
  setDependencies,
  verifySuperAdmin,
} from '../../../../server/src/middleware/superAdmin.middleware.js';

function mockReq(overrides: Record<string, any> = {}) {
  return {
    headers: { authorization: 'Bearer test.token.sig' },
    user: undefined as any,
    userId: undefined as any,
    userRole: undefined as any,
    organizationId: undefined as any,
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 0,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
  };
  return res;
}

function invokeVerifyCallback(args: unknown[], payload: unknown, error: unknown = null) {
  const callback = args.at(-1);
  if (typeof callback !== 'function') {
    throw new Error('verify callback is missing');
  }
  callback(error, payload);
}

describe('verifySuperAdmin', () => {
  const next = vi.fn();

  beforeEach(() => { vi.clearAllMocks(); });

  it('allows access when token has SUPERADMIN role', async () => {
    const verify = vi.fn((...args: unknown[]) => {
      invokeVerifyCallback(args, {
        id: 'admin-1',
        sub: 'admin-1',
        role: 'SUPERADMIN',
        organizationId: 'org-1',
      });
    });
    setDependencies({
      jwt: { verify } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.isSuperAdmin).toBe(true);
    expect(req.userId).toBe('admin-1');
    expect(verify).toHaveBeenCalledWith(
      'test.token.sig',
      'test-secret',
      expect.objectContaining({ algorithms: ['HS256'], clockTolerance: 30 }),
      expect.any(Function)
    );
  });

  it('rejects and skips DB lookup when jwt sub disagrees with id', async () => {
    const dbGet = vi.fn();
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'admin-1',
            sub: 'admin-2',
            role: 'SUPERADMIN',
            organizationId: 'org-1',
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet,
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('rejects when authorization header getter throws', async () => {
    setDependencies({
      jwt: { verify: vi.fn() } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    Object.defineProperty(req, 'headers', {
      configurable: true,
      get: () => {
        throw new Error('headers getter failed');
      },
    });
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('fails closed with 500 when JWT secret is missing', async () => {
    const verify = vi.fn();
    setDependencies({
      jwt: { verify } as any,
      config: { JWT_SECRET: '   ' },
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('AUTH_CONFIGURATION');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects when decoded id accessor throws', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) => {
          const payload: Record<string, unknown> = { role: 'SUPERADMIN' };
          Object.defineProperty(payload, 'id', {
            enumerable: true,
            get: () => {
              throw new Error('id getter failed');
            },
          });
          invokeVerifyCallback(args, payload);
        },
      } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('accepts bearer token from authorization header array', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'admin-array',
            role: 'SUPERADMIN',
            organizationId: 'org-array',
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: vi.fn().mockResolvedValue({ role: 'SUPERADMIN' }),
    });
    const req = mockReq({ headers: { authorization: ['Bearer', 'Bearer array.token.sig'] } });
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('admin-array');
    expect(req.organizationId).toBe('org-array');
  });

  it('fails closed when req.user accessor throws during superadmin attach phase', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'admin-attach-fail',
            role: 'SUPERADMIN',
            organizationId: 'org-1',
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: vi.fn().mockResolvedValue({ role: 'SUPERADMIN' }),
    });
    const req = mockReq();
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user accessor failed');
      },
    });
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('normalizes organization_id and user id when token contains surrounding whitespace', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: '  admin-whitespace  ',
            role: 'SUPERADMIN',
            organization_id: '  org-whitespace  ',
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('admin-whitespace');
    expect(req.organizationId).toBe('org-whitespace');
  });

  it('allows SUPER_ADMIN role', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, { id: 'a2', role: 'SUPER_ADMIN', organizationId: 'o2' }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.isSuperAdmin).toBe(true);
  });

  it('rejects when no token is provided', async () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('falls back to DB when token role is not SUPERADMIN', async () => {
    const mockDbGet = vi.fn().mockResolvedValue({ role: 'SUPERADMIN' });
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, { id: 'a3', role: 'ADMIN', organizationId: 'o3' }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: mockDbGet,
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(mockDbGet).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('rejects when DB also says non-superadmin', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, { id: 'u1', role: 'USER', organizationId: 'o1' }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: vi.fn().mockResolvedValue({ role: 'USER' }),
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('rejects tenant owners from platform superadmin routes', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, { id: 'owner-1', role: 'owner', organizationId: 'org-1' }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: vi.fn().mockResolvedValue({ role: 'owner' }),
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PLATFORM_ROLE');
  });

  it('rejects with 401 when token is invalid', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) => invokeVerifyCallback(args, null, new Error('invalid')),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(warnSpy).toHaveBeenCalledWith(
      '[SuperAdmin Middleware] JWT verification failed',
      expect.objectContaining({
        code: 'SUPERADMIN_JWT_VERIFY_FAILED',
        errorName: 'Error',
      })
    );
    warnSpy.mockRestore();
  });

  it('rejects when JWT payload is not an object and skips DB lookup', async () => {
    const dbGet = vi.fn();
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) => invokeVerifyCallback(args, 'not-an-object'),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet,
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('rejects and skips JWT verify when bearer token exceeds max length', async () => {
    const verify = vi.fn();
    setDependencies({
      jwt: { verify } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq({
      headers: {
        authorization: `Bearer ${'a'.repeat(8193)}`,
      },
    });
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects and skips JWT verify when bearer token contains control characters', async () => {
    const verify = vi.fn();
    setDependencies({
      jwt: { verify } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq({
      headers: {
        authorization: 'Bearer token-with-\nnewline',
      },
    });
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects and skips JWT verify when bearer token contains non-compact JWS characters', async () => {
    const verify = vi.fn();
    setDependencies({
      jwt: { verify } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq({
      headers: {
        authorization: 'Bearer abc+def',
      },
    });
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects and skips JWT verify when bearer token has invalid JWS segment count', async () => {
    const verify = vi.fn();
    setDependencies({
      jwt: { verify } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq({
      headers: {
        authorization: 'Bearer a.b',
      },
    });
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects and skips DB lookup when decoded subject id exceeds max length', async () => {
    const dbGet = vi.fn();
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'a'.repeat(257),
            role: 'SUPERADMIN',
            organizationId: 'org-1',
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet,
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('rejects and skips DB lookup when organization id claim exceeds max length', async () => {
    const dbGet = vi.fn();
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'admin-1',
            role: 'SUPERADMIN',
            organizationId: 'o'.repeat(257),
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet,
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('rejects and skips DB lookup when role claim exceeds max length', async () => {
    const dbGet = vi.fn();
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'admin-role-1',
            role: 'S'.repeat(129),
            organizationId: 'org-1',
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet,
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('caps processed superadminCapabilities claim entries to avoid oversized arrays', async () => {
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'admin-cap-limit',
            role: 'USER',
            organizationId: 'org-1',
            superadminCapabilities: [...Array(64).fill('invalid_capability'), 'billing_ops'],
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: vi.fn().mockResolvedValue({ role: 'USER' }),
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PLATFORM_ROLE');
  });

  it('ignores capability entries beyond raw-array cap boundary', async () => {
    const boundaryArray = [
      ...Array(8192).fill('invalid_capability'),
      'billing_ops',
    ];
    setDependencies({
      jwt: {
        verify: (...args: unknown[]) =>
          invokeVerifyCallback(args, {
            id: 'admin-cap-boundary',
            role: 'USER',
            organizationId: 'org-1',
            superadminCapabilities: boundaryArray,
          }),
      } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: vi.fn().mockResolvedValue({ role: 'USER' }),
    });
    const req = mockReq();
    const res = mockRes();

    await verifySuperAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PLATFORM_ROLE');
  });
});

describe('superadmin capabilities', () => {
  it('assigns all capability domains to canonical superadmin role', () => {
    expect(getSuperAdminCapabilities('SUPERADMIN')).toEqual([
      'platform_ops',
      'security_ops',
      'billing_ops',
      'support_ops',
      'ai_ops',
    ]);
  });

  it('does not strip canonical superadmin access for an empty explicit capability list', () => {
    expect(getSuperAdminCapabilities('SUPERADMIN', [])).toEqual([
      'platform_ops',
      'security_ops',
      'billing_ops',
      'support_ops',
      'ai_ops',
    ]);
  });

  it('allows requests that have the required capability', () => {
    const middleware = requireSuperAdminCapability('billing_ops');
    const req = mockReq({
      userRole: 'SUPERADMIN',
      user: { superadminCapabilities: ['billing_ops', 'security_ops'] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('fails closed with 500 when capability gate has no required capabilities', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const middleware = requireSuperAdminCapability();
    const req = mockReq({
      userRole: 'SUPERADMIN',
      user: { superadminCapabilities: ['billing_ops', 'platform_ops'] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('SUPERADMIN_CAPABILITY_GATE_MISCONFIGURED');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('fails closed with 500 when capability gate includes unknown capability', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const middleware = requireSuperAdminCapability('billing_ops', 'unknown_capability' as any);
    const req = mockReq({
      userRole: 'SUPERADMIN',
      user: { superadminCapabilities: ['billing_ops', 'platform_ops'] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('SUPERADMIN_CAPABILITY_GATE_MISCONFIGURED');
    expect(errorSpy).toHaveBeenCalledWith(
      '[SuperAdmin Middleware] requireSuperAdminCapability invoked with unknown capabilities',
      expect.objectContaining({
        code: 'SUPERADMIN_CAPABILITY_GATE_MISCONFIGURED',
        unknownCapabilities: ['unknown_capability'],
      })
    );
    errorSpy.mockRestore();
  });

  it('rejects requests missing the required capability', () => {
    const middleware = requireSuperAdminCapability('support_ops');
    const req = mockReq({
      userRole: 'SUPERADMIN',
      user: { superadminCapabilities: ['billing_ops'] },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PLATFORM_CAPABILITY');
  });

  it('fails closed when role and capability accessors throw in capability gate', () => {
    const middleware = requireSuperAdminCapability('platform_ops');
    const req: any = {};
    Object.defineProperty(req, 'userRole', {
      configurable: true,
      get: () => {
        throw new Error('userRole getter failed');
      },
    });
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PLATFORM_CAPABILITY');
  });
});
