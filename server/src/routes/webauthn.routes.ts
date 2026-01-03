/**
 * Webauthn Routes
 * API endpoints for webauthn
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const webauthnRoutesJSPromise = (async () => {
    const module = await import('../../routes/webauthn.js');
    return module.default || module;
})();
const webauthnRoutesJS = webauthnRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof webauthnRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(webauthnRoutesJS);
} else if (webauthnRoutesJS.default) {
    // If it has a default export
    router.use(webauthnRoutesJS.default);
} else {
    // If it's the router itself
    router.use(webauthnRoutesJS);
}

export default router;
