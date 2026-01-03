/**
 * AiSecurity Routes
 * API endpoints for ai-security
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ai_securityRoutesJS = require('../../routes/ai-security.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof ai_securityRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(ai_securityRoutesJS);
} else if (ai_securityRoutesJS.default) {
    // If it has a default export
    router.use(ai_securityRoutesJS.default);
} else {
    // If it's the router itself
    router.use(ai_securityRoutesJS);
}

export default router;
