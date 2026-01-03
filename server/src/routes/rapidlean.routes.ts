/**
 * Rapidlean Routes
 * API endpoints for rapidlean
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const rapidleanRoutesJSPromise = (async () => {
    const module = await import('../../routes/rapidlean.js');
    return module.default || module;
})();
const rapidleanRoutesJS = rapidleanRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof rapidleanRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(rapidleanRoutesJS);
} else if (rapidleanRoutesJS.default) {
    // If it has a default export
    router.use(rapidleanRoutesJS.default);
} else {
    // If it's the router itself
    router.use(rapidleanRoutesJS);
}

export default router;
