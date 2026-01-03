/**
 * MediaIngestion Routes
 * API endpoints for media-ingestion
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const media_ingestionRoutesJS = require('../../routes/media-ingestion.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof media_ingestionRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(media_ingestionRoutesJS);
} else if (media_ingestionRoutesJS.default) {
    // If it has a default export
    router.use(media_ingestionRoutesJS.default);
} else {
    // If it's the router itself
    router.use(media_ingestionRoutesJS);
}

export default router;
