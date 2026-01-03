/**
 * UserAvailability Routes
 * API endpoints for user-availability
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const user_availabilityRoutesJSPromise = (async () => {
    const module = await import('../../routes/user-availability.js');
    return module.default || module;
})();
const user_availabilityRoutesJS = user_availabilityRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof user_availabilityRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(user_availabilityRoutesJS);
} else if (user_availabilityRoutesJS.default) {
    // If it has a default export
    router.use(user_availabilityRoutesJS.default);
} else {
    // If it's the router itself
    router.use(user_availabilityRoutesJS);
}

export default router;
