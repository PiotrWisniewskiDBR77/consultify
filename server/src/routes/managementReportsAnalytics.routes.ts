/**
 * ManagementReportsAnalytics Routes
 * API endpoints for managementReportsAnalytics
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const managementReportsAnalyticsRoutesJSPromise = (async () => {
    const module = await import('../../routes/managementReportsAnalytics.js');
    return module.default || module;
})();
const managementReportsAnalyticsRoutesJS = managementReportsAnalyticsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof managementReportsAnalyticsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(managementReportsAnalyticsRoutesJS);
} else if (managementReportsAnalyticsRoutesJS.default) {
    // If it has a default export
    router.use(managementReportsAnalyticsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(managementReportsAnalyticsRoutesJS);
}

export default router;
