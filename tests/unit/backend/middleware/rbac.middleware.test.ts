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

  it('requireRole: does not throw when next is not a function on allow path', () => {
    const req: any = { user: { role: 'admin' } };
    const res = makeRes();
    expect(() => requireRole('admin')(req, res as any, undefined as any)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('requireRole: caps oversized required role list deterministically (admin beyond cap stays denied)', () => {
    const req: any = { user: { role: 'admin' } };
    const res = makeRes();
    const next = vi.fn();
    const requiredRoles = Array.from({ length: 200 }, (_, i) => `role_${i}`);
    requiredRoles.push('admin');

    expect(() => requireRole(...requiredRoles)(req, res as any, next as any)).not.toThrow();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
  });

  it('requireRole: does not throw when next is not a function on deny path', () => {
    const req: any = { user: { role: 'guest' } };
    const res = makeRes();
    expect(() => requireRole('admin')(req, res as any, undefined as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
  });

  it('requireRole: denies when role not allowed', () => {
    const req: any = { user: { role: 'guest' } };
    const res = makeRes();
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: fails closed when req is null', () => {
    const res = makeRes();
    const next = vi.fn();

    requireRole('admin')(null as any, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
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

  // Regression: GET /api/my-work/team-workload is an org-wide roll-up (every
  // user's capacity/utilization). It must mirror the client Manager-tab gate
  // (useUserCan: admin | manager | superadmin/owner). requireRole('manager',
  // 'admin') is the guard applied in server/src/routes/my-work/stats.routes.ts.
  describe("my-work /team-workload gate = requireRole('manager','admin')", () => {
    const guard = () => requireRole('manager', 'admin');

    it.each([
      ['manager', 'exact match'],
      ['admin', 'hierarchy level >= admin'],
      ['owner', 'canonicalises to superadmin'],
      ['superadmin', 'short-circuit'],
      ['super_admin', 'superadmin alias'],
    ])('allows %s (%s)', (role) => {
      const req: any = { user: { role } };
      const res = makeRes();
      const next = vi.fn();
      guard()(req, res as any, next as any);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it.each(['user', 'member', 'team_member', 'viewer', 'guest'])(
      'denies pilot/respondent role %s with 403',
      (role) => {
        const req: any = { user: { role } };
        const res = makeRes();
        const next = vi.fn();
        guard()(req, res as any, next as any);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.body).toEqual({
          error: 'Insufficient role',
          code: 'RBAC_INSUFFICIENT_ROLE',
        });
      }
    );
  });

  it('requireOrgAccess: denies when no orgId', () => {
    const req: any = { user: { organizationId: '' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: fails closed when req is null', () => {
    const res = makeRes();
    const next = vi.fn();

    requireOrgAccess()(null as any, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: allows when orgId exists (req.user)', () => {
    const req: any = { user: { organizationId: 'org1' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireOrgAccess: does not throw when next is not a function', () => {
    const req: any = { user: { organizationId: 'org1' } };
    const res = makeRes();
    expect(() => requireOrgAccess()(req, res as any, undefined as any)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies when next is not a function on deny path', () => {
    const req: any = { user: { organizationId: '' } };
    const res = makeRes();
    expect(() => requireOrgAccess()(req, res as any, undefined as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });

  it('requireOrgAccess: allows when only legacy organization_id exists', () => {
    const req: any = { user: { organization_id: 'org-legacy' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireOrgRole is an alias of requireRole', () => {
    const req: any = { user: { role: 'admin' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgRole('admin')(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireRole: fails closed when req.userRole accessor throws', () => {
    const req: any = {};
    Object.defineProperty(req, 'userRole', {
      configurable: true,
      get: () => {
        throw new Error('userRole getter failed');
      },
    });
    req.user = { role: 'guest' };
    const res = makeRes();
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies when organizationId accessor throws', () => {
    const req: any = {};
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: avoids writing when headers are already sent', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.headersSent = true;
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: avoids writing when response writableEnded is true', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.writableEnded = true;
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: avoids writing when writableEnded is true', () => {
    const req: any = { user: { organizationId: '' } };
    const res: any = makeRes();
    res.writableEnded = true;
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: avoids writing when response finished is true', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.finished = true;
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: avoids writing when response finished is true', () => {
    const req: any = { user: { organizationId: '' } };
    const res: any = makeRes();
    res.finished = true;
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: avoids writing when response writableFinished is true', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.writableFinished = true;
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: avoids writing when response destroyed is true', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.destroyed = true;
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: avoids writing when response writableFinished is true', () => {
    const req: any = { user: { organizationId: '' } };
    const res: any = makeRes();
    res.writableFinished = true;
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: avoids writing when response destroyed is true', () => {
    const req: any = { user: { organizationId: '' } };
    const res: any = makeRes();
    res.destroyed = true;
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: avoids json write when status marks response as committed', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.status = vi.fn((code: number) => {
      res.statusCode = code;
      res.headersSent = true;
      return res;
    });
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: avoids json write when status marks response as committed', () => {
    const req: any = { user: { organizationId: '' } };
    const res: any = makeRes();
    res.status = vi.fn((code: number) => {
      res.statusCode = code;
      res.headersSent = true;
      return res;
    });
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies placeholder string org identifiers', () => {
    const req: any = { user: { organizationId: ' null ' } };
    const res = makeRes();
    const next = vi.fn();
    requireOrgAccess()(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies when organization id exceeds max safety length', () => {
    const req: any = { user: { organizationId: 'o'.repeat(257) } };
    const res = makeRes();
    const next = vi.fn();

    requireOrgAccess()(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies when organization id contains control characters', () => {
    const req: any = { user: { organizationId: 'org-\u0000-1' } };
    const res = makeRes();
    const next = vi.fn();

    requireOrgAccess()(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies when organization id contains bidi override characters', () => {
    const req: any = { user: { organizationId: 'org-\u202E-1' } };
    const res = makeRes();
    const next = vi.fn();

    requireOrgAccess()(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies when organization id contains traversal delimiters', () => {
    const req: any = { user: { organizationId: 'org/../x' } };
    const res = makeRes();
    const next = vi.fn();

    requireOrgAccess()(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: denies when organization id contains angle bracket delimiters', () => {
    const req: any = { user: { organizationId: 'org<unsafe>' } };
    const res = makeRes();
    const next = vi.fn();

    requireOrgAccess()(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: fails closed when required role coercion throws', () => {
    const req: any = { userRole: 'admin' };
    const res = makeRes();
    const next = vi.fn();
    const badRole: any = {
      toString: () => {
        throw new Error('coercion failed');
      },
    };

    requireRole(badRole)(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: allows when req.userRole is sufficient even if req.user getter throws', () => {
    const req: any = { userRole: 'admin' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();

    requireRole('admin')(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireRole: fails closed when attached user role value exceeds max input length', () => {
    const req: any = { user: { role: `admin${'x'.repeat(2000)}` } };
    const res = makeRes();
    const next = vi.fn();
    requireRole('admin')(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: does not throw when deny response json writer throws', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();

    expect(() => requireRole('admin')(req, res as any, next as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: does not throw when deny response json writer throws', () => {
    const req: any = { user: { organizationId: '' } };
    const res: any = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();

    expect(() => requireOrgAccess()(req, res as any, next as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: does not throw when deny response status writer throws', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    res.status = vi.fn(() => {
      throw new Error('status failed');
    });
    const next = vi.fn();

    expect(() => requireRole('admin')(req, res as any, next as any)).not.toThrow();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: does not throw when deny path receives missing response object', () => {
    const req: any = { user: { role: 'guest' } };
    const next = vi.fn();

    expect(() => requireRole('admin')(req, null as any, next as any)).not.toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRole: swallows downstream next throws on allow path', () => {
    const req: any = { user: { role: 'admin' } };
    const res = makeRes();
    const next = vi.fn(() => {
      throw new Error('next failed');
    });

    expect(() => requireRole('admin')(req, res as any, next as any)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireRole: skips allow-path next when response is already committed', () => {
    const req: any = { user: { role: 'admin' } };
    const res: any = makeRes();
    res.headersSent = true;
    const next = vi.fn();

    requireRole('admin')(req, res as any, next as any);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('requireRole: fails closed when internal role-checking path throws unexpectedly', () => {
    const req: any = { user: { role: 'admin' } };
    const res = makeRes();
    const next = vi.fn();
    const someSpy = vi.spyOn(Array.prototype, 'some').mockImplementationOnce(() => {
      throw new Error('some failed');
    });

    expect(() => requireRole('admin')(req, res as any, next as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
    expect(next).not.toHaveBeenCalled();
    someSpy.mockRestore();
  });

  it('requireOrgAccess: fails closed when internal org checks throw unexpectedly', () => {
    const req: any = { user: { organizationId: 'org-safe' } };
    const res = makeRes();
    const next = vi.fn();
    const includesSpy = vi.spyOn(String.prototype, 'includes').mockImplementationOnce(() => {
      throw new Error('includes failed');
    });

    expect(() => requireOrgAccess()(req, res as any, next as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
    includesSpy.mockRestore();
  });

  it('requireOrgAccess: skips allow-path next when response is already committed', () => {
    const req: any = { user: { organizationId: 'org-safe' } };
    const res: any = makeRes();
    res.writableEnded = true;
    const next = vi.fn();

    requireOrgAccess()(req, res as any, next as any);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('requireRole: uses send fallback when deny response json writer is missing', () => {
    const req: any = { user: { role: 'guest' } };
    const res: any = makeRes();
    delete res.json;
    res.send = vi.fn(() => res);
    const next = vi.fn();

    expect(() => requireRole('admin')(req, res as any, next as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Insufficient role',
      code: 'RBAC_INSUFFICIENT_ROLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgAccess: uses send fallback when deny response json writer is missing', () => {
    const req: any = { user: { organizationId: '' } };
    const res: any = makeRes();
    delete res.json;
    res.send = vi.fn(() => res);
    const next = vi.fn();

    expect(() => requireOrgAccess()(req, res as any, next as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });
});

