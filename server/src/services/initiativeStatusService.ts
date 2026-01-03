/**
 * InitiativeStatusService Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript with proper types
 */

import { createRequire } from 'module';
import logger from '../utils/Logger.js';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const initiativeStatusServiceServiceJS = require('../../services/initiativeStatusService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const initiativeStatusServiceService = initiativeStatusServiceServiceJS.default || initiativeStatusServiceServiceJS;

// Export default instance (for backward compatibility)
export default initiativeStatusServiceService;

// Also export named exports if they exist
if (typeof initiativeStatusServiceServiceJS === 'object' && initiativeStatusServiceServiceJS !== null) {
    Object.keys(initiativeStatusServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = initiativeStatusServiceServiceJS[key];
        }
    });
}
