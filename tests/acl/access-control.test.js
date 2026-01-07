/**
 * Access Control Tests
 * Tests for access control list (ACL) implementation
 * 
 * @module tests/acl/access-control.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ACL Service implementation
const createACLService = () => {
    const rules = new Map();
    const roleHierarchy = new Map();

    return {
        // Define role hierarchy
        defineRole: (role, parents = []) => {
            roleHierarchy.set(role, parents);
        },

        // Get all roles including inherited
        getEffectiveRoles: (role) => {
            const roles = new Set([role]);
            const parents = roleHierarchy.get(role) || [];

            for (const parent of parents) {
                const parentRoles = this.getEffectiveRoles(parent);
                parentRoles.forEach(r => roles.add(r));
            }

            return roles;
        },

        // Grant permission
        allow: (role, resource, actions) => {
            const key = `${role}:${resource}`;
            const existing = rules.get(key) || { allow: new Set(), deny: new Set() };

            (Array.isArray(actions) ? actions : [actions]).forEach(a => {
                existing.allow.add(a);
                existing.deny.delete(a);
            });

            rules.set(key, existing);
        },

        // Deny permission
        deny: (role, resource, actions) => {
            const key = `${role}:${resource}`;
            const existing = rules.get(key) || { allow: new Set(), deny: new Set() };

            (Array.isArray(actions) ? actions : [actions]).forEach(a => {
                existing.deny.add(a);
                existing.allow.delete(a);
            });

            rules.set(key, existing);
        },

        // Check permission
        isAllowed: (role, resource, action) => {
            const effectiveRoles = this.getEffectiveRoles(role);

            // Check explicit deny first (deny takes precedence)
            for (const r of effectiveRoles) {
                const key = `${r}:${resource}`;
                const rule = rules.get(key);

                if (rule?.deny.has(action) || rule?.deny.has('*')) {
                    return false;
                }
            }

            // Check allow
            for (const r of effectiveRoles) {
                const key = `${r}:${resource}`;
                const rule = rules.get(key);

                if (rule?.allow.has(action) || rule?.allow.has('*')) {
                    return true;
                }
            }

            // Check wildcard resource
            for (const r of effectiveRoles) {
                const key = `${r}:*`;
                const rule = rules.get(key);

                if (rule?.allow.has(action) || rule?.allow.has('*')) {
                    return true;
                }
            }

            return false;
        },

        // Check multiple permissions
        can: (role, permissions) => {
            return permissions.every(([resource, action]) =>
                this.isAllowed(role, resource, action)
            );
        },

        // Get all permissions for role
        getPermissions: (role) => {
            const permissions = [];
            const effectiveRoles = this.getEffectiveRoles(role);

            for (const r of effectiveRoles) {
                for (const [key, rule] of rules) {
                    if (key.startsWith(`${r}:`)) {
                        const resource = key.split(':')[1];
                        rule.allow.forEach(action => {
                            permissions.push({ resource, action, type: 'allow' });
                        });
                        rule.deny.forEach(action => {
                            permissions.push({ resource, action, type: 'deny' });
                        });
                    }
                }
            }

            return permissions;
        },

        // Clear all rules
        clear: () => {
            rules.clear();
            roleHierarchy.clear();
        },
    };
};

// Resource-based access control
const createResourceACL = () => {
    const permissions = new Map(); // resourceId -> Map<userId, actions[]>

    return {
        grant: (resourceId, userId, actions) => {
            if (!permissions.has(resourceId)) {
                permissions.set(resourceId, new Map());
            }

            const resourcePerms = permissions.get(resourceId);
            const existing = resourcePerms.get(userId) || new Set();

            (Array.isArray(actions) ? actions : [actions]).forEach(a => existing.add(a));
            resourcePerms.set(userId, existing);
        },

        revoke: (resourceId, userId, actions) => {
            const resourcePerms = permissions.get(resourceId);
            if (!resourcePerms) return;

            const userPerms = resourcePerms.get(userId);
            if (!userPerms) return;

            (Array.isArray(actions) ? actions : [actions]).forEach(a => userPerms.delete(a));
        },

        can: (resourceId, userId, action) => {
            const resourcePerms = permissions.get(resourceId);
            if (!resourcePerms) return false;

            const userPerms = resourcePerms.get(userId);
            if (!userPerms) return false;

            return userPerms.has(action) || userPerms.has('*');
        },

        getUsers: (resourceId, action) => {
            const resourcePerms = permissions.get(resourceId);
            if (!resourcePerms) return [];

            const users = [];
            for (const [userId, actions] of resourcePerms) {
                if (actions.has(action) || actions.has('*')) {
                    users.push(userId);
                }
            }
            return users;
        },

        getResources: (userId, action) => {
            const resources = [];

            for (const [resourceId, resourcePerms] of permissions) {
                const userPerms = resourcePerms.get(userId);
                if (userPerms && (userPerms.has(action) || userPerms.has('*'))) {
                    resources.push(resourceId);
                }
            }

            return resources;
        },

        clear: (resourceId) => {
            if (resourceId) {
                permissions.delete(resourceId);
            } else {
                permissions.clear();
            }
        },
    };
};

describe('Access Control Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // ACL SERVICE
    // ═══════════════════════════════════════════════════════════════════

    describe('ACL Service', () => {
        let acl;

        beforeEach(() => {
            acl = createACLService();
        });

        describe('allow', () => {
            it('should grant permission', () => {
                acl.allow('editor', 'posts', 'read');

                expect(acl.isAllowed('editor', 'posts', 'read')).toBe(true);
            });

            it('should grant multiple actions', () => {
                acl.allow('editor', 'posts', ['read', 'write', 'delete']);

                expect(acl.isAllowed('editor', 'posts', 'read')).toBe(true);
                expect(acl.isAllowed('editor', 'posts', 'write')).toBe(true);
                expect(acl.isAllowed('editor', 'posts', 'delete')).toBe(true);
            });

            it('should grant wildcard action', () => {
                acl.allow('admin', 'posts', '*');

                expect(acl.isAllowed('admin', 'posts', 'anything')).toBe(true);
            });

            it('should grant wildcard resource', () => {
                acl.allow('superadmin', '*', '*');

                expect(acl.isAllowed('superadmin', 'anything', 'anything')).toBe(true);
            });
        });

        describe('deny', () => {
            it('should deny permission', () => {
                acl.allow('user', 'posts', ['read', 'write']);
                acl.deny('user', 'posts', 'write');

                expect(acl.isAllowed('user', 'posts', 'read')).toBe(true);
                expect(acl.isAllowed('user', 'posts', 'write')).toBe(false);
            });

            it('should deny takes precedence', () => {
                acl.allow('user', 'posts', '*');
                acl.deny('user', 'posts', 'delete');

                expect(acl.isAllowed('user', 'posts', 'read')).toBe(true);
                expect(acl.isAllowed('user', 'posts', 'delete')).toBe(false);
            });
        });

        describe('role hierarchy', () => {
            beforeEach(() => {
                acl.defineRole('guest');
                acl.defineRole('user', ['guest']);
                acl.defineRole('editor', ['user']);
                acl.defineRole('admin', ['editor']);

                acl.allow('guest', 'posts', 'read');
                acl.allow('user', 'comments', 'create');
                acl.allow('editor', 'posts', 'write');
                acl.allow('admin', 'users', 'manage');
            });

            it('should inherit parent permissions', () => {
                expect(acl.isAllowed('user', 'posts', 'read')).toBe(true);
                expect(acl.isAllowed('editor', 'posts', 'read')).toBe(true);
                expect(acl.isAllowed('admin', 'posts', 'read')).toBe(true);
            });

            it('should get effective roles', () => {
                const roles = acl.getEffectiveRoles('admin');

                expect(roles.has('admin')).toBe(true);
                expect(roles.has('editor')).toBe(true);
                expect(roles.has('user')).toBe(true);
                expect(roles.has('guest')).toBe(true);
            });
        });

        describe('can', () => {
            it('should check multiple permissions', () => {
                acl.allow('editor', 'posts', ['read', 'write']);
                acl.allow('editor', 'comments', ['read', 'create']);

                expect(acl.can('editor', [
                    ['posts', 'read'],
                    ['comments', 'create'],
                ])).toBe(true);

                expect(acl.can('editor', [
                    ['posts', 'delete'],
                ])).toBe(false);
            });
        });

        describe('getPermissions', () => {
            it('should list all permissions', () => {
                acl.allow('editor', 'posts', ['read', 'write']);
                acl.deny('editor', 'users', 'delete');

                const perms = acl.getPermissions('editor');

                expect(perms.find(p => p.resource === 'posts' && p.action === 'read')).toBeDefined();
                expect(perms.find(p => p.resource === 'users' && p.type === 'deny')).toBeDefined();
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RESOURCE ACL
    // ═══════════════════════════════════════════════════════════════════

    describe('Resource ACL', () => {
        let resourceACL;

        beforeEach(() => {
            resourceACL = createResourceACL();
        });

        describe('grant', () => {
            it('should grant user access to resource', () => {
                resourceACL.grant('doc-1', 'user-1', 'read');

                expect(resourceACL.can('doc-1', 'user-1', 'read')).toBe(true);
            });

            it('should grant multiple actions', () => {
                resourceACL.grant('doc-1', 'user-1', ['read', 'write']);

                expect(resourceACL.can('doc-1', 'user-1', 'read')).toBe(true);
                expect(resourceACL.can('doc-1', 'user-1', 'write')).toBe(true);
            });
        });

        describe('revoke', () => {
            it('should revoke user access', () => {
                resourceACL.grant('doc-1', 'user-1', ['read', 'write']);
                resourceACL.revoke('doc-1', 'user-1', 'write');

                expect(resourceACL.can('doc-1', 'user-1', 'read')).toBe(true);
                expect(resourceACL.can('doc-1', 'user-1', 'write')).toBe(false);
            });
        });

        describe('getUsers', () => {
            it('should get users with access', () => {
                resourceACL.grant('doc-1', 'user-1', 'read');
                resourceACL.grant('doc-1', 'user-2', 'read');
                resourceACL.grant('doc-1', 'user-3', 'write');

                const readers = resourceACL.getUsers('doc-1', 'read');

                expect(readers).toContain('user-1');
                expect(readers).toContain('user-2');
                expect(readers).not.toContain('user-3');
            });
        });

        describe('getResources', () => {
            it('should get resources user can access', () => {
                resourceACL.grant('doc-1', 'user-1', 'read');
                resourceACL.grant('doc-2', 'user-1', 'read');
                resourceACL.grant('doc-3', 'user-2', 'read');

                const resources = resourceACL.getResources('user-1', 'read');

                expect(resources).toContain('doc-1');
                expect(resources).toContain('doc-2');
                expect(resources).not.toContain('doc-3');
            });
        });

        describe('clear', () => {
            it('should clear resource permissions', () => {
                resourceACL.grant('doc-1', 'user-1', 'read');
                resourceACL.clear('doc-1');

                expect(resourceACL.can('doc-1', 'user-1', 'read')).toBe(false);
            });

            it('should clear all permissions', () => {
                resourceACL.grant('doc-1', 'user-1', 'read');
                resourceACL.grant('doc-2', 'user-2', 'read');
                resourceACL.clear();

                expect(resourceACL.can('doc-1', 'user-1', 'read')).toBe(false);
                expect(resourceACL.can('doc-2', 'user-2', 'read')).toBe(false);
            });
        });
    });
});
