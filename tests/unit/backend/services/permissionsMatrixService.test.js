/**
 * Unit Tests for Permissions Matrix Service
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock database
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

// Mock the service with dependency injection
vi.mock('../../../../server/database', () => ({
    default: mockDb,
    run: mockDb.run,
    get: mockDb.get,
    all: mockDb.all
}));

const permissionsMatrixService = require('../../../../server/services/permissionsMatrixService');
permissionsMatrixService.setDependencies({ db: mockDb });

describe('PermissionsMatrixService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ROLE_HIERARCHY', () => {
        it('should have correct hierarchy levels', () => {
            expect(permissionsMatrixService.ROLE_HIERARCHY.SUPERADMIN).toBe(100);
            expect(permissionsMatrixService.ROLE_HIERARCHY.ADMIN).toBe(80);
            expect(permissionsMatrixService.ROLE_HIERARCHY.MANAGER).toBe(60);
            expect(permissionsMatrixService.ROLE_HIERARCHY.MEMBER).toBe(40);
            expect(permissionsMatrixService.ROLE_HIERARCHY.VIEWER).toBe(20);
        });
    });

    describe('getAllPermissions', () => {
        it('should return permissions grouped by category', async () => {
            mockDb.all.mockResolvedValueOnce([
                { id: '1', key: 'users:read', description: 'Read users', category: 'users', is_system: 1 },
                { id: '2', key: 'users:write', description: 'Write users', category: 'users', is_system: 0 },
                { id: '3', key: 'orgs:read', description: 'Read orgs', category: 'organizations', is_system: 1 }
            ]);

            const result = await permissionsMatrixService.getAllPermissions();

            expect(result.users.permissions).toHaveLength(2);
            expect(result.organizations.permissions).toHaveLength(1);
        });
    });

    describe('getRolePermissions', () => {
        it('should return permission keys for a role', async () => {
            mockDb.all.mockResolvedValueOnce([
                { permission_key: 'users:read' },
                { permission_key: 'users:write' }
            ]);

            const result = await permissionsMatrixService.getRolePermissions('ADMIN');

            expect(result).toEqual(['users:read', 'users:write']);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('role_permissions'),
                ['ADMIN']
            );
        });
    });

    describe('getMatrix', () => {
        it('should return complete permissions matrix', async () => {
            mockDb.all.mockResolvedValueOnce([
                { id: '1', key: 'users:read', description: 'Read users', category: 'users', is_system: 1 }
            ]);
            mockDb.all.mockResolvedValueOnce([
                { role: 'SUPERADMIN', permission_key: 'users:read' },
                { role: 'ADMIN', permission_key: 'users:read' }
            ]);

            const result = await permissionsMatrixService.getMatrix();

            expect(result.categories).toBeDefined();
            expect(result.roles).toBeDefined();
            expect(result.matrix).toBeDefined();
            expect(result.matrix.SUPERADMIN['users:read']).toBe(true);
            expect(result.matrix.VIEWER['users:read']).toBe(false);
        });
    });

    describe('updateRolePermissions', () => {
        it('should update permissions for a role', async () => {
            mockDb.all.mockResolvedValueOnce([
                { permission_key: 'users:read' }
            ]);
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await permissionsMatrixService.updateRolePermissions('ADMIN', [
                'users:read',
                'users:write'
            ]);

            expect(result.role).toBe('ADMIN');
            expect(result.added).toContain('users:write');
            expect(result.removed).toHaveLength(0);
        });

        it('should throw error for invalid role', async () => {
            await expect(
                permissionsMatrixService.updateRolePermissions('INVALID_ROLE', ['users:read'])
            ).rejects.toThrow('Invalid role');
        });
    });

    describe('togglePermission', () => {
        it('should enable permission', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const result = await permissionsMatrixService.togglePermission('ADMIN', 'users:read', true);

            expect(result.enabled).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR IGNORE'),
                expect.any(Array)
            );
        });

        it('should disable permission', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const result = await permissionsMatrixService.togglePermission('ADMIN', 'users:read', false);

            expect(result.enabled).toBe(false);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE'),
                ['ADMIN', 'users:read']
            );
        });
    });

    describe('createPermission', () => {
        it('should create a new permission', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const result = await permissionsMatrixService.createPermission({
                key: 'custom:test',
                description: 'Test permission',
                category: 'general'
            });

            expect(result.key).toBe('custom:test');
            expect(result.isSystem).toBe(false);
        });
    });

    describe('deletePermission', () => {
        it('should delete non-system permission', async () => {
            mockDb.get.mockResolvedValueOnce({ key: 'custom:test', is_system: 0 });
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await permissionsMatrixService.deletePermission('custom:test');

            expect(result.deleted).toBe('custom:test');
        });

        it('should throw error for system permission', async () => {
            mockDb.get.mockResolvedValueOnce({ key: 'system:perm', is_system: 1 });

            await expect(
                permissionsMatrixService.deletePermission('system:perm')
            ).rejects.toThrow('Cannot delete system permissions');
        });

        it('should throw error if permission not found', async () => {
            mockDb.get.mockResolvedValueOnce(null);

            await expect(
                permissionsMatrixService.deletePermission('nonexistent')
            ).rejects.toThrow('Permission not found');
        });
    });

    describe('copyRolePermissions', () => {
        it('should copy permissions from source to target role', async () => {
            mockDb.all.mockResolvedValueOnce([
                { permission_key: 'users:read' },
                { permission_key: 'users:write' }
            ]);
            mockDb.all.mockResolvedValueOnce([]);
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await permissionsMatrixService.copyRolePermissions('ADMIN', 'MANAGER');

            expect(result.role).toBe('MANAGER');
            expect(result.added).toHaveLength(2);
        });
    });

    describe('hasPermission', () => {
        it('should return true if role has permission', async () => {
            mockDb.get.mockResolvedValueOnce({ permission_key: 'users:read' });

            const result = await permissionsMatrixService.hasPermission('ADMIN', 'users:read');

            expect(result).toBe(true);
        });

        it('should return false if role lacks permission', async () => {
            mockDb.get.mockResolvedValueOnce(null);

            const result = await permissionsMatrixService.hasPermission('VIEWER', 'users:write');

            expect(result).toBe(false);
        });
    });

    describe('compareRoles', () => {
        it('should return permission differences between roles', async () => {
            mockDb.all.mockResolvedValueOnce([
                { permission_key: 'users:read' },
                { permission_key: 'users:write' }
            ]);
            mockDb.all.mockResolvedValueOnce([
                { permission_key: 'users:read' },
                { permission_key: 'orgs:read' }
            ]);

            const result = await permissionsMatrixService.compareRoles('ADMIN', 'MANAGER');

            expect(result.onlyIn1).toContain('users:write');
            expect(result.onlyIn2).toContain('orgs:read');
            expect(result.common).toContain('users:read');
        });
    });

    describe('getStats', () => {
        it('should return permission statistics', async () => {
            mockDb.get.mockResolvedValueOnce({ count: 50 });
            mockDb.get.mockResolvedValueOnce({ count: 30 });
            mockDb.all.mockResolvedValueOnce([
                { role: 'ADMIN', count: 40 },
                { role: 'VIEWER', count: 10 }
            ]);
            mockDb.all.mockResolvedValueOnce([
                { category: 'users', count: 20 },
                { category: 'organizations', count: 15 }
            ]);

            const result = await permissionsMatrixService.getStats();

            expect(result.totalPermissions).toBe(50);
            expect(result.systemPermissions).toBe(30);
            expect(result.customPermissions).toBe(20);
            expect(result.roleAssignments.ADMIN).toBe(40);
            expect(result.categoryBreakdown.users).toBe(20);
        });
    });
});

