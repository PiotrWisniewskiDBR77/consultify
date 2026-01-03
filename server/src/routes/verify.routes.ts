/**
 * Verify Routes
 * API endpoints for verify
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const verifyRoutesJSPromise = (async () => {
    const module = await import('../../routes/verify.js');
    return module.default || module;
})();
const verifyRoutesJS = verifyRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof verifyRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(verifyRoutesJS);
} else if (verifyRoutesJS.default) {
    // If it has a default export
    router.use(verifyRoutesJS.default);
} else {
    // If it's the router itself
    router.use(verifyRoutesJS);
}

export default router;
