declare namespace _default {
    export { EnhancedContextBuilder };
    export { enhancedContextBuilder };
    export { PHASE_CONTEXT_PRIORITIES };
    export { MAX_TOKENS_PER_LAYER };
}
export default _default;
export class EnhancedContextBuilder {
    constructor(dependencies?: {});
    contextCache: Map<any, any>;
    cacheMaxAge: number;
    memoryManager: any;
    intelligentResearch: any;
    projectMemoryStore: any;
    ragService: any;
    knowledgeIndexer: any;
    /**
     * Build comprehensive context from all layers
     * @param {Object} params - Build parameters
     * @returns {Object} Merged context with metadata
     */
    build(params: Object): Object;
    /**
     * Get session context (current conversation)
     */
    getSessionContext(conversationId: any, userId: any): Promise<{
        history: any;
        currentTopics: any;
        preferences: {};
    }>;
    /**
     * Get project context
     */
    getProjectContext(projectId: any): Promise<{
        memories: any;
        assessment: {};
        initiatives: any[];
        roadmap: {};
        summary: string;
    } | null>;
    /**
     * Get organization context
     */
    getOrganizationContext(organizationId: any): Promise<{
        profile: any;
        preferences: any;
        industry: any;
        size: any;
        strategicGoals: any;
        previousProjects: any;
    } | null>;
    /**
     * Get knowledge base context
     */
    getKnowledgeContext(query: any, topic: any, organizationId: any): Promise<{
        ragResults: any;
        indexedKnowledge: any;
        totalMatches: any;
    }>;
    /**
     * Get external/web research context
     */
    getExternalContext(query: any, options?: {}): Promise<{
        content: string;
        sources: never[];
        needed: any;
        insights?: undefined;
        queries?: undefined;
    } | {
        content: any;
        insights: any;
        sources: any;
        queries: any;
        needed: boolean;
    }>;
    /**
     * Merge contexts from all layers with priorities
     */
    mergeContexts(contexts: any, priorities: any, maxTokens: any): Promise<{
        narrative: string;
        sessionHistory: any;
        projectData: any;
        orgData: any;
        assessmentData: any;
        initiativesData: any;
        knowledgeMatches: any;
        externalResearch: any;
        contributions: {
            session: number;
            project: number;
            organization: number;
            knowledge: number;
            external: number;
        };
        totalTokens: number;
    }>;
    formatSessionContext(session: any): string;
    formatProjectContext(project: any): string;
    formatOrganizationContext(org: any): string;
    formatKnowledgeContext(knowledge: any): string;
    formatExternalContext(external: any): string;
    extractValue(settledPromise: any): any;
    estimateTokens(text: any): number;
    truncateToTokens(text: any, maxTokens: any): any;
    getUserPreferences(userId: any): Promise<{}>;
    getProjectAssessment(projectId: any): Promise<{}>;
    getProjectInitiatives(projectId: any): Promise<never[]>;
    getProjectRoadmap(projectId: any): Promise<{}>;
    summarizeProject(projectId: any): Promise<string>;
    getCached(key: any): any;
    setCache(key: any, data: any): void;
    clearCache(): void;
}
export const enhancedContextBuilder: EnhancedContextBuilder;
export namespace PHASE_CONTEXT_PRIORITIES {
    namespace discovery {
        let organization: number;
        let project: number;
        let session: number;
        let knowledge: number;
        let external: number;
    }
    namespace assessment {
        let project_1: number;
        export { project_1 as project };
        let organization_1: number;
        export { organization_1 as organization };
        let knowledge_1: number;
        export { knowledge_1 as knowledge };
        let session_1: number;
        export { session_1 as session };
        let external_1: number;
        export { external_1 as external };
    }
    namespace initiatives {
        let project_2: number;
        export { project_2 as project };
        let knowledge_2: number;
        export { knowledge_2 as knowledge };
        let external_2: number;
        export { external_2 as external };
        let session_2: number;
        export { session_2 as session };
        let organization_2: number;
        export { organization_2 as organization };
    }
    namespace roadmap {
        let project_3: number;
        export { project_3 as project };
        let session_3: number;
        export { session_3 as session };
        let knowledge_3: number;
        export { knowledge_3 as knowledge };
        let organization_3: number;
        export { organization_3 as organization };
        let external_3: number;
        export { external_3 as external };
    }
    namespace execution {
        let project_4: number;
        export { project_4 as project };
        let session_4: number;
        export { session_4 as session };
        let knowledge_4: number;
        export { knowledge_4 as knowledge };
        let external_4: number;
        export { external_4 as external };
        let organization_4: number;
        export { organization_4 as organization };
    }
}
export namespace MAX_TOKENS_PER_LAYER {
    let session_5: number;
    export { session_5 as session };
    let project_5: number;
    export { project_5 as project };
    let organization_5: number;
    export { organization_5 as organization };
    let knowledge_5: number;
    export { knowledge_5 as knowledge };
    let external_5: number;
    export { external_5 as external };
}
//# sourceMappingURL=enhancedContextBuilder.d.ts.map