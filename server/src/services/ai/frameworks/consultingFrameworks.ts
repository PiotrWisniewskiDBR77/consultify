/**
 * Ai/frameworks/consultingFrameworks Service
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
const ai/frameworks/consultingFrameworksServiceJS = require('../../services/ai/frameworks/consultingFrameworks.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/frameworks/consultingFrameworksService = ai/frameworks/consultingFrameworksServiceJS.default || ai/frameworks/consultingFrameworksServiceJS;

// Export default instance (for backward compatibility)
export default ai/frameworks/consultingFrameworksService;

// Also export named exports if they exist
if (typeof ai/frameworks/consultingFrameworksServiceJS === 'object' && ai/frameworks/consultingFrameworksServiceJS !== null) {
    Object.keys(ai/frameworks/consultingFrameworksServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/frameworks/consultingFrameworksServiceJS[key];
        }
    });
}
