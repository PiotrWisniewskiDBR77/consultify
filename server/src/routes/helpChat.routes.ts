/**
 * HelpChat Routes
 * API endpoints for helpChat
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const helpChatRoutesJSPromise = (async () => {
    const module = await import('../../routes/helpChat.js');
    return module.default || module;
})();
const helpChatRoutesJS = helpChatRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof helpChatRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(helpChatRoutesJS);
} else if (helpChatRoutesJS.default) {
    // If it has a default export
    router.use(helpChatRoutesJS.default);
} else {
    // If it's the router itself
    router.use(helpChatRoutesJS);
}

export default router;
