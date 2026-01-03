/**
 * DailyBrief Routes
 * API endpoints for daily-brief
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const daily_briefRoutesJSPromise = (async () => {
    const module = await import('../../routes/daily-brief.js');
    return module.default || module;
})();
const daily_briefRoutesJS = daily_briefRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof daily_briefRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(daily_briefRoutesJS);
} else if (daily_briefRoutesJS.default) {
    // If it has a default export
    router.use(daily_briefRoutesJS.default);
} else {
    // If it's the router itself
    router.use(daily_briefRoutesJS);
}

export default router;
