/**
 * Rapidlean Routes
 * API endpoints for rapidlean
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/rapidlean.js');
const rapidleanRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof rapidleanRoutesJS === 'function' || (rapidleanRoutesJS && typeof rapidleanRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(rapidleanRoutesJS);
} else {
    // Fallback or error
    logger.error('rapidlean.js did not export a valid router');
}

export default router;
