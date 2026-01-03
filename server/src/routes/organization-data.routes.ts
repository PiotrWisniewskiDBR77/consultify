/**
 * OrganizationData Routes
 * API endpoints for organization-data
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const organization_dataRoutesJSPromise = (async () => {
    const module = await import('../../routes/organization-data.js');
    return module.default || module;
})();
const organization_dataRoutesJS = organization_dataRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof organization_dataRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(organization_dataRoutesJS);
} else if (organization_dataRoutesJS.default) {
    // If it has a default export
    router.use(organization_dataRoutesJS.default);
} else {
    // If it's the router itself
    router.use(organization_dataRoutesJS);
}

export default router;
