/**
 * Permission Middleware
 * Step 14: Governance, Security & Enterprise Controls
 * 
 * Database-backed permission checking middleware.
 * Uses PBAC (Permission-Based Access Control) with org-user overrides.
 */

const PermissionService = require('../services/permissionService');
const GovernanceAuditService = require('../services/governanceAuditService');

/**
 * Middleware factory to require a specific permission
 * @param {string} permissionKey - Permission key to check (e.g., 'PLAYBOOK_PUBLISH')
 * @returns {Function} Express middleware
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            const userId = req.userId || req.user?.id;
            const orgId = req.organizationId || req.user?.organization_id;
            const userRole = req.userRole || req.user?.role;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            const hasPermission = await PermissionService.hasPermission(
                userId,
                orgId,
                permissionKey,
                userRole
            );

            if (!hasPermission) {
                console.log(`[PermissionMiddleware] Denied: ${permissionKey} for user ${userId}`);
                return res.status(403).json({
                    error: 'Permission denied',
                    required: permissionKey,
                    code: 'PERMISSION_DENIED'
                });
            }

            // Attach permission info for audit logging
            req.permissionChecked = permissionKey;
            next();
        } catch (err) {
            console.error('[PermissionMiddleware] Error:', err);
            return res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
            });
        }
    };
};

/**
 * Middleware factory to require ANY of the specified permissions
 * @param {Array<string>} permissionKeys - Array of permission keys
 * @returns {Function} Express middleware
 */
const requireAnyPermission = (permissionKeys) => {
    return async (req, res, next) => {
        try {
            const userId = req.userId || req.user?.id;
            const orgId = req.organizationId || req.user?.organization_id;
            const userRole = req.userRole || req.user?.role;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            for (const permissionKey of permissionKeys) {
                const hasPermission = await PermissionService.hasPermission(
                    userId,
                    orgId,
                    permissionKey,
                    userRole
                );

                if (hasPermission) {
                    req.permissionChecked = permissionKey;
                    return next();
                }
            }

            console.log(`[PermissionMiddleware] Denied: none of [${permissionKeys.join(', ')}] for user ${userId}`);
            return res.status(403).json({
                error: 'Permission denied',
                requiredAny: permissionKeys,
                code: 'PERMISSION_DENIED'
            });
        } catch (err) {
            console.error('[PermissionMiddleware] Error:', err);
            return res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
            });
        }
    };
};

/**
 * Middleware factory to require ALL of the specified permissions
 * @param {Array<string>} permissionKeys - Array of permission keys
 * @returns {Function} Express middleware
 */
const requireAllPermissions = (permissionKeys) => {
    return async (req, res, next) => {
        try {
            const userId = req.userId || req.user?.id;
            const orgId = req.organizationId || req.user?.organization_id;
            const userRole = req.userRole || req.user?.role;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            const missingPermissions = [];

            for (const permissionKey of permissionKeys) {
                const hasPermission = await PermissionService.hasPermission(
                    userId,
                    orgId,
                    permissionKey,
                    userRole
                );

                if (!hasPermission) {
                    missingPermissions.push(permissionKey);
                }
            }

            if (missingPermissions.length > 0) {
                console.log(`[PermissionMiddleware] Denied: missing [${missingPermissions.join(', ')}] for user ${userId}`);
                return res.status(403).json({
                    error: 'Permission denied',
                    missing: missingPermissions,
                    code: 'PERMISSION_DENIED'
                });
            }

            req.permissionChecked = permissionKeys;
            next();
        } catch (err) {
            console.error('[PermissionMiddleware] Error:', err);
            return res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
            });
        }
    };
};

/**
 * Middleware to audit-log the action after successful completion
 * Use AFTER requirePermission middleware and the route handler
 * @param {Object} options - Audit options
 * @param {string} options.action - Action type
 * @param {string} options.resourceType - Resource type
 * @param {Function} [options.getResourceId] - Function to extract resource ID from req
 * @param {Function} [options.getBefore] - Function to get before state
 * @param {Function} [options.getAfter] - Function to get after state
 */
const auditAction = (options) => {
    const {
        action,
        resourceType,
        getResourceId = () => null,
        getBefore = () => null,
        getAfter = () => null
    } = options;

    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json to intercept response
        res.json = async function (data) {
            // Only audit on success (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    await GovernanceAuditService.logAudit({
                        actorId: req.userId || req.user?.id,
                        actorRole: req.userRole || req.user?.role,
                        orgId: req.organizationId || req.user?.organization_id,
                        action,
                        resourceType,
                        resourceId: getResourceId(req, data),
                        before: getBefore(req),
                        after: getAfter(req, data),
                        correlationId: req.correlationId || req.get('X-Correlation-Id')
                    });
                } catch (auditErr) {
                    console.error('[AuditMiddleware] Error logging audit:', auditErr);
                    // Don't fail the request if audit fails
                }
            }

            // Call original json method
            return originalJson(data);
        };

        next();
    };
};

module.exports = {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    auditAction
};
