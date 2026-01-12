export default quotaService;
export class QuotaService extends BaseService {
    isPg: boolean;
    _tableEnsured: boolean;
    /**
     * Ensure the quota table exists
     */
    ensureTable(): Promise<void>;
    /**
     * Check if request is within quota limits
     * Checks all three levels: user, project, org
     * @returns {{ allowed: boolean, reason?: string, quotaInfo?: object }}
     */
    checkQuota(userId: any, organizationId: any, projectId?: null): {
        allowed: boolean;
        reason?: string;
        quotaInfo?: object;
    };
    /**
     * Consume tokens after successful LLM call
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @param {number} tokenCount - Base token count
     * @param {Object} options - Additional options
     * @param {string} options.tier - Model tier (REASONING applies 3x multiplier)
     * @param {boolean} options.isMaxMode - Explicit MAX mode flag
     */
    consumeTokens(userId: string, organizationId: string, projectId: string, tokenCount: number, options?: {
        tier: string;
        isMaxMode: boolean;
    }): Promise<{
        effectiveTokens: number;
        multiplier: number;
    }>;
    /**
     * Get or create quota record
     */
    getOrCreateQuota(entityType: any, entityId: any): Promise<any>;
    getQuota(entityType: any, entityId: any): Promise<any>;
    createQuota(entityType: any, entityId: any): Promise<any>;
    incrementUsage(entityType: any, entityId: any, tokenCount: any): Promise<any>;
    /**
     * Reset expired quotas (daily and monthly)
     */
    resetExpiredQuotas(): Promise<void>;
    /**
     * Get usage statistics for an entity
     */
    getUsage(entityType: any, entityId: any): Promise<{
        entityType: any;
        entityId: any;
        daily: {
            used: any;
            limit: any;
            remaining: number;
            percentUsed: number;
        };
        monthly: {
            used: any;
            limit: any;
            remaining: number;
            percentUsed: number;
        };
    } | null>;
    /**
     * Update quota limits for an entity
     */
    setQuotaLimits(entityType: any, entityId: any, dailyLimit: any, monthlyLimit: any): Promise<boolean>;
}
export const quotaService: QuotaService;
export namespace DEFAULT_QUOTAS {
    namespace user {
        let daily: number;
        let monthly: number;
    }
    namespace project {
        let daily_1: number;
        export { daily_1 as daily };
        let monthly_1: number;
        export { monthly_1 as monthly };
    }
    namespace organization {
        let daily_2: number;
        export { daily_2 as daily };
        let monthly_2: number;
        export { monthly_2 as monthly };
    }
}
import BaseService from '../BaseService.js';
//# sourceMappingURL=quotaService.d.ts.map