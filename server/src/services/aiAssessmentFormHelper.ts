/**
 * Aiassessmentformhelper Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

// Lazy load the JS service module
import service from '../../services/aiAssessmentFormHelper.js';

// Export default instance (for backward compatibility)
export default service;

// Re-export named exports
export const { AIAssessmentFormHelper, aiAssessmentFormHelper, FIELD_TYPES, VALIDATION_RULES } = service;
