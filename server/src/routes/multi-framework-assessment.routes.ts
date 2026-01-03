/**
 * MultiFrameworkAssessment Routes
 * API endpoints for multi-framework-assessment
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const multi_framework_assessmentRoutesJSPromise = (async () => {
    const module = await import('../../routes/multi-framework-assessment.js');
    return module.default || module;
})();
const multi_framework_assessmentRoutesJS = multi_framework_assessmentRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof multi_framework_assessmentRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(multi_framework_assessmentRoutesJS);
} else if (multi_framework_assessmentRoutesJS.default) {
    // If it has a default export
    router.use(multi_framework_assessmentRoutesJS.default);
} else {
    // If it's the router itself
    router.use(multi_framework_assessmentRoutesJS);
}

export default router;
