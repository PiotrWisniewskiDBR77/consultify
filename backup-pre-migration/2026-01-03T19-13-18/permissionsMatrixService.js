/**
 * Permissions Matrix Service
 * 
 * Manages granular permissions for roles with category grouping,
 * inheritance, and bulk operations.
 */

import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';

const require = createRequire(import.meta.url);


// Dependency injection for testing
const deps = {
    db: require('../database')
};

/**
 * Set dependencies for testing
 */
const setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

/**
 * Permission categories with metadata
 */
const PERMISSION_CATEGORIES = {
    organizations: {
        name: 'Organizations',
        description: 'Permissions for managing organizations',
        icon: 'building'
    },
    users: {
        name: 'Users',
        description: 'Permissions for user management',
        icon: 'users'
    },
    security: {
        name: 'Security',
        description: 'Security and access control permissions',
        icon: 'shield'
    },
    billing: {
        name: 'Billing',
        description: 'Billing and subscription permissions',
        icon: 'credit-card'
    },
    ai: {
        name: 'AI & LLM',
        description: 'AI features and model management',
        icon: 'cpu'
    },
    content: {
        name: 'Content',
        description: 'Content and template management',
        icon: 'file-text'
    },
    analytics: {
        name: 'Analytics',
        description: 'Reports and analytics access',
        icon: 'bar-chart'
    },
    system: {
        name: 'System',
        description: 'System configuration and maintenance',
        icon: 'settings'
    }
};

/**
 * Default role hierarchy (higher = more permissions)
 */
const ROLE_HIERARCHY = {
    'SUPERADMIN': 100,
    'ADMIN': 80,
    'MANAGER': 60,
    'MEMBER': 40,
    'VIEWER': 20
};

/**
 * Get all permissions with category grouping
 */
const getAllPermissions = async () => {
    const sql = `
        SELECT 
            id, key, description, category, is_system, created_at
        FROM permissions 
        ORDER BY category, key
    `;
    
    const permissions = await deps.db.all(sql);
    
    // Group by category
    const grouped = {};
    for (const category of Object.keys(PERMISSION_CATEGORIES)) {
        grouped[category] = {
            ...PERMISSION_CATEGORIES[category],
            permissions: []
        };
    }
    
    permissions.forEach(p => {
        const cat = p.category || 'system';
        if (!grouped[cat]) {
            grouped[cat] = {
                name: cat,
                description: '',
                permissions: []
            };
        }
        grouped[cat].permissions.push({
            id: p.id,
            key: p.key,
            description: p.description,
            isSystem: p.is_system === 1,
            createdAt: p.created_at
        });
    });
    
    return grouped;
};

/**
 * Get permissions for a specific role
 */
const getRolePermissions = async (role) => {
    const sql = `
        SELECT permission_key 
        FROM role_permissions 
        WHERE role = ?
    `;
    
    const results = await deps.db.all(sql, [role]);
    return results.map(r => r.permission_key);
};

/**
 * Get the full permissions matrix
 */
const getMatrix = async () => {
    const permissions = await deps.db.all('SELECT * FROM permissions ORDER BY category, key');
    const rolePermissions = await deps.db.all('SELECT * FROM role_permissions');
    
    // Group permissions by category with metadata
    const categories = [];
    const categoryMap = {};
    
    permissions.forEach(p => {
        const cat = p.category || 'general';
        if (!categoryMap[cat]) {
            categoryMap[cat] = {
                id: cat,
                name: PERMISSION_CATEGORIES[cat]?.name || cat,
                description: PERMISSION_CATEGORIES[cat]?.description || '',
                icon: PERMISSION_CATEGORIES[cat]?.icon || 'settings',
                permissions: []
            };
            categories.push(categoryMap[cat]);
        }
        categoryMap[cat].permissions.push({
            id: p.id,
            key: p.key,
            description: p.description,
            isSystem: p.is_system === 1
        });
    });
    
    // Build roles list with hierarchy
    const roles = Object.entries(ROLE_HIERARCHY).map(([name, level]) => ({
        id: name.toLowerCase(),
        name,
        level,
        description: getRoleDescription(name)
    })).sort((a, b) => b.level - a.level);
    
    // Build matrix
    const matrix = {};
    roles.forEach(role => {
        matrix[role.name] = {};
        const rolePerms = rolePermissions
            .filter(rp => rp.role.toUpperCase() === role.name)
            .map(rp => rp.permission_key);
        
        permissions.forEach(p => {
            matrix[role.name][p.key] = rolePerms.includes(p.key);
        });
    });
    
    return { categories, roles, matrix };
};

/**
 * Get role description
 */
const getRoleDescription = (role) => {
    const descriptions = {
        'SUPERADMIN': 'Full system access with all permissions',
        'ADMIN': 'Administrative access with most permissions',
        'MANAGER': 'Team management and operational permissions',
        'MEMBER': 'Standard user permissions',
        'VIEWER': 'Read-only access'
    };
    return descriptions[role] || '';
};

/**
 * Update permissions for a role
 */
