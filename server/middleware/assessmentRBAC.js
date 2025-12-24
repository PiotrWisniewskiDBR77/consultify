/**
 * Assessment RBAC Middleware
 * Role-based access control for assessment operations
 */

const hasPermission = (user, action, resource) => {
    const permissions = {
        SUPER_ADMIN: ['*'],
        ORG_ADMIN: ['assessment:create', 'assessment:read', 'assessment:update', 'assessment:delete', 'assessment:export'],
        PROJECT_MANAGER: ['assessment:create', 'assessment:read', 'assessment:update', 'assessment:export'],
        CONSULTANT: ['assessment:create', 'assessment:read', 'assessment:export'],
        VIEWER: ['assessment:read']
    };

    const userRole = user.role || 'VIEWER';
    const userPermissions = permissions[userRole] || [];

    // Super admin has all permissions
    if (userPermissions.includes('*')) return true;

    // Check specific permission
    return userPermissions.includes(`${resource}:${action}`);
};

const assessmentRBAC = (action) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!hasPermission(req.user, action, 'assessment')) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: `assessment:${action}`,
                userRole: req.user.role
            });
        }

        next();
    };
};

module.exports = { assessmentRBAC, hasPermission };
