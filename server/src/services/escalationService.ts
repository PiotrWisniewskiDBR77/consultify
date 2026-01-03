/**
 * Escalation Service Proxy
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Standardized PascalCase wrapper for EscalationService
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadEscalationService = createCachedLazyService('../../services/escalationService.js');

/**
 * Export a proxy object that awaits the service on each call.
 * This ensures that methods are only called once the service is loaded.
 */
const EscalationService = {
    getEscalations: async (projectId: string, status: string | null = null) => {
        const service = await loadEscalationService();
        return (service as any).getEscalations(projectId, status);
    },
    acknowledgeEscalation: async (escalationId: string, userId: string) => {
        const service = await loadEscalationService();
        return (service as any).acknowledgeEscalation(escalationId, userId);
    },
    resolveEscalation: async (escalationId: string) => {
        const service = await loadEscalationService();
        return (service as any).resolveEscalation(escalationId);
    },
    runAutoEscalation: async (projectId: string) => {
        const service = await loadEscalationService();
        return (service as any).runAutoEscalation(projectId);
    },
    createEscalation: async (data: any) => {
        const service = await loadEscalationService();
        return (service as any).createEscalation(data);
    }
};

export default EscalationService;
