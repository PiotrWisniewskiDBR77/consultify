/**
 * Raid Routes
 * API endpoints for raid
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const raidRoutesJSPromise = (async () => {
    const module = await import('../../routes/raid.js');
    return module.default || module;
})();
const raidRoutesJS = raidRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof raidRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(raidRoutesJS);
} else if (raidRoutesJS.default) {
    // If it has a default export
    router.use(raidRoutesJS.default);
} else {
    // If it's the router itself
    router.use(raidRoutesJS);
}

export default router;
