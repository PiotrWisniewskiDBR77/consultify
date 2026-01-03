/**
 * Notificationoutbox Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadNotificationoutboxservice = createCachedLazyService('../../services/notificationOutboxService.js');

// Export default instance (for backward compatibility)
export default loadNotificationoutboxservice();
