/**
 * MultiFrameworkAssessment Routes
 * API endpoints for multi-framework-assessment
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/multi-framework-assessment.js');
const multi_framework_assessmentRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof multi_framework_assessmentRoutesJS === 'function' ||
    (multi_framework_assessmentRoutesJS && typeof multi_framework_assessmentRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(multi_framework_assessmentRoutesJS);
} else {
    // Fallback or error
    logger.error('multi-framework-assessment.js did not export a valid router');
}

export default router;
