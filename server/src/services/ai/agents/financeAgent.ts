/**
 * Ai/agents/financeAgent Service
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
const ai/agents/financeAgentServiceJS = require('../../services/ai/agents/financeAgent.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ai/agents/financeAgentService = ai/agents/financeAgentServiceJS.default || ai/agents/financeAgentServiceJS;

// Export default instance (for backward compatibility)
export default ai/agents/financeAgentService;

// Also export named exports if they exist
if (typeof ai/agents/financeAgentServiceJS === 'object' && ai/agents/financeAgentServiceJS !== null) {
    Object.keys(ai/agents/financeAgentServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ai/agents/financeAgentServiceJS[key];
        }
    });
}
