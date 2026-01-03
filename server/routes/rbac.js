/**
 * RBAC Routes
 * 
 * Endpoints for Role-Based Access Control
 * Includes custom roles, permissions, and role assignments
 */

import express from 'express';
const router = express.Router();
const rbacService = import('rbacService.js');
import verifyToken from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');

// ====== ROLES ======

/**
 * GET /roles
 * List all roles for organization
 */
router.get('/roles', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { includeSystem } = req.query;
        
        const roles = await rbacService.getOrganizationRoles(
            req.user.organization_id,
            includeSystem !== 'false'
        );

        res.json({
            success: true,
            data: roles,
        });
    } catch (error) {
        console.error('[RBAC] List roles error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list roles',
        });
    }
});

/**
 * POST /roles
 * Create a custom role
 */
router.post('/roles', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const {
            name,
            displayName,
            description,
            color,
            icon,
            baseRole,
            scope,
            priority,
            isDefault,
        } = req.body;

        if (!name || !displayName) {
            return res.status(400).json({
                success: false,
                error: 'name and displayName are required',
            });
        }

        const result = await rbacService.createRole(req.user.organization_id, {
            name,
            displayName,
            description,
            color,
            icon,
            baseRole,
            scope,
            priority,
            isDefault,
            createdBy: req.user.id,
        });

        res.status(201).json({
            success: true,
            data: result,
            message: 'Role created successfully',
        });
    } catch (error) {
        console.error('[RBAC] Create role error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create role',
        });
    }
});

/**
 * GET /roles/:id
 * Get a specific role with its permissions
 */
router.get('/roles/:id', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const role = await rbacService.getRole(req.params.id);

        if (!role) {
            return res.status(404).json({
                success: false,
                error: 'Role not found',
            });
        }

        // Get permissions for the role
        const permissions = await rbacService.getRolePermissions(req.params.id);

        res.json({
            success: true,
            data: {
                ...role,
                permissions,
            },
        });
    } catch (error) {
        console.error('[RBAC] Get role error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get role',
        });
    }
});

/**
 * PUT /roles/:id
 * Update a custom role
 */
router.put('/roles/:id', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const result = await rbacService.updateRole(req.params.id, req.body);

        if (!result.updated) {
            return res.status(404).json({
                success: false,
                error: 'Role not found or is a system role',
            });
        }

        res.json({
            success: true,
            message: 'Role updated successfully',
        });
    } catch (error) {
        console.error('[RBAC] Update role error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update role',
        });
    }
});

/**
 * DELETE /roles/:id
 * Delete a custom role
 */
router.delete('/roles/:id', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const result = await rbacService.deleteRole(req.params.id);

        if (!result.deleted) {
            return res.status(404).json({
                success: false,
                error: 'Role not found or is a system role',
            });
        }

        res.json({
            success: true,
            message: 'Role deleted successfully',
        });
    } catch (error) {
        console.error('[RBAC] Delete role error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete role',
        });
    }
});

/**
 * GET /roles/:id/users
 * Get users with a specific role
 */
router.get('/roles/:id/users', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const users = await rbacService.getRoleUsers(req.params.id, req.user.organization_id);

        res.json({
            success: true,
            data: users,
        });
    } catch (error) {
        console.error('[RBAC] Get role users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get role users',
        });
    }
});

// ====== PERMISSIONS ======

/**
 * GET /permissions
 * List all permission definitions
 */
router.get('/permissions', verifyToken, async (req, res) => {
    try {
        const { category } = req.query;
        const permissions = await rbacService.getPermissionDefinitions(category);

        res.json({
            success: true,
            data: permissions,
        });
    } catch (error) {
        console.error('[RBAC] List permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list permissions',
        });
    }
});

/**
 * GET /roles/:id/permissions
 * Get permissions for a role
 */
router.get('/roles/:id/permissions', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const permissions = await rbacService.getRolePermissions(req.params.id);

        res.json({
            success: true,
            data: permissions,
        });
    } catch (error) {
        console.error('[RBAC] Get role permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get role permissions',
        });
    }
});

/**
 * PUT /roles/:id/permissions
 * Set all permissions for a role
 */
router.put('/roles/:id/permissions', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { permissions } = req.body;

        if (!Array.isArray(permissions)) {
            return res.status(400).json({
                success: false,
                error: 'permissions must be an array',
            });
        }

        const result = await rbacService.setRolePermissions(req.params.id, permissions);

        res.json({
            success: true,
            data: result,
            message: 'Role permissions updated successfully',
        });
    } catch (error) {
        console.error('[RBAC] Set role permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set role permissions',
        });
    }
});

/**
 * POST /roles/:id/permissions
 * Add a permission to a role
 */
