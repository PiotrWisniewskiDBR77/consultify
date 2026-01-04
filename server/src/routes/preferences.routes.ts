/**
 * Preferences Routes
 * API endpoints for preferences
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/preferences.js');
const preferencesRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof preferencesRoutesJS === 'function' ||
    (preferencesRoutesJS && typeof preferencesRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(preferencesRoutesJS);
} else {
    // Fallback or error
    logger.error('preferences.js did not export a valid router');
}

export default router;
