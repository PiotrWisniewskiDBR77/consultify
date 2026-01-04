export namespace AI_ROLES {
    let ADVISOR: string;
    let PMO_MANAGER: string;
    let EXECUTOR: string;
    let EDUCATOR: string;
}
export namespace CHAT_MODES {
    let EXPLAIN: string;
    let GUIDE: string;
    let ANALYZE: string;
    let DO: string;
    let TEACH: string;
}
export namespace AIOrchestrator {
    export { AI_ROLES };
    export { CHAT_MODES };
    export function _setDependencies(newDeps: any): void;
    export function processMessage(message: any, userId: any, organizationId: any, projectId?: null, options?: {}): Promise<{
        blocked: boolean;
        errorCode: string;
        message: string;
        role: string;
        intent: string;
        tokenBalance?: undefined;
        minRequired?: undefined;
        buyTokensUrl?: undefined;
        responseContext?: undefined;
        prompt?: undefined;
        policyAllows?: undefined;
        contextSummary?: undefined;
        explanation?: undefined;
        accessContext?: undefined;
    } | {
        blocked: boolean;
        errorCode: string;
        message: string;
        role: string;
        intent: string;
        tokenBalance: any;
        minRequired: number;
        buyTokensUrl: string;
        responseContext?: undefined;
        prompt?: undefined;
        policyAllows?: undefined;
        contextSummary?: undefined;
        explanation?: undefined;
        accessContext?: undefined;
    } | {
        responseContext: {
            id: string;
            role: string;
            intent: string;
            context: any;
            policy: any;
            preferences: any;
            projectMemory: any;
            dataSources: string[];
            confidenceLevel: null;
            explanation: null;
            aiGovernance: {
                activeRole: any;
                capabilities: any;
                roleDescription: any;
            };
            accessContext: {
                organizationType: any;
                isDemo: any;
                isTrial: any;
                isPaid: any;
                aiResponseBadge: any;
                dailyAIUsage: any;
            };
        };
        prompt: string;
        policyAllows: boolean;
        role: string;
        intent: string;
        contextSummary: string;
        explanation: null;
        accessContext: {
            organizationType: any;
            isDemo: any;
            isTrial: any;
            isPaid: any;
            aiResponseBadge: any;
            dailyAIUsage: any;
        };
        blocked?: undefined;
        errorCode?: undefined;
        message?: undefined;
        tokenBalance?: undefined;
        minRequired?: undefined;
        buyTokensUrl?: undefined;
    }>;
    export function _detectIntent(message: any): string;
    export function _selectRole(intent: any, policy: any): string;
    export function _buildPrompt(userMessage: any, responseContext: any, options?: {}): string;
    export function _identifyDataSources(context: any): string[];
    export function _summarizeContext(context: any): string;
    export function getRoleDescription(role: any): string;
    export function postProcessResponse(responseText: any, responseContext: any): Promise<any>;
    export function processMessageWithAgents(message: string, userId: string, organizationId: string, projectId?: string, options?: object): object;
    export function querySpecialistAgent(domain: string, message: string, userId: string, organizationId: string, projectId?: string): object;
    export function getMultiAgentRecommendations(topic: string, userId: string, organizationId: string, projectId?: string): object;
    export function getAvailableAgents(): Promise<any>;
    export function getAgentMetrics(): Promise<any>;
}
export default AIOrchestrator;
//# sourceMappingURL=aiOrchestrator.d.ts.map