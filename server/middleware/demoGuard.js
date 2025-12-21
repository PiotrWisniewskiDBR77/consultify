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

    // 2. Allow Safe Methods (GET, OPTIONS, HEAD)
    if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
        return next();
    }

    // 3. Allow Whitelisted Paths
    if (isAllowedPath(req.originalUrl)) {
        return next();
    }

    // 4. Block Everything Else
    console.warn(`[DemoGuard] Blocked ${req.method} ${req.originalUrl} for Demo User ${req.userId}`);

    return res.status(403).json({
        error: 'This action is disabled in Demo Mode.',
        errorCode: 'DEMO_ACTION_BLOCKED',
        isDemoRestriction: true // Frontend can use this to show specific modal
    });
};

module.exports = demoGuard;
