/**
 * UserPrivacyExtended Routes
 * API endpoints for user-privacy-extended
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const user_privacy_extendedRoutesJS = require('../../routes/user-privacy-extended.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_privacy_extendedRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_privacy_extendedRoutesJS);
} else if (user_privacy_extendedRoutesJS.default) {
    // If it has a default export
    router.use(user_privacy_extendedRoutesJS.default);
} else {
    // If it's the router itself
    router.use(user_privacy_extendedRoutesJS);
}

export default router;
