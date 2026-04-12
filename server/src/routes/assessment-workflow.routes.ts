/**
 * AssessmentWorkflow Routes
 * API endpoints for assessment-workflow
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { type RequestHandler, Router } from 'express';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/assessment-workflow.js');
const assessment_workflowRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof assessment_workflowRoutesJS === 'function') {
  // If it's a router function, use it
  router.use(
    assessment_workflowRoutesJS as unknown as unknown as unknown as unknown as RequestHandler
  );
} else if (
  assessment_workflowRoutesJS &&
  typeof (assessment_workflowRoutesJS as { handle?: unknown }).handle === 'function'
) {
  // If it's a router function or Router object, use it
  router.use(
    assessment_workflowRoutesJS as unknown as unknown as unknown as unknown as RequestHandler
  );
} else {
  // Fallback or error
  logger.error('assessment-workflow.js did not export a valid router');
}
export default router;
