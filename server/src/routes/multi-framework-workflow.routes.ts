/**
 * MultiFrameworkWorkflow Routes
 * API endpoints for multi-framework-workflow
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const multi_framework_workflowRoutesJS = require('../../routes/multi-framework-workflow.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof multi_framework_workflowRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(multi_framework_workflowRoutesJS);
} else if (multi_framework_workflowRoutesJS.default) {
    // If it has a default export
    router.use(multi_framework_workflowRoutesJS.default);
} else {
    // If it's the router itself
    router.use(multi_framework_workflowRoutesJS);
}

export default router;
