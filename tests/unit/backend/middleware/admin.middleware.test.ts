import { describe, expect, it, vi } from 'vitest';

const { dbGetMock } = vi.hoisted(() => ({
  dbGetMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: dbGetMock,
}));

vi.mock('../../../../server/src/services/organizationService.js', () => ({
  normalizeOrganizationRole: (role?: string) => String(role || '').trim().toUpperCase(),
}));

import { isAdminRole, verifyAdmin } from '../../../../server/src/middleware/admin.middleware.ts';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('admin.middleware (L1)', () => {
  describe('isAdminRole', () => {
    it('returns false for missing role', () => {
      expect(isAdminRole(undefined)).toBe(false);
    });

    it('returns true for known admin roles (case-insensitive)', () => {
      expect(isAdminRole('admin')).toBe(true);
      expect(isAdminRole('Administrator')).toBe(true);
      expect(isAdminRole('superadmin')).toBe(true);
      expect(isAdminRole('owner')).toBe(true);
    });

    it('returns false for non-admin roles', () => {
      expect(isAdminRole('user')).toBe(false);
      expect(isAdminRole('team_member')).toBe(false);
    });

    it('normalizes non-string role values via String()', () => {
      expect(isAdminRole(123 as any)).toBe(false);
    });
  });

  describe('verifyAdmin', () => {
    it('denies when no org context and not superadmin (403)', async () => {
      const req: any = { user: { id: 'u1', role: 'user' } };
      const res = makeRes();
      const next = vi.fn();
      await verifyAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('allows when request is superadmin', async () => {
      const req: any = { user: { id: 'u1', isSuperAdmin: true } };
      const res = makeRes();
      const next = vi.fn();
      await verifyAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows when org membership role is ADMIN', async () => {
      dbGetMock.mockResolvedValueOnce({ role: 'ADMIN' });
      const req: any = { user: { id: 'u1', organizationId: 'org-1', role: 'user' } };
      const res = makeRes();
      const next = vi.fn();
      await verifyAdmin(req, res, next);
      expect(dbGetMock).toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

