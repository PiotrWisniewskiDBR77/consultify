import { describe, expect, it, vi } from 'vitest';

import { requireOrgAccess, requireOrgRole, requireRole } from '../../../../server/src/middleware/rbac.middleware.ts';

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

describe('rbac.middleware (L1)', () => {
  it('requireRole: no-ops when no roles provided', () => {
    const req: any = { user: { role: 'guest' } };
    const res = makeRes();
    const next = vi.fn();
    requireRole()(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireRole: denies when role not allowed', () => {
    const req: any = { user: { role: 'guest' } };
    const res = makeRes();
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: 'Insufficient role' });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: allows when role matches (case-insensitive)', () => {
    const req: any = { user: { role: 'ADMIN' } };
    const res = makeRes();
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireRole: supports legacy req.userRole', () => {
    const req: any = { userRole: 'administrator' };
    const res = makeRes();
    const next = vi.fn();
    requireRole('administrator')(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireOrgAccess: denies when no orgId', () => {
    const req: any = { user: { organizationId: '' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: 'Organization access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: allows when orgId exists (req.user)', () => {
    const req: any = { user: { organizationId: 'org1' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireOrgRole is an alias of requireRole', () => {
    const req: any = { user: { role: 'admin' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgRole('admin')(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

