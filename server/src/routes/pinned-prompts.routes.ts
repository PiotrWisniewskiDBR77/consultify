/**
 * PinnedPrompts Routes
 * API endpoints for pinned-prompts
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const pinned_promptsRoutesJSPromise = (async () => {
    const module = await import('../../routes/pinned-prompts.js');
    return module.default || module;
})();
const pinned_promptsRoutesJS = pinned_promptsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof pinned_promptsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(pinned_promptsRoutesJS);
} else if (pinned_promptsRoutesJS.default) {
    // If it has a default export
    router.use(pinned_promptsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(pinned_promptsRoutesJS);
}

export default router;
