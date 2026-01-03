/**
 * RBAC Service
 * 
 * Role-Based Access Control with Custom Roles
 * Supports hierarchical permissions and role inheritance
 * 
 * Features:
 * - Custom role creation
 * - Permission management
 * - Role assignment
 * - Permission checking
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



// System roles that cannot be modified
const SYSTEM_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    OWNER: 'owner',
    PROJECT_MANAGER: 'project_manager',
    MEMBER: 'member',
    VIEWER: 'viewer',
    GUEST: 'guest',
};

// Default permissions for system roles
const SYSTEM_ROLE_PERMISSIONS = {
    super_admin: ['*'], // All permissions
    admin: [
        'projects:*', 'users:*', 'assessments:*', 'initiatives:*',
        'tasks:*', 'reports:*', 'ai:*', 'settings:*', 'security:read',
        'billing:read', 'integrations:*', 'roles:read'
    ],
    owner: [
        'projects:*', 'users:*', 'assessments:*', 'initiatives:*',
        'tasks:*', 'reports:*', 'ai:*', 'settings:*', 'security:*',
        'billing:*', 'integrations:*', 'roles:*'
    ],
    project_manager: [
        'projects:read', 'projects:write', 'users:read', 'assessments:*',
        'initiatives:*', 'tasks:*', 'reports:*', 'ai:chat', 'ai:analyze'
    ],
    member: [
        'projects:read', 'users:read', 'assessments:read', 'assessments:write',
        'initiatives:read', 'initiatives:write', 'tasks:*', 'reports:read',
        'ai:chat'
    ],
    viewer: [
        'projects:read', 'users:read', 'assessments:read', 'initiatives:read',
        'tasks:read', 'reports:read'
    ],
    guest: [
        'projects:read', 'tasks:read'
    ],
};

class RBACService {
    // ====== CUSTOM ROLES ======

    /**
     * Create a custom role
     */
    async createRole(organizationId, roleData) {
        const id = uuidv4();
        const {
            name,
            displayName,
            description,
            color = '#6366f1',
            icon = 'shield',
            baseRole,
            scope = 'organization',
            priority = 0,
            isDefault = false,
            createdBy,
        } = roleData;

        // Validate name uniqueness
        const existing = await this.getRoleByName(organizationId, name);
        if (existing) {
            throw new Error(`Role with name "${name}" already exists`);
        }

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO custom_roles (
                    id, organization_id, name, display_name, description,
                    color, icon, base_role, role_type, scope, priority,
                    is_active, is_default, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'custom', ?, ?, 1, ?, ?)`,
                [
                    id, organizationId, name, displayName, description,
                    color, icon, baseRole || null, scope, priority,
                    isDefault ? 1 : 0, createdBy
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id, created: true });
                }
            );
        });
    }

    /**
     * Get all roles for an organization
     */
    async getOrganizationRoles(organizationId, includeSystem = true) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT cr.*, 
                    (SELECT COUNT(*) FROM user_role_assignments ura 
                     WHERE ura.role_id = cr.id AND ura.is_active = 1) as user_count
                FROM custom_roles cr
                WHERE cr.organization_id = ? AND cr.is_active = 1
            `;
            const params = [organizationId];

            if (!includeSystem) {
                query += ` AND cr.role_type != 'system'`;
            }

            query += ' ORDER BY cr.priority DESC, cr.display_name';

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);

                // Include system roles if requested
                if (includeSystem) {
                    const systemRoles = Object.entries(SYSTEM_ROLES).map(([key, value]) => ({
                        id: `system_${value}`,
                        organization_id: organizationId,
                        name: value,
                        display_name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        role_type: 'system',
                        scope: 'global',
                        is_system: true,
                        user_count: 0, // Would need to query users table for actual count
                    }));
                    resolve([...systemRoles, ...(rows || [])]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Get a role by ID
     */
    async getRole(roleId) {
        // Check if it's a system role
        if (roleId.startsWith('system_')) {
            const roleName = roleId.replace('system_', '');
            return {
                id: roleId,
                name: roleName,
                display_name: roleName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                role_type: 'system',
                is_system: true,
                permissions: SYSTEM_ROLE_PERMISSIONS[roleName] || [],
            };
        }

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM custom_roles WHERE id = ?`,
                [roleId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * Get a role by name within an organization
     */
    async getRoleByName(organizationId, name) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM custom_roles WHERE organization_id = ? AND name = ?`,
                [organizationId, name],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * Update a role
     */
    async updateRole(roleId, updates) {
        const allowedFields = [
            'display_name', 'description', 'color', 'icon',
            'base_role', 'scope', 'priority', 'is_default', 'is_active'
        ];

        const setClauses = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(dbKey)) {
                setClauses.push(`${dbKey} = ?`);
                params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            return { updated: false };
        }

        setClauses.push("updated_at = datetime('now')");
        params.push(roleId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE custom_roles SET ${setClauses.join(', ')} WHERE id = ? AND role_type != 'system'`,
                params,
                function(err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Delete a role
     */
    async deleteRole(roleId) {
        return new Promise((resolve, reject) => {
            // First check if role has any assignments
            db.get(
                `SELECT COUNT(*) as count FROM user_role_assignments WHERE role_id = ? AND is_active = 1`,
                [roleId],
                (err, row) => {
                    if (err) return reject(err);
                    
                    if (row?.count > 0) {
                        return reject(new Error('Cannot delete role with active assignments'));
                    }

                    db.run(
                        `DELETE FROM custom_roles WHERE id = ? AND role_type != 'system'`,
                        [roleId],
                        function(err) {
                            if (err) return reject(err);
                            resolve({ deleted: this.changes > 0 });
                        }
                    );
                }
            );
        });
    }

    // ====== PERMISSIONS ======

    /**
     * Get all permission definitions
     */
    async getPermissionDefinitions(category = null) {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM permission_definitions WHERE is_active = 1`;
            const params = [];

            if (category) {
                query += ' AND category = ?';
                params.push(category);
            }

            query += ' ORDER BY category, name';

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Get permissions for a role
     */
    async getRolePermissions(roleId) {
        // Handle system roles
        if (roleId.startsWith('system_')) {
            const roleName = roleId.replace('system_', '');
            const permissions = SYSTEM_ROLE_PERMISSIONS[roleName] || [];
            return permissions.map(p => ({
                permission_name: p,
                grant_type: 'allow',
            }));
        }

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT rp.*, pd.name as permission_name, pd.display_name, pd.category, pd.risk_level
                 FROM role_permissions rp
                 JOIN permission_definitions pd ON rp.permission_id = pd.id
                 WHERE rp.role_id = ?`,
                [roleId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Set permissions for a role
     */
    async setRolePermissions(roleId, permissions) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Delete existing permissions
                db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);

                // Insert new permissions
                const stmt = db.prepare(
                    `INSERT INTO role_permissions (id, role_id, permission_id, grant_type, conditions)
                     VALUES (?, ?, ?, ?, ?)`
                );

                for (const perm of permissions) {
                    stmt.run([
                        uuidv4(),
                        roleId,
                        perm.permissionId,
                        perm.grantType || 'allow',
                        perm.conditions ? JSON.stringify(perm.conditions) : null,
                    ]);
                }

                stmt.finalize((err) => {
                    if (err) return reject(err);
                    resolve({ set: true, count: permissions.length });
                });
            });
        });
    }

    /**
     * Add a single permission to a role
     */
    async addPermissionToRole(roleId, permissionId, grantType = 'allow', conditions = null) {
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO role_permissions (id, role_id, permission_id, grant_type, conditions)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, roleId, permissionId, grantType, conditions ? JSON.stringify(conditions) : null],
                function(err) {
                    if (err) return reject(err);
                    resolve({ added: true });
                }
            );
        });
    }

    /**
     * Remove a permission from a role
     */
    async removePermissionFromRole(roleId, permissionId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
                [roleId, permissionId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ removed: this.changes > 0 });
                }
            );
        });
    }

    // ====== USER ROLE ASSIGNMENTS ======

    /**
     * Assign a role to a user
     */
    async assignRole(userId, roleId, organizationId, options = {}) {
        const id = uuidv4();
        const {
            scopeType = 'organization',
            scopeId = null,
            validFrom = new Date().toISOString(),
            validUntil = null,
            assignedBy = null,
            assignedReason = null,
        } = options;

        return new Promise((resolve, reject) => {
            // Check if assignment already exists
            db.get(
                `SELECT id FROM user_role_assignments 
                 WHERE user_id = ? AND role_id = ? AND organization_id = ? 
                 AND scope_type = ? AND (scope_id = ? OR (scope_id IS NULL AND ? IS NULL))
                 AND is_active = 1`,
                [userId, roleId, organizationId, scopeType, scopeId, scopeId],
                (err, existing) => {
                    if (err) return reject(err);
                    
                    if (existing) {
                        return resolve({ id: existing.id, existing: true });
                    }

                    db.run(
                        `INSERT INTO user_role_assignments (
                            id, user_id, role_id, organization_id, scope_type, scope_id,
                            valid_from, valid_until, is_active, assigned_by, assigned_reason
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                        [
                            id, userId, roleId, organizationId, scopeType, scopeId,
                            validFrom, validUntil, assignedBy, assignedReason
                        ],
                        function(err) {
                            if (err) return reject(err);
                            resolve({ id, assigned: true });
                        }
                    );
                }
            );
        });
    }

    /**
     * Revoke a role from a user
     */
    async revokeRole(assignmentId) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_role_assignments SET is_active = 0, updated_at = datetime('now') WHERE id = ?`,
                [assignmentId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ revoked: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Get user's role assignments
     */
    async getUserRoles(userId, organizationId = null) {
        let query = `
            SELECT ura.*, cr.name as role_name, cr.display_name, cr.color, cr.icon
            FROM user_role_assignments ura
            LEFT JOIN custom_roles cr ON ura.role_id = cr.id
            WHERE ura.user_id = ? AND ura.is_active = 1
            AND (ura.valid_until IS NULL OR ura.valid_until > datetime('now'))
        `;
        const params = [userId];

        if (organizationId) {
            query += ' AND ura.organization_id = ?';
            params.push(organizationId);
        }

        query += ' ORDER BY cr.priority DESC';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Get all users with a specific role
     */
    async getRoleUsers(roleId, organizationId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT u.id, u.email, u.display_name, u.first_name, u.last_name,
                        ura.valid_from, ura.valid_until, ura.assigned_by
                 FROM user_role_assignments ura
                 JOIN users u ON ura.user_id = u.id
                 WHERE ura.role_id = ? AND ura.organization_id = ? AND ura.is_active = 1
                 ORDER BY u.display_name`,
                [roleId, organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    // ====== PERMISSION CHECKING ======

    /**
     * Check if user has a specific permission
     */
    async hasPermission(userId, organizationId, permission, context = {}) {
        // Get user's roles
        const roles = await this.getUserRoles(userId, organizationId);
        
        // Also check user's system role from users table
        const userSystemRole = await this.getUserSystemRole(userId);

        // Check system role permissions
        if (userSystemRole) {
            const systemPerms = SYSTEM_ROLE_PERMISSIONS[userSystemRole] || [];
            if (this.matchPermission(systemPerms, permission)) {
                return { allowed: true, source: 'system_role', role: userSystemRole };
            }
        }

        // Check custom role permissions
        for (const roleAssignment of roles) {
            const rolePerms = await this.getRolePermissions(roleAssignment.role_id);
            
            for (const perm of rolePerms) {
                if (this.matchPermission([perm.permission_name], permission)) {
                    if (perm.grant_type === 'deny') {
                        return { allowed: false, source: 'explicit_deny', role: roleAssignment.role_name };
                    }
                    
                    // Check conditions if any
                    if (perm.conditions) {
                        const conditions = JSON.parse(perm.conditions);
                        if (!this.evaluateConditions(conditions, context)) {
                            continue;
                        }
                    }
                    
                    return { allowed: true, source: 'custom_role', role: roleAssignment.role_name };
                }
            }

            // Check base role if exists
            if (roleAssignment.base_role) {
                const basePerms = SYSTEM_ROLE_PERMISSIONS[roleAssignment.base_role] || [];
                if (this.matchPermission(basePerms, permission)) {
                    return { allowed: true, source: 'base_role', role: roleAssignment.base_role };
                }
            }
        }

        return { allowed: false, source: 'no_permission' };
    }

    /**
     * Get user's effective permissions
     */
    async getEffectivePermissions(userId, organizationId) {
        const permissions = new Set();
        const deniedPermissions = new Set();

        // Get user's system role
        const userSystemRole = await this.getUserSystemRole(userId);
        if (userSystemRole) {
            const systemPerms = SYSTEM_ROLE_PERMISSIONS[userSystemRole] || [];
            systemPerms.forEach(p => permissions.add(p));
        }

        // Get user's custom roles
        const roles = await this.getUserRoles(userId, organizationId);

        for (const roleAssignment of roles) {
            // Get role permissions
            const rolePerms = await this.getRolePermissions(roleAssignment.role_id);
            
            for (const perm of rolePerms) {
                if (perm.grant_type === 'deny') {
                    deniedPermissions.add(perm.permission_name);
                } else {
                    permissions.add(perm.permission_name);
                }
            }

            // Add base role permissions
            if (roleAssignment.base_role) {
                const basePerms = SYSTEM_ROLE_PERMISSIONS[roleAssignment.base_role] || [];
                basePerms.forEach(p => permissions.add(p));
            }
        }

        // Remove denied permissions
        deniedPermissions.forEach(p => permissions.delete(p));

        return Array.from(permissions);
    }

    /**
     * Get user's system role from users table
     */
    async getUserSystemRole(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT role FROM users WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.role);
                }
            );
        });
    }

    /**
     * Match permission against permission patterns
     */
    matchPermission(patterns, permission) {
        const [resource, action] = permission.split(':');

        for (const pattern of patterns) {
            if (pattern === '*') return true;
            if (pattern === permission) return true;

            const [patternResource, patternAction] = pattern.split(':');
            
            // Match resource:* pattern
            if (patternAction === '*' && patternResource === resource) return true;
            
            // Match *:action pattern
            if (patternResource === '*' && patternAction === action) return true;
        }

        return false;
    }

    /**
     * Evaluate permission conditions
     */
    evaluateConditions(conditions, context) {
        // own_resources_only - check if user owns the resource
        if (conditions.own_resources_only && context.resourceOwnerId) {
            if (context.userId !== context.resourceOwnerId) {
                return false;
            }
        }

        // project_member_only - check if user is member of project
        if (conditions.project_member_only && context.projectId) {
            // This would need to query project membership
            // Simplified for now
            return true;
        }

        return true;
    }

    // ====== ROLE TEMPLATES ======

    /**
     * Get predefined role templates
     */
    getRoleTemplates() {
        return [
            {
                name: 'analyst',
                displayName: 'Analyst',
                description: 'Can view and analyze data, create reports',
                color: '#0ea5e9',
                icon: 'chart-bar',
                permissions: [
                    'projects:read', 'assessments:read', 'assessments:write',
                    'initiatives:read', 'tasks:read', 'reports:*', 'ai:analyze'
                ]
            },
            {
                name: 'consultant',
                displayName: 'Consultant',
                description: 'External consultant with limited access',
                color: '#f59e0b',
                icon: 'briefcase',
                permissions: [
                    'projects:read', 'assessments:read', 'assessments:write',
                    'initiatives:read', 'initiatives:write', 'tasks:read', 'tasks:write',
                    'reports:read', 'ai:chat'
                ]
            },
            {
                name: 'approver',
                displayName: 'Approver',
                description: 'Can approve initiatives and workflows',
                color: '#10b981',
                icon: 'check-circle',
                permissions: [
                    'projects:read', 'assessments:read', 'initiatives:read',
                    'initiatives:approve', 'tasks:read', 'reports:read'
                ]
            },
            {
                name: 'auditor',
                displayName: 'Auditor',
                description: 'Read-only access with audit capabilities',
                color: '#6366f1',
                icon: 'search',
                permissions: [
                    'projects:read', 'users:read', 'assessments:read',
                    'initiatives:read', 'tasks:read', 'reports:read',
                    'security:audit', 'settings:read'
                ]
            },
        ];
    }

    /**
     * Create role from template
     */
    async createRoleFromTemplate(organizationId, templateName, createdBy) {
        const templates = this.getRoleTemplates();
        const template = templates.find(t => t.name === templateName);

        if (!template) {
            throw new Error(`Template "${templateName}" not found`);
        }

        // Create the role
        const role = await this.createRole(organizationId, {
            name: template.name,
            displayName: template.displayName,
            description: template.description,
            color: template.color,
            icon: template.icon,
            createdBy,
        });

        // Get permission IDs and set permissions
        const permDefs = await this.getPermissionDefinitions();
        const permMap = {};
        permDefs.forEach(p => permMap[p.name] = p.id);

        const permissions = template.permissions
            .filter(p => permMap[p])
            .map(p => ({ permissionId: permMap[p], grantType: 'allow' }));

        if (permissions.length > 0) {
            await this.setRolePermissions(role.id, permissions);
        }

        return role;
    }
}

const rBACServiceInstance = new RBACService();
export default rBACServiceInstance;







