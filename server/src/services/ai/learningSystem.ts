/**
 * Learningsystem Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadLearningsystem = createCachedLazyService('../../services/ai/learningSystem.js');
const service = loadLearningsystem();

export const learningSystem = service.learningSystem;
export const LearningSystem = service.LearningSystem;
export const CONFIG = service.CONFIG;

export default service;
