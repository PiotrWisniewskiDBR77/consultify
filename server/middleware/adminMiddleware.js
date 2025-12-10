const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

/**
 * Admin Middleware - Verifies user is an ADMIN or SUPERADMIN for their organization
 * Use this for organization-scoped admin actions (user management, team creation, etc.)
 */
const verifyAdmin = (req, res, next) => {
    const token = req.headers['authorization'] || req.headers['x-access-token'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    jwt.verify(cleanToken, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });

        // Check if user is ADMIN or SUPERADMIN
        if (decoded.role !== 'ADMIN' && decoded.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        req.user = decoded;
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    });
};

/**
 * Permission Checker - Granular permission checking utility
 * @param {string} requiredPermission - The permission key to check
 * @returns {Function} Middleware function
 */
const checkPermission = (requiredPermission) => {
    return (req, res, next) => {
        // Permission matrix by role
        const permissions = {
            SUPERADMIN: [
                'org:create', 'org:read', 'org:update', 'org:delete',
                'user:create', 'user:read', 'user:update', 'user:delete', 'user:reset_password',
                'project:create', 'project:read', 'project:update', 'project:delete',
                'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
                'team:create', 'team:read', 'team:update', 'team:delete',
                'settings:global', 'analytics:global'
            ],
            ADMIN: [
                'user:create', 'user:read', 'user:update', 'user:delete',
                'project:create', 'project:read', 'project:update', 'project:delete',
                'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
                'team:create', 'team:read', 'team:update', 'team:delete',
                'settings:org', 'analytics:org'
            ],
            USER: [
                'project:read',
                'task:create', 'task:read', 'task:update:own', 'task:delete:own',
                'team:read',
                'settings:own'
            ]
        };

        const userRole = req.userRole || req.user?.role;
        const userPermissions = permissions[userRole] || [];

        // Check for exact match or wildcard match
        const hasPermission = userPermissions.some(perm => {
            if (perm === requiredPermission) return true;
            // Check :own suffix - if user has :own, they can do action on their own resources
            if (requiredPermission.endsWith(':own') && perm === requiredPermission) return true;
            // If user has full permission, :own is also granted
            const basePermission = requiredPermission.replace(':own', '');
            return perm === basePermission;
        });

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Permission denied',
                required: requiredPermission,
                role: userRole
            });
        }

        next();
    };
};

module.exports = { verifyAdmin, checkPermission };
