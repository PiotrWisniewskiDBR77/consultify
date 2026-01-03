/**
 * ProjectMembers Routes
 * API endpoints for project-members
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const project_membersRoutesJS = require('../../routes/project-members.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof project_membersRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(project_membersRoutesJS);
} else if (project_membersRoutesJS.default) {
    // If it has a default export
    router.use(project_membersRoutesJS.default);
} else {
    // If it's the router itself
    router.use(project_membersRoutesJS);
}

export default router;
