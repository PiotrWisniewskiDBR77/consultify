const ActivityService = require('../services/activityService');

/**
 * Audit Log Middleware
 * Automatically logs successful state-changing requests (POST, PUT, PATCH, DELETE)
 */
const auditLogMiddleware = (req, res, next) => {
    // Only log state changes
    if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
        return next();
    }

    // Capture original end function
    const originalEnd = res.end;
    let responseBody;

    // Override end to capture status
    res.end = function (chunk, encoding) {
        res.end = originalEnd;
        res.end(chunk, encoding);

        // Only log successful operations (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
                // Extract User Info
                const user = req.user;
                const userId = user ? user.id : 'anonymous';
                const organizationId = user ? user.organizationId : (req.body.organizationId || 'unknown');

                // Determine Entity & Action
                // URL: /api/projects/:id -> Entity: project, ID: :id
                const parts = req.originalUrl.split('/').filter(p => p);
                const entityType = parts[1] || 'unknown'; // api / [entity]
                const entityId = parts[2] || (req.body.id) || 'new';

                const actionMap = {
                    'POST': 'created',
                    'PUT': 'updated',
                    'PATCH': 'updated',
                    'DELETE': 'deleted'
                };
                const action = actionMap[req.method] || 'modified';

                // Log asynchronously
                ActivityService.log({
                    organizationId,
                    userId,
                    action,
                    entityType: entityType.replace(/s$/, ''), // singularize roughly
                    entityId,
                    entityName: req.body.name || req.body.title || entityType,
                    newValue: (req.method !== 'DELETE') ? req.body : null,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                }).catch(err => console.error('[AuditLog] Failed to log:', err.message));

            } catch (err) {
                console.error('[AuditLog] Error processing log:', err);
            }
        }
    };

    next();
};

module.exports = auditLogMiddleware;
