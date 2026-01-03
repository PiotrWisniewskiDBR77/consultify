/**
 * Ai/tools/index Service
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
const ai/tools/indexServiceJS = require('../../services/ai/tools/index.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/tools/indexService = ai/tools/indexServiceJS.default || ai/tools/indexServiceJS;

// Export default instance (for backward compatibility)
export default ai/tools/indexService;

// Also export named exports if they exist
if (typeof ai/tools/indexServiceJS === 'object' && ai/tools/indexServiceJS !== null) {
    Object.keys(ai/tools/indexServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/tools/indexServiceJS[key];
        }
    });
}
