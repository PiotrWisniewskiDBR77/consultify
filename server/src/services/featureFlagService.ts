/**
 * Featureflag Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

// Lazy load the JS service module
import service from '../../services/featureFlagService.js';

// Export default instance (for backward compatibility)
export default service;
