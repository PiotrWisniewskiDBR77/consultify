/**
 * Ai/pipeline/reportPipeline Service
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
const ai/pipeline/reportPipelineServiceJS = require('../../services/ai/pipeline/reportPipeline.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/pipeline/reportPipelineService = ai/pipeline/reportPipelineServiceJS.default || ai/pipeline/reportPipelineServiceJS;

// Export default instance (for backward compatibility)
export default ai/pipeline/reportPipelineService;

// Also export named exports if they exist
if (typeof ai/pipeline/reportPipelineServiceJS === 'object' && ai/pipeline/reportPipelineServiceJS !== null) {
    Object.keys(ai/pipeline/reportPipelineServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/pipeline/reportPipelineServiceJS[key];
        }
    });
}
