/**
 * AssessmentWorkflow Routes
 * API endpoints for assessment-workflow
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const assessment_workflowRoutesJSPromise = (async () => {
    const module = await import('../../routes/assessment-workflow.js');
    return module.default || module;
})();
const assessment_workflowRoutesJS = assessment_workflowRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof assessment_workflowRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(assessment_workflowRoutesJS);
} else if (assessment_workflowRoutesJS.default) {
    // If it has a default export
    router.use(assessment_workflowRoutesJS.default);
} else {
    // If it's the router itself
    router.use(assessment_workflowRoutesJS);
}

export default router;
