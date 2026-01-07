/**
 * Access Control Tests
 * Tests for RBAC, ABAC, and permissions
 * 
 * @module tests/access/access-control.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Role-based access control
const createRBAC = () => {
    const roles = new Map(); // role -> permissions[]
    const userRoles = new Map(); // userId -> roles[]

    return {
        defineRole: (roleName, permissions = []) => {
            roles.set(roleName, new Set(permissions));
        },

        extendRole: (roleName, baseRole) => {
            const basePermissions = roles.get(baseRole) || new Set();
            const rolePermissions = roles.get(roleName) || new Set();
            roles.set(roleName, new Set([...basePermissions, ...rolePermissions]));
        },

        addPermission: (roleName, permission) => {
            if (!roles.has(roleName)) {
                roles.set(roleName, new Set());
            }
            roles.get(roleName).add(permission);
        },

        assignRole: (userId, roleName) => {
            if (!userRoles.has(userId)) {
                userRoles.set(userId, new Set());
            }
            userRoles.get(userId).add(roleName);
        },

        removeRole: (userId, roleName) => {
            userRoles.get(userId)?.delete(roleName);
        },

        hasPermission: (userId, permission) => {
            const assignedRoles = userRoles.get(userId) || new Set();

            for (const roleName of assignedRoles) {
                const permissions = roles.get(roleName);
                if (permissions?.has(permission) || permissions?.has('*')) {
                    return true;
                }
            }

            return false;
        },

        getUserRoles: (userId) => {
            return [...(userRoles.get(userId) || [])];
        },

        getRolePermissions: (roleName) => {
            return [...(roles.get(roleName) || [])];
        },
    };
};

// Attribute-based access control
const createABAC = () => {
    const policies = [];

    return {
        addPolicy: (name, condition) => {
            policies.push({ name, condition });
        },

        removePolicy: (name) => {
            const index = policies.findIndex(p => p.name === name);
            if (index !== -1) policies.splice(index, 1);
        },

        evaluate: (context) => {
            for (const policy of policies) {
                if (policy.condition(context)) {
                    return { allowed: true, policy: policy.name };
                }
            }
            return { allowed: false };
        },

        evaluateAll: (context) => {
            return policies.map(policy => ({
                name: policy.name,
                matched: policy.condition(context),
            }));
        },

        getPolicies: () => policies.map(p => p.name),
    };
};

// Permission checker
const createPermissionChecker = (rbac) => {
    return {
        can: (userId, action, resource = null) => {
            // Check specific permission first
            if (resource) {
                if (rbac.hasPermission(userId, `${action}:${resource}`)) {
                    return true;
                }
            }

            // Check general action permission
            return rbac.hasPermission(userId, action);
        },

        canAll: (userId, permissions) => {
            return permissions.every(p => rbac.hasPermission(userId, p));
        },

        canAny: (userId, permissions) => {
            return permissions.some(p => rbac.hasPermission(userId, p));
        },

        enforce: (userId, action, resource = null) => {
            if (!this.can(userId, action, resource)) {
                throw new Error(`Permission denied: ${action}${resource ? `:${resource}` : ''}`);
            }
        },
    };
};

// Resource ownership
const createResourceOwnership = () => {
    const ownership = new Map(); // resourceId -> ownerId

    return {
        setOwner: (resourceId, ownerId) => {
            ownership.set(resourceId, ownerId);
        },

        getOwner: (resourceId) => {
            return ownership.get(resourceId);
        },

        isOwner: (resourceId, userId) => {
            return ownership.get(resourceId) === userId;
        },

        transfer: (resourceId, newOwnerId) => {
            if (ownership.has(resourceId)) {
                ownership.set(resourceId, newOwnerId);
                return true;
            }
            return false;
        },

        remove: (resourceId) => {
            return ownership.delete(resourceId);
        },
    };
};

// Access policy builder
const createAccessPolicyBuilder = () => {
    const rules = [];

    const builder = {
        allow: (action) => {
            rules.push({ type: 'allow', action, conditions: [] });
            return builder;
        },

        deny: (action) => {
            rules.push({ type: 'deny', action, conditions: [] });
            return builder;
        },

        when: (condition) => {
            const lastRule = rules[rules.length - 1];
            if (lastRule) {
                lastRule.conditions.push(condition);
            }
            return builder;
        },

        build: () => ({
            evaluate: (action, context) => {
                for (const rule of rules) {
                    if (rule.action !== action && rule.action !== '*') continue;

                    const conditionsMet = rule.conditions.every(c => c(context));
                    if (conditionsMet) {
                        return rule.type === 'allow';
                    }
                }
                return false; // Default deny
            },
            getRules: () => [...rules],
        }),
    };

    return builder;
};

describe('RBAC Tests', () => {
    let rbac;

    beforeEach(() => {
        rbac = createRBAC();
    });

    it('should define role with permissions', () => {
        rbac.defineRole('admin', ['read', 'write', 'delete']);

        expect(rbac.getRolePermissions('admin')).toContain('read');
    });

    it('should assign role to user', () => {
        rbac.defineRole('editor', ['read', 'write']);
        rbac.assignRole('user-1', 'editor');

        expect(rbac.getUserRoles('user-1')).toContain('editor');
    });

    it('should check permissions', () => {
        rbac.defineRole('viewer', ['read']);
        rbac.assignRole('user-1', 'viewer');

        expect(rbac.hasPermission('user-1', 'read')).toBe(true);
        expect(rbac.hasPermission('user-1', 'write')).toBe(false);
    });

    it('should support wildcard permission', () => {
        rbac.defineRole('superadmin', ['*']);
        rbac.assignRole('admin', 'superadmin');

        expect(rbac.hasPermission('admin', 'anything')).toBe(true);
    });

    it('should support multiple roles', () => {
        rbac.defineRole('reader', ['read']);
        rbac.defineRole('writer', ['write']);
        rbac.assignRole('user-1', 'reader');
        rbac.assignRole('user-1', 'writer');

        expect(rbac.hasPermission('user-1', 'read')).toBe(true);
        expect(rbac.hasPermission('user-1', 'write')).toBe(true);
    });
});

describe('ABAC Tests', () => {
    let abac;

    beforeEach(() => {
        abac = createABAC();
    });

    it('should add and evaluate policy', () => {
        abac.addPolicy('same-department', (ctx) =>
            ctx.user.department === ctx.resource.department
        );

        const result = abac.evaluate({
            user: { department: 'engineering' },
            resource: { department: 'engineering' },
        });

        expect(result.allowed).toBe(true);
    });

    it('should deny on no matching policy', () => {
        abac.addPolicy('admin-only', (ctx) => ctx.user.role === 'admin');

        const result = abac.evaluate({
            user: { role: 'user' },
        });

        expect(result.allowed).toBe(false);
    });

    it('should evaluate all policies', () => {
        abac.addPolicy('policy-a', () => true);
        abac.addPolicy('policy-b', () => false);

        const results = abac.evaluateAll({});

        expect(results).toHaveLength(2);
        expect(results[0].matched).toBe(true);
        expect(results[1].matched).toBe(false);
    });
});

describe('Permission Checker Tests', () => {
    let rbac;
    let checker;

    beforeEach(() => {
        rbac = createRBAC();
        rbac.defineRole('editor', ['read', 'write', 'write:articles']);
        rbac.assignRole('user-1', 'editor');
        checker = createPermissionChecker(rbac);
    });

    it('should check action permission', () => {
        expect(checker.can('user-1', 'read')).toBe(true);
        expect(checker.can('user-1', 'delete')).toBe(false);
    });

    it('should check resource permission', () => {
        expect(checker.can('user-1', 'write', 'articles')).toBe(true);
        expect(checker.can('user-1', 'write', 'users')).toBe(true); // Falls back to general write
    });

    it('should check all permissions', () => {
        expect(checker.canAll('user-1', ['read', 'write'])).toBe(true);
        expect(checker.canAll('user-1', ['read', 'delete'])).toBe(false);
    });

    it('should check any permission', () => {
        expect(checker.canAny('user-1', ['delete', 'read'])).toBe(true);
        expect(checker.canAny('user-1', ['delete', 'admin'])).toBe(false);
    });

    it('should enforce permission', () => {
        expect(() => checker.enforce('user-1', 'delete')).toThrow('Permission denied');
    });
});

describe('Resource Ownership Tests', () => {
    let ownership;

    beforeEach(() => {
        ownership = createResourceOwnership();
    });

    it('should set and check owner', () => {
        ownership.setOwner('doc-1', 'user-1');

        expect(ownership.isOwner('doc-1', 'user-1')).toBe(true);
        expect(ownership.isOwner('doc-1', 'user-2')).toBe(false);
    });

    it('should transfer ownership', () => {
        ownership.setOwner('doc-1', 'user-1');
        ownership.transfer('doc-1', 'user-2');

        expect(ownership.getOwner('doc-1')).toBe('user-2');
    });
});

describe('Access Policy Builder Tests', () => {
    it('should build and evaluate policy', () => {
        const policy = createAccessPolicyBuilder()
            .allow('read')
            .when((ctx) => ctx.user.authenticated)
            .allow('write')
            .when((ctx) => ctx.user.role === 'admin')
            .build();

        expect(policy.evaluate('read', { user: { authenticated: true } })).toBe(true);
        expect(policy.evaluate('write', { user: { role: 'user' } })).toBe(false);
        expect(policy.evaluate('write', { user: { role: 'admin' } })).toBe(true);
    });
});
