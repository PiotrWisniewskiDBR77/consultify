/**
 * AssessmentLevelAttachments Routes
 * API endpoints for assessment-level-attachments
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const assessment_level_attachmentsRoutesJSPromise = (async () => {
    const module = await import('../../routes/assessment-level-attachments.js');
    return module.default || module;
})();
const assessment_level_attachmentsRoutesJS = assessment_level_attachmentsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof assessment_level_attachmentsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(assessment_level_attachmentsRoutesJS);
} else if (assessment_level_attachmentsRoutesJS.default) {
    // If it has a default export
    router.use(assessment_level_attachmentsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(assessment_level_attachmentsRoutesJS);
}

export default router;
