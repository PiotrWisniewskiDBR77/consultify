/**
 * Preferences Routes
 * API endpoints for preferences
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const preferencesRoutesJSPromise = (async () => {
    const module = await import('../../routes/preferences.js');
    return module.default || module;
})();
const preferencesRoutesJS = preferencesRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof preferencesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(preferencesRoutesJS);
} else if (preferencesRoutesJS.default) {
    // If it has a default export
    router.use(preferencesRoutesJS.default);
} else {
    // If it's the router itself
    router.use(preferencesRoutesJS);
}

export default router;
