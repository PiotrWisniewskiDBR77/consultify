import { describe, expect, it, vi } from 'vitest';

import {
  __private__,
  requirePermission,
  setDependencies,
} from '../../../../server/src/middleware/permission.middleware.ts';

describe('permission middleware (server/src/middleware/permission.middleware.ts)', () => {
  it('normalizes roles for DB', () => {
    expect(__private__.normalizeRoleForDb('admin')).toBe('ADMIN');
    expect(__private__.normalizeRoleForDb('SUPERADMIN')).toBe('SUPERADMIN');
    expect(__private__.normalizeRoleForDb('user')).toBe('USER');
    expect(__private__.getRoleCandidates('user')).toEqual(['USER', 'TEAM_MEMBER']);
  });

  it('returns 401 when missing userId', async () => {
    setDependencies({
      PermissionService: { hasPermission: vi.fn(async () => true) },
      GovernanceAuditService: { logAudit: vi.fn(async () => {}) },
    });

    const mw = requirePermission('PLAYBOOK_PUBLISH');
    const req = { user: null, userId: null, organizationId: 'org-1' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when permission is denied', async () => {
    const hasPermission = vi.fn(async () => false);
    setDependencies({
      PermissionService: { hasPermission },
      GovernanceAuditService: { logAudit: vi.fn(async () => {}) },
    });

    const mw = requirePermission('PLAYBOOK_PUBLISH');
    const req = { user: { id: 'u-1', role: 'USER', organizationId: 'org-1' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await mw(req, res, next);
    expect(hasPermission).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when permission is allowed', async () => {
    const hasPermission = vi.fn(async () => true);
    setDependencies({
      PermissionService: { hasPermission },
      GovernanceAuditService: { logAudit: vi.fn(async () => {}) },
    });

    const mw = requirePermission('PLAYBOOK_PUBLISH');
    const req = { user: { id: 'u-1', role: 'ADMIN', organizationId: 'org-1' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
