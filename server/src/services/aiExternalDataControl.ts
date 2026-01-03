/**
 * AiExternalDataControl Service
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
const aiExternalDataControlServiceJS = require('../../services/aiExternalDataControl.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const aiExternalDataControlService = aiExternalDataControlServiceJS.default || aiExternalDataControlServiceJS;

// Export default instance (for backward compatibility)
export default aiExternalDataControlService;

// Also export named exports if they exist
if (typeof aiExternalDataControlServiceJS === 'object' && aiExternalDataControlServiceJS !== null) {
    Object.keys(aiExternalDataControlServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = aiExternalDataControlServiceJS[key];
        }
    });
}
