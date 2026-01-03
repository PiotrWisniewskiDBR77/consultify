/**
 * AssessmentReports Routes
 * API endpoints for assessment-reports
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const assessment_reportsRoutesJSPromise = (async () => {
    const module = await import('../../routes/assessment-reports.js');
    return module.default || module;
})();
const assessment_reportsRoutesJS = assessment_reportsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof assessment_reportsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(assessment_reportsRoutesJS);
} else if (assessment_reportsRoutesJS.default) {
    // If it has a default export
    router.use(assessment_reportsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(assessment_reportsRoutesJS);
}

export default router;
