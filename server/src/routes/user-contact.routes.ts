/**
 * UserContact Routes
 * API endpoints for user-contact
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const user_contactRoutesJSPromise = (async () => {
    const module = await import('../../routes/user-contact.js');
    return module.default || module;
})();
const user_contactRoutesJS = user_contactRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_contactRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_contactRoutesJS);
} else if (user_contactRoutesJS.default) {
    // If it has a default export
    router.use(user_contactRoutesJS.default);
} else {
    // If it's the router itself
    router.use(user_contactRoutesJS);
}

export default router;
