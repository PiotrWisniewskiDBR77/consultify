/**
 * Framework RBAC Routes
 * 
 * API endpoints for framework-specific role-based access control.
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { FrameworkRBACService, FRAMEWORK_ROLES } = require('../services/frameworkRBACService');

/**
 * GET /api/framework-rbac/permissions
 * 
 * Get user's permissions for a framework
 */
router.get('/permissions', authenticateToken, async (req, res) => {
    try {
        const { framework, assessmentId, projectId, organizationId } = req.query;
        const userId = req.user.id;

        const permissions = {};
        const actions = ['create', 'edit', 'view', 'delete', 'submit', 'review', 'approve', 'certify', 'export', 'report', 'initiatives'];

        for (const action of actions) {
            permissions[action] = await FrameworkRBACService.hasPermission(
                userId,
                framework,
                action,
                { projectId, organizationId }
            );
        }

        res.json(permissions);
    } catch (error) {
        console.error('[Framework-RBAC] Get permissions error:', error);
        res.status(500).json({ error: 'Failed to get permissions' });
    }
});

/**
 * GET /api/framework-rbac/roles
 * 
 * Get available roles for a framework
 */
router.get('/roles', authenticateToken, (req, res) => {
    const { framework } = req.query;

    if (framework) {
        const roles = FrameworkRBACService.getFrameworkRoles(framework);
        res.json({ framework, roles });
    } else {
        res.json({ roles: FRAMEWORK_ROLES });
    }
});

/**
 * GET /api/framework-rbac/user-roles/:userId
 * 
 * Get user's framework roles
 */
router.get('/user-roles/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const roles = await FrameworkRBACService.getUserRoles(userId);
        res.json({ userId, roles });
    } catch (error) {
        console.error('[Framework-RBAC] Get user roles error:', error);
        res.status(500).json({ error: 'Failed to get user roles' });
    }
});

/**
 * POST /api/framework-rbac/assign-role
 * 
 * Assign a framework role to user
 */
router.post('/assign-role', authenticateToken, async (req, res) => {
    try {
        const { userId, roleId } = req.body;
        const assignedBy = req.user.id;

        // Check if assigner has permission
        const role = FRAMEWORK_ROLES[roleId];
        if (!role) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Only admins can assign roles
        if (!['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized to assign roles' });
        }

        await FrameworkRBACService.assignRole(userId, roleId, assignedBy);
        res.json({ success: true, message: `Role ${roleId} assigned to user` });
    } catch (error) {
        console.error('[Framework-RBAC] Assign role error:', error);
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

/**
 * DELETE /api/framework-rbac/remove-role
 * 
 * Remove a framework role from user
 */
router.delete('/remove-role', authenticateToken, async (req, res) => {
    try {
        const { userId, roleId } = req.body;

        // Only admins can remove roles
        if (!['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized to remove roles' });
        }

        await FrameworkRBACService.removeRole(userId, roleId);
        res.json({ success: true, message: `Role ${roleId} removed from user` });
    } catch (error) {
        console.error('[Framework-RBAC] Remove role error:', error);
        res.status(500).json({ error: 'Failed to remove role' });
    }
});

/**
 * GET /api/framework-rbac/approvers/:framework
 * 
 * Get users who can approve a specific framework
 */
router.get('/approvers/:framework', authenticateToken, async (req, res) => {
    try {
        const { framework } = req.params;
        const { organizationId } = req.query;

        const approvers = await FrameworkRBACService.getApprovers(
            framework,
            organizationId || req.user.organization_id
        );

        res.json({ framework, approvers });
    } catch (error) {
        console.error('[Framework-RBAC] Get approvers error:', error);
        res.status(500).json({ error: 'Failed to get approvers' });
    }
});

/**
 * POST /api/framework-rbac/validate-transition
 * 
 * Validate a workflow status transition
 */
router.post('/validate-transition', authenticateToken, async (req, res) => {
    try {
        const { framework, fromStatus, toStatus } = req.body;
        const userId = req.user.id;

        const validation = await FrameworkRBACService.validateWorkflowTransition(
            userId,
            framework,
            fromStatus,
            toStatus
        );

        res.json(validation);
    } catch (error) {
        console.error('[Framework-RBAC] Validate transition error:', error);
        res.status(500).json({ error: 'Failed to validate transition' });
    }
});

module.exports = router;






