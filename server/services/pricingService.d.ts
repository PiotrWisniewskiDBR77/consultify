declare namespace _default {
    export { setDependencies };
    export { loadLegalMetadata };
    export { getPlans };
    export { getPlanById };
    export { getTrialConfig };
    export { getCurrency };
    export { getCompanyInfo };
    export { getContactEmails };
    export { getDocuments };
    export { getDocumentByType };
    export { getComplianceInfo };
    export { getFullMetadata };
    export { formatPlanForApi };
    export { getFormattedPlans };
    export { getPricingPageData };
    export { syncPricingToDatabase };
    export { clearCache };
}
export default _default;
/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps?: {}): void;
/**
 * Load legal metadata from file
 */
export function loadLegalMetadata(): any;
/**
 * Get all subscription plans from legal-metadata.json
 */
export function getPlans(): any;
/**
 * Get a specific plan by ID
 */
export function getPlanById(planId: any): any;
/**
 * Get trial configuration
 */
export function getTrialConfig(): any;
/**
 * Get currency configuration
 */
export function getCurrency(): any;
/**
 * Get company information
 */
export function getCompanyInfo(): any;
/**
 * Get contact emails
 */
export function getContactEmails(): any;
/**
 * Get document metadata
 */
export function getDocuments(): any;
/**
 * Get document by type
 */
export function getDocumentByType(docType: any): any;
/**
 * Get compliance information
 */
export function getComplianceInfo(): any;
/**
 * Get full metadata
 */
export function getFullMetadata(): any;
/**
 * Format plan for API response
 */
export function formatPlanForApi(plan: any): {
    id: any;
    name: any;
    description: any;
    annualPrice: any;
    monthlyPrice: any;
    monthlyPriceNote: any;
    currency: any;
    seatsIncluded: any;
    aiCreditsMonthly: any;
    extraSeatPrice: any;
    overagePrice: any;
    byokEnabled: any;
    byokPrice: any;
    workspaces: any;
    supportSla: any;
    features: any;
};
/**
 * Get all formatted plans for API
 */
export function getFormattedPlans(): any;
/**
 * Get pricing page data (for public display)
 */
export function getPricingPageData(): {
    currency: any;
    plans: any;
    trial: {
        durationDays: any;
        creditCardRequired: any;
        features: string;
    };
    companyName: any;
    links: {
        terms: string;
        privacy: string;
        subscription: string;
        refunds: string;
        sla: string;
    };
};
/**
 * Sync pricing to database (for billing operations)
 * Updates subscription_plans table with data from legal-metadata.json
 */
export function syncPricingToDatabase(): Promise<({
    id: any;
    action: string;
    error?: undefined;
} | {
    id: any;
    action: string;
    error: any;
})[]>;
/**
 * Clear pricing cache
 */
export function clearCache(): void;
//# sourceMappingURL=pricingService.d.ts.map