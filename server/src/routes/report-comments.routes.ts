/**
 * ReportComments Routes
 * API endpoints for report-comments
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const report_commentsRoutesJSPromise = (async () => {
    const module = await import('../../routes/report-comments.js');
    return module.default || module;
})();
const report_commentsRoutesJS = report_commentsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof report_commentsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(report_commentsRoutesJS);
} else if (report_commentsRoutesJS.default) {
    // If it has a default export
    router.use(report_commentsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(report_commentsRoutesJS);
}

export default router;
