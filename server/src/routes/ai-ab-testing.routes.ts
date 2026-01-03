/**
 * AiAbTesting Routes
 * API endpoints for ai-ab-testing
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ai_ab_testingRoutesJS = require('../../routes/ai-ab-testing.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof ai_ab_testingRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(ai_ab_testingRoutesJS);
} else if (ai_ab_testingRoutesJS.default) {
    // If it has a default export
    router.use(ai_ab_testingRoutesJS.default);
} else {
    // If it's the router itself
    router.use(ai_ab_testingRoutesJS);
}

export default router;
