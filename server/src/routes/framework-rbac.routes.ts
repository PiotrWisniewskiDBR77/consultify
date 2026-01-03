/**
 * FrameworkRbac Routes
 * API endpoints for framework-rbac
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const framework_rbacRoutesJSPromise = (async () => {
    const module = await import('../../routes/framework-rbac.js');
    return module.default || module;
})();
const framework_rbacRoutesJS = framework_rbacRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof framework_rbacRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(framework_rbacRoutesJS);
} else if (framework_rbacRoutesJS.default) {
    // If it has a default export
    router.use(framework_rbacRoutesJS.default);
} else {
    // If it's the router itself
    router.use(framework_rbacRoutesJS);
}

export default router;
