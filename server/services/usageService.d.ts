declare namespace _default {
    export { recordTokenUsage };
    export { recordStorageUsage };
    export { getCurrentUsage };
    export { checkQuota };
    export { calculateOverage };
    export { updateUsageSummary };
    export { getUsageHistory };
    export { getGlobalUsageStats };
    export { recordProjectStorageUsage };
    export { checkProjectQuota };
    export { setDependencies };
    export { getOperationalCosts };
}
export default _default;
/**
 * Record token usage
 */
export function recordTokenUsage(orgId: any, userId: any, tokens: any, action: any, metadata?: {}): Promise<any>;
/**
 * Record storage usage
 */
export function recordStorageUsage(orgId: any, bytes: any, action: any, metadata?: {}): Promise<any>;
/**
 * Get current period usage for an organization
 */
/**
 * Get current period usage for an organization
 */
export function getCurrentUsage(orgId: any): Promise<any>;
/**
 * Check if organization has quota for a specific action
 * Returns: { allowed: boolean, remaining: number, overageEnabled: boolean }
 */
export function checkQuota(orgId: any, type?: string): Promise<{
    allowed: boolean;
    used: any;
    limit: any;
    remaining: any;
    percentage: any;
    overageEnabled: boolean;
    overageRate: any;
}>;
/**
 * Calculate overage charges for a billing period
 */
export function calculateOverage(orgId: any, periodStart: any, periodEnd: any): Promise<any>;
/**
 * Create or update monthly usage summary
 */
export function updateUsageSummary(orgId: any, periodStart: any): Promise<any>;
/**
 * Get usage history for organization
 */
export function getUsageHistory(orgId: any, limit?: number): Promise<any>;
/**
 * Get global usage statistics (Superadmin)
 */
export function getGlobalUsageStats(): Promise<any>;
/**
 * Record project-level storage usage
 */
export function recordProjectStorageUsage(projectId: any, bytes: any, action: any): Promise<any>;
/**
 * Check if project has storage quota
 * Returns: { allowed: boolean, remaining: number }
 */
export function checkProjectQuota(projectId: any): Promise<any>;
/**
 * Set dependencies for testing
 */
export function setDependencies(newDeps: any): void;
/**
 * Get operational costs grouped by Provider/Model
 */
export function getOperationalCosts(startDate: any, endDate: any): Promise<any>;
//# sourceMappingURL=usageService.d.ts.map