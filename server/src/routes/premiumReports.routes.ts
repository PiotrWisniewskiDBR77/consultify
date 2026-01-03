/**
 * PremiumReports Routes
 * API endpoints for premiumReports
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const premiumReportsRoutesJSPromise = (async () => {
    const module = await import('../../routes/premiumReports.js');
    return module.default || module;
})();
const premiumReportsRoutesJS = premiumReportsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof premiumReportsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(premiumReportsRoutesJS);
} else if (premiumReportsRoutesJS.default) {
    // If it has a default export
    router.use(premiumReportsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(premiumReportsRoutesJS);
}

export default router;
