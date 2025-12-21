/**
 * RBAC Middleware (HARDENED)
 * 
 * Provides granular role-based access control for multi-tenant organizations.
 * 
 * Key Guards:
 * - requireOrgAccess: Unified guard for members AND consultants
 * - requireOrgRole: Check org-level role (OWNER, ADMIN, MEMBER)
 * - requireConsultantScope: Check consultant permission scope
 * - requireOwnerOrSuperadmin: Destructive operations
 * 
 * SECURITY: All guards require orgContextMiddleware to be applied first.
 */

// Organization Role Hierarchy
const ORG_ROLE_HIERARCHY = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    CONSULTANT: 1
};

/**
 * requireOrgAccess - UNIFIED guard for both members and consultants
 * 
 * This is the PRIMARY guard to use. It handles:
 * - Members: checks if user has one of the allowed roles
 * - Consultants: checks if consultant has required permissions in scope
 * 
 * @param {Object} options
 * @param {Array<string>} options.roles - Allowed org roles for members (e.g., ['OWNER', 'ADMIN'])
 * @param {Array<string>} options.consultantPermissions - Required permissions for consultants
 * @param {boolean} options.allowConsultant - Whether consultants can access (default: true)
 */
const requireOrgAccess = (options = {}) => {
    const {
        roles = null,
        consultantPermissions = null,
        allowConsultant = true
    } = options;

    return (req, res, next) => {
        // Must have org context (set by orgContextMiddleware)
        if (!req.org?.id) {
            return res.status(400).json({
                error: 'Missing organization context',
                message: 'Organization context must be resolved before access check.'
            });
        }

        // Handle MEMBER access
        if (req.org.isMember) {
            // If no specific roles required, any member can access
            if (!roles || roles.length === 0) {
                return next();
            }
            // Check if user's role is in allowed list
            if (roles.includes(req.org.role)) {
                return next();
            }
            return res.status(403).json({
                error: 'Insufficient role',
                message: `This action requires one of: ${roles.join(', ')}`,
                yourRole: req.org.role
            });
        }

        // Handle CONSULTANT access
        if (req.org.isConsultant) {
            if (!allowConsultant) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'This resource is not accessible to consultants.'
                });
            }

            // If no specific permissions required, any active consultant can access
            if (!consultantPermissions || consultantPermissions.length === 0) {
                return next();
            }

            // Check consultant permission scope
            const scope = req.org.permissionScope || {};
            const permissions = scope.permissions || [];

            // Also check for boolean flags (e.g., { can_view_initiatives: true })
            const hasAllPermissions = consultantPermissions.every(p =>
                permissions.includes(p) || scope[p] === true
            );

            if (hasAllPermissions) {
                return next();
            }

            return res.status(403).json({
                error: 'Insufficient consultant scope',
                message: `Required permissions: ${consultantPermissions.join(', ')}`,
                yourPermissions: permissions
            });
        }

        // No valid access type
        return res.status(403).json({
            error: 'Access denied',
            message: 'You do not have access to this organization.'
        });
    };
};

/**
 * requireRole - Check GLOBAL user role (legacy, for non-org routes)
 */
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires one of the following roles: ${roles.join(', ')}`,
                yourRole: req.user.role
            });
        }

        next();
    };
};

/**
 * requireOrgMember - Simple check that user is a member (not consultant)
 */
const requireOrgMember = () => {
    return (req, res, next) => {
        if (!req.org?.id) {
            return res.status(400).json({ error: 'Missing organization context' });
        }

        if (!req.org.isMember) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'This action requires organization membership (consultants excluded).'
            });
        }

        next();
    };
};

/**
 * requireOrgRole - Check if user has one of the allowed org roles
 * NOTE: Prefer requireOrgAccess for new code (handles both members and consultants)
 */
const requireOrgRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.org?.id) {
            return res.status(400).json({ error: 'Missing organization context' });
        }

        if (!req.org.isMember) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Organization membership required.'
            });
        }

        if (!allowedRoles.includes(req.org.role)) {
            return res.status(403).json({
                error: 'Insufficient role',
                message: `Required: ${allowedRoles.join(', ')}`,
                yourRole: req.org.role
            });
        }

        next();
    };
};

/**
 * requireOrgRoleOrHigher - Check if user has minimum role level
 */
const requireOrgRoleOrHigher = (minimumRole) => {
    return (req, res, next) => {
        if (!req.org?.id) {
            return res.status(400).json({ error: 'Missing organization context' });
        }

        const userLevel = ORG_ROLE_HIERARCHY[req.org.role] || 0;
        const requiredLevel = ORG_ROLE_HIERARCHY[minimumRole] || 0;

        if (userLevel < requiredLevel) {
            return res.status(403).json({
                error: 'Insufficient role',
                message: `Requires ${minimumRole} or higher.`,
                yourRole: req.org.role
            });
        }

        next();
    };
};

/**
 * requireConsultantScope - Check consultant has specific permissions
 * NOTE: Prefer requireOrgAccess for new code
 */
const requireConsultantScope = (requiredPermissions) => {
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    return (req, res, next) => {
        if (!req.org?.id) {
            return res.status(400).json({ error: 'Missing organization context' });
        }

        // Non-consultants automatically pass (they have full org access based on role)
        if (!req.org.isConsultant) {
            return next();
        }

        const scope = req.org.permissionScope || {};
        const permissionArray = scope.permissions || [];

        const hasAll = permissions.every(p =>
            permissionArray.includes(p) || scope[p] === true
        );

        if (!hasAll) {
            return res.status(403).json({
                error: 'Insufficient consultant scope',
                message: `Required: ${permissions.join(', ')}`
            });
        }

        next();
    };
};

/**
 * requireOwnerOrSuperadmin - For destructive operations
 */
const requireOwnerOrSuperadmin = () => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Global superadmin always allowed
        if (req.user.role === 'SUPERADMIN') {
            return next();
        }

        // Check org owner
        if (req.org?.isMember && req.org.role === 'OWNER') {
            return next();
        }

        return res.status(403).json({
            error: 'Forbidden',
            message: 'This action requires organization owner or superadmin privileges.'
        });
    };
};

module.exports = {
    // Primary guard (recommended for new code)
    requireOrgAccess,

    // Specific guards
    requireRole,
    requireOrgMember,
    requireOrgRole,
    requireOrgRoleOrHigher,
    requireConsultantScope,
    requireOwnerOrSuperadmin,

    // Constants
    ORG_ROLE_HIERARCHY
};
