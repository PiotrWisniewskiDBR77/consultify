/**
 * Workqueue Routes
 * API endpoints for workqueue
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const workqueueRoutesJSPromise = (async () => {
    const module = await import('../../routes/workqueue.js');
    return module.default || module;
})();
const workqueueRoutesJS = workqueueRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof workqueueRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(workqueueRoutesJS);
} else if (workqueueRoutesJS.default) {
    // If it has a default export
    router.use(workqueueRoutesJS.default);
} else {
    // If it's the router itself
    router.use(workqueueRoutesJS);
}

export default router;
