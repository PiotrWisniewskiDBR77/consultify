export default AICostControlService;
declare namespace AICostControlService {
    export { MODEL_CATEGORIES };
    export { ROLE_TO_CATEGORY };
    export { ACTION_TO_CATEGORY };
    export function setDependencies(newDeps?: {}): void;
    export function setGlobalBudget(monthlyLimitUsd: any, autoDowngrade?: boolean): Promise<any>;
    export function setTenantBudget(organizationId: any, monthlyLimitUsd: any, autoDowngrade?: boolean): Promise<any>;
    export function setProjectBudget(projectId: any, monthlyLimitUsd: any, autoDowngrade?: boolean): Promise<any>;
    export function getBudget(scopeType: any, scopeId?: null): Promise<any>;
    export function checkBudget(organizationId: any, projectId?: null, estimatedCost?: number): Promise<{
        allowed: boolean;
        remainingBudget: null;
        shouldDowngrade: boolean;
        currentUsage: number;
        limit: null;
        isFrozen: boolean;
        restrictingScope?: undefined;
        reason?: undefined;
        percentUsed?: undefined;
    } | {
        allowed: boolean;
        remainingBudget: number;
        shouldDowngrade: boolean;
        currentUsage: any;
        limit: any;
        restrictingScope: any;
        isFrozen: boolean;
        reason: string;
        percentUsed?: undefined;
    } | {
        allowed: boolean;
        remainingBudget: number;
        shouldDowngrade: boolean;
        currentUsage: any;
        limit: any;
        restrictingScope: any;
        percentUsed: number;
        isFrozen: boolean;
        reason?: undefined;
    }>;
    export function estimateCost(modelId: any, inputTokens: any, outputTokens?: number): number;
    export function logUsage({ organizationId, projectId, userId, modelUsed, modelCategory, actionType, inputTokens, outputTokens, wasDowngraded, downgradeReason }: {
        organizationId: any;
        projectId: any;
        userId: any;
        modelUsed: any;
        modelCategory: any;
        actionType: any;
        inputTokens: any;
        outputTokens: any;
        wasDowngraded?: boolean | undefined;
        downgradeReason?: null | undefined;
    }): Promise<any>;
    export function _updateBudgetUsage(organizationId: any, projectId: any, cost: any): Promise<any>;
    export function resetMonthlyUsage(scopeType?: null): Promise<any>;
    export function getCategoryForAction(actionType: any, aiRole?: null): any;
    export function getTierForBudget(budgetStatus: any, preferredCategory: any): number;
    export function getUsageSummary(organizationId: any, startDate?: null, endDate?: null): Promise<any>;
    export function getUserUsage(userId: any, organizationId: any, days?: number): Promise<any>;
    export function getAllBudgets(): Promise<any>;
}
declare namespace MODEL_CATEGORIES {
    let REASONING: string;
    let EXECUTION: string;
    let CHAT: string;
    let SUMMARIZATION: string;
}
declare namespace ROLE_TO_CATEGORY {
    import ADVISOR = MODEL_CATEGORIES.CHAT;
    export { ADVISOR };
    import PMO_MANAGER = MODEL_CATEGORIES.REASONING;
    export { PMO_MANAGER };
    import EXECUTOR = MODEL_CATEGORIES.EXECUTION;
    export { EXECUTOR };
    import EDUCATOR = MODEL_CATEGORIES.CHAT;
    export { EDUCATOR };
}
declare namespace ACTION_TO_CATEGORY {
    import chat = MODEL_CATEGORIES.CHAT;
    export { chat };
    import analysis = MODEL_CATEGORIES.REASONING;
    export { analysis };
    import deep_diagnose = MODEL_CATEGORIES.REASONING;
    export { deep_diagnose };
    import generation = MODEL_CATEGORIES.EXECUTION;
    export { generation };
    import task_insight = MODEL_CATEGORIES.EXECUTION;
    export { task_insight };
    import report = MODEL_CATEGORIES.SUMMARIZATION;
    export { report };
    import executive_summary = MODEL_CATEGORIES.SUMMARIZATION;
    export { executive_summary };
}
//# sourceMappingURL=aiCostControlService.d.ts.map