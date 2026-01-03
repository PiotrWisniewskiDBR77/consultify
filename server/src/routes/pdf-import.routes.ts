/**
 * PdfImport Routes
 * API endpoints for pdf-import
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const pdf_importRoutesJSPromise = (async () => {
    const module = await import('../../routes/pdf-import.js');
    return module.default || module;
})();
const pdf_importRoutesJS = pdf_importRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof pdf_importRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(pdf_importRoutesJS);
} else if (pdf_importRoutesJS.default) {
    // If it has a default export
    router.use(pdf_importRoutesJS.default);
} else {
    // If it's the router itself
    router.use(pdf_importRoutesJS);
}

export default router;
