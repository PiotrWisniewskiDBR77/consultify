/**
 * Conversations Routes
 * API endpoints for conversations
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const conversationsRoutesJSPromise = (async () => {
    const module = await import('../../routes/conversations.js');
    return module.default || module;
})();
const conversationsRoutesJS = conversationsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof conversationsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(conversationsRoutesJS);
} else if (conversationsRoutesJS.default) {
    // If it has a default export
    router.use(conversationsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(conversationsRoutesJS);
}

export default router;
