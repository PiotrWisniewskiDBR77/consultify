/**
 * PmoContext Routes
 * API endpoints for pmo-context
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const pmo_contextRoutesJSPromise = (async () => {
    const module = await import('../../routes/pmo-context.js');
    return module.default || module;
})();
const pmo_contextRoutesJS = pmo_contextRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof pmo_contextRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(pmo_contextRoutesJS);
} else if (pmo_contextRoutesJS.default) {
    // If it has a default export
    router.use(pmo_contextRoutesJS.default);
} else {
    // If it's the router itself
    router.use(pmo_contextRoutesJS);
}

export default router;
