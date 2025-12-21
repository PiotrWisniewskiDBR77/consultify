/**
 * Demo Guard Middleware
 * 
 * Enforces Read-Only restrictions for Demo Users.
 * Blocks state-changing methods (POST, PUT, DELETE, PATCH) unless explicitly allowed.
 */

const ALLOWED_DEMO_PATHS = [
    '/api/auth/logout',
    '/api/ai/chat',     // AI interaction allowed
    '/api/ai/stream',   // AI streaming allowed
    '/api/ai/coach',    // AI coach interaction allowed
    '/api/ai/actions',   // AI actions (check logic inside for safeguards if needed, but chat/proposal is ok)
    '/api/ai/explain',  // Explainability is read-heavy or interactive viewing
    '/api/feedback',    // Feedback might be useful even in demo? Maybe not. Let's block for now unless critical.
    '/api/metrics'      // Metrics viewing is GET usually.
];

// Helper to check if path matches allowed list
const isAllowedPath = (path) => {
    return ALLOWED_DEMO_PATHS.some(allowed => path.startsWith(allowed));
};

const demoGuard = (req, res, next) => {
    // 1. Check if user is in Demo Mode
    // We assume req.user is populated by authMiddleware
    // jwt payload has { isDemo: true }
    if (!req.user || !req.user.isDemo) {
        return next();
    }

    // 1.1 Strict Isolation Check (Before matching paths)
    // Ensure that if organizationId is passed in Query, Body, or Params, it matches User's Org
    const userOrg = req.user.organizationId;
    const requestedOrgs = [
        (req.query || {}).organizationId,
        (req.body || {}).organizationId,
        (req.params || {}).organizationId
    ];

    for (const reqOrg of requestedOrgs) {
        if (reqOrg && reqOrg !== userOrg) {
            console.warn(`[DemoGuard] Blocked cross-tenant access attempt by Demo User ${req.userId} (Target: ${reqOrg}, Actual: ${userOrg})`);
            return res.status(403).json({
                code: 'DEMO_BLOCKED',
                action: 'ISOLATION_VIOLATION',
                message: 'Cross-tenant access blocked in Demo Mode',
                error: 'Cross-tenant access blocked in Demo Mode',
                errorCode: 'DEMO_ACTION_BLOCKED',
                isDemoRestriction: true
            });
        }
    }

    // 2. Allow Safe Methods (GET, OPTIONS, HEAD)
    if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
        return next();
    }

    // 3. Allow Whitelisted Paths
    if (isAllowedPath(req.originalUrl)) {
        return next();
    }

    // 4. Block Everything Else
    const actionContext = req.originalUrl.split('/api/')[1]?.split('/')[0]?.toUpperCase() || 'UNKNOWN';
    const actionMethod = req.method === 'POST' ? 'CREATE' : req.method === 'PUT' ? 'UPDATE' : req.method === 'DELETE' ? 'DELETE' : 'MODIFY';
    const derivedAction = `${actionMethod}_${actionContext}`;

    console.warn(`[DemoGuard] Blocked ${req.method} ${req.originalUrl} for Demo User ${req.userId} (Action: ${derivedAction})`);

    return res.status(403).json({
        code: 'DEMO_BLOCKED',
        action: derivedAction,
        message: 'Action not allowed in Demo Mode',
        // Backward compatibility flags if needed by specific old guards (can remove later)
        error: 'Action not allowed in Demo Mode',
        errorCode: 'DEMO_ACTION_BLOCKED',
        isDemoRestriction: true
    });
};

module.exports = demoGuard;
