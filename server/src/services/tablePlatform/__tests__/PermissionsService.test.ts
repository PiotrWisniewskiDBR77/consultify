import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import permissionsService from '../PermissionsService.js';

const BASE_ID = 'base-1';
const USER_ID = 'user-1';
const ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';

describe('PermissionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserRole', () => {
    it('returns the role when a tp_base_members row exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'data_editor' }] });
      const role = await permissionsService.getUserRole(BASE_ID, USER_ID);
      expect(role).toBe('data_editor');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('tp_base_members'), [
        BASE_ID,
        USER_ID,
      ]);
    });

    it('returns null when no membership row exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const role = await permissionsService.getUserRole(BASE_ID, USER_ID);
      expect(role).toBeNull();
    });

    it('returns null and swallows db errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      const role = await permissionsService.getUserRole(BASE_ID, USER_ID);
      expect(role).toBeNull();
    });
  });

  // 7-role hierarchy: read/write/manage per role
  describe('requireRole — 7-role hierarchy', () => {
    const READ_ROLES = [
      'base_owner',
      'schema_editor',
      'data_editor',
      'view_editor',
      'interface_builder',
      'viewer',
    ];
    const DATA_WRITE_ROLES = ['base_owner', 'schema_editor', 'data_editor'];
    const SCHEMA_WRITE_ROLES = ['base_owner', 'schema_editor'];

    it.each(READ_ROLES)('role=%s is allowed to read', async (role) => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role }] });
      const result = await permissionsService.requireRole(BASE_ID, USER_ID, ORG_ID, READ_ROLES as any);
      expect(result).toEqual({ allowed: true, role });
    });

    it('form_submitter is denied read access', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'form_submitter' }] });
      const result = await permissionsService.requireRole(BASE_ID, USER_ID, ORG_ID, READ_ROLES as any);
      expect(result).toEqual({ allowed: false, role: 'form_submitter' });
    });

    it.each(DATA_WRITE_ROLES)('role=%s can write data', async (role) => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role }] });
      const result = await permissionsService.requireRole(
        BASE_ID,
        USER_ID,
        ORG_ID,
        DATA_WRITE_ROLES as any
      );
      expect(result.allowed).toBe(true);
    });

    it.each(['view_editor', 'interface_builder', 'viewer', 'form_submitter'])(
      'role=%s cannot write data',
      async (role) => {
        mockQuery.mockResolvedValueOnce({ rows: [{ role }] });
        const result = await permissionsService.requireRole(
          BASE_ID,
          USER_ID,
          ORG_ID,
          DATA_WRITE_ROLES as any
        );
        expect(result.allowed).toBe(false);
      }
    );

    it.each(SCHEMA_WRITE_ROLES)('role=%s can manage schema', async (role) => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role }] });
      const result = await permissionsService.requireRole(
        BASE_ID,
        USER_ID,
        ORG_ID,
        SCHEMA_WRITE_ROLES as any
      );
      expect(result.allowed).toBe(true);
    });

    it('data_editor cannot manage schema', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'data_editor' }] });
      const result = await permissionsService.requireRole(
        BASE_ID,
        USER_ID,
        ORG_ID,
        SCHEMA_WRITE_ROLES as any
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('requireRole — legacy fallback', () => {
    it('falls back to org/creator access and grants base_owner when no membership row exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // getUserRole → no membership
        .mockResolvedValueOnce({ rows: [{ created_by: 'someone-else', organization_id: ORG_ID }] }); // canAccessBase

      const result = await permissionsService.requireRole(BASE_ID, USER_ID, ORG_ID, [
        'data_editor',
      ] as any);

      expect(result).toEqual({ allowed: true, role: 'base_owner' });
    });

    it('denies access for a user from a different org_id when no membership row exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // getUserRole → no membership
        .mockResolvedValueOnce({
          rows: [{ created_by: 'someone-else', organization_id: ORG_ID }],
        }); // canAccessBase — base belongs to ORG_ID, requester is OTHER_ORG_ID

      const result = await permissionsService.requireRole(BASE_ID, USER_ID, OTHER_ORG_ID, [
        'data_editor',
      ] as any);

      expect(result).toEqual({ allowed: false, role: null });
    });

    it('denies access when base does not exist at all', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // getUserRole
        .mockResolvedValueOnce({ rows: [] }); // canAccessBase → no base row

      const result = await permissionsService.requireRole(BASE_ID, USER_ID, ORG_ID, [
        'data_editor',
      ] as any);

      expect(result).toEqual({ allowed: false, role: null });
    });
  });

  describe('canAccessBase', () => {
    it('grants access to the base creator regardless of org', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: USER_ID, organization_id: OTHER_ORG_ID }],
      });
      const result = await permissionsService.canAccessBase(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(true);
    });

    it('grants access to same-org members', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'other-user', organization_id: ORG_ID }],
      });
      const result = await permissionsService.canAccessBase(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(true);
    });

    it('denies access for a foreign org_id (obcy org)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'other-user', organization_id: ORG_ID }],
      });
      const result = await permissionsService.canAccessBase(USER_ID, OTHER_ORG_ID, BASE_ID);
      expect(result).toBe(false);
    });

    it('returns false when base not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await permissionsService.canAccessBase(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(false);
    });

    it('returns false and swallows db errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      const result = await permissionsService.canAccessBase(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(false);
    });
  });

  describe('canModifyBase / canModifySchema', () => {
    it('canModifyBase true for data_editor', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'data_editor' }] });
      const result = await permissionsService.canModifyBase(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(true);
    });

    it('canModifyBase false for viewer', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] });
      const result = await permissionsService.canModifyBase(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(false);
    });

    it('canModifySchema true for schema_editor', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'schema_editor' }] });
      const result = await permissionsService.canModifySchema(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(true);
    });

    it('canModifySchema false for data_editor', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'data_editor' }] });
      const result = await permissionsService.canModifySchema(USER_ID, ORG_ID, BASE_ID);
      expect(result).toBe(false);
    });
  });

  describe('canAccessTable', () => {
    it('resolves table → base then checks base access', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ base_id: BASE_ID }] }) // table lookup
        .mockResolvedValueOnce({ rows: [{ created_by: USER_ID, organization_id: ORG_ID }] }); // canAccessBase

      const result = await permissionsService.canAccessTable(USER_ID, ORG_ID, 'tbl-1');
      expect(result).toBe(true);
    });

    it('returns false when table does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await permissionsService.canAccessTable(USER_ID, ORG_ID, 'tbl-missing');
      expect(result).toBe(false);
    });
  });

  describe('setUserRole / removeUserRole / listBaseMembers', () => {
    it('setUserRole upserts a role', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await permissionsService.setUserRole(BASE_ID, USER_ID, 'view_editor');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (base_id, user_id) DO UPDATE'),
        [BASE_ID, USER_ID, 'view_editor']
      );
    });

    it('setUserRole propagates db errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('constraint violation'));
      await expect(
        permissionsService.setUserRole(BASE_ID, USER_ID, 'view_editor')
      ).rejects.toThrow('constraint violation');
    });

    it('removeUserRole deletes membership row', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await permissionsService.removeUserRole(BASE_ID, USER_ID);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM tp_base_members'), [
        BASE_ID,
        USER_ID,
      ]);
    });

    it('listBaseMembers returns members ordered by creation', async () => {
      const members = [{ user_id: 'u1', role: 'base_owner', created_at: '2024-01-01' }];
      mockQuery.mockResolvedValueOnce({ rows: members });
      const result = await permissionsService.listBaseMembers(BASE_ID);
      expect(result).toEqual(members);
    });

    it('listBaseMembers returns [] on db error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      const result = await permissionsService.listBaseMembers(BASE_ID);
      expect(result).toEqual([]);
    });
  });

  describe('requireBaseAccess middleware', () => {
    function makeReqRes(overrides: Record<string, unknown> = {}) {
      const req: any = {
        userId: USER_ID,
        organizationId: ORG_ID,
        params: { baseId: BASE_ID },
        body: {},
        ...overrides,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();
      return { req, res, next };
    }

    it('403 when userId/orgId missing', () => {
      const { req, res, next } = makeReqRes({ userId: undefined });
      permissionsService.requireBaseAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('400 when baseId missing', () => {
      const { req, res, next } = makeReqRes({ params: {} });
      permissionsService.requireBaseAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('calls next() when access is allowed', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: USER_ID, organization_id: ORG_ID }],
      });
      const { req, res, next } = makeReqRes();
      permissionsService.requireBaseAccess(req, res, next);
      await new Promise((r) => setTimeout(r, 0));
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('403 when access denied (foreign org)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'other', organization_id: OTHER_ORG_ID }],
      });
      const { req, res, next } = makeReqRes();
      permissionsService.requireBaseAccess(req, res, next);
      await new Promise((r) => setTimeout(r, 0));
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRoles middleware — service account role capping', () => {
    function makeReqRes(overrides: Record<string, unknown> = {}) {
      const req: any = {
        userId: USER_ID,
        organizationId: ORG_ID,
        params: { baseId: BASE_ID },
        body: {},
        ...overrides,
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();
      return { req, res, next };
    }

    it('caps a service-account request to its scoped role and denies if not allowed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'base_owner' }] }); // getUserRole (legit PAT owner row)
      const { req, res, next } = makeReqRes({
        isServiceAccount: true,
        userRole: 'viewer',
      });
      const middleware = permissionsService.requireRoles('base_owner', 'schema_editor');
      middleware(req, res, next);
      await new Promise((r) => setTimeout(r, 0));

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows a service-account request when the capped role is in the allowed set', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'base_owner' }] }); // getUserRole
      const { req, res, next } = makeReqRes({
        isServiceAccount: true,
        userRole: 'data_editor',
      });
      const middleware = permissionsService.requireRoles('data_editor', 'base_owner');
      middleware(req, res, next);
      await new Promise((r) => setTimeout(r, 0));

      expect(next).toHaveBeenCalled();
      expect(req.userRole).toBe('data_editor');
    });

    it('400 when baseId cannot be resolved from any param', async () => {
      const { req, res, next } = makeReqRes({ params: {}, body: {} });
      const middleware = permissionsService.requireRoles('base_owner');
      middleware(req, res, next);
      await new Promise((r) => setTimeout(r, 0));
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
