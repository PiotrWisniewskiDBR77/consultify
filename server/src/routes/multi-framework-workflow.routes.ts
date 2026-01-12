/**
 * MultiFrameworkWorkflow Routes
 * API endpoints for multi-framework-workflow
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/multi-framework-workflow.js');
const multi_framework_workflowRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof multi_framework_workflowRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(multi_framework_workflowRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (multi_framework_workflowRoutesJS && typeof (multi_framework_workflowRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function or Router object, use it
    router.use(multi_framework_workflowRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
    // Fallback or error
    console.error('multi-framework-workflow.js did not export a valid router');
}
export default router;
