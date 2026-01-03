/**
 * Economics Routes
 * API endpoints for economics
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const economicsRoutesJSPromise = (async () => {
    const module = await import('../../routes/economics.js');
    return module.default || module;
})();
const economicsRoutesJS = economicsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof economicsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(economicsRoutesJS);
} else if (economicsRoutesJS.default) {
    // If it has a default export
    router.use(economicsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(economicsRoutesJS);
}

export default router;
