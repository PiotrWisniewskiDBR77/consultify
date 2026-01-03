/**
 * Ai/intelligence/index Service
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
const ai/intelligence/indexServiceJS = require('../../services/ai/intelligence/index.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/intelligence/indexService = ai/intelligence/indexServiceJS.default || ai/intelligence/indexServiceJS;

// Export default instance (for backward compatibility)
export default ai/intelligence/indexService;

// Also export named exports if they exist
if (typeof ai/intelligence/indexServiceJS === 'object' && ai/intelligence/indexServiceJS !== null) {
    Object.keys(ai/intelligence/indexServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/intelligence/indexServiceJS[key];
        }
    });
}
