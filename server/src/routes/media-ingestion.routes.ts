/**
 * MediaIngestion Routes
 * API endpoints for media-ingestion
 *
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router, type RequestHandler } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const module = await import('../../routes/media-ingestion.js');
const media_ingestionRoutesJS = module.default || module;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof media_ingestionRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(media_ingestionRoutesJS as RequestHandler);
} else if (media_ingestionRoutesJS && typeof (media_ingestionRoutesJS as { handle?: unknown }).handle === 'function') {
    // If it's a router function or Router object, use it
    router.use(media_ingestionRoutesJS as RequestHandler);
} else {
    // Fallback or error
    console.error('media-ingestion.js did not export a valid router');
}
export default router;
