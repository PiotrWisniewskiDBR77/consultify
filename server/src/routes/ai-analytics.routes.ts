/**
 * AiAnalytics Routes
 * API endpoints for ai-analytics
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ai_analyticsRoutesJS = require('../../routes/ai-analytics.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof ai_analyticsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(ai_analyticsRoutesJS);
} else if (ai_analyticsRoutesJS.default) {
    // If it has a default export
    router.use(ai_analyticsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(ai_analyticsRoutesJS);
}

export default router;
