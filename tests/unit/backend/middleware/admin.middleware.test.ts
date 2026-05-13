import { describe, expect, it, vi } from 'vitest';

const { dbGetMock } = vi.hoisted(() => ({
  dbGetMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: dbGetMock,
}));

import { isAdminRole, verifyAdmin } from '../../../../server/src/middleware/admin.middleware.ts';

function makeRes() {
  const res: any = {};
  res.setHeader = vi.fn(() => res);
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

    it('returns false when role coercion throws', () => {
      const roleWithThrowingToString = {
        toString: () => {
          throw new Error('toString failed');
        },
      };
      expect(isAdminRole(roleWithThrowingToString as any)).toBe(false);
    });
  });

  describe('verifyAdmin', () => {
    it('uses legacy organization_id + req.userId for membership lookup fallback', async () => {
      dbGetMock.mockResolvedValueOnce({ role: 'OWNER' });
      const req: any = {
        user: { role: 'user', organization_id: 'org-legacy' },
        userId: 'user-legacy',
      };
      const res = makeRes();
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(dbGetMock).toHaveBeenCalledWith(
        expect.stringContaining('organization_members'),
        ['org-legacy', 'user-legacy'],
        expect.objectContaining({ fallback: true })
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('falls back to req.organizationId + req.userId when req.user accessor throws', async () => {
      dbGetMock.mockResolvedValueOnce({ role: 'ADMIN' });
      const req: any = {
        organizationId: 'org-fallback',
        userId: 'user-fallback',
      };
      Object.defineProperty(req, 'user', {
        configurable: true,
        get: () => {
          throw new Error('user getter failed');
        },
      });
      const res = makeRes();
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(dbGetMock).toHaveBeenCalledWith(
        expect.stringContaining('organization_members'),
        ['org-fallback', 'user-fallback'],
        expect.objectContaining({ fallback: true })
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('falls back to req.userId when req.user.id accessor throws', async () => {
      dbGetMock.mockResolvedValueOnce({ role: 'OWNER' });
      const user: any = { organizationId: 'org-from-user' };
      Object.defineProperty(user, 'id', {
        configurable: true,
        get: () => {
          throw new Error('id getter failed');
        },
      });
      const req: any = {
        user,
        userId: 'user-fallback-id',
      };
      const res = makeRes();
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(dbGetMock).toHaveBeenCalledWith(
        expect.stringContaining('organization_members'),
        ['org-from-user', 'user-fallback-id'],
        expect.objectContaining({ fallback: true })
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('denies when no admin role present (403)', () => {
      const req: any = { user: { role: 'user' } };
      const res = makeRes();
      const next = vi.fn();
      verifyAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(next).not.toHaveBeenCalled();
    });

    it('denies with 403 when req is nullish without calling next', async () => {
      const res = makeRes();
      const next = vi.fn();

      await verifyAdmin(null as any, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('allows when req.user.role is admin', () => {
      const req: any = { user: { role: 'admin' } };
      const res = makeRes();
      const next = vi.fn();
      verifyAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('denies with 403 when allow path has invalid next handler', async () => {
      const req: any = { user: { role: 'admin' } };
      const res = makeRes();

      await verifyAdmin(req, res, undefined as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('allows when req.userRole is admin (legacy)', () => {
      const req: any = { userRole: 'administrator' };
      const res = makeRes();
      const next = vi.fn();
      verifyAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('fails closed (403) when req.user accessor throws', () => {
      const req: any = {};
      Object.defineProperty(req, 'user', {
        configurable: true,
        get: () => {
          throw new Error('user getter failed');
        },
      });
      const res = makeRes();
      const next = vi.fn();
      verifyAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows when superadmin flag is true even if userRole accessor throws', () => {
      const req: any = {
        user: { isSuperAdmin: true },
      };
      Object.defineProperty(req, 'userRole', {
        configurable: true,
        get: () => {
          throw new Error('userRole getter failed');
        },
      });
      const res = makeRes();
      const next = vi.fn();
      verifyAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('does not attempt json body when headers are already sent', async () => {
      const req: any = { user: { role: 'user' } };
      const res: any = makeRes();
      res.headersSent = true;
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('falls back to sendStatus when json throws in deny path', async () => {
      const req: any = { user: { role: 'user' } };
      const res: any = makeRes();
      res.sendStatus = vi.fn(() => res);
      res.json = vi.fn(() => {
        throw new Error('json failed');
      });
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.sendStatus).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('does not reject when status/json/sendStatus throw and end fallback exists', async () => {
      const req: any = { user: { role: 'user' } };
      const res: any = {
        headersSent: false,
        end: vi.fn(),
        status: vi.fn(() => ({
          json: () => {
            throw new Error('json failed');
          },
        })),
        sendStatus: vi.fn(() => {
          throw new Error('sendStatus failed');
        }),
      };
      const next = vi.fn();

      await expect(verifyAdmin(req, res, next)).resolves.toBeUndefined();
      expect(next).not.toHaveBeenCalled();
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('does not reject when response object is null in deny path', async () => {
      const req: any = { user: { role: 'user' } };
      const next = vi.fn();

      await expect(verifyAdmin(req, null as any, next)).resolves.toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('sanitizes invisible/control chars in lookup ids before membership fallback query', async () => {
      dbGetMock.mockResolvedValueOnce({ role: 'OWNER' });
      const req: any = {
        user: {
          role: 'user',
          organizationId: 'org\u200B-1',
          id: 'user-\u2066id\u2069',
        },
      };
      const res = makeRes();
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(dbGetMock).toHaveBeenCalledWith(
        expect.stringContaining('organization_members'),
        ['org-1', 'user-id'],
        expect.objectContaining({ fallback: true })
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('denies and skips membership lookup when orgId exceeds max lookup length', async () => {
      const req: any = {
        user: { role: 'user', organizationId: 'x'.repeat(129), id: 'user-1' },
      };
      const res = makeRes();
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(dbGetMock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('does not throw when allow-path next throws', async () => {
      const req: any = { user: { role: 'admin' } };
      const res = makeRes();
      const next = vi.fn(() => {
        throw new Error('next failed');
      });

      await expect(verifyAdmin(req, res, next as any)).resolves.toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('denies when membership role is non-string runtime value', async () => {
      dbGetMock.mockResolvedValueOnce({ role: { label: 'ADMIN' } as any });
      const req: any = {
        user: { role: 'user', organizationId: 'org-1', id: 'user-1' },
      };
      const res = makeRes();
      const next = vi.fn();

      await verifyAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

