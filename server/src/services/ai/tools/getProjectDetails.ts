/**
 * Ai/tools/getProjectDetails Service
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
const ai/tools/getProjectDetailsServiceJS = require('../../services/ai/tools/getProjectDetails.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/tools/getProjectDetailsService = ai/tools/getProjectDetailsServiceJS.default || ai/tools/getProjectDetailsServiceJS;

// Export default instance (for backward compatibility)
export default ai/tools/getProjectDetailsService;

// Also export named exports if they exist
if (typeof ai/tools/getProjectDetailsServiceJS === 'object' && ai/tools/getProjectDetailsServiceJS !== null) {
    Object.keys(ai/tools/getProjectDetailsServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/tools/getProjectDetailsServiceJS[key];
        }
    });
}
