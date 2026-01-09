/**
 * Role Service Unit Tests
 * 
 * Tests for role management and permissions.
 * 
 * @module tests/unit/backend/roleService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create role service implementation
const createRoleService = () => {
    const roles = new Map();
    const userRoles = new Map();

    // Default roles
    const defaultRoles = [
        { id: 'admin', name: 'Administrator', permissions: ['*'], isSystem: true },
        { id: 'manager', name: 'Manager', permissions: ['read', 'write', 'delete:own', 'manage:team'], isSystem: true },
        { id: 'member', name: 'Member', permissions: ['read', 'write:own'], isSystem: true },
        { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystem: true }
    ];

    defaultRoles.forEach(r => roles.set(r.id, { ...r, createdAt: new Date().toISOString() }));

    // Helper function for recursive permissions
    const getEffectivePermissionsInternal = async (roleId) => {
        const role = roles.get(roleId);
        if (!role) throw new Error('Role not found');

        let permissions = [...role.permissions];

        if (role.inherits) {
            const parentPermissions = await getEffectivePermissionsInternal(role.inherits);
            permissions = [...new Set([...permissions, ...parentPermissions])];
        }

        return permissions;
    };

    return {
        // Create custom role
        create: async (data) => {
            if (!data.id || !data.name) {
                throw new Error('ID and name required');
            }

            if (roles.has(data.id)) {
                throw new Error('Role already exists');
            }

            const role = {
                id: data.id,
                name: data.name,
                description: data.description || '',
                permissions: data.permissions || [],
                inherits: data.inherits || null,
                isSystem: false,
                organizationId: data.organizationId,
                createdAt: new Date().toISOString()
            };

            roles.set(data.id, role);
            return role;
        },

        // Get role by ID
        getById: async (id) => {
            return roles.get(id) || null;
        },

        // List roles
        list: async (organizationId) => {
            return Array.from(roles.values())
                .filter(r => r.isSystem || r.organizationId === organizationId);
        },

        // Update role
        update: async (id, updates) => {
            const role = roles.get(id);
            if (!role) throw new Error('Role not found');
            if (role.isSystem) throw new Error('Cannot modify system role');

            const updated = { ...role, ...updates, updatedAt: new Date().toISOString() };
            roles.set(id, updated);
            return updated;
        },

        // Delete role
        delete: async (id) => {
            const role = roles.get(id);
            if (!role) throw new Error('Role not found');
            if (role.isSystem) throw new Error('Cannot delete system role');

            return roles.delete(id);
        },

        // Get effective permissions (with inheritance)
        getEffectivePermissions: getEffectivePermissionsInternal,

        // Check permission
        hasPermission: async (roleId, permission) => {
            const permissions = await getEffectivePermissionsInternal(roleId);

            if (permissions.includes('*')) return true;
            if (permissions.includes(permission)) return true;

            // Check wildcard patterns
            const [action, scope] = permission.split(':');
            if (permissions.includes(action)) return true;
            if (scope === 'own' && permissions.includes(`${action}:own`)) return true;

            return false;
        },

        // Assign role to user
        assignRole: async (userId, roleId, context = {}) => {
            const role = roles.get(roleId);
            if (!role) throw new Error('Role not found');

            const key = context.projectId
                ? `${userId}:${context.projectId}`
                : userId;

            const assignment = {
                userId,
                roleId,
                projectId: context.projectId,
                assignedAt: new Date().toISOString(),
                assignedBy: context.assignedBy
            };

            userRoles.set(key, assignment);
            return assignment;
        },

        // Get user's role
        getUserRole: async (userId, context = {}) => {
            const key = context.projectId
                ? `${userId}:${context.projectId}`
                : userId;

            const assignment = userRoles.get(key);
            if (!assignment) return null;

            const role = roles.get(assignment.roleId);
            return role;
        },

        // Remove role from user
        removeRole: async (userId, context = {}) => {
            const key = context.projectId
                ? `${userId}:${context.projectId}`
                : userId;

            return userRoles.delete(key);
        },

        // Get users with role
        getUsersWithRole: async (roleId) => {
            const users = [];
            for (const [key, assignment] of userRoles.entries()) {
                if (assignment.roleId === roleId) {
                    users.push(assignment);
                }
            }
            return users;
        },

        // Clear for testing
        clear: () => {
            roles.clear();
            userRoles.clear();
            defaultRoles.forEach(r => roles.set(r.id, { ...r, createdAt: new Date().toISOString() }));
        }
    };
};

describe('RoleService', () => {
    let roleService;

    beforeEach(() => {
        roleService = createRoleService();
    });

    describe('Default Roles', () => {
        it('should have default system roles', async () => {
            const admin = await roleService.getById('admin');
            const viewer = await roleService.getById('viewer');

            expect(admin).toBeDefined();
            expect(admin.isSystem).toBe(true);
            expect(admin.permissions).toContain('*');

            expect(viewer.permissions).toContain('read');
        });
    });

    describe('Custom Roles', () => {
        it('should create custom role', async () => {
            const role = await roleService.create({
                id: 'project_lead',
                name: 'Project Lead',
                permissions: ['read', 'write', 'manage:project'],
                organizationId: 'org-1'
            });

            expect(role.id).toBe('project_lead');
            expect(role.isSystem).toBe(false);
        });

        it('should prevent duplicate role IDs', async () => {
            await roleService.create({ id: 'custom', name: 'Custom', organizationId: 'org-1' });

            await expect(roleService.create({ id: 'custom', name: 'Another', organizationId: 'org-1' }))
                .rejects.toThrow('Role already exists');
        });

        it('should update custom role', async () => {
            await roleService.create({ id: 'custom', name: 'Original', organizationId: 'org-1' });

            const updated = await roleService.update('custom', { name: 'Updated Name' });

            expect(updated.name).toBe('Updated Name');
        });

        it('should not modify system roles', async () => {
            await expect(roleService.update('admin', { name: 'Modified Admin' }))
                .rejects.toThrow('Cannot modify system role');
        });

        it('should delete custom role', async () => {
            await roleService.create({ id: 'temp', name: 'Temporary', organizationId: 'org-1' });

            await roleService.delete('temp');

            const role = await roleService.getById('temp');
            expect(role).toBeNull();
        });

        it('should not delete system roles', async () => {
            await expect(roleService.delete('admin'))
                .rejects.toThrow('Cannot delete system role');
        });
    });

    describe('Role Inheritance', () => {
        it('should support role inheritance', async () => {
            await roleService.create({
                id: 'senior_member',
                name: 'Senior Member',
                permissions: ['approve:own'],
                inherits: 'member',
                organizationId: 'org-1'
            });

            const permissions = await roleService.getEffectivePermissions('senior_member');

            expect(permissions).toContain('approve:own');
            expect(permissions).toContain('read'); // From member
            expect(permissions).toContain('write:own'); // From member
        });
    });

    describe('Permission Checking', () => {
        it('should check direct permissions', async () => {
            const hasRead = await roleService.hasPermission('viewer', 'read');
            const hasWrite = await roleService.hasPermission('viewer', 'write');

            expect(hasRead).toBe(true);
            expect(hasWrite).toBe(false);
        });

        it('should allow admin all permissions', async () => {
            const hasAny = await roleService.hasPermission('admin', 'any:permission');
            expect(hasAny).toBe(true);
        });

        it('should handle scope-based permissions', async () => {
            const hasWriteOwn = await roleService.hasPermission('member', 'write:own');
            const hasWriteAll = await roleService.hasPermission('member', 'write:all');

            expect(hasWriteOwn).toBe(true);
            expect(hasWriteAll).toBe(false);
        });
    });

    describe('User Role Assignment', () => {
        it('should assign role to user', async () => {
            const assignment = await roleService.assignRole('user-1', 'manager');

            expect(assignment.roleId).toBe('manager');
            expect(assignment.assignedAt).toBeDefined();
        });

        it('should get user role', async () => {
            await roleService.assignRole('user-1', 'manager');

            const role = await roleService.getUserRole('user-1');

            expect(role.id).toBe('manager');
        });

        it('should support project-specific roles', async () => {
            await roleService.assignRole('user-1', 'admin', { projectId: 'proj-1' });
            await roleService.assignRole('user-1', 'viewer', { projectId: 'proj-2' });

            const proj1Role = await roleService.getUserRole('user-1', { projectId: 'proj-1' });
            const proj2Role = await roleService.getUserRole('user-1', { projectId: 'proj-2' });

            expect(proj1Role.id).toBe('admin');
            expect(proj2Role.id).toBe('viewer');
        });

        it('should remove role from user', async () => {
            await roleService.assignRole('user-1', 'manager');

            await roleService.removeRole('user-1');

            const role = await roleService.getUserRole('user-1');
            expect(role).toBeNull();
        });
    });

    describe('Role Queries', () => {
        it('should list roles including system and org-specific', async () => {
            await roleService.create({ id: 'org_role', name: 'Org Role', organizationId: 'org-1' });
            await roleService.create({ id: 'other_org', name: 'Other Org', organizationId: 'org-2' });

            const roles = await roleService.list('org-1');

            expect(roles.some(r => r.id === 'admin')).toBe(true); // system
            expect(roles.some(r => r.id === 'org_role')).toBe(true); // org-1
            expect(roles.some(r => r.id === 'other_org')).toBe(false); // org-2
        });

        it('should get users with specific role', async () => {
            await roleService.assignRole('user-1', 'manager');
            await roleService.assignRole('user-2', 'manager');
            await roleService.assignRole('user-3', 'viewer');

            const managers = await roleService.getUsersWithRole('manager');

            expect(managers).toHaveLength(2);
        });
    });
});
