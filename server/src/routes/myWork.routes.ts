/**
 * MyWork Routes
 * API endpoints for myWork
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const myWorkRoutesJSPromise = (async () => {
    const module = await import('../../routes/myWork.js');
    return module.default || module;
})();
const myWorkRoutesJS = myWorkRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof myWorkRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(myWorkRoutesJS);
} else if (myWorkRoutesJS.default) {
    // If it has a default export
    router.use(myWorkRoutesJS.default);
} else {
    // If it's the router itself
    router.use(myWorkRoutesJS);
}

export default router;
