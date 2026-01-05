/**
 * UserSettingsTemplates Routes
 * API endpoints for user-settings-templates
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';
// Import the JS implementation for now (will be fully migrated later)

const router = Router();

// Import the JS implementation for now (will be fully migrated later)
const templatesModule = (await import('./user-settings-templates.js')) as any;
const user_settings_templatesRoutesJS = templatesModule.default || templatesModule;

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_settings_templatesRoutesJS === 'function' ||
    (user_settings_templatesRoutesJS && typeof user_settings_templatesRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(user_settings_templatesRoutesJS);
} else {
    // Fallback or error
    logger.error('user-settings-templates.js did not export a valid router');
}

export default router;
