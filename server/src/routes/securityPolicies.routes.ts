/**
 * SecurityPolicies Routes
 * API endpoints for securityPolicies
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const securityPoliciesRoutesJSPromise = (async () => {
    const module = await import('../../routes/securityPolicies.js');
    return module.default || module;
})();
const securityPoliciesRoutesJS = securityPoliciesRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof securityPoliciesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(securityPoliciesRoutesJS);
} else if (securityPoliciesRoutesJS.default) {
    // If it has a default export
    router.use(securityPoliciesRoutesJS.default);
} else {
    // If it's the router itself
    router.use(securityPoliciesRoutesJS);
}

export default router;
