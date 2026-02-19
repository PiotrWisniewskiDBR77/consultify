import { describe, expect, it, vi, beforeEach } from 'vitest';

import { setDependencies, verifySuperAdmin } from '../../../../server/src/middleware/superAdmin.middleware.ts';

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe('superAdmin.middleware (L1)', () => {
  beforeEach(() => {
    setDependencies({
      config: { JWT_SECRET: 'test-secret' } as any,
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u1', role: 'SUPERADMIN', organizationId: 'org1' }),
      } as any,
      dbGet: vi.fn(async () => ({ role: 'SUPERADMIN' })),
    });
  });

  it('returns 403 when no token provided', async () => {
    const req: any = { headers: undefined };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts SUPERADMIN role from token and attaches user context', async () => {
    const req: any = { headers: { authorization: 'Bearer t' } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('u1');
    expect(req.userRole).toBe('SUPERADMIN');
    expect(req.organizationId).toBe('org1');
    expect(req.user?.isSuperAdmin).toBe(true);
    expect(req.user?.role).toBe('owner');
  });

  it('accepts SUPER_ADMIN role from token when DB confirms', async () => {
    setDependencies({
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u1', role: 'SUPER_ADMIN', organizationId: 'org1' }),
      } as any,
      dbGet: vi.fn(async () => ({ role: 'SUPER_ADMIN' })),
    });

    const req: any = { headers: { authorization: 'Bearer t' } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userRole).toBe('SUPER_ADMIN');
    expect(req.user?.role).toBe('owner');
  });

  it('falls back to DB role when token role is not SUPERADMIN', async () => {
    const dbGet = vi.fn(async () => ({ role: 'SUPER_ADMIN' }));
    setDependencies({
      dbGet,
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u2', role: 'ADMIN', organization_id: 'org2' }),
      } as any,
    });

    const req: any = { headers: { authorization: 't' }, user: { id: 'u2', role: 'admin', organizationId: '' } };
    const res = makeRes();
    const next = vi.fn();

    await verifySuperAdmin(req, res as any, next as any);
    expect(dbGet).toHaveBeenCalledWith('SELECT role FROM users WHERE id = ?', ['u2']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.isSuperAdmin).toBe(true);
    expect(req.userRole).toBe('SUPER_ADMIN');
    expect(req.organizationId).toBe('org2');
  });

  it('allows when DB does not return a row but token role is SUPERADMIN (fallback to token)', async () => {
    setDependencies({
      dbGet: vi.fn(async () => undefined),
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u6', role: 'SUPERADMIN', organizationId: 'org6' }),
      } as any,
    });

    const req: any = { headers: { authorization: 'Bearer t' } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userRole).toBe('SUPERADMIN');
  });

  it('denies when token role not SUPERADMIN and DB also not SUPERADMIN', async () => {
    setDependencies({
      dbGet: vi.fn(async () => ({ role: 'USER' })),
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u3', role: 'ADMIN', organizationId: 'org3' }),
      } as any,
    });

    const req: any = { headers: { authorization: 't' } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Requires Super Admin privileges' });
    expect(next).not.toHaveBeenCalled();
  });

  it('denies when token role is SUPERADMIN but DB role is not SUPERADMIN (prevents stale privilege)', async () => {
    setDependencies({
      dbGet: vi.fn(async () => ({ role: 'ADMIN' })),
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u5', role: 'SUPERADMIN', organizationId: 'org5' }),
      } as any,
    });

    const req: any = { headers: { authorization: 'Bearer t' } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Requires Super Admin privileges' });
    expect(next).not.toHaveBeenCalled();
  });

  it('denies when DB check throws (fail-closed)', async () => {
    setDependencies({
      dbGet: vi.fn(async () => {
        throw new Error('db down');
      }),
      jwt: {
        verify: (_token: string, _secret: string, cb: any) =>
          cb(null, { id: 'u4', role: 'ADMIN', organizationId: 'org4' }),
      } as any,
    });

    const req: any = { headers: { authorization: 't' } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Requires Super Admin privileges' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header is not a string (cleanToken is empty)', async () => {
    setDependencies({
      jwt: {
        verify: (token: string, _secret: string, cb: any) => {
          if (!token) return cb(new Error('bad'));
          cb(null, { id: 'u1', role: 'SUPERADMIN', organizationId: 'org1' });
        },
      } as any,
    });
    const req: any = { headers: { authorization: 123 } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when jwt verification fails', async () => {
    setDependencies({
      jwt: {
        verify: (_token: string, _secret: string, cb: any) => cb(new Error('bad')),
      } as any,
    });
    const req: any = { headers: { authorization: 'Bearer t' } };
    const res = makeRes();
    const next = vi.fn();
    await verifySuperAdmin(req, res as any, next as any);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });
});
