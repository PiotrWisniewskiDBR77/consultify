/**
 * UserSettingsHistory Routes
 * API endpoints for user-settings-history
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const user_settings_historyRoutesJS = require('../../routes/user-settings-history.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_settings_historyRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_settings_historyRoutesJS);
} else if (user_settings_historyRoutesJS.default) {
    // If it has a default export
    router.use(user_settings_historyRoutesJS.default);
} else {
    // If it's the router itself
    router.use(user_settings_historyRoutesJS);
}

export default router;
