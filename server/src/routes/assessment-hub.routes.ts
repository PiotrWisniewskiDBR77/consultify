/**
 * AssessmentHub Routes
 * API endpoints for assessment-hub
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { type RequestHandler, Router } from 'express';

import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/assessment-hub.js');
const assessment_hubRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof assessment_hubRoutesJS === 'function') {
  // If it's a router function, use it
  router.use(assessment_hubRoutesJS as unknown as unknown as unknown as RequestHandler);
} else if (
  assessment_hubRoutesJS &&
  typeof (assessment_hubRoutesJS as { handle?: unknown }).handle === 'function'
) {
  // If it's a router function or Router object, use it
  router.use(assessment_hubRoutesJS as unknown as unknown as unknown as RequestHandler);
} else {
  // Fallback or error
  logger.error('assessment-hub.js did not export a valid router');
}
export default router;
