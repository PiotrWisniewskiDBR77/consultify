/**
 * Scenarios Routes
 * API endpoints for scenarios
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/scenarios.js');
const scenariosRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof scenariosRoutesJS === 'function' || (scenariosRoutesJS && typeof scenariosRoutesJS.handle === 'function')) {
    // If it's a router function or Router object, use it
    router.use(scenariosRoutesJS);
} else {
    // Fallback or error
    console.error('scenarios.js did not export a valid router');
}

export default router;
