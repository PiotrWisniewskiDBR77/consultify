/**
 * Sso Routes
 * API endpoints for sso
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const ssoRoutesJSPromise = (async () => {
    const module = await import('../../routes/sso.js');
    return module.default || module;
})();
const ssoRoutesJS = ssoRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof ssoRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(ssoRoutesJS);
} else if (ssoRoutesJS.default) {
    // If it has a default export
    router.use(ssoRoutesJS.default);
} else {
    // If it's the router itself
    router.use(ssoRoutesJS);
}

export default router;
