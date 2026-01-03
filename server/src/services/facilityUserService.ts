/**
 * Facilityuser Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadFacilityuserservice = createCachedLazyService('../../services/facilityUserService.js');

// Export default instance (for backward compatibility)
export default loadFacilityuserservice();
