/**
 * Consultants Routes
 * API endpoints for consultants
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const consultantsRoutesJSPromise = (async () => {
    const module = await import('../../routes/consultants.js');
    return module.default || module;
})();
const consultantsRoutesJS = consultantsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof consultantsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(consultantsRoutesJS);
} else if (consultantsRoutesJS.default) {
    // If it has a default export
    router.use(consultantsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(consultantsRoutesJS);
}

export default router;
