/**
 * ExternalAssessments Routes
 * API endpoints for external-assessments
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const external_assessmentsRoutesJSPromise = (async () => {
    const module = await import('../../routes/external-assessments.js');
    return module.default || module;
})();
const external_assessmentsRoutesJS = external_assessmentsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof external_assessmentsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(external_assessmentsRoutesJS);
} else if (external_assessmentsRoutesJS.default) {
    // If it has a default export
    router.use(external_assessmentsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(external_assessmentsRoutesJS);
}

export default router;
