/**
 * Permission Service Unit Tests
 * Tests database-backed PBAC (Permission-Based Access Control) and legacy role-based checks
 *
 * Coverage Target: 95%+
 * Critical Path: Security & Multi-Tenant Isolation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ROLES,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  CONTENT_PERMISSIONS,
  can,
  getCapabilitiesForRole,
  hasPermission,
  getUserPermissions,
  grantPermission,
  revokePermission,
  removeOverride,
  getAllPermissions,
  getPermissionsByCategory,
  getRolePermissions,
  hasContentPermission,
  grantContentPermission,
  revokeContentPermission,
  removeContentPermission,
  getContentPermissions,
  hasPermissions,
  validateContentAction,
  setDependencies,
} from '../../../server/src/services/permissionService.js';
import { createMockDb, injectDependencies } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';

// Mock DbPromise module
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  default: {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  },
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));

describe('PermissionService', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    setDependencies({ db: mockDb as any });
  });

  describe('Legacy Role-Based Checks', () => {
    describe('can()', () => {
      it('should return false for null/undefined user', () => {
        expect(can(null, CAPABILITIES.MANAGE_USERS)).toBe(false);
        expect(can(undefined, CAPABILITIES.MANAGE_USERS)).toBe(false);
      });

      it('should return false for user without role', () => {
        expect(can({}, CAPABILITIES.MANAGE_USERS)).toBe(false);
      });

      it('should allow SUPERADMIN all capabilities', () => {
        const superadmin = { role: ROLES.SUPERADMIN };
        expect(can(superadmin, CAPABILITIES.MANAGE_USERS)).toBe(true);
        expect(can(superadmin, CAPABILITIES.AI_EXECUTE_ACTIONS)).toBe(true);
        expect(can(superadmin, CAPABILITIES.MANAGE_BILLING)).toBe(true);
      });

      it('should allow ADMIN all capabilities', () => {
        const admin = { role: ROLES.ADMIN };
        expect(can(admin, CAPABILITIES.MANAGE_USERS)).toBe(true);
        expect(can(admin, CAPABILITIES.MANAGE_ORG_SETTINGS)).toBe(true);
        expect(can(admin, CAPABILITIES.CREATE_PROJECT)).toBe(true);
      });

      it('should restrict PROJECT_MANAGER capabilities', () => {
        const pm = { role: ROLES.PROJECT_MANAGER };
        expect(can(pm, CAPABILITIES.EDIT_PROJECT_SETTINGS)).toBe(true);
        expect(can(pm, CAPABILITIES.MANAGE_USERS)).toBe(false);
        expect(can(pm, CAPABILITIES.MANAGE_BILLING)).toBe(false);
      });

      it('should restrict TEAM_MEMBER to limited capabilities', () => {
        const member = { role: ROLES.TEAM_MEMBER };
        expect(can(member, CAPABILITIES.UPDATE_TASK_STATUS)).toBe(true);
        expect(can(member, CAPABILITIES.AI_VIEW_INSIGHTS)).toBe(true);
        expect(can(member, CAPABILITIES.CREATE_PROJECT)).toBe(false);
        expect(can(member, CAPABILITIES.MANAGE_USERS)).toBe(false);
      });

      it('should restrict VIEWER to read-only', () => {
        const viewer = { role: ROLES.VIEWER };
        expect(can(viewer, CAPABILITIES.AI_VIEW_INSIGHTS)).toBe(true);
        expect(can(viewer, CAPABILITIES.UPDATE_TASK_STATUS)).toBe(false);
        expect(can(viewer, CAPABILITIES.CREATE_PROJECT)).toBe(false);
      });

      it('should enforce ADMIN-only for MANAGE_USERS', () => {
        const pm = { role: ROLES.PROJECT_MANAGER };
        expect(can(pm, CAPABILITIES.MANAGE_USERS)).toBe(false);
      });

      it('should enforce ADMIN-only for MANAGE_ORG_SETTINGS', () => {
        const pm = { role: ROLES.PROJECT_MANAGER };
        expect(can(pm, CAPABILITIES.MANAGE_ORG_SETTINGS)).toBe(false);
      });
    });

    describe('getCapabilitiesForRole()', () => {
      it('should return capabilities for SUPERADMIN', () => {
        const caps = getCapabilitiesForRole(ROLES.SUPERADMIN);
        expect(caps).toHaveLength(Object.values(CAPABILITIES).length);
        expect(caps).toContain(CAPABILITIES.MANAGE_USERS);
      });

      it('should return capabilities for ADMIN', () => {
        const caps = getCapabilitiesForRole(ROLES.ADMIN);
        expect(caps).toHaveLength(Object.values(CAPABILITIES).length);
      });

      it('should return limited capabilities for PROJECT_MANAGER', () => {
        const caps = getCapabilitiesForRole(ROLES.PROJECT_MANAGER);
        expect(caps.length).toBeLessThan(Object.values(CAPABILITIES).length);
        expect(caps).toContain(CAPABILITIES.EDIT_PROJECT_SETTINGS);
        expect(caps).not.toContain(CAPABILITIES.MANAGE_USERS);
      });

      it('should return minimal capabilities for VIEWER', () => {
        const caps = getCapabilitiesForRole(ROLES.VIEWER);
        expect(caps).toHaveLength(1);
        expect(caps).toContain(CAPABILITIES.AI_VIEW_INSIGHTS);
      });

      it('should return empty array for unknown role', () => {
        const caps = getCapabilitiesForRole('UNKNOWN_ROLE' as any);
        expect(caps).toEqual([]);
      });
    });
  });

  describe('Database-Backed PBAC', () => {
    describe('hasPermission()', () => {
      it('should return false for null/undefined userId', async () => {
        expect(await hasPermission('', 'org-test-123', 'PERMISSION_KEY', ROLES.ADMIN)).toBe(false);
        expect(
          await hasPermission(null as any, 'org-test-123', 'PERMISSION_KEY', ROLES.ADMIN)
        ).toBe(false);
      });

      it('should return false for empty permissionKey', async () => {
        expect(await hasPermission('user-123', 'org-test-123', '', ROLES.ADMIN)).toBe(false);
      });

      it('should allow SUPERADMIN bypass', async () => {
        const result = await hasPermission(
          testUsers.superadmin.id,
          'org-test-123',
          'ANY_PERMISSION',
          ROLES.SUPERADMIN
        );
        expect(result).toBe(true);
        // Should not query database
        expect(DbPromise.get).not.toHaveBeenCalled();
      });

      it('should check explicit GRANT override', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({ grant_type: 'GRANT' });
        const result = await hasPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY',
          ROLES.USER
        );
        expect(result).toBe(true);
        expect(DbPromise.get).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('org_user_permissions'),
          expect.arrayContaining([testUsers.user.id, testOrganizations.org1.id, 'PERMISSION_KEY']),
          { fallback: false }
        );
      });

      it('should check explicit REVOKE override', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({ grant_type: 'REVOKE' });
        const result = await hasPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY',
          ROLES.USER
        );
        expect(result).toBe(false);
      });

      it('should fall back to role-based permission when no override', async () => {
        (DbPromise.get as any)
          .mockResolvedValueOnce(null) // No override
          .mockResolvedValueOnce({ '1': 1 }); // Role permission exists
        const result = await hasPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY',
          ROLES.USER
        );
        expect(result).toBe(true);
        expect(DbPromise.get).toHaveBeenCalledTimes(2);
      });

      it('should return false when role permission does not exist', async () => {
        (DbPromise.get as any)
          .mockResolvedValueOnce(null) // No override
          .mockResolvedValueOnce(null); // No role permission
        const result = await hasPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY',
          ROLES.USER
        );
        expect(result).toBe(false);
      });

      it('should handle database errors gracefully', async () => {
        (DbPromise.get as any).mockRejectedValueOnce(new Error('DB Error'));
        const result = await hasPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY',
          ROLES.USER
        );
        expect(result).toBe(false);
      });
    });

    describe('getUserPermissions()', () => {
      it('should return role permissions and overrides', async () => {
        (DbPromise.all as any)
          .mockResolvedValueOnce([{ permission_key: 'PERM_1' }, { permission_key: 'PERM_2' }]) // Role permissions
          .mockResolvedValueOnce([
            { permission_key: 'PERM_1', grant_type: 'REVOKE' },
            { permission_key: 'PERM_3', grant_type: 'GRANT' },
          ]); // Overrides

        const result = await getUserPermissions(
          testUsers.user.id,
          testOrganizations.org1.id,
          ROLES.USER
        );

        expect(result.rolePermissions).toEqual(['PERM_1', 'PERM_2']);
        expect(result.overrides.granted).toEqual(['PERM_3']);
        expect(result.overrides.revoked).toEqual(['PERM_1']);
        expect(result.effective).toEqual(['PERM_2', 'PERM_3']); // PERM_1 revoked, PERM_3 granted
      });

      it('should handle empty role permissions', async () => {
        (DbPromise.all as any)
          .mockResolvedValueOnce([]) // No role permissions
          .mockResolvedValueOnce([{ permission_key: 'PERM_1', grant_type: 'GRANT' }]); // One override

        const result = await getUserPermissions(
          testUsers.user.id,
          testOrganizations.org1.id,
          ROLES.USER
        );

        expect(result.rolePermissions).toEqual([]);
        expect(result.effective).toEqual(['PERM_1']);
      });

      it('should handle null database results', async () => {
        (DbPromise.all as any).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        const result = await getUserPermissions(
          testUsers.user.id,
          testOrganizations.org1.id,
          ROLES.USER
        );

        expect(result.rolePermissions).toEqual([]);
        expect(result.overrides.granted).toEqual([]);
        expect(result.overrides.revoked).toEqual([]);
        expect(result.effective).toEqual([]);
      });
    });

    describe('grantPermission()', () => {
      it('should grant permission successfully', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({ '1': 1 }); // Permission exists
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await grantPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY',
          testUsers.admin.id
        );

        expect(result.success).toBe(true);
        expect(result.userId).toBe(testUsers.user.id);
        expect(result.permissionKey).toBe('PERMISSION_KEY');
        expect(result.grantType).toBe('GRANT');
        expect(result.grantedBy).toBe(testUsers.admin.id);
        expect(DbPromise.run).toHaveBeenCalled();
      });

      it('should throw error if permission does not exist', async () => {
        (DbPromise.get as any).mockResolvedValueOnce(null); // Permission not found

        await expect(
          grantPermission(
            testUsers.user.id,
            testOrganizations.org1.id,
            'INVALID_PERMISSION',
            testUsers.admin.id
          )
        ).rejects.toThrow('Permission not found: INVALID_PERMISSION');
      });
    });

    describe('revokePermission()', () => {
      it('should revoke permission successfully', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({ '1': 1 }); // Permission exists
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await revokePermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY',
          testUsers.admin.id
        );

        expect(result.success).toBe(true);
        expect(result.grantType).toBe('REVOKE');
        expect(result.revokedBy).toBe(testUsers.admin.id);
      });

      it('should throw error if permission does not exist', async () => {
        (DbPromise.get as any).mockResolvedValueOnce(null);

        await expect(
          revokePermission(
            testUsers.user.id,
            testOrganizations.org1.id,
            'INVALID_PERMISSION',
            testUsers.admin.id
          )
        ).rejects.toThrow('Permission not found: INVALID_PERMISSION');
      });
    });

    describe('removeOverride()', () => {
      it('should remove override successfully', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await removeOverride(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY'
        );

        expect(result.removed).toBe(true);
        expect(result.userId).toBe(testUsers.user.id);
        expect(result.permissionKey).toBe('PERMISSION_KEY');
      });

      it('should return removed: false when no override exists', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 0 });

        const result = await removeOverride(
          testUsers.user.id,
          testOrganizations.org1.id,
          'PERMISSION_KEY'
        );

        expect(result.removed).toBe(false);
      });
    });

    describe('getAllPermissions()', () => {
      it('should return all permissions', async () => {
        const mockPermissions = [
          { key: 'PERM_1', description: 'Permission 1', category: 'ai' },
          { key: 'PERM_2', description: 'Permission 2', category: 'governance' },
        ];
        (DbPromise.all as any).mockResolvedValueOnce(mockPermissions);

        const result = await getAllPermissions();

        expect(result).toEqual(mockPermissions);
        expect(DbPromise.all).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('SELECT key, description, category FROM permissions'),
          []
        );
      });

      it('should handle empty result', async () => {
        (DbPromise.all as any).mockResolvedValueOnce([]);

        const result = await getAllPermissions();

        expect(result).toEqual([]);
      });
    });

    describe('getPermissionsByCategory()', () => {
      it('should return permissions filtered by category', async () => {
        const mockPermissions = [{ key: 'PERM_1', description: 'Permission 1', category: 'ai' }];
        (DbPromise.all as any).mockResolvedValueOnce(mockPermissions);

        const result = await getPermissionsByCategory('ai');

        expect(result).toEqual(mockPermissions);
        expect(DbPromise.all).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('WHERE category = ?'),
          ['ai']
        );
      });
    });

    describe('getRolePermissions()', () => {
      it('should return role permissions for specific role', async () => {
        const mockRolePerms = [
          {
            role: 'ADMIN',
            permission_key: 'PERM_1',
            description: 'Permission 1',
            category: 'ai',
          },
        ];
        (DbPromise.all as any).mockResolvedValueOnce(mockRolePerms);

        const result = await getRolePermissions(ROLES.ADMIN);

        expect(result).toEqual(mockRolePerms);
      });

      it('should return all role permissions when role is null', async () => {
        (DbPromise.all as any).mockResolvedValueOnce([]);

        const result = await getRolePermissions(null);

        expect(result).toEqual([]);
        expect(DbPromise.all).toHaveBeenCalledWith(
          mockDb,
          expect.not.stringContaining('WHERE'),
          []
        );
      });
    });
  });

  describe('Content Permissions', () => {
    describe('hasContentPermission()', () => {
      it('should return false for invalid inputs', async () => {
        expect(
          await hasContentPermission('', 'org-1', 'content-1', 'EMAIL_TEMPLATE', 'VIEW', ROLES.USER)
        ).toBe(false);
        expect(
          await hasContentPermission('user-1', 'org-1', '', 'EMAIL_TEMPLATE', 'VIEW', ROLES.USER)
        ).toBe(false);
      });

      it('should allow SUPERADMIN bypass', async () => {
        const result = await hasContentPermission(
          testUsers.superadmin.id,
          'org-1',
          'content-1',
          'EMAIL_TEMPLATE',
          'VIEW',
          ROLES.SUPERADMIN
        );
        expect(result).toBe(true);
      });

      it('should check content-specific permission first', async () => {
        (DbPromise.get as any).mockResolvedValueOnce({ grant_type: 'GRANT' });

        const result = await hasContentPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'content-1',
          'EMAIL_TEMPLATE',
          CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
          ROLES.USER
        );

        expect(result).toBe(true);
        expect(DbPromise.get).toHaveBeenCalledWith(
          mockDb,
          expect.stringContaining('content_permissions'),
          expect.arrayContaining(['content-1', 'EMAIL_TEMPLATE', testUsers.user.id])
        );
      });

      it('should fall back to general permission when no content permission', async () => {
        (DbPromise.get as any)
          .mockResolvedValueOnce(null) // No content permission
          .mockResolvedValueOnce(null) // No override
          .mockResolvedValueOnce({ '1': 1 }); // Role permission exists

        const result = await hasContentPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'content-1',
          'EMAIL_TEMPLATE',
          CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
          ROLES.USER
        );

        expect(result).toBe(true);
      });

      it('should handle database errors gracefully', async () => {
        (DbPromise.get as any).mockRejectedValueOnce(new Error('DB Error'));

        // Should fall back to general permission check
        (DbPromise.get as any).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        const result = await hasContentPermission(
          testUsers.user.id,
          testOrganizations.org1.id,
          'content-1',
          'EMAIL_TEMPLATE',
          CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
          ROLES.USER
        );

        expect(result).toBe(false);
      });
    });

    describe('grantContentPermission()', () => {
      it('should grant content permission successfully', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await grantContentPermission({
          contentId: 'content-1',
          contentType: 'EMAIL_TEMPLATE',
          userId: testUsers.user.id,
          permissionKey: CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
          grantedBy: testUsers.admin.id,
        });

        expect(result.success).toBe(true);
        expect(result.contentId).toBe('content-1');
        expect(result.grantType).toBe('GRANT');
      });

      it('should throw error for missing required fields', async () => {
        await expect(
          grantContentPermission({
            contentId: '',
            contentType: 'EMAIL_TEMPLATE',
            userId: testUsers.user.id,
            permissionKey: CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
            grantedBy: testUsers.admin.id,
          } as any)
        ).rejects.toThrow('contentId, contentType, userId, and permissionKey are required');
      });

      it('should handle expiresAt parameter', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });
        const expiresAt = new Date(Date.now() + 86400000).toISOString();

        const result = await grantContentPermission({
          contentId: 'content-1',
          contentType: 'EMAIL_TEMPLATE',
          userId: testUsers.user.id,
          permissionKey: CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
          grantedBy: testUsers.admin.id,
          expiresAt,
        });

        expect(result.expiresAt).toBe(expiresAt);
      });
    });

    describe('revokeContentPermission()', () => {
      it('should revoke content permission successfully', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await revokeContentPermission({
          contentId: 'content-1',
          contentType: 'EMAIL_TEMPLATE',
          userId: testUsers.user.id,
          permissionKey: CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
          revokedBy: testUsers.admin.id,
        });

        expect(result.success).toBe(true);
        expect(result.grantType).toBe('REVOKE');
      });
    });

    describe('removeContentPermission()', () => {
      it('should remove content permission successfully', async () => {
        (DbPromise.run as any).mockResolvedValueOnce({ changes: 1 });

        const result = await removeContentPermission(
          'content-1',
          'EMAIL_TEMPLATE',
          testUsers.user.id,
          CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW
        );

        expect(result.removed).toBe(true);
      });
    });

    describe('getContentPermissions()', () => {
      it('should return content permissions', async () => {
        const mockPerms = [
          {
            id: 'perm-1',
            content_id: 'content-1',
            content_type: 'EMAIL_TEMPLATE',
            user_id: testUsers.user.id,
            permission_key: 'VIEW',
            grant_type: 'GRANT',
            granted_by: testUsers.admin.id,
            created_at: '2024-01-01T00:00:00Z',
            expires_at: null,
            first_name: 'Test',
            last_name: 'User',
            email: 'user@test.com',
          },
        ];
        (DbPromise.all as any).mockResolvedValueOnce(mockPerms);

        const result = await getContentPermissions('content-1', 'EMAIL_TEMPLATE');

        expect(result).toHaveLength(1);
        expect(result[0].contentId).toBe('content-1');
      });
    });
  });

  describe('Multi-Permission Checks', () => {
    describe('hasPermissions()', () => {
      it('should return empty object for empty permission keys', async () => {
        const result = await hasPermissions(testUsers.user.id, 'org-1', [], ROLES.USER);
        expect(result).toEqual({});
      });

      it('should allow SUPERADMIN all permissions', async () => {
        const result = await hasPermissions(
          testUsers.superadmin.id,
          'org-1',
          ['PERM_1', 'PERM_2'],
          ROLES.SUPERADMIN
        );
        expect(result).toEqual({ PERM_1: true, PERM_2: true });
      });

      it('should check multiple permissions', async () => {
        (DbPromise.get as any)
          .mockResolvedValueOnce(null) // No override for PERM_1
          .mockResolvedValueOnce({ '1': 1 }) // Role permission exists for PERM_1
          .mockResolvedValueOnce({ grant_type: 'GRANT' }); // Override GRANT for PERM_2

        const result = await hasPermissions(
          testUsers.user.id,
          testOrganizations.org1.id,
          ['PERM_1', 'PERM_2'],
          ROLES.USER
        );

        expect(result.PERM_1).toBe(true);
        expect(result.PERM_2).toBe(true);
      });
    });
  });

  describe('Content Action Validation', () => {
    describe('validateContentAction()', () => {
      it('should validate VIEW action for EMAIL_TEMPLATE', async () => {
        (DbPromise.get as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ '1': 1 });

        const result = await validateContentAction({
          userId: testUsers.user.id,
          orgId: testOrganizations.org1.id,
          userRole: ROLES.USER,
          contentId: 'content-1',
          contentType: 'EMAIL_TEMPLATE',
          action: 'VIEW',
        });

        expect(result.allowed).toBe(true);
      });

      it('should validate CREATE action for PLAYBOOK_TEMPLATE', async () => {
        // When contentId is not provided, hasPermission is called directly
        // 1. Check override (null)
        // 2. Check role permission ({ '1': 1 })
        (DbPromise.get as any)
          .mockResolvedValueOnce(null) // No override
          .mockResolvedValueOnce({ '1': 1 }); // Role permission exists

        const result = await validateContentAction({
          userId: testUsers.user.id,
          orgId: testOrganizations.org1.id,
          userRole: ROLES.USER,
          contentType: 'PLAYBOOK_TEMPLATE',
          action: 'CREATE',
        });

        expect(result.allowed).toBe(true);
      });

      it('should return false for unknown action', async () => {
        const result = await validateContentAction({
          userId: testUsers.user.id,
          orgId: testOrganizations.org1.id,
          userRole: ROLES.USER,
          contentType: 'EMAIL_TEMPLATE',
          action: 'UNKNOWN_ACTION',
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Unknown action');
      });

      it('should return false with reason when permission denied', async () => {
        (DbPromise.get as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);

        const result = await validateContentAction({
          userId: testUsers.user.id,
          orgId: testOrganizations.org1.id,
          userRole: ROLES.USER,
          contentType: 'EMAIL_TEMPLATE',
          action: 'VIEW',
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Permission denied');
      });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not allow user from Org A to access Org B permissions', async () => {
      // User from Org A tries to check permission in Org B
      (DbPromise.get as any)
        .mockResolvedValueOnce(null) // No override in Org B
        .mockResolvedValueOnce(null); // No role permission

      const result = await hasPermission(
        testUsers.user.id, // User from org-test-123
        testOrganizations.org2.id, // Trying to access org-test-456
        'PERMISSION_KEY',
        ROLES.USER
      );

      expect(result).toBe(false);
      // Verify query includes correct organization ID
      expect(DbPromise.get).toHaveBeenNthCalledWith(
        1,
        mockDb,
        expect.anything(),
        expect.arrayContaining([testUsers.user.id, testOrganizations.org2.id, 'PERMISSION_KEY']),
        { fallback: false }
      );
    });

    it('should isolate content permissions by organization', async () => {
      // No content permission for user in different org
      (DbPromise.get as any)
        .mockResolvedValueOnce(null) // No content permission
        .mockResolvedValueOnce(null) // No override
        .mockResolvedValueOnce(null); // No role permission

      const result = await hasContentPermission(
        testUsers.user.id,
        testOrganizations.org2.id, // Different org
        'content-1',
        'EMAIL_TEMPLATE',
        CONTENT_PERMISSIONS.EMAIL_TEMPLATE_VIEW,
        ROLES.USER
      );

      expect(result).toBe(false);
    });
  });
});
