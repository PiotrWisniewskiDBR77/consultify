/**
 * ApiKeys Routes
 * API endpoints for apiKeys
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const apiKeysRoutesJSPromise = (async () => {
    const module = await import('../../routes/apiKeys.js');
    return module.default || module;
})();
const apiKeysRoutesJS = apiKeysRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof apiKeysRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(apiKeysRoutesJS);
} else if (apiKeysRoutesJS.default) {
    // If it has a default export
    router.use(apiKeysRoutesJS.default);
} else {
    // If it's the router itself
    router.use(apiKeysRoutesJS);
}

export default router;
