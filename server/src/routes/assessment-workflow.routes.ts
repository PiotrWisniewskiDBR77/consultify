/**
 * AssessmentWorkflow Routes
 * API endpoints for assessment-workflow
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const workflowModule = (await import('./assessment-workflow.js')) as any;
const assessment_workflowRoutesJS = workflowModule.default || workflowModule;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof assessment_workflowRoutesJS === 'function' ||
    (assessment_workflowRoutesJS && typeof assessment_workflowRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(assessment_workflowRoutesJS);
} else {
    // Fallback or error
    logger.error('assessment-workflow.js did not export a valid router');
}

export default router;
