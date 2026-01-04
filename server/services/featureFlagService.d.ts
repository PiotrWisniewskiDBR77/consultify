export default featureFlagServiceInstance;
declare const featureFlagServiceInstance: FeatureFlagService;
declare class FeatureFlagService {
    cache: {};
    cacheTTL: number;
    lastFetch: number;
    refreshCache(): Promise<any>;
    /**
     * Get all feature flags
     */
    getFlags(filters?: {}): Promise<any>;
    /**
     * Get feature flag by ID
     */
    getFlagById(id: any): Promise<any>;
    /**
     * Get feature flag by key
     */
    getFlagByKey(key: any, environment?: string): Promise<any>;
    /**
     * Create a feature flag
     */
    createFlag(flagData: any): Promise<any>;
    /**
     * Update a feature flag
     */
    updateFlag(id: any, updates: any): Promise<any>;
    /**
     * Delete a feature flag
     */
    deleteFlag(id: any, deletedBy: any): Promise<any>;
    /**
     * Toggle a feature flag
     */
    toggleFlag(id: any, enabled: any, updatedBy: any): Promise<any>;
    /**
     * Record flag history
     */
    recordHistory(flagId: any, changeType: any, oldValue: any, newValue: any, changedBy: any): Promise<any>;
    /**
     * Get flag history
     */
    getFlagHistory(flagId: any, limit?: number): Promise<any>;
    /**
     * Evaluate a flag for a specific context
     * @param {string} key - Flag key e.g. 'new_ai_dashboard'
     * @param {object} context - { userId, orgId, email, role }
     */
    isEnabled(key: string, context?: object, environment?: string): Promise<boolean>;
    evaluateRule(rule: any, context: any): any;
    simpleHash(str: any): number;
}
//# sourceMappingURL=featureFlagService.d.ts.map