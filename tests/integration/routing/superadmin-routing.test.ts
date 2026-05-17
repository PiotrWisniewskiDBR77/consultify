import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSuperAdminCapabilities,
  setDependencies,
  verifySuperAdmin,
} from '../../../server/src/middleware/superAdmin.middleware.js';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('Superadmin routing (verifySuperAdmin middleware) - REAL_CODE', () => {
  beforeEach(() => {
    setDependencies({
      config: { JWT_SECRET: 'secret' } as any,
      jwt: {
        verify: vi.fn(),
      } as any,
      dbGet: vi.fn(),
    });
  });

  it('returns 401 when no token provided', async () => {
    const req: any = { headers: {}, user: undefined };
    const res = makeRes();
    const next = vi.fn();

    await verifySuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', async () => {
    const jwtVerify = vi.fn((_t: any, _s: any, cb: any) => cb(new Error('bad'), null));
    setDependencies({ jwt: { verify: jwtVerify } as any });

    const req: any = { headers: { authorization: 'Bearer bad' } };
    const res = makeRes();
    const next = vi.fn();

    await verifySuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not superadmin and DB role is not superadmin', async () => {
    const jwtVerify = vi.fn((_t: any, _s: any, cb: any) => cb(null, { id: 'u-1', role: 'ADMIN' }));
    const dbGet = vi.fn(async () => ({ role: 'ADMIN' }));
    setDependencies({ jwt: { verify: jwtVerify } as any, dbGet: dbGet as any });

    const req: any = { headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    const next = vi.fn();

    await verifySuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches superadmin flags when token role is SUPERADMIN', async () => {
    const jwtVerify = vi.fn((_t: any, _s: any, cb: any) =>
      cb(null, { id: 'u-1', role: 'SUPERADMIN', organizationId: 'org-1' })
    );
    setDependencies({ jwt: { verify: jwtVerify } as any });

    const req: any = { headers: { authorization: 'Bearer ok' }, user: { id: 'u-1' } };
    const res = makeRes();
    const next = vi.fn();

    await verifySuperAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.isSuperAdmin).toBe(true);
    expect(req.userId).toBe('u-1');
  });

  it('allows access when DB role promotes user to SUPERADMIN', async () => {
    const jwtVerify = vi.fn((_t: any, _s: any, cb: any) => cb(null, { id: 'u-1', role: 'ADMIN' }));
    const dbGet = vi.fn(async () => ({ role: 'SUPERADMIN' }));
    setDependencies({ jwt: { verify: jwtVerify } as any, dbGet: dbGet as any });

    const req: any = { headers: { authorization: 'Bearer ok' } };
    const res = makeRes();
    const next = vi.fn();

    await verifySuperAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.isSuperAdmin).toBe(true);
  });

  it('keeps full canonical capabilities for SUPERADMIN with an empty override list', () => {
    expect(getSuperAdminCapabilities('SUPERADMIN', [])).toEqual([
      'platform_ops',
      'security_ops',
      'billing_ops',
      'support_ops',
      'ai_ops',
    ]);
  });
});
