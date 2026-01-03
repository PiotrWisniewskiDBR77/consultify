/**
 * Ai/consultingFlowEngine Service
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
const ai/consultingFlowEngineServiceJS = require('../../services/ai/consultingFlowEngine.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/consultingFlowEngineService = ai/consultingFlowEngineServiceJS.default || ai/consultingFlowEngineServiceJS;

// Export default instance (for backward compatibility)
export default ai/consultingFlowEngineService;

// Also export named exports if they exist
if (typeof ai/consultingFlowEngineServiceJS === 'object' && ai/consultingFlowEngineServiceJS !== null) {
    Object.keys(ai/consultingFlowEngineServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/consultingFlowEngineServiceJS[key];
        }
    });
}
