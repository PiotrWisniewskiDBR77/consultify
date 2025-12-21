/**
 * Permission Service Tests
 * 
 * CRITICAL SECURITY SERVICE - Must have 95%+ coverage
 * Tests PBAC (Permission-Based Access Control), multi-tenant isolation, and role-based permissions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testPermissions } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);
const PermissionService = require('../../../server/services/permissionService.js');

describe('PermissionService', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = createMockDb();
        
        // Mock database module
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Legacy: can() - Role-based capability check', () => {
        it('should allow SUPERADMIN all capabilities', () => {
            const user = { role: PermissionService.ROLES.SUPERADMIN };
            const result = PermissionService.can(user, PermissionService.CAPABILITIES.MANAGE_USERS);
            expect(result).toBe(true);
        });

        it('should allow ADMIN to manage users', () => {
            const user = { role: PermissionService.ROLES.ADMIN };
            const result = PermissionService.can(user, PermissionService.CAPABILITIES.MANAGE_USERS);
            expect(result).toBe(true);
        });

        it('should deny PROJECT_MANAGER from managing users', () => {
            const user = { role: PermissionService.ROLES.PROJECT_MANAGER };
            const result = PermissionService.can(user, PermissionService.CAPABILITIES.MANAGE_USERS);
            expect(result).toBe(false);
        });

        it('should deny user without role', () => {
            const user = { role: null };
            const result = PermissionService.can(user, PermissionService.CAPABILITIES.MANAGE_USERS);
            expect(result).toBe(false);
        });

        it('should deny null user', () => {
            const result = PermissionService.can(null, PermissionService.CAPABILITIES.MANAGE_USERS);
            expect(result).toBe(false);
        });
    });

    describe('hasPermission() - Database-backed PBAC', () => {
        it('should return false for missing userId', async () => {
            const result = await PermissionService.hasPermission(null, 'org-1', 'PLAYBOOK_PUBLISH', 'ADMIN');
            expect(result).toBe(false);
        });

        it('should return false for missing permissionKey', async () => {
            const result = await PermissionService.hasPermission('user-1', 'org-1', null, 'ADMIN');
            expect(result).toBe(false);
        });

        it('should allow SUPERADMIN bypass', async () => {
            const result = await PermissionService.hasPermission(
                testUsers.superadmin.id,
                'org-1',
                'PLAYBOOK_PUBLISH',
                PermissionService.ROLES.SUPERADMIN
            );
            expect(result).toBe(true);
            // Should not query DB for SUPERADMIN
            expect(mockDb.get).not.toHaveBeenCalled();
        });

        it('should grant permission from explicit org-user override', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const permissionKey = 'PLAYBOOK_PUBLISH';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('org_user_permissions')) {
                    // Explicit override exists
                    callback(null, { grant_type: 'GRANT' });
                } else {
                    callback(null, null);
                }
            });

            const result = await PermissionService.hasPermission(
                userId,
                orgId,
                permissionKey,
                PermissionService.ROLES.USER
            );

            expect(result).toBe(true);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('org_user_permissions'),
                expect.arrayContaining([userId, orgId, permissionKey]),
                expect.any(Function)
            );
        });

        it('should deny permission from explicit org-user override', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const permissionKey = 'PLAYBOOK_PUBLISH';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('org_user_permissions')) {
                    // Explicit override exists with REVOKE
                    callback(null, { grant_type: 'REVOKE' });
                } else {
                    callback(null, null);
                }
            });

            const result = await PermissionService.hasPermission(
                userId,
                orgId,
                permissionKey,
                PermissionService.ROLES.ADMIN
            );

            expect(result).toBe(false);
        });

        it('should fallback to role-based permission when no override', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const permissionKey = 'PLAYBOOK_PUBLISH';

            let callCount = 0;
            mockDb.get.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // No explicit override
                    callback(null, null);
                } else if (callCount === 2) {
                    // Role permission exists
                    callback(null, { 1: 1 });
                } else {
                    callback(null, null);
                }
            });

            const result = await PermissionService.hasPermission(
                userId,
                orgId,
                permissionKey,
                PermissionService.ROLES.ADMIN
            );

            expect(result).toBe(true);
            expect(mockDb.get).toHaveBeenCalledTimes(2);
        });

        it('should deny permission when role permission not found', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const permissionKey = 'PLAYBOOK_PUBLISH';

            let callCount = 0;
            mockDb.get.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // No explicit override
                    callback(null, null);
                } else {
                    // No role permission
                    callback(null, null);
                }
            });

            const result = await PermissionService.hasPermission(
                userId,
                orgId,
                permissionKey,
                PermissionService.ROLES.USER
            );

            expect(result).toBe(false);
        });

        it('should handle database errors gracefully', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            const result = await PermissionService.hasPermission(
                userId,
                orgId,
                'PLAYBOOK_PUBLISH',
                PermissionService.ROLES.ADMIN
            );

            // Should return false on error (fail-safe)
            expect(result).toBe(false);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only check permissions for specified organization', async () => {
            const userId = testUsers.user.id;
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                // Verify query filters by organization_id
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                callback(null, null);
            });

            await PermissionService.hasPermission(
                userId,
                org1Id,
                'PLAYBOOK_PUBLISH',
                PermissionService.ROLES.ADMIN
            );

            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('organization_id = ?'),
                expect.arrayContaining([userId, org1Id]),
                expect.any(Function)
            );
        });

        it('should not leak permissions between organizations', async () => {
            const userId = testUsers.user.id;
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            // Grant permission in org1
            mockDb.get.mockImplementation((query, params, callback) => {
                if (params.includes(org1Id)) {
                    callback(null, { grant_type: 'GRANT' });
                } else {
                    callback(null, null);
                }
            });

            const result1 = await PermissionService.hasPermission(
                userId,
                org1Id,
                'PLAYBOOK_PUBLISH',
                PermissionService.ROLES.ADMIN
            );

            // Should not have permission in org2
            const result2 = await PermissionService.hasPermission(
                userId,
                org2Id,
                'PLAYBOOK_PUBLISH',
                PermissionService.ROLES.ADMIN
            );

            expect(result1).toBe(true);
            expect(result2).toBe(false);
        });
    });

    describe('getUserPermissions()', () => {
        it('should return role permissions and overrides', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const userRole = PermissionService.ROLES.ADMIN;

            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('role_permissions')) {
                    callback(null, [
                        { permission_key: 'PLAYBOOK_PUBLISH' },
                        { permission_key: 'AI_ACTION_APPROVE' }
                    ]);
                } else if (query.includes('org_user_permissions')) {
                    callback(null, [
                        { permission_key: 'PLAYBOOK_PUBLISH', grant_type: 'GRANT' },
                        { permission_key: 'ORG_MANAGE', grant_type: 'REVOKE' }
                    ]);
                } else {
                    callback(null, []);
                }
            });

            const result = await PermissionService.getUserPermissions(userId, orgId, userRole);

            expect(result).toBeDefined();
            expect(result.rolePermissions).toHaveLength(2);
            expect(result.overrides.granted).toContain('PLAYBOOK_PUBLISH');
            expect(result.overrides.revoked).toContain('ORG_MANAGE');
        });

        it('should handle empty permissions', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await PermissionService.getUserPermissions(
                userId,
                orgId,
                PermissionService.ROLES.USER
            );

            expect(result.rolePermissions).toEqual([]);
            expect(result.overrides.granted).toEqual([]);
            expect(result.overrides.revoked).toEqual([]);
        });
    });

    describe('grantPermission()', () => {
        it('should grant permission to user', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const permissionKey = 'PLAYBOOK_PUBLISH';

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await PermissionService.grantPermission(userId, orgId, permissionKey);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO org_user_permissions'),
                expect.arrayContaining([userId, orgId, permissionKey, 'GRANT']),
                expect.any(Function)
            );
        });

        it('should handle database errors', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'));
            });

            await expect(
                PermissionService.grantPermission(userId, orgId, 'PLAYBOOK_PUBLISH')
            ).rejects.toThrow('DB Error');
        });
    });

    describe('revokePermission()', () => {
        it('should revoke permission from user', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const permissionKey = 'PLAYBOOK_PUBLISH';

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await PermissionService.revokePermission(userId, orgId, permissionKey);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO org_user_permissions'),
                expect.arrayContaining([userId, orgId, permissionKey, 'REVOKE']),
                expect.any(Function)
            );
        });
    });

    describe('getCapabilitiesForRole()', () => {
        it('should return capabilities for ADMIN role', () => {
            const caps = PermissionService.getCapabilitiesForRole(PermissionService.ROLES.ADMIN);
            expect(caps).toBeDefined();
            expect(Array.isArray(caps)).toBe(true);
            expect(caps.length).toBeGreaterThan(0);
        });

        it('should return empty array for unknown role', () => {
            const caps = PermissionService.getCapabilitiesForRole('UNKNOWN_ROLE');
            expect(caps).toEqual([]);
        });
    });
});

