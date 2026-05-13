import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  auditAction,
  requireAnyPermission,
  requireAllPermissions,
  requirePermission,
  setDependencies,
} from '../../../../server/src/middleware/permissionMiddleware.ts';

describe('permissionMiddleware.ts', () => {
  const mockPermissionService = {
    hasPermission: vi.fn(),
  };
  const mockAuditService = {
    logAudit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setDependencies({
      PermissionService: mockPermissionService as any,
      GovernanceAuditService: mockAuditService as any,
    });
  });

  it('returns 401 when auth accessor throws in requirePermission', async () => {
    const middleware = requirePermission('PROJECT_READ');
    const req: any = {};
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePermission skips writes when response is already committed', async () => {
    const middleware = requirePermission('PROJECT_READ');
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 and skips permission service when requirePermission key is blank', async () => {
    const middleware = requirePermission('   ');
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
      })
    );
    expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requirePermission denies when permission service returns truthy non-boolean value', async () => {
    mockPermissionService.hasPermission.mockResolvedValueOnce([] as any);
    const middleware = requirePermission('PROJECT_READ');
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps audit flow when req.get throws while resolving correlation id', async () => {
    const middleware = auditAction({ action: 'UPDATE' as any, resourceType: 'PROJECT' as any });
    const req: any = {
      user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' },
      get: () => {
        throw new Error('header getter failed');
      },
    };
    const originalJson = vi.fn().mockResolvedValue({ ok: true });
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    await middleware(req, res, next);
    await res.json({ ok: true });

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockAuditService.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u-1',
        orgId: 'org-1',
        correlationId: null,
      })
    );
  });

  it('keeps request flow when response json binder throws before wrapping', async () => {
    const middleware = auditAction({ action: 'UPDATE' as any, resourceType: 'PROJECT' as any });
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = {};
    Object.defineProperty(res, 'json', {
      configurable: true,
      get: () => {
        throw new Error('json binder failed');
      },
    });
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockAuditService.logAudit).not.toHaveBeenCalled();
  });

  it('requireAllPermissions denies when provided permission list is empty', async () => {
    const middleware = requireAllPermissions([]);
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
        missing: [],
      })
    );
    expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAnyPermission denies safely when permission key input is not an array', async () => {
    const middleware = requireAnyPermission(null as any);
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
        requiredAny: [],
      })
    );
    expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAllPermissions denies safely when permission key input is not an array', async () => {
    const middleware = requireAllPermissions(undefined as any);
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
        missing: [],
      })
    );
    expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAnyPermission denies when all keys are blank after normalization', async () => {
    const middleware = requireAnyPermission(['', '   '] as any);
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PERMISSION_DENIED',
        requiredAny: [],
      })
    );
    expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAnyPermission returns a snapshot copy of requiredAny response keys', async () => {
    mockPermissionService.hasPermission.mockResolvedValue(false);
    const keys = ['PROJECT_READ', 'PROJECT_WRITE'];
    const middleware = requireAnyPermission(keys);
    const req: any = { user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);
    keys.push('PROJECT_DELETE');

    const payload = res.json.mock.calls[0]?.[0];
    expect(payload.requiredAny).toEqual(['PROJECT_READ', 'PROJECT_WRITE']);
    expect(payload.requiredAny).not.toBe(keys);
    expect(next).not.toHaveBeenCalled();
  });

  it('auditAction tolerates throwing resource accessors and logs null snapshots', async () => {
    const middleware = auditAction({
      action: 'UPDATE' as any,
      resourceType: 'PROJECT' as any,
      getResourceId: () => {
        throw new Error('resource id failed');
      },
      getBefore: () => {
        throw new Error('before failed');
      },
      getAfter: () => {
        throw new Error('after failed');
      },
    });
    const req: any = {
      user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' },
      get: vi.fn().mockReturnValue(undefined),
    };
    const originalJson = vi.fn().mockResolvedValue({ ok: true });
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    await middleware(req, res, next);
    await res.json({ ok: true });

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockAuditService.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: null,
        before: null,
        after: null,
      })
    );
  });

  it('auditAction wraps response json only once when middleware is mounted twice', async () => {
    const middleware = auditAction({ action: 'UPDATE' as any, resourceType: 'PROJECT' as any });
    const req: any = {
      user: { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' },
      get: vi.fn().mockReturnValue(undefined),
    };
    const originalJson = vi.fn().mockResolvedValue({ ok: true });
    const res: any = { statusCode: 200, json: originalJson };
    const next = vi.fn();

    await middleware(req, res, next);
    await middleware(req, res, next);
    await res.json({ ok: true });

    expect(next).toHaveBeenCalledTimes(2);
    expect(mockAuditService.logAudit).toHaveBeenCalledTimes(1);
  });
});
