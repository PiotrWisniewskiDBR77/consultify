/**
 * Governance Admin Routes
 * Step 14: Governance, Security & Enterprise Controls
 * 
 * API endpoints for:
 * - Audit log viewing/export
 * - Permission management
 * - Break-glass sessions
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbac');
const { requirePermission, auditAction } = require('../middleware/permissionMiddleware');
const GovernanceAuditService = require('../services/governanceAuditService');
const BreakGlassService = require('../services/breakGlassService');
const PermissionService = require('../services/permissionService');

// All routes require authentication
router.use(authMiddleware);

// =========================================
// AUDIT LOG ENDPOINTS
// =========================================

/**
 * GET /api/governance/audit
 * Query governance audit log
 * ADMIN: org-only, SUPERADMIN: all orgs
 */
router.get('/audit', async (req, res) => {
    try {
        const { action, resourceType, resourceId, actorId, startDate, endDate, limit, offset } = req.query;

        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const orgId = isSuperAdmin && req.query.orgId ? req.query.orgId : req.organizationId;

        const entries = await GovernanceAuditService.getAuditLog({
            orgId,
            superadminBypass: isSuperAdmin && !req.query.orgId,
            action,
            resourceType,
            resourceId,
            actorId,
            startDate,
            endDate,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0
        });

        res.json({
            entries,
            count: entries.length,
            pagination: {
                limit: parseInt(limit) || 100,
                offset: parseInt(offset) || 0
            }
        });
    } catch (err) {
        console.error('[GovernanceAdmin] Audit log error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/governance/audit/export
 * Export governance audit log as CSV or JSON
 * ADMIN: org-only, SUPERADMIN: all orgs
 */
router.get('/audit/export', requirePermission('AUDIT_EXPORT'), async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;

        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const orgId = isSuperAdmin && req.query.orgId ? req.query.orgId : req.organizationId;

        const result = await GovernanceAuditService.exportAuditLog({
            orgId,
            format,
            superadminBypass: isSuperAdmin && !req.query.orgId,
            startDate,
            endDate
        });

        if (result.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="governance_audit.csv"');
            return res.send(result.data);
        }

        res.json(result.data);
    } catch (err) {
        console.error('[GovernanceAdmin] Audit export error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/governance/audit/verify
 * Verify hash chain integrity (SUPERADMIN only)
 */
router.get('/audit/verify', requireRole(['SUPERADMIN']), async (req, res) => {
    try {
        const { orgId } = req.query;

        if (!orgId) {
            return res.status(400).json({ error: 'orgId query parameter required' });
        }

        const result = await GovernanceAuditService.verifyHashChain(orgId);
        res.json(result);
    } catch (err) {
        console.error('[GovernanceAdmin] Hash verify error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================
// PERMISSION MANAGEMENT ENDPOINTS
// =========================================

/**
 * GET /api/governance/permissions
 * List all defined permissions
 * SUPERADMIN only
 */
router.get('/permissions', requireRole(['SUPERADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { category } = req.query;

        let permissions;
        if (category) {
            permissions = await PermissionService.getPermissionsByCategory(category);
        } else {
            permissions = await PermissionService.getAllPermissions();
        }

        res.json(permissions);
    } catch (err) {
        console.error('[GovernanceAdmin] Permissions list error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/governance/permissions/roles
 * Get role-permission mappings
 */
router.get('/permissions/roles', requireRole(['SUPERADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { role } = req.query;
        const mappings = await PermissionService.getRolePermissions(role);

        // Group by role for easier consumption
        const grouped = {};
        mappings.forEach(m => {
            if (!grouped[m.role]) {
                grouped[m.role] = [];
            }
            grouped[m.role].push({
                permissionKey: m.permission_key,
                description: m.description,
                category: m.category
            });
        });

        res.json(grouped);
    } catch (err) {
        console.error('[GovernanceAdmin] Role permissions error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/governance/users/:id/permissions
 * Get user permissions (with overrides)
 */
router.get('/users/:id/permissions', requirePermission('PERMISSION_VIEW'), async (req, res) => {
    try {
        const { id: userId } = req.params;
        const orgId = req.organizationId;

        // Fetch user role (simplified - would normally come from users table)
        const db = require('../database');
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT role FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const permissions = await PermissionService.getUserPermissions(userId, orgId, user.role);
        res.json({
            userId,
            organizationId: orgId,
            role: user.role,
            ...permissions
        });
    } catch (err) {
        console.error('[GovernanceAdmin] User permissions error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/governance/users/:id/permissions
 * Grant or revoke a permission for a user
 */
router.patch('/users/:id/permissions',
    requirePermission('PERMISSION_MANAGE'),
    auditAction({
        action: GovernanceAuditService.AUDIT_ACTIONS.GRANT_PERMISSION,
        resourceType: GovernanceAuditService.RESOURCE_TYPES.PERMISSION,
        getResourceId: (req) => req.body.permissionKey,
        getAfter: (req, data) => ({
            userId: req.params.id,
            permissionKey: req.body.permissionKey,
            action: req.body.action
        })
    }),
    async (req, res) => {
        try {
            const { id: userId } = req.params;
            const { permissionKey, action } = req.body;
            const orgId = req.organizationId;
            const actorId = req.userId;

            if (!permissionKey) {
                return res.status(400).json({ error: 'permissionKey is required' });
            }

            if (!action || !['grant', 'revoke', 'reset'].includes(action)) {
                return res.status(400).json({ error: 'action must be grant, revoke, or reset' });
            }

            let result;
            if (action === 'grant') {
                result = await PermissionService.grantPermission(userId, orgId, permissionKey, actorId);
            } else if (action === 'revoke') {
                result = await PermissionService.revokePermission(userId, orgId, permissionKey, actorId);
            } else {
                result = await PermissionService.removeOverride(userId, orgId, permissionKey);
            }

            res.json({
                success: true,
                action,
                ...result
            });
        } catch (err) {
            console.error('[GovernanceAdmin] Permission update error:', err);
            res.status(400).json({ error: err.message });
        }
    }
);

// =========================================
// BREAK-GLASS ENDPOINTS
// =========================================

/**
 * GET /api/governance/break-glass/active
 * Get active break-glass sessions
 * ADMIN: org-only, SUPERADMIN: all orgs
 */
router.get('/break-glass/active', async (req, res) => {
    try {
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let sessions;
        if (isSuperAdmin && !req.query.orgId) {
            sessions = await BreakGlassService.getAllActiveSessions();
        } else {
            const orgId = req.query.orgId || req.organizationId;
            sessions = await BreakGlassService.getActiveSessions(orgId);
        }

        res.json({
            sessions,
            count: sessions.length
        });
    } catch (err) {
        console.error('[GovernanceAdmin] Break-glass list error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/governance/break-glass/start
 * Start a break-glass session
 * SUPERADMIN only (or delegated)
 */
router.post('/break-glass/start',
    requirePermission('BREAK_GLASS_START'),
    async (req, res) => {
        try {
            const { reason, scope, durationMinutes, orgId } = req.body;

            if (!reason || !scope) {
                return res.status(400).json({ error: 'reason and scope are required' });
            }

            // SUPERADMIN can specify orgId, others use their own
            const targetOrgId = req.user.role === 'SUPERADMIN' && orgId
                ? orgId
                : req.organizationId;

            const session = await BreakGlassService.startSession({
                actorId: req.userId,
                actorRole: req.user.role,
                orgId: targetOrgId,
                reason,
                scope,
                durationMinutes: durationMinutes || BreakGlassService.DEFAULT_DURATION_MINUTES
            });

            res.status(201).json({
                success: true,
                session,
                warning: 'Break-glass session started. All actions are being audited.'
            });
        } catch (err) {
            console.error('[GovernanceAdmin] Break-glass start error:', err);
            res.status(400).json({ error: err.message });
        }
    }
);

/**
 * POST /api/governance/break-glass/close
 * Close a break-glass session
 */
router.post('/break-glass/close',
    requirePermission('BREAK_GLASS_CLOSE'),
    async (req, res) => {
        try {
            const { sessionId } = req.body;

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' });
            }

            const result = await BreakGlassService.closeSession(
                sessionId,
                req.userId,
                req.user.role
            );

            res.json({
                success: true,
                ...result
            });
        } catch (err) {
            if (err.code === 'SESSION_NOT_FOUND') {
                return res.status(404).json({ error: err.message });
            }
            if (err.code === 'SESSION_ALREADY_CLOSED') {
                return res.status(400).json({ error: err.message });
            }
            console.error('[GovernanceAdmin] Break-glass close error:', err);
            res.status(500).json({ error: err.message });
        }
    }
);

/**
 * GET /api/governance/break-glass/scopes
 * Get available break-glass scopes
 */
router.get('/break-glass/scopes', requireRole(['SUPERADMIN']), (req, res) => {
    res.json({
        scopes: Object.entries(BreakGlassService.SCOPES).map(([key, value]) => ({
            key,
            value,
            description: getBreakGlassScopeDescription(value)
        }))
    });
});

/**
 * Helper: Get human-readable scope descriptions
 */
function getBreakGlassScopeDescription(scope) {
    const descriptions = {
        'policy_engine_disabled': 'Temporarily disable the policy engine (all proposals require manual review)',
        'approval_bypass': 'Allow immediate execution without approval workflow',
        'rate_limit_bypass': 'Bypass rate limiting on API endpoints',
        'audit_bypass': 'Reduce audit logging verbosity (not recommended)',
        'emergency_access': 'General emergency access override'
    };
    return descriptions[scope] || 'No description available';
}

module.exports = router;
