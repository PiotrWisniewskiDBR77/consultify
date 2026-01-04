export default aIBudgetServiceInstance;
declare const aIBudgetServiceInstance: AIBudgetService;
declare class AIBudgetService {
    /**
     * Create a new budget
     */
    createBudget(organizationId: any, budgetData: any): Promise<any>;
    /**
     * Get budgets for an organization
     */
    getOrganizationBudgets(organizationId: any, includeUserBudgets?: boolean): Promise<any>;
    /**
     * Get a specific budget
     */
    getBudget(budgetId: any): Promise<any>;
    /**
     * Update a budget
     */
    updateBudget(budgetId: any, updates: any): Promise<any>;
    /**
     * Delete a budget
     */
    deleteBudget(budgetId: any): Promise<any>;
    /**
     * Record AI usage and check against budget
     */
    recordUsage(organizationId: any, userId: any, usage: any): Promise<{
        recorded: boolean;
        cost: number;
        tokens: any;
        alerts: never[];
        blocked: boolean;
    }>;
    /**
     * Get applicable budgets for a user
     */
    getApplicableBudgets(organizationId: any, userId: any): Promise<any>;
    /**
     * Update budget current usage
     */
    updateBudgetUsage(budgetId: any, newUsage: any): Promise<any>;
    /**
     * Check if user can make AI request
     */
    checkBudget(organizationId: any, userId: any, estimatedUsage: any): Promise<{
        allowed: boolean;
        reason: string;
        budget: {
            type: any;
            limit: any;
            current: any;
            remaining: number;
        };
    } | {
        allowed: boolean;
        reason?: undefined;
        budget?: undefined;
    }>;
    /**
     * Reset budget usage (called by scheduler)
     */
    resetBudgetUsage(budgetId: any): Promise<any>;
    /**
     * Create a spending alert
     */
    createAlert(organizationId: any, userId: any, budgetId: any, alertData: any): Promise<any>;
    /**
     * Get alerts for an organization
     */
    getAlerts(organizationId: any, options?: {}): Promise<any>;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: any, userId: any): Promise<any>;
    /**
     * Dismiss an alert
     */
    dismissAlert(alertId: any): Promise<any>;
    /**
     * Set model permissions
     */
    setModelPermission(organizationId: any, permissionData: any): Promise<any>;
    /**
     * Get model permissions for organization
     */
    getModelPermissions(organizationId: any, scopeType?: null, scopeId?: null): Promise<any>;
    /**
     * Check if user can use a specific model
     */
    checkModelAccess(organizationId: any, userId: any, userRole: any, modelId: any): Promise<{
        allowed: boolean;
        reason?: undefined;
        maxTokensPerRequest?: undefined;
        dailyTokenLimit?: undefined;
    } | {
        allowed: boolean;
        reason: string;
        maxTokensPerRequest?: undefined;
        dailyTokenLimit?: undefined;
    } | {
        allowed: boolean;
        maxTokensPerRequest: any;
        dailyTokenLimit: any;
        reason?: undefined;
    }>;
    /**
     * Delete model permission
     */
    deleteModelPermission(permissionId: any): Promise<any>;
    /**
     * Get usage statistics for an organization
     */
    getUsageStats(organizationId: any, options?: {}): Promise<{
        budgets: any;
        totalBudgets: any;
        alertCount: number;
    }>;
    /**
     * Get model cost estimates
     */
    getModelCosts(): {
        'gpt-4': {
            input: number;
            output: number;
        };
        'gpt-4-turbo': {
            input: number;
            output: number;
        };
        'gpt-4o': {
            input: number;
            output: number;
        };
        'gpt-4o-mini': {
            input: number;
            output: number;
        };
        'gpt-3.5-turbo': {
            input: number;
            output: number;
        };
        'claude-3-opus': {
            input: number;
            output: number;
        };
        'claude-3-sonnet': {
            input: number;
            output: number;
        };
        'claude-3-haiku': {
            input: number;
            output: number;
        };
        'claude-3.5-sonnet': {
            input: number;
            output: number;
        };
        'gemini-pro': {
            input: number;
            output: number;
        };
        'gemini-pro-vision': {
            input: number;
            output: number;
        };
    };
    /**
     * Estimate cost for a request
     */
    estimateCost(model: any, inputTokens: any, outputTokens: any): number;
}
//# sourceMappingURL=aiBudgetService.d.ts.map