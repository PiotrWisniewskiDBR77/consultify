/**
 * Onboarding Routes
 * API endpoints for onboarding
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const onboardingRoutesJSPromise = (async () => {
    const module = await import('../../routes/onboarding.js');
    return module.default || module;
})();
const onboardingRoutesJS = onboardingRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof onboardingRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(onboardingRoutesJS);
} else if (onboardingRoutesJS.default) {
    // If it has a default export
    router.use(onboardingRoutesJS.default);
} else {
    // If it's the router itself
    router.use(onboardingRoutesJS);
}

export default router;
