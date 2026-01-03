/**
 * Metrics Routes
 * API endpoints for metrics
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const metricsRoutesJSPromise = (async () => {
    const module = await import('../../routes/metrics.js');
    return module.default || module;
})();
const metricsRoutesJS = metricsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof metricsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(metricsRoutesJS);
} else if (metricsRoutesJS.default) {
    // If it has a default export
    router.use(metricsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(metricsRoutesJS);
}

export default router;
