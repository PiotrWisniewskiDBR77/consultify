/**
 * Ai/agents/changeAgent Service
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
const ai/agents/changeAgentServiceJS = require('../../services/ai/agents/changeAgent.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/agents/changeAgentService = ai/agents/changeAgentServiceJS.default || ai/agents/changeAgentServiceJS;

// Export default instance (for backward compatibility)
export default ai/agents/changeAgentService;

// Also export named exports if they exist
if (typeof ai/agents/changeAgentServiceJS === 'object' && ai/agents/changeAgentServiceJS !== null) {
    Object.keys(ai/agents/changeAgentServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/agents/changeAgentServiceJS[key];
        }
    });
}
