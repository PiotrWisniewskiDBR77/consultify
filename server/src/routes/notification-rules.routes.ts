/**
 * NotificationRules Routes
 * API endpoints for notification-rules
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const notification_rulesRoutesJSPromise = (async () => {
    const module = await import('../../routes/notification-rules.js');
    return module.default || module;
})();
const notification_rulesRoutesJS = notification_rulesRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof notification_rulesRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(notification_rulesRoutesJS);
} else if (notification_rulesRoutesJS.default) {
    // If it has a default export
    router.use(notification_rulesRoutesJS.default);
} else {
    // If it's the router itself
    router.use(notification_rulesRoutesJS);
}

export default router;
