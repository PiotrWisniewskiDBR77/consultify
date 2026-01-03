/**
 * Ai/agents/strategyAgent Service
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
const ai/agents/strategyAgentServiceJS = require('../../services/ai/agents/strategyAgent.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/agents/strategyAgentService = ai/agents/strategyAgentServiceJS.default || ai/agents/strategyAgentServiceJS;

// Export default instance (for backward compatibility)
export default ai/agents/strategyAgentService;

// Also export named exports if they exist
if (typeof ai/agents/strategyAgentServiceJS === 'object' && ai/agents/strategyAgentServiceJS !== null) {
    Object.keys(ai/agents/strategyAgentServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/agents/strategyAgentServiceJS[key];
        }
    });
}
