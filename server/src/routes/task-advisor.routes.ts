/**
 * TaskAdvisor Routes
 * API endpoints for task-advisor
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const task_advisorRoutesJSPromise = (async () => {
    const module = await import('../../routes/task-advisor.js');
    return module.default || module;
})();
const task_advisorRoutesJS = task_advisorRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof task_advisorRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(task_advisorRoutesJS);
} else if (task_advisorRoutesJS.default) {
    // If it has a default export
    router.use(task_advisorRoutesJS.default);
} else {
    // If it's the router itself
    router.use(task_advisorRoutesJS);
}

export default router;
