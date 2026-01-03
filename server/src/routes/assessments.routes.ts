/**
 * Assessments Routes
 * API endpoints for assessments
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const assessmentsRoutesJSPromise = (async () => {
    const module = await import('../../routes/assessments.js');
    return module.default || module;
})();
const assessmentsRoutesJS = assessmentsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof assessmentsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(assessmentsRoutesJS);
} else if (assessmentsRoutesJS.default) {
    // If it has a default export
    router.use(assessmentsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(assessmentsRoutesJS);
}

export default router;
