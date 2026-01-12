/**
 * Mfa Routes
 * API endpoints for mfa
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';

// Create router
const router = Router();

// Lazy load the JS implementation
const getMfaRoutesJS = async () => {
    const module = await import('../../routes/mfa.js');
    return module.default || module;
};

// Apply legacy routes with async handler wrapping to ensure they are loaded before use
router.use(
    asyncHandler(async (req, res, next) => {
        const legacyRouter = await getMfaRoutesJS();
        // Since we can't easily 'await' a router mount inside another router's initialization
        // for all sub-routes, we would normally use it at entry point.
        // However, for this wrapper to work, we need to handle the delegation.
        return legacyRouter(req, res, next);
    }),
);

export default router;
