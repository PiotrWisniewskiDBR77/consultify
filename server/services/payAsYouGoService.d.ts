declare namespace _default {
    export { setDependencies };
    export { recordUsage };
    export { getCurrentPeriodUsage };
    export { generatePayAsYouGoInvoice };
    export { calculateUsageCost };
    export { checkPayAsYouGoLimits };
    export { getPayAsYouGoForecast };
}
export default _default;
/**
 * Set dependencies for testing
 */
export function setDependencies(newDeps: any): void;
/**
 * Record usage for PAYG billing
 */
export function recordUsage(orgId: any, usageType: any, quantity: any, unitPrice: any, metadata?: {}, userId?: null, projectId?: null): Promise<any>;
/**
 * Get current period usage
 */
export function getCurrentPeriodUsage(orgId: any, periodStart?: null, periodEnd?: null): Promise<any>;
/**
 * Generate PAYG invoice (mark usage as invoiced)
 */
export function generatePayAsYouGoInvoice(orgId: any, periodStart: any, periodEnd: any): Promise<any>;
/**
 * Calculate usage cost
 */
export function calculateUsageCost(orgId: any, usageType: any, quantity: any): Promise<any>;
/**
 * Check PAYG limits before usage
 */
export function checkPayAsYouGoLimits(orgId: any, usageType: any, quantity: any): Promise<any>;
/**
 * Get PAYG forecast (projected costs for current period)
 */
export function getPayAsYouGoForecast(orgId: any): Promise<any>;
//# sourceMappingURL=payAsYouGoService.d.ts.map