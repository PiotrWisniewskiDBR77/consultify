/**
 * ConsultantProjectAccess Routes
 * API endpoints for consultant-project-access
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const consultant_project_accessRoutesJS = require('../../routes/consultant-project-access.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof consultant_project_accessRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(consultant_project_accessRoutesJS);
} else if (consultant_project_accessRoutesJS.default) {
    // If it has a default export
    router.use(consultant_project_accessRoutesJS.default);
} else {
    // If it's the router itself
    router.use(consultant_project_accessRoutesJS);
}

export default router;
