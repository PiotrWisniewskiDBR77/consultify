/**
 * Ai/processors/index Service
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
const ai/processors/indexServiceJS = require('../../services/ai/processors/index.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/processors/indexService = ai/processors/indexServiceJS.default || ai/processors/indexServiceJS;

// Export default instance (for backward compatibility)
export default ai/processors/indexService;

// Also export named exports if they exist
if (typeof ai/processors/indexServiceJS === 'object' && ai/processors/indexServiceJS !== null) {
    Object.keys(ai/processors/indexServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/processors/indexServiceJS[key];
        }
    });
}
