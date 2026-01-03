/**
 * Aigateway Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadAigateway = createCachedLazyService('../../services/ai/aiGateway.js');

// Export default instance (for backward compatibility)
export default loadAigateway();
