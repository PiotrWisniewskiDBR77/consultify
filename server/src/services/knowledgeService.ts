/**
 * KnowledgeService Service
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
const knowledgeServiceServiceJS = require('../../services/knowledgeService.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const knowledgeServiceService = knowledgeServiceServiceJS.default || knowledgeServiceServiceJS;

// Export default instance (for backward compatibility)
export default knowledgeServiceService;

// Also export named exports if they exist
if (typeof knowledgeServiceServiceJS === 'object' && knowledgeServiceServiceJS !== null) {
    Object.keys(knowledgeServiceServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = knowledgeServiceServiceJS[key];
        }
    });
}
