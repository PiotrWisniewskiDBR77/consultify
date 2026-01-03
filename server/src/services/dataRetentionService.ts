/**
 * DataRetentionService Service
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
const dataRetentionServiceServiceJS = require('../../services/dataRetentionService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const dataRetentionServiceService = dataRetentionServiceServiceJS.default || dataRetentionServiceServiceJS;

// Export default instance (for backward compatibility)
export default dataRetentionServiceService;

// Also export named exports if they exist
if (typeof dataRetentionServiceServiceJS === 'object' && dataRetentionServiceServiceJS !== null) {
    Object.keys(dataRetentionServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = dataRetentionServiceServiceJS[key];
        }
    });
}
