/**
 * Multiframeworkaudit Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadMultiframeworkauditservice = createCachedLazyService('../../services/multiFrameworkAuditService.js');

// Export default instance (for backward compatibility)
export default loadMultiframeworkauditservice();
