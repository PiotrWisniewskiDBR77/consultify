/**
 * ApiKeys Routes
 * API endpoints for api-keys
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/api-keys.js');
const api_keysRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof api_keysRoutesJS === 'function' || (api_keysRoutesJS && typeof api_keysRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(api_keysRoutesJS);
} else {
    // Fallback or error
    logger.error('api-keys.js did not export a valid router');
}

export default router;
