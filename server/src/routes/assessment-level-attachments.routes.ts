/**
 * AssessmentLevelAttachments Routes
 * API endpoints for assessment-level-attachments
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const attachmentsModule = (await import('./assessment-level-attachments.js')) as any;
const assessment_level_attachmentsRoutesJS = attachmentsModule.default || attachmentsModule;

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Create router and apply JS routes
// const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof assessment_level_attachmentsRoutesJS === 'function' ||
    (assessment_level_attachmentsRoutesJS && typeof assessment_level_attachmentsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(assessment_level_attachmentsRoutesJS);
} else {
    // Fallback or error
    logger.error('assessment-level-attachments.js did not export a valid router');
}

export default router;