router.post('/roles/:id/permissions', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { permissionId, grantType, conditions } = req.body;

        if (!permissionId) {
            return res.status(400).json({
                success: false,
                error: 'permissionId is required',
            });
        }

        await rbacService.addPermissionToRole(
            req.params.id,
            permissionId,
            grantType,
            conditions
        );

        res.json({
            success: true,
            message: 'Permission added to role',
        });
    } catch (error) {
        console.error('[RBAC] Add permission to role error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add permission to role',
        });
    }
});

/**
 * DELETE /roles/:id/permissions/:permissionId
 * Remove a permission from a role
 */
router.delete('/roles/:id/permissions/:permissionId', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const result = await rbacService.removePermissionFromRole(
            req.params.id,
            req.params.permissionId
        );

        if (!result.removed) {
            return res.status(404).json({
                success: false,
                error: 'Permission not found on role',
            });
        }

        res.json({
            success: true,
            message: 'Permission removed from role',
        });
    } catch (error) {
        console.error('[RBAC] Remove permission from role error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove permission from role',
        });
    }
});

// ====== USER ROLE ASSIGNMENTS ======

/**
 * GET /users/:userId/roles
 * Get roles assigned to a user
 */
router.get('/users/:userId/roles', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const roles = await rbacService.getUserRoles(
            req.params.userId,
            req.user.organization_id
        );

        res.json({
            success: true,
            data: roles,
        });
    } catch (error) {
        console.error('[RBAC] Get user roles error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user roles',
        });
    }
});

/**
 * POST /users/:userId/roles
 * Assign a role to a user
 */
router.post('/users/:userId/roles', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { roleId, scopeType, scopeId, validUntil, reason } = req.body;

        if (!roleId) {
            return res.status(400).json({
                success: false,
                error: 'roleId is required',
            });
        }

        const result = await rbacService.assignRole(
            req.params.userId,
            roleId,
            req.user.organization_id,
            {
                scopeType,
                scopeId,
                validUntil,
                assignedBy: req.user.id,
                assignedReason: reason,
            }
        );

        res.json({
            success: true,
            data: result,
            message: result.existing ? 'Role already assigned' : 'Role assigned successfully',
        });
    } catch (error) {
        console.error('[RBAC] Assign role error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign role',
        });
    }
});

/**
 * DELETE /assignments/:id
 * Revoke a role assignment
 */
router.delete('/assignments/:id', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const result = await rbacService.revokeRole(req.params.id);

        if (!result.revoked) {
            return res.status(404).json({
                success: false,
                error: 'Assignment not found',
            });
        }

        res.json({
            success: true,
            message: 'Role assignment revoked',
        });
    } catch (error) {
        console.error('[RBAC] Revoke role error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke role assignment',
        });
    }
});

// ====== PERMISSION CHECKING ======

/**
 * GET /check
 * Check if current user has a specific permission
 */
router.get('/check', verifyToken, async (req, res) => {
    try {
        const { permission, resourceOwnerId, projectId } = req.query;

        if (!permission) {
            return res.status(400).json({
                success: false,
                error: 'permission is required',
            });
        }

        const result = await rbacService.hasPermission(
            req.user.id,
            req.user.organization_id,
            permission,
            {
                userId: req.user.id,
                resourceOwnerId,
                projectId,
            }
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[RBAC] Check permission error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check permission',
        });
    }
});

/**
 * GET /my-permissions
 * Get current user's effective permissions
 */
router.get('/my-permissions', verifyToken, async (req, res) => {
    try {
        const permissions = await rbacService.getEffectivePermissions(
            req.user.id,
            req.user.organization_id
        );

        res.json({
            success: true,
            data: permissions,
        });
    } catch (error) {
        console.error('[RBAC] Get my permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get permissions',
        });
    }
});

/**
 * GET /my-roles
 * Get current user's roles
 */
router.get('/my-roles', verifyToken, async (req, res) => {
    try {
        const roles = await rbacService.getUserRoles(
            req.user.id,
            req.user.organization_id
        );

        res.json({
            success: true,
            data: roles,
        });
    } catch (error) {
        console.error('[RBAC] Get my roles error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get roles',
        });
    }
});

// ====== ROLE TEMPLATES ======

/**
 * GET /templates
 * Get role templates
 */
router.get('/templates', verifyToken, requireRole(['super_admin', 'admin', 'owner']), (req, res) => {
    const templates = rbacService.getRoleTemplates();
    res.json({
        success: true,
        data: templates,
    });
});

/**
 * POST /roles/from-template
 * Create a role from template
 */
router.post('/roles/from-template', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { templateName } = req.body;

        if (!templateName) {
            return res.status(400).json({
                success: false,
                error: 'templateName is required',
            });
        }

        const result = await rbacService.createRoleFromTemplate(
            req.user.organization_id,
            templateName,
            req.user.id
        );

        res.status(201).json({
            success: true,
            data: result,
            message: 'Role created from template successfully',
        });
    } catch (error) {
        console.error('[RBAC] Create role from template error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create role from template',
        });
    }
});

export default router;

