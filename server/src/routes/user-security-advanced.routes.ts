/**
 * UserSecurityAdvanced Routes
 * API endpoints for user-security-advanced
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const user_security_advancedRoutesJSPromise = (async () => {
    const module = await import('../../routes/user-security-advanced.js');
    return module.default || module;
})();
const user_security_advancedRoutesJS = user_security_advancedRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_security_advancedRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_security_advancedRoutesJS);
} else if (user_security_advancedRoutesJS.default) {
    // If it has a default export
    router.use(user_security_advancedRoutesJS.default);
} else {
    // If it's the router itself
    router.use(user_security_advancedRoutesJS);
}

export default router;
