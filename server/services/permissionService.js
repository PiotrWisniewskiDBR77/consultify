/**
 * SCMS Permission Service
 * Step 14: Enhanced with database-backed PBAC (Permission-Based Access Control)
 * 
 * Maintains backward compatibility with existing role-based checks while
 * adding granular database-backed permission management.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const ROLES = {
    SUPERADMIN: 'SUPERADMIN',
    ADMIN: 'ADMIN',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    TEAM_MEMBER: 'TEAM_MEMBER',
    VIEWER: 'VIEWER'
};

// Legacy capability constants (for backward compatibility)
const CAPABILITIES = {
    MANAGE_USERS: 'manage_users',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_BILLING: 'manage_billing',
    MANAGE_ORG_SETTINGS: 'manage_org_settings',
    MANAGE_AI_POLICY: 'manage_ai_policy',
    CREATE_PROJECT: 'create_project',
    EDIT_PROJECT_SETTINGS: 'edit_project_settings',
    MANAGE_PROJECT_ROLES: 'manage_project_roles',
    MANAGE_WORKSTREAMS: 'manage_workstreams',
    APPROVE_CHANGES: 'approve_changes',
    MANAGE_STAGE_GATES: 'manage_stage_gates',
    VIEW_AUDIT_LOG: 'view_audit_log',
    CREATE_INITIATIVE: 'create_initiative',
    EDIT_INITIATIVE: 'edit_initiative',
    MANAGE_ROADMAP: 'manage_roadmap',
    ASSIGN_TASKS: 'assign_tasks',
    UPDATE_TASK_STATUS: 'update_task_status',
    MANAGE_RISKS: 'manage_risks',
    AI_EXECUTE_ACTIONS: 'ai_execute_actions',
    AI_VIEW_INSIGHTS: 'ai_view_insights'
};

// Legacy capability matrix (for backward compatibility)
const ROLE_CAPABILITIES = {
    [ROLES.SUPERADMIN]: Object.values(CAPABILITIES),
    [ROLES.ADMIN]: Object.values(CAPABILITIES),
    [ROLES.PROJECT_MANAGER]: [
        CAPABILITIES.EDIT_PROJECT_SETTINGS,
        CAPABILITIES.MANAGE_PROJECT_ROLES,
        CAPABILITIES.MANAGE_WORKSTREAMS,
        CAPABILITIES.APPROVE_CHANGES,
        CAPABILITIES.MANAGE_STAGE_GATES,
        CAPABILITIES.VIEW_AUDIT_LOG,
        CAPABILITIES.CREATE_INITIATIVE,
        CAPABILITIES.EDIT_INITIATIVE,
        CAPABILITIES.MANAGE_ROADMAP,
        CAPABILITIES.ASSIGN_TASKS,
        CAPABILITIES.UPDATE_TASK_STATUS,
        CAPABILITIES.MANAGE_RISKS,
        CAPABILITIES.AI_VIEW_INSIGHTS
    ],
    [ROLES.TEAM_MEMBER]: [
        CAPABILITIES.UPDATE_TASK_STATUS,
        CAPABILITIES.AI_VIEW_INSIGHTS
    ],
    [ROLES.VIEWER]: [
        CAPABILITIES.AI_VIEW_INSIGHTS
    ]
};

const PermissionService = {
    ROLES,
    CAPABILITIES,
    ROLE_CAPABILITIES,

    /**
     * Legacy: Check if a user has a capability (role-based)
     * Maintained for backward compatibility
     */
    can: (user, capability, context = {}) => {
        if (!user || !user.role) return false;
        if (user.role === ROLES.SUPERADMIN) return true;

        const allowedCaps = ROLE_CAPABILITIES[user.role] || [];
        if (!allowedCaps.includes(capability)) return false;

        if ([CAPABILITIES.MANAGE_USERS, CAPABILITIES.MANAGE_ORG_SETTINGS].includes(capability)) {
            if (user.role !== ROLES.ADMIN) return false;
        }

        return true;
    },

    /**
     * Legacy: Get list of capabilities for a role
     */
    getCapabilitiesForRole: (role) => {
        return ROLE_CAPABILITIES[role] || [];
    },

    // =========================================
    // NEW: Database-Backed PBAC Methods
    // =========================================

    /**
     * Check if a user has a specific permission (DB-backed PBAC)
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {string} permissionKey - Permission key (e.g., 'PLAYBOOK_PUBLISH')
     * @param {string} userRole - User's role (for fallback to role_permissions)
     * @returns {Promise<boolean>}
     */
    hasPermission: async (userId, orgId, permissionKey, userRole) => {
        if (!userId || !permissionKey) return false;

        // SUPERADMIN bypass
        if (userRole === ROLES.SUPERADMIN) return true;

        return new Promise((resolve) => {
            // First check for explicit org-user override
            db.get(
                `SELECT grant_type FROM org_user_permissions 
                 WHERE user_id = ? AND organization_id = ? AND permission_key = ?`,
                [userId, orgId, permissionKey],
                (err, override) => {
                    if (err) {
                        console.error('[PermissionService] Override query error:', err);
                    }

                    // If explicit override exists, use it
                    if (override) {
                        return resolve(override.grant_type === 'GRANT');
                    }

                    // Fall back to role-based permission from role_permissions table
                    db.get(
                        `SELECT 1 FROM role_permissions 
                         WHERE role = ? AND permission_key = ?`,
                        [userRole, permissionKey],
                        (roleErr, rolePermission) => {
                            if (roleErr) {
                                console.error('[PermissionService] Role permission query error:', roleErr);
                                return resolve(false);
                            }
                            resolve(!!rolePermission);
                        }
                    );
                }
            );
        });
    },

    /**
     * Get all permissions for a user in an organization
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {string} userRole - User's role
     * @returns {Promise<Object>} - { rolePermissions: [], overrides: { granted: [], revoked: [] }, effective: [] }
     */
    getUserPermissions: async (userId, orgId, userRole) => {
        return new Promise((resolve, reject) => {
            // Get role-based permissions
            db.all(
                `SELECT permission_key FROM role_permissions WHERE role = ?`,
                [userRole],
                (roleErr, rolePerms) => {
                    if (roleErr) return reject(roleErr);

                    const rolePermissions = (rolePerms || []).map(r => r.permission_key);

                    // Get user overrides
                    db.all(
                        `SELECT permission_key, grant_type 
                         FROM org_user_permissions 
                         WHERE user_id = ? AND organization_id = ?`,
                        [userId, orgId],
                        (overrideErr, overrides) => {
                            if (overrideErr) return reject(overrideErr);

                            const granted = (overrides || [])
                                .filter(o => o.grant_type === 'GRANT')
                                .map(o => o.permission_key);
                            const revoked = (overrides || [])
                                .filter(o => o.grant_type === 'REVOKE')
                                .map(o => o.permission_key);

                            // Calculate effective permissions
                            const effective = [
                                ...rolePermissions.filter(p => !revoked.includes(p)),
                                ...granted.filter(p => !rolePermissions.includes(p))
                            ];

                            resolve({
                                rolePermissions,
                                overrides: { granted, revoked },
                                effective
                            });
                        }
                    );
                }
            );
        });
    },

    /**
     * Grant a permission to a user in an organization
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {string} permissionKey - Permission key
     * @param {string} grantedBy - ID of user granting the permission
     * @returns {Promise<Object>}
     */
    grantPermission: async (userId, orgId, permissionKey, grantedBy) => {
        // Verify permission exists
        const permExists = await PermissionService._permissionExists(permissionKey);
        if (!permExists) {
            throw new Error(`Permission not found: ${permissionKey}`);
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO org_user_permissions 
                 (id, user_id, organization_id, permission_key, grant_type, granted_by, created_at)
                 VALUES (?, ?, ?, ?, 'GRANT', ?, datetime('now'))`,
                [id, userId, orgId, permissionKey, grantedBy],
                function (err) {
                    if (err) return reject(err);

                    console.log(`[PermissionService] Permission granted: ${permissionKey} to ${userId} by ${grantedBy}`);
                    resolve({
                        id,
                        userId,
                        organizationId: orgId,
                        permissionKey,
                        grantType: 'GRANT',
                        grantedBy
                    });
                }
            );
        });
    },

    /**
     * Revoke a permission from a user in an organization
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {string} permissionKey - Permission key
     * @param {string} revokedBy - ID of user revoking the permission
     * @returns {Promise<Object>}
     */
    revokePermission: async (userId, orgId, permissionKey, revokedBy) => {
        // Verify permission exists
        const permExists = await PermissionService._permissionExists(permissionKey);
        if (!permExists) {
            throw new Error(`Permission not found: ${permissionKey}`);
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO org_user_permissions 
                 (id, user_id, organization_id, permission_key, grant_type, granted_by, created_at)
                 VALUES (?, ?, ?, ?, 'REVOKE', ?, datetime('now'))`,
                [id, userId, orgId, permissionKey, revokedBy],
                function (err) {
                    if (err) return reject(err);

                    console.log(`[PermissionService] Permission revoked: ${permissionKey} from ${userId} by ${revokedBy}`);
                    resolve({
                        id,
                        userId,
                        organizationId: orgId,
                        permissionKey,
                        grantType: 'REVOKE',
                        revokedBy
                    });
                }
            );
        });
    },

    /**
     * Remove override (revert to role default)
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {string} permissionKey - Permission key
     * @returns {Promise<Object>}
     */
    removeOverride: async (userId, orgId, permissionKey) => {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM org_user_permissions 
                 WHERE user_id = ? AND organization_id = ? AND permission_key = ?`,
                [userId, orgId, permissionKey],
                function (err) {
                    if (err) return reject(err);

                    resolve({
                        removed: this.changes > 0,
                        userId,
                        organizationId: orgId,
                        permissionKey
                    });
                }
            );
        });
    },

    /**
     * Get all defined permissions
     * @returns {Promise<Array>}
     */
    getAllPermissions: async () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT key, description, category FROM permissions ORDER BY category, key`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get permissions by category
     * @param {string} category - Permission category
     * @returns {Promise<Array>}
     */
    getPermissionsByCategory: async (category) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT key, description, category FROM permissions WHERE category = ?`,
                [category],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get role-permission mappings
     * @param {string} [role] - Optional role filter
     * @returns {Promise<Array>}
     */
    getRolePermissions: async (role = null) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT rp.role, rp.permission_key, p.description, p.category
                       FROM role_permissions rp
                       JOIN permissions p ON p.key = rp.permission_key`;
            const params = [];

            if (role) {
                sql += ` WHERE rp.role = ?`;
                params.push(role);
            }

            sql += ` ORDER BY rp.role, p.category, rp.permission_key`;

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Internal: Check if permission exists
     */
    _permissionExists: async (permissionKey) => {
        return new Promise((resolve) => {
            db.get(
                `SELECT 1 FROM permissions WHERE key = ?`,
                [permissionKey],
                (err, row) => {
                    resolve(!!row);
                }
            );
        });
    }
};

module.exports = PermissionService;
