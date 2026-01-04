/**
 * AssessmentReports Routes
 * API endpoints for assessment-reports
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.ts';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/assessment-reports.js');
const assessment_reportsRoutesJS = module.default || module;

// Apply rate limiting
const router = Router();

router.use(defaultRateLimiter);

// Create router and apply JS routes

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof assessment_reportsRoutesJS === 'function' ||
    (assessment_reportsRoutesJS && typeof assessment_reportsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(assessment_reportsRoutesJS);
} else {
    // Fallback or error
    logger.error('assessment-reports.js did not export a valid router');
}

export default router;
