/**
 * Changeagent Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../../utils/lazyServiceLoader.ts';

// Lazy load the JS service module
const loadChangeagent = createCachedLazyService('../../services/ai/agents/changeAgent.js');

// Export default instance (for backward compatibility)
export default loadChangeagent();
