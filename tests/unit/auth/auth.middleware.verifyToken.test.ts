import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __private__,
  optionalAuth,
  requirePermission,
  setDependencies,
  verifyToken,
} from '../../../server/src/middleware/auth.middleware';

const makeRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeNext = () => vi.fn();

const makeReq = (overrides: any = {}) => ({
  headers: {},
  path: '/api/test',
  body: {},
  query: {},
  cookies: {},
  ...overrides,
});

describe('auth.middleware verifyToken + optionalAuth + requirePermission', () => {
  beforeEach(() => {
    __private__.resetDepsForTests();
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.E2E_MODE;
    delete process.env.ENABLE_TEST_AUTH_BYPASS;
  });

  it('verifyToken uses test bypass when enabled and no token is provided', async () => {
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    const req: any = makeReq();
    const res = makeRes();
    const next = makeNext();

    await verifyToken(req, res, next);

    expect(req.user).toBeTruthy();
    expect(next).toHaveBeenCalled();
  });

  it('verifyToken returns 401 unauthorized for invalid token', async () => {
    setDependencies({
      jwt: {
        verify: (_token: string, _secret: string, cb: any) => cb(new Error('bad token')),
        decode: vi.fn(),
      } as any,
      config: { JWT_SECRET: 'secret' },
      PermissionService: { can: vi.fn().mockReturnValue(true) },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });

    const req: any = makeReq({ headers: { authorization: 'Bearer bad' } });
    const res = makeRes();
    const next = makeNext();

    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('verifyToken returns token expired for expired token', async () => {
    const err: any = new Error('expired');
    err.name = 'TokenExpiredError';
    setDependencies({
      jwt: {
        verify: (_token: string, _secret: string, cb: any) => cb(err),
        decode: vi.fn(),
      } as any,
      config: { JWT_SECRET: 'secret' },
      PermissionService: { can: vi.fn().mockReturnValue(true) },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });

    const req: any = makeReq({ headers: { authorization: 'Bearer expired' } });
    const res = makeRes();
    const next = makeNext();

    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('verifyToken attaches user and calls next for valid token', async () => {
    setDependencies({
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u-1', email: 'user@test.com', role: 'admin', organizationId: 'org-1' }),
        decode: vi.fn(),
      } as any,
      config: { JWT_SECRET: 'secret' },
      PermissionService: { can: vi.fn().mockReturnValue(true) },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });

    const req: any = makeReq({ headers: { authorization: 'Bearer good' } });
    const res = makeRes();
    const next = makeNext();

    await verifyToken(req, res, next);

    expect(req.user?.id).toBe('u-1');
    expect(req.user?.role).toBe('administrator');
    expect(next).toHaveBeenCalled();
  });

  it('optionalAuth calls next when no token present', async () => {
    setDependencies({
      jwt: { verify: vi.fn(), decode: vi.fn() } as any,
      config: { JWT_SECRET: 'secret' },
      PermissionService: { can: vi.fn().mockReturnValue(true) },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });

    const req: any = makeReq();
    const res = makeRes();
    const next = makeNext();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('optionalAuth attaches user for valid token', async () => {
    setDependencies({
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u-2', email: 'user2@test.com', role: 'member', organizationId: 'org-2' }),
        decode: vi.fn(),
      } as any,
      config: { JWT_SECRET: 'secret' },
      PermissionService: { can: vi.fn().mockReturnValue(true) },
      dbGet: vi.fn().mockResolvedValue(undefined),
    });

    const req: any = makeReq({ headers: { authorization: 'Bearer good' } });
    const res = makeRes();
    const next = makeNext();

    await optionalAuth(req, res, next);

    expect(req.user?.id).toBe('u-2');
    expect(next).toHaveBeenCalled();
  });

  it('requirePermission returns 401 when no user attached', () => {
    const req: any = makeReq();
    const res = makeRes();
    const next = makeNext();

    const mw = requirePermission('test:cap');
    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('requirePermission returns 403 when capability denied', () => {
    const req: any = makeReq();
    req.user = { id: 'u-1' } as any;
    req.can = vi.fn().mockReturnValue(false);
    const res = makeRes();
    const next = makeNext();

    const mw = requirePermission('test:cap');
    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Permission denied', required: 'test:cap' });
  });
});
