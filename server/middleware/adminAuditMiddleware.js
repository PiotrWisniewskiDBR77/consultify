/**
 * Admin Audit Middleware
 * 
 * Automatically logs admin actions for audit trail.
 * Can be applied to specific routes or globally.
 */

const adminAuditService = import('../services/adminAuditService.js');

/**
 * Extract resource info from request
 */
const extractResourceInfo = (req) => {
    const path = req.path;
    const method = req.method;
    
    // Common patterns to extract resource type and ID
    const patterns = [
        { regex: /\/organizations\/([^\/]+)/, type: 'organization' },
        { regex: /\/users\/([^\/]+)/, type: 'user' },
        { regex: /\/sessions\/([^\/]+)/, type: 'session' },
        { regex: /\/permissions\/([^\/]+)/, type: 'permission' },
        { regex: /\/workflows\/([^\/]+)/, type: 'workflow' },
        { regex: /\/audit-logs\/([^\/]+)/, type: 'audit_log' },
        { regex: /\/api-keys\/([^\/]+)/, type: 'api_key' },
        { regex: /\/invoices\/([^\/]+)/, type: 'invoice' },
        { regex: /\/tickets\/([^\/]+)/, type: 'ticket' },
        { regex: /\/segments\/([^\/]+)/, type: 'segment' }
    ];
    
    let resourceType = 'system';
    let resourceId = null;
    
    for (const pattern of patterns) {
        const match = path.match(pattern.regex);
        if (match) {
            resourceType = pattern.type;
            resourceId = match[1];
            break;
        }
    }
    
    return { resourceType, resourceId };
};

/**
 * Determine action type from method and path
 */
const determineActionType = (method, path) => {
    // Check for specific action keywords in path
    if (path.includes('/revoke')) return 'session_revoke';
    if (path.includes('/approve')) return 'approve';
    if (path.includes('/reject')) return 'reject';
    if (path.includes('/export')) return 'export_data';
    if (path.includes('/bulk')) return 'bulk_action';
    if (path.includes('/resolve')) return 'resolve';
    
    // Map HTTP methods to action types
    switch (method) {
        case 'GET':
            return 'view_data';
        case 'POST':
            return 'create';
        case 'PUT':
        case 'PATCH':
            return 'modify';
        case 'DELETE':
            return 'delete';
        default:
            return 'unknown';
    }
};

/**
 * Create audit middleware with custom configuration
 */
const createAuditMiddleware = (config = {}) => {
    const {
        actionType: customActionType,
        resourceType: customResourceType,
        descriptionFn,
        detailsFn,
        skipCondition
    } = config;
    
    return async (req, res, next) => {
        // Skip if condition is met
        if (skipCondition && skipCondition(req)) {
            return next();
        }
        
        // Skip if no user (not authenticated)
        if (!req.user) {
            return next();
        }
        
        // Store original res.json to capture response
        const originalJson = res.json.bind(res);
        let responseData = null;
        
        res.json = function(data) {
            responseData = data;
            return originalJson(data);
        };
        
        // Capture request start time
        const startTime = Date.now();
        
        // Wait for response
        res.on('finish', async () => {
            try {
                const { resourceType: autoResourceType, resourceId } = extractResourceInfo(req);
                const actionType = customActionType || `${determineActionType(req.method, req.path)}_${customResourceType || autoResourceType}`;
                
                // Build description
                let description = descriptionFn 
                    ? descriptionFn(req, responseData)
                    : `${req.method} ${req.path}`;
                
                // Build details
                let details = detailsFn 
                    ? detailsFn(req, responseData)
                    : {};
                
                // Add common details
                details = {
                    ...details,
                    method: req.method,
                    path: req.path,
                    duration: Date.now() - startTime,
                    statusCode: res.statusCode,
                    query: Object.keys(req.query).length > 0 ? req.query : undefined,
                    bodyFields: req.body ? Object.keys(req.body) : undefined
                };
                
                // Remove sensitive data from details
                if (details.bodyFields) {
                    details.bodyFields = details.bodyFields.filter(f => 
                        !['password', 'token', 'secret', 'apiKey'].includes(f)
                    );
                }
                
                await adminAuditService.logAction({
                    adminId: req.user.id,
                    actionType,
                    resourceType: customResourceType || autoResourceType,
                    resourceId,
                    description,
                    details,
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    status: res.statusCode < 400 ? 'success' : 'failure',
                    context: {
                        affectedCount: responseData?.affectedCount,
                        isFirstTime: false, // Could check if first action of this type
                        unusualHour: isUnusualHour(),
                        newIpAddress: false // Could check against known IPs
                    }
                });
            } catch (error) {
                console.error('Audit logging error:', error);
                // Don't fail the request if audit logging fails
            }
        });
        
        next();
    };
};

/**
 * Check if current hour is unusual (outside business hours)
 */
const isUnusualHour = () => {
    const hour = new Date().getHours();
    return hour < 6 || hour > 22;
};

/**
 * Pre-configured middlewares for common actions
 */
const auditLogin = createAuditMiddleware({
    actionType: 'login',
    resourceType: 'authentication',
    descriptionFn: (req) => `Admin login attempt for ${req.body?.email || 'unknown'}`
});

const auditLogout = createAuditMiddleware({
    actionType: 'logout',
    resourceType: 'authentication',
    descriptionFn: (req) => `Admin logout`
});

const auditUserAction = createAuditMiddleware({
    resourceType: 'user',
    descriptionFn: (req, res) => {
        const action = req.method === 'POST' ? 'created' : 
                      req.method === 'DELETE' ? 'deleted' : 'modified';
        return `User ${action}: ${req.params.id || res?.id || 'unknown'}`;
    }
});

const auditOrgAction = createAuditMiddleware({
    resourceType: 'organization',
    descriptionFn: (req, res) => {
        const action = req.method === 'POST' ? 'created' : 
                      req.method === 'DELETE' ? 'deleted' : 'modified';
        return `Organization ${action}: ${req.params.id || res?.id || 'unknown'}`;
    }
});

const auditSecurityAction = createAuditMiddleware({
    resourceType: 'security',
    descriptionFn: (req) => `Security action: ${req.path}`,
    detailsFn: (req) => ({
        affectedEntity: req.params.id,
        changes: req.body ? Object.keys(req.body) : []
    })
});

const auditBulkAction = createAuditMiddleware({
    actionType: 'bulk_action',
    resourceType: 'bulk',
    descriptionFn: (req) => `Bulk operation: ${req.path}`,
    detailsFn: (req, res) => ({
        itemCount: req.body?.ids?.length || res?.processedCount || 0,
        action: req.body?.action || 'unknown'
    })
});

const auditDataExport = createAuditMiddleware({
    actionType: 'export_data',
    resourceType: 'data',
    descriptionFn: (req) => `Data export: ${req.query?.type || req.path}`,
    detailsFn: (req) => ({
        format: req.query?.format || 'unknown',
        filters: req.query
    })
});

export {
createAuditMiddleware,
    auditLogin,
    auditLogout,
    auditUserAction,
    auditOrgAction,
    auditSecurityAction,
    auditBulkAction,
    auditDataExport
};

export default {
    createAuditMiddleware,
    auditLogin,
    auditLogout,
    auditUserAction,
    auditOrgAction,
    auditSecurityAction,
    auditBulkAction,
    auditDataExport
};







