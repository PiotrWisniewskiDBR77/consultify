/**
 * Learningsystem Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadLearningsystem = createCachedLazyService('../../services/ai/learningSystem.js');
const servicePromise = loadLearningsystem();

// Export async getters
export const getLearningSystem = async () => {
    const service = await servicePromise;
    return (service as any).learningSystem;
};

export const getLearningSystemClass = async () => {
    const service = await servicePromise;
    return (service as any).LearningSystem;
};

export const getLearningSystemConfig = async () => {
    const service = await servicePromise;
    return (service as any).CONFIG;
};

// For backward compatibility, export the promise (will need to await when used)
export const learningSystem = servicePromise.then(s => (s as any).learningSystem);
export const LearningSystem = servicePromise.then(s => (s as any).LearningSystem);
export const CONFIG = servicePromise.then(s => (s as any).CONFIG);

export default servicePromise;
