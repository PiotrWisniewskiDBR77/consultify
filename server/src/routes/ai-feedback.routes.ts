/**
 * AiFeedback Routes
 * API endpoints for ai-feedback
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ai_feedbackRoutesJS = require('../../routes/ai-feedback.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof ai_feedbackRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(ai_feedbackRoutesJS);
} else if (ai_feedbackRoutesJS.default) {
    // If it has a default export
    router.use(ai_feedbackRoutesJS.default);
} else {
    // If it's the router itself
    router.use(ai_feedbackRoutesJS);
}

export default router;
