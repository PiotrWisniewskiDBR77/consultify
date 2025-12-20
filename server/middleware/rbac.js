/**
 * RBAC Middleware
 * Provides granular role-based access control.
 */

/**
 * requireRole - Middleware to check if user has one of the allowed roles
 * @param {Array<string>} roles - List of allowed roles
 * @returns {Function} Middleware
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

module.exports = { requireRole };
