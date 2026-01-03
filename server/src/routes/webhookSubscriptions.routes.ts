/**
 * WebhookSubscriptions Routes
 * API endpoints for webhookSubscriptions
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const webhookSubscriptionsRoutesJSPromise = (async () => {
    const module = await import('../../routes/webhookSubscriptions.js');
    return module.default || module;
})();
const webhookSubscriptionsRoutesJS = webhookSubscriptionsRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof webhookSubscriptionsRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(webhookSubscriptionsRoutesJS);
} else if (webhookSubscriptionsRoutesJS.default) {
    // If it has a default export
    router.use(webhookSubscriptionsRoutesJS.default);
} else {
    // If it's the router itself
    router.use(webhookSubscriptionsRoutesJS);
}

export default router;