const updateRolePermissions = async (role, permissionKeys) => {
    // Validate role
    if (!ROLE_HIERARCHY[role.toUpperCase()]) {
        throw new Error(`Invalid role: ${role}`);
    }
    
    const normalizedRole = role.toUpperCase();
    
    // Get current permissions
    const current = await getRolePermissions(normalizedRole);
    
    // Calculate changes
    const toAdd = permissionKeys.filter(k => !current.includes(k));
    const toRemove = current.filter(k => !permissionKeys.includes(k));
    
    // Delete removed permissions
    if (toRemove.length > 0) {
        const placeholders = toRemove.map(() => '?').join(',');
        await deps.db.run(
            `DELETE FROM role_permissions WHERE role = ? AND permission_key IN (${placeholders})`,
            [normalizedRole, ...toRemove]
        );
    }
    
    // Add new permissions
    for (const key of toAdd) {
        await deps.db.run(
            'INSERT OR IGNORE INTO role_permissions (id, role, permission_key, created_at) VALUES (?, ?, ?, datetime("now"))',
            [uuidv4(), normalizedRole, key]
        );
    }
    
    return {
        role: normalizedRole,
        added: toAdd,
        removed: toRemove,
        total: permissionKeys.length
    };
};

/**
 * Toggle a single permission for a role
 */
const togglePermission = async (role, permissionKey, enabled) => {
    const normalizedRole = role.toUpperCase();
    
    if (enabled) {
        await deps.db.run(
            'INSERT OR IGNORE INTO role_permissions (id, role, permission_key, created_at) VALUES (?, ?, ?, datetime("now"))',
            [uuidv4(), normalizedRole, permissionKey]
        );
    } else {
        await deps.db.run(
            'DELETE FROM role_permissions WHERE role = ? AND permission_key = ?',
            [normalizedRole, permissionKey]
        );
    }
    
    return { role: normalizedRole, permissionKey, enabled };
};

/**
 * Create a new permission
 */
const createPermission = async ({ key, description, category }) => {
    const id = uuidv4();
    
    await deps.db.run(
        'INSERT INTO permissions (id, key, description, category, is_system, created_at) VALUES (?, ?, ?, ?, 0, datetime("now"))',
        [id, key, description, category || 'general']
    );
    
    return {
        id,
        key,
        description,
        category: category || 'general',
        isSystem: false,
        createdAt: new Date().toISOString()
    };
};

/**
 * Delete a permission (non-system only)
 */
const deletePermission = async (key) => {
    const permission = await deps.db.get('SELECT * FROM permissions WHERE key = ?', [key]);
    
    if (!permission) {
        throw new Error(`Permission not found: ${key}`);
    }
    
    if (permission.is_system === 1) {
        throw new Error('Cannot delete system permissions');
    }
    
    // Delete from role_permissions first
    await deps.db.run('DELETE FROM role_permissions WHERE permission_key = ?', [key]);
    
    // Delete permission
    await deps.db.run('DELETE FROM permissions WHERE key = ?', [key]);
    
    return { deleted: key };
};

/**
 * Copy permissions from one role to another
 */
const copyRolePermissions = async (sourceRole, targetRole) => {
    const sourcePerms = await getRolePermissions(sourceRole.toUpperCase());
    return updateRolePermissions(targetRole, sourcePerms);
};

/**
 * Check if a role has a specific permission
 */
const hasPermission = async (role, permissionKey) => {
    const result = await deps.db.get(
        'SELECT 1 FROM role_permissions WHERE role = ? AND permission_key = ?',
        [role.toUpperCase(), permissionKey]
    );
    return !!result;
};

/**
 * Get permissions diff between two roles
 */
const compareRoles = async (role1, role2) => {
    const perms1 = await getRolePermissions(role1.toUpperCase());
    const perms2 = await getRolePermissions(role2.toUpperCase());
    
    return {
        onlyIn1: perms1.filter(p => !perms2.includes(p)),
        onlyIn2: perms2.filter(p => !perms1.includes(p)),
        common: perms1.filter(p => perms2.includes(p))
    };
};

/**
 * Get statistics about permissions
 */
const getStats = async () => {
    const totalPermissions = await deps.db.get('SELECT COUNT(*) as count FROM permissions');
    const systemPermissions = await deps.db.get('SELECT COUNT(*) as count FROM permissions WHERE is_system = 1');
    const roleAssignments = await deps.db.all(`
        SELECT role, COUNT(*) as count 
        FROM role_permissions 
        GROUP BY role
    `);
    const categoryBreakdown = await deps.db.all(`
        SELECT category, COUNT(*) as count 
        FROM permissions 
        GROUP BY category
    `);
    
    return {
        totalPermissions: totalPermissions?.count || 0,
        systemPermissions: systemPermissions?.count || 0,
        customPermissions: (totalPermissions?.count || 0) - (systemPermissions?.count || 0),
        roleAssignments: roleAssignments.reduce((acc, r) => {
            acc[r.role] = r.count;
            return acc;
        }, {}),
        categoryBreakdown: categoryBreakdown.reduce((acc, c) => {
            acc[c.category || 'general'] = c.count;
            return acc;
        }, {})
    };
};

export default {
    setDependencies,
    PERMISSION_CATEGORIES,
    ROLE_HIERARCHY,
    getAllPermissions,
    getRolePermissions,
    getMatrix,
    updateRolePermissions,
    togglePermission,
    createPermission,
    deletePermission,
    copyRolePermissions,
    hasPermission,
    compareRoles,
    getStats
};





