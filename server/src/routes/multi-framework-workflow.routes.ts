/**
 * MultiFrameworkWorkflow Routes
 * API endpoints for multi-framework-workflow
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const workflowModule = (await import('./multi-framework-workflow.js')) as any;
const multi_framework_workflowRoutesJS = workflowModule.default || workflowModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof multi_framework_workflowRoutesJS === 'function' ||
    (multi_framework_workflowRoutesJS && typeof multi_framework_workflowRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(multi_framework_workflowRoutesJS);
} else {
    // Fallback or error
    logger.error('multi-framework-workflow.js did not export a valid router');
}

export default router;
