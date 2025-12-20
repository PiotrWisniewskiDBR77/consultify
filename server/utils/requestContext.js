/**
 * Request Context Utility
 * 
 * Safely extracts user and organization context from a request object.
 * Used for logging, auditing, and server-side RBAC enforcement.
 */

const getRequestContext = (req) => {
    // Depending on auth middleware, user info might be in req.user or req.session.user
    const user = req.user || (req.session && req.session.user) || {};

    return {
        userId: user.id || null,
        orgId: user.organization_id || null,
        role: user.role || 'GUEST',
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        path: req.path,
        requestId: req.get('X-Request-Id') || 'none'
    };
};

module.exports = {
    getRequestContext
};
