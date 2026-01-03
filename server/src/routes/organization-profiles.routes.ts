/**
 * OrganizationProfiles Routes
 * API endpoints for organization-profiles
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const organization_profilesRoutesJSPromise = (async () => {
    const module = await import('../../routes/organization-profiles.js');
    return module.default || module;
})();
const organization_profilesRoutesJS = organization_profilesRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof organization_profilesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(organization_profilesRoutesJS);
} else if (organization_profilesRoutesJS.default) {
    // If it has a default export
    router.use(organization_profilesRoutesJS.default);
} else {
    // If it's the router itself
    router.use(organization_profilesRoutesJS);
}

export default router;
