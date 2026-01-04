/**
 * RBAC Service Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDatabase } from '../../../../server/src/database/index.js';
import rbacService from '../../../../server/services/rbacService.js';

describe('RBAC Service', () => {
    let db;

    beforeEach(() => {
        vi.clearAllMocks();
        db = getDatabase();
        db.run.mockClear();
        db.get.mockClear();
        db.all.mockClear();
    });

    describe('getOrganizationRoles', () => {
        it('should return system roles and custom roles', async () => {
            const orgId = 'org-1';
            const customRoles = [{ id: 'role-1', name: 'custom', priority: 0 }];

            db.all.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                if (typeof callback === 'function') {
                    callback(null, customRoles);
                }
            });

            const roles = await rbacService.getOrganizationRoles(orgId, true);
            expect(roles.length).toBeGreaterThan(1);
            expect(roles.some(r => r.role_type === 'system')).toBe(true);
            expect(roles.some(r => r.id === 'role-1')).toBe(true);
        });
    });

    describe('hasPermission', () => {
        it('should allow if system role has permission', async () => {
            db.get.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                // getUserRoles
                if (sql.includes('SELECT role FROM users')) {
                    if (callback) callback(null, { role: 'admin' });
                } else if (callback) {
                    callback(null, null);
                }
            });

            db.all.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                if (sql.includes('user_role_assignments')) {
                    if (callback) callback(null, []);
                }
            });

            const result = await rbacService.hasPermission('user-1', 'org-1', 'users:read');
            expect(result.allowed).toBe(true);
            expect(result.source).toBe('system_role');
        });

        it('should deny if no role has permission', async () => {
            db.get.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                if (callback) callback(null, { role: 'guest' });
            });
            db.all.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                if (callback) callback(null, []);
            });

            const result = await rbacService.hasPermission('user-1', 'org-1', 'settings:write');
            expect(result.allowed).toBe(false);
        });
    });

    describe('createRole', () => {
        it('should create a custom role', async () => {
            db.get.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                // check existing
                if (callback) callback(null, null);
            });
            db.run.mockImplementation(function (sql, params, cb) {
                const callback = cb || params;
                if (typeof callback === 'function') {
                    callback.call({ changes: 1 }, null);
                }
            });

            const result = await rbacService.createRole('org-1', { name: 'new-role', displayName: 'New Role' });
            expect(result.created).toBe(true);
            expect(db.run).toHaveBeenCalled();
        });
    });
});
