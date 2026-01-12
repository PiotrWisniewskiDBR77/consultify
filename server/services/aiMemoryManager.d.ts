export namespace MEMORY_TYPES {
    let DECISION: string;
    let PHASE_TRANSITION: string;
    let RECOMMENDATION: string;
    let PATTERN: string;
}
export const MODEL_TOKEN_LIMITS: {
    'gpt-4': number;
    'gpt-4-turbo': number;
    'gpt-4o': number;
    'gpt-4o-mini': number;
    'gpt-3.5-turbo': number;
    'claude-3-opus': number;
    'claude-3-sonnet': number;
    'claude-3-haiku': number;
    default: number;
};
export namespace AIMemoryManager {
    export { MEMORY_TYPES };
    export function setDependencies(newDeps?: {}): void;
    export function createSession(): Promise<{
        conversationId: any;
        messages: never[];
        currentScreen: null;
        startedAt: string;
    }>;
    export function addMessage(session: any, role: any, content: any): any;
    export function recordProjectMemory(projectId: any, memoryType: any, content: any, userId: any): Promise<any>;
    export function recordDecision(projectId: any, decisionId: any, title: any, outcome: any, rationale: any, userId: any): Promise<any>;
    export function recordPhaseTransition(projectId: any, fromPhase: any, toPhase: any, reason: any, userId: any): Promise<any>;
    export function recordRecommendation(projectId: any, recommendation: any, accepted: any, userFeedback: any, userId: any): Promise<any>;
    export function getProjectMemory(projectId: any, memoryType?: null, limit?: number): Promise<any>;
    export function buildProjectMemorySummary(projectId: any): Promise<{
        projectId: any;
        majorDecisions: any;
        phaseTransitions: any;
        aiRecommendations: any;
        memoryCount: any;
    }>;
    export function calculateRelevance(content: string, query: string): number;
    export function getRelevantMemory(projectId: string, query: string, limit?: number, minRelevance?: number): any[];
    export function buildRelevantMemorySummary(projectId: string, query: string): object;
    export function getOrganizationMemory(organizationId: any): Promise<any>;
    export function updateOrganizationMemory(organizationId: any, updates: any): Promise<any>;
    export function addRecurringPattern(organizationId: any, pattern: any): Promise<any>;
    export function getUserPreferences(userId: any): Promise<any>;
    export function updateUserPreferences(userId: any, updates: any): Promise<any>;
    export function clearProjectMemory(projectId: any): Promise<any>;
    export function clearOrganizationMemory(organizationId: any): Promise<any>;
    export function cleanupOldMemory(projectId?: string, maxAgeDays?: number): object;
    export function cleanupPartialResponses(maxAgeHours?: number): object;
    export function cleanupOldFeedback(maxAgeDays?: number): object;
    export function getMemoryStats(): object;
    export function runCleanupCycle(): object;
    export function estimateTokens(text: string): number;
    export function getModelTokenLimit(modelName: string): number;
    export function trimMemory(memory: object, maxTokens: number): object;
    export function trimHistory(history: any[], maxTokens: number): any[];
    export function analyzeContextTokens(systemPrompt: string, userMessage: string, history: any[], memory: object, modelName?: string): object;
    export function autoTrimContext({ systemPrompt, userMessage, history, memory, modelName }: {
        systemPrompt: string;
        userMessage: string;
        history: any[];
        memory: object;
        modelName: string;
    }): object;
    export namespace DEFAULT_PERSONALIZATION {
        let responseLength: string;
        let technicalDepth: string;
        let communicationStyle: string;
        let preferredLanguage: string;
        let includeExamples: boolean;
        let includeCodeSnippets: boolean;
        let formatPreference: string;
        let educationMode: boolean;
        let actionOrientation: string;
    }
    export function getPersonalizationProfile(userId: string): Promise<object>;
    export function updatePersonalizationProfile(userId: string, preferences: object): Promise<any>;
    export function learnFromInteraction(userId: string, interaction: object): Promise<void>;
    export function buildPersonalizedPrompt(userId: string): Promise<string>;
    export function getPersonalizationAnalytics(userId: string): Promise<any>;
}
export default AIMemoryManager;
//# sourceMappingURL=aiMemoryManager.d.ts.map