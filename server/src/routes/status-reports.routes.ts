/**
 * StatusReports Routes
 * API endpoints for status-reports
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const status_reportsRoutesJSPromise = (async () => {
    const module = await import('../../routes/status-reports.js');
    return module.default || module;
})();
const status_reportsRoutesJS = status_reportsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof status_reportsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(status_reportsRoutesJS);
} else if (status_reportsRoutesJS.default) {
    // If it has a default export
    router.use(status_reportsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(status_reportsRoutesJS);
}

export default router;
