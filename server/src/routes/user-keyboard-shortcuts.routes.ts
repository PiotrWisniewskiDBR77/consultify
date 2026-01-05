/**
 * UserKeyboardShortcuts Routes
 * API endpoints for user-keyboard-shortcuts
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
const shortcutsModule = (await import('./user-keyboard-shortcuts.js')) as any;
const user_keyboard_shortcutsRoutesJS = shortcutsModule.default || shortcutsModule;

// Apply rate limiting
router.use(defaultRateLimiter);

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (
    typeof user_keyboard_shortcutsRoutesJS === 'function' ||
    (user_keyboard_shortcutsRoutesJS && typeof user_keyboard_shortcutsRoutesJS.handle === 'function')
) {
    // If it's a router function or Router object, use it
    router.use(user_keyboard_shortcutsRoutesJS);
} else {
    // Fallback or error
    logger.error('user-keyboard-shortcuts.js did not export a valid router');
}

export default router;
