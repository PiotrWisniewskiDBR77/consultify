/**
 * DataExport Routes
 * API endpoints for dataExport
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
// Import the JS implementation for now (will be fully migrated later)
const dataExportRoutesJSPromise = (async () => {
    const module = await import('../../routes/dataExport.js');
    return module.default || module;
})();
const dataExportRoutesJS = dataExportRoutesJSPromise;;

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof dataExportRoutesJS === 'function') {
    // If it's a router function, use it
    router.use(dataExportRoutesJS);
} else if (dataExportRoutesJS.default) {
    // If it has a default export
    router.use(dataExportRoutesJS.default);
} else {
    // If it's the router itself
    router.use(dataExportRoutesJS);
}

export default router;
