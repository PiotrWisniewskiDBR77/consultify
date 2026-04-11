import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSuperAdminCapabilities,
  requireSuperAdminCapability,
  setDependencies,
  verifySuperAdmin,
} from '../../../../server/src/middleware/superAdmin.middleware.js';

function mockReq(overrides: Record<string, any> = {}) {
  return {
    headers: { authorization: 'Bearer test-token' },
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

describe('verifySuperAdmin', () => {
  const next = vi.fn();

  beforeEach(() => { vi.clearAllMocks(); });

  it('allows access when token has SUPERADMIN role', async () => {
    setDependencies({
      jwt: { verify: (_t: string, _s: string, cb: any) => cb(null, { id: 'admin-1', role: 'SUPERADMIN', organizationId: 'org-1' }) } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.isSuperAdmin).toBe(true);
    expect(req.userId).toBe('admin-1');
  });

  it('allows SUPER_ADMIN role', async () => {
    setDependencies({
      jwt: { verify: (_t: string, _s: string, cb: any) => cb(null, { id: 'a2', role: 'SUPER_ADMIN', organizationId: 'o2' }) } as any,
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
    expect(res.statusCode).toBe(403);
  });

  it('falls back to DB when token role is not SUPERADMIN', async () => {
    const mockDbGet = vi.fn().mockResolvedValue({ role: 'SUPERADMIN' });
    setDependencies({
      jwt: { verify: (_t: string, _s: string, cb: any) => cb(null, { id: 'a3', role: 'ADMIN', organizationId: 'o3' }) } as any,
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
      jwt: { verify: (_t: string, _s: string, cb: any) => cb(null, { id: 'u1', role: 'USER', organizationId: 'o1' }) } as any,
      config: { JWT_SECRET: 'test-secret' },
      dbGet: vi.fn().mockResolvedValue({ role: 'USER' }),
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('rejects with 401 when token is invalid', async () => {
    setDependencies({
      jwt: { verify: (_t: string, _s: string, cb: any) => cb(new Error('invalid'), null) } as any,
      config: { JWT_SECRET: 'test-secret' },
    });
    const req = mockReq();
    const res = mockRes();
    await verifySuperAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
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
});
