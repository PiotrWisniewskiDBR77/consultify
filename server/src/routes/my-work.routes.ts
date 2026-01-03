/**
 * MyWork Routes
 * API endpoints for my-work
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const my_workRoutesJSPromise = (async () => {
    const module = await import('../../routes/my-work.js');
    return module.default || module;
})();
const my_workRoutesJS = my_workRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof my_workRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(my_workRoutesJS);
} else if (my_workRoutesJS.default) {
    // If it has a default export
    router.use(my_workRoutesJS.default);
} else {
    // If it's the router itself
    router.use(my_workRoutesJS);
}

export default router;
