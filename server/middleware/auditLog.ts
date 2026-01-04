// Default Dependencies
// @ts-ignore - Vitest direct import
import AuditLogService from '../services/auditLogService.ts';

const deps = {
    AuditLogService
};

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
                const userEmail = user ? user.email : 'anonymous';
                const organizationId = user ? user.organizationId : ((req.body && req.body.organizationId) || 'unknown');

                // Determine Entity & Action
                // URL: /api/projects/:id -> Entity: project, ID: :id
                const parts = req.originalUrl.split('/').filter(p => p);
                const entityType = parts[1] || 'unknown'; // api / [entity]
                const entityId = parts[2] || (req.body && req.body.id) || 'new';

                const actionMap = {
                    'POST': 'created',
                    'PUT': 'updated',
                    'PATCH': 'updated',
                    'DELETE': 'deleted'
                };
                const action = actionMap[req.method] || 'modified';

                // Prepare metadata
                const metadata = {
                    entityName: (req.body && (req.body.name || req.body.title)) || entityType
                };

                // Log asynchronously
                Promise.resolve(deps.AuditLogService.createLog({
                    user_id: userId,
                    user_email: userEmail,
                    organization_id: organizationId,
                    action_type: action,
                    resource_type: entityType.replace(/s$/, ''),
                    resource_id: entityId,
                    after_data: (req.method !== 'DELETE' && req.body) ? req.body : null,
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    metadata
                })).catch(err => console.error('[AuditLog] Failed to log:', err.message));

            } catch (err) {
                console.error('[AuditLog] Error processing log:', err);
            }
        }
    };

    next();
};

// Expose DI setter on the function itself
auditLogMiddleware.setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

export default auditLogMiddleware;
