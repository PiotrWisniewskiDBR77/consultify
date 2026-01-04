/**
 * JiraUserIntegration Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

// Lazy load the JS service module
import service from '../../../services/integrations/jiraUserIntegration.js';
import { createCachedLazyService } from '../../../utils/lazyServiceLoader.ts';

// Export default instance (for backward compatibility)
export default service;
