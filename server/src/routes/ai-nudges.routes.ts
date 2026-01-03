/**
 * AiNudges Routes
 * API endpoints for ai-nudges
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ai_nudgesRoutesJS = require('../../routes/ai-nudges.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof ai_nudgesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(ai_nudgesRoutesJS);
} else if (ai_nudgesRoutesJS.default) {
    // If it has a default export
    router.use(ai_nudgesRoutesJS.default);
} else {
    // If it's the router itself
    router.use(ai_nudgesRoutesJS);
}

export default router;
