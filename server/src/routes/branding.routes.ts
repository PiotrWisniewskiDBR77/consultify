/**
 * Branding Routes
 * API endpoints for branding
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const brandingRoutesJS = require('../../routes/branding.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof brandingRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(brandingRoutesJS);
} else if (brandingRoutesJS.default) {
    // If it has a default export
    router.use(brandingRoutesJS.default);
} else {
    // If it's the router itself
    router.use(brandingRoutesJS);
}

export default router;
