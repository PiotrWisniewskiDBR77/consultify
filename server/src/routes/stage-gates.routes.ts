/**
 * StageGates Routes
 * API endpoints for stage-gates
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/stage-gates.js');
const stage_gatesRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof stage_gatesRoutesJS === 'function' ||
    (stage_gatesRoutesJS && typeof stage_gatesRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(stage_gatesRoutesJS);
} else {
    // Fallback or error
    logger.error('stage-gates.js did not export a valid router');
}

export default router;
