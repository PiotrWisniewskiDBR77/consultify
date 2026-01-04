/**
 * RbacService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for RbacService - Covering Role Creation and Permission Checking
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Database Object - Hoisted to avoid TDZ
const { mockDb } = vi.hoisted(() => {
    return {
        mockDb: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
            exec: vi.fn(),
            serialize: vi.fn((cb) => cb()), // Synchronous execution for serialize
            close: vi.fn(),
            query: vi.fn(),
            prepare: vi.fn(() => ({
                run: vi.fn(),
                finalize: vi.fn((cb) => cb && cb(null)),
            })),
        },
    };
});

// Mock Dependencies
vi.mock('../../../../src/database/Database', () => ({
    getDatabase: () => mockDb,
    default: {
        getDatabase: () => mockDb,
    },
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid'),
}));

// Import service AFTER mocks
import RbacService from '../../../../src/services/rbacService.js';

describe('RbacService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock implementations
        mockDb.get.mockReset();
        mockDb.all.mockReset();
        mockDb.run.mockReset();

        // Default run behavior
        mockDb.run.mockImplementation((sql, params, callback) => {
            const cb = typeof params === 'function' ? params : callback;
            if (cb) cb.call({ changes: 1, lastID: 1 }, null);
            return mockDb;
        });
    });

    describe('createRole', () => {
        it('should create a custom role if name is unique', async () => {
            const roleData = { name: 'editor', displayName: 'Editor' };
            const orgId = 'org-1';

            // Mock getRoleByName checks (returning null means name is unique)
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
                return mockDb;
            });

            const result = await RbacService.createRole(orgId, roleData);

            expect(result).toEqual({ id: 'mock-uuid', created: true });
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO custom_roles'),
                expect.arrayContaining(['editor', 'Editor']), // Removed 'custom' as it is hardcoded in SQL
                expect.any(Function),
            );
        });

        it('should throw error if role name exists', async () => {
            const roleData = { name: 'editor' };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'existing-id' });
                return mockDb;
            });

            await expect(RbacService.createRole('org-1', roleData)).rejects.toThrow(
                'Role with name "editor" already exists',
            );
        });
    });

    describe('hasPermission', () => {
        const userId = 'user-1';
        const orgId = 'org-1';

        it('should allow if system role has permission (admin gets *)', async () => {
            // Mock getUserSystemRole
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('SELECT role FROM users')) {
                    callback(null, { role: 'admin' });
                }
                return mockDb;
            });

            // Mock getUserRoles (empty)
            mockDb.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM user_role_assignments')) {
                    callback(null, []);
                }
                return mockDb;
            });

            // admin has 'projects:*' or similar. Using 'projects:read' which is inclusive.
            const result = await RbacService.hasPermission(userId, orgId, 'projects:read');
            expect(result.allowed).toBe(true);
            expect(result.source).toBe('system_role');
        });

        it('should allow if custom role has exact permission', async () => {
            // Mock no system role
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { role: 'user' }); // 'user' is not in SYSTEM_ROLES map usually, or member
                return mockDb;
            });

            // Mock getUserRoles returns one role
            mockDb.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM user_role_assignments')) {
                    callback(null, [{ role_id: 'role-1', role_name: 'custom_role' }]);
                } else if (sql.includes('FROM role_permissions')) {
                    // getRolePermissions
                    callback(null, [{ permission_name: 'projects:read', grant_type: 'allow' }]);
                }
                return mockDb;
            });

            const result = await RbacService.hasPermission(userId, orgId, 'projects:read');
            expect(result.allowed).toBe(true);
            expect(result.source).toBe('custom_role');
        });

        it('should deny if custom role has explicit deny', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
                return mockDb;
            });
            mockDb.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM user_role_assignments')) {
                    callback(null, [{ role_id: 'role-1' }]);
                } else if (sql.includes('FROM role_permissions')) {
                    callback(null, [{ permission_name: 'projects:delete', grant_type: 'deny' }]);
                }
                return mockDb;
            });

            const result = await RbacService.hasPermission(userId, orgId, 'projects:delete');
            expect(result.allowed).toBe(false);
            expect(result.source).toBe('explicit_deny');
        });

        it('should match wildcard permission (resource:*)', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
                return mockDb;
            });
            mockDb.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM user_role_assignments')) {
                    callback(null, [{ role_id: 'role-1' }]);
                } else if (sql.includes('FROM role_permissions')) {
                    callback(null, [{ permission_name: 'projects:*', grant_type: 'allow' }]);
                }
                return mockDb;
            });

            const result = await RbacService.hasPermission(userId, orgId, 'projects:write');
            expect(result.allowed).toBe(true);
        });
    });

    describe('permission matching logic', () => {
        it('matchPermission should handle wildcards', () => {
            const patterns = ['projects:*', '*:view'];
            expect(RbacService.matchPermission(patterns, 'projects:create')).toBe(true);
            expect(RbacService.matchPermission(patterns, 'tasks:view')).toBe(true);
            expect(RbacService.matchPermission(patterns, 'tasks:create')).toBe(false);
        });
    });
});
