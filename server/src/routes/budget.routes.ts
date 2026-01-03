/**
 * Budget Routes
 * API endpoints for budget
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const budgetRoutesJSPromise = (async () => {
    const module = await import('../../routes/budget.js');
    return module.default || module;
})();
const budgetRoutesJS = budgetRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof budgetRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(budgetRoutesJS);
} else if (budgetRoutesJS.default) {
    // If it has a default export
    router.use(budgetRoutesJS.default);
} else {
    // If it's the router itself
    router.use(budgetRoutesJS);
}

export default router;
