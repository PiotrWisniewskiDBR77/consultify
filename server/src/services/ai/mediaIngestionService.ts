/**
 * Mediaingestion Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.js';

// Lazy load the JS service module - file is in the same directory
// The .js file is a re-export wrapper that exports from the .ts file
const loadMediaingestion = createCachedLazyService('./mediaIngestionService.js');

// Export default instance (for backward compatibility)
export default loadMediaingestion();
