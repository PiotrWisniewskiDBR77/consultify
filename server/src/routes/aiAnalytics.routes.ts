/**
 * AiAnalytics Routes
 * API endpoints for aiAnalytics
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const aiAnalyticsRoutesJS = require('../../routes/aiAnalytics.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof aiAnalyticsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(aiAnalyticsRoutesJS);
} else if (aiAnalyticsRoutesJS.default) {
    // If it has a default export
    router.use(aiAnalyticsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(aiAnalyticsRoutesJS);
}

export default router;
