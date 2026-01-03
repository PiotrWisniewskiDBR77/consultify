/**
 * Activity Service Proxy
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Standardized PascalCase wrapper for ActivityService
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadActivityService = createCachedLazyService('../../services/activityService.js');

/**
 * Export a proxy object that awaits the service on each call.
 */
const ActivityService = {
    log: async (params: any) => {
        const service = await loadActivityService();
        return (service as any).log(params);
    },
    getRecent: async (limit: number = 50) => {
        const service = await loadActivityService();
        return (service as any).getRecent(limit);
    },
    getByOrganization: async (organizationId: string, limit: number = 50) => {
        const service = await loadActivityService();
        return (service as any).getByOrganization(organizationId, limit);
    },
    getStats: async () => {
        const service = await loadActivityService();
        return (service as any).getStats();
    }
};

export default ActivityService;
