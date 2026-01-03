/**
 * Ai/pipeline/reportAgents Service
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
const ai/pipeline/reportAgentsServiceJS = require('../../services/ai/pipeline/reportAgents.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/pipeline/reportAgentsService = ai/pipeline/reportAgentsServiceJS.default || ai/pipeline/reportAgentsServiceJS;

// Export default instance (for backward compatibility)
export default ai/pipeline/reportAgentsService;

// Also export named exports if they exist
if (typeof ai/pipeline/reportAgentsServiceJS === 'object' && ai/pipeline/reportAgentsServiceJS !== null) {
    Object.keys(ai/pipeline/reportAgentsServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/pipeline/reportAgentsServiceJS[key];
        }
    });
}
