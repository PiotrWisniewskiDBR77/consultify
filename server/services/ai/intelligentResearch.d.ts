declare namespace _default {
    export { IntelligentResearch };
    export { intelligentResearch };
    export { QUERY_TEMPLATES };
    export { CONTEXT_RESEARCH_MAP };
}
export default _default;
export class IntelligentResearch {
    webResearch: import("./webResearchService.js").WebResearchService;
    queryCache: Map<any, any>;
    maxCacheSize: number;
    /**
     * Generate intelligent research queries based on context
     * @param {Object} context - Full conversation context
     * @returns {Array} Array of optimized search queries
     */
    generateQueries(context: Object): any[];
    /**
     * Perform intelligent research based on context
     * @param {Object} context - Conversation context
     * @returns {Object} Research results with synthesis
     */
    research(context: Object): Object;
    /**
     * Deep research for complex questions
     * @param {string} question - Complex question requiring deep research
     * @param {Object} context - Context information
     */
    deepResearch(question: string, context?: Object): Promise<{
        originalQuestion: string;
        subQuestions: any[];
        subResults: {
            constructor: Function;
            toString(): string;
            toLocaleString(): string;
            valueOf(): Object;
            hasOwnProperty(v: PropertyKey): boolean;
            isPrototypeOf(v: Object): boolean;
            propertyIsEnumerable(v: PropertyKey): boolean;
            question: any;
        }[];
        crossReferences: {
            commonThemes: any[];
            convergingInsights: {
                theme: any;
                count: any;
            }[];
        };
        synthesis: string | {
            executiveSummary: string;
            keyFindings: any;
            convergingThemes: any;
            recommendedActions: string[];
            confidenceLevel: number;
        };
        depth: any;
        totalSources: number;
        timestamp: string;
    }>;
    /**
     * Real-time research support for conversation
     * @param {Object} message - Current message being processed
     * @param {Object} conversationState - Full conversation state
     */
    supportConversation(message: Object, conversationState: Object): Promise<any>;
    determineResearchTypes(intent: any, phase: any): any[];
    selectTemplate(templates: any, context: any): any;
    fillTemplate(template: any, variables: any): any;
    enhanceQuery(query: any, enhancers: any, context: any): string;
    getRelevantMetric(axisId: any, context: any): any;
    extractInitiative(message: any): any;
    extractTechnology(message: any): string;
    getCompanyType(orgContext: any): "SME" | "large enterprise" | "mid-size company" | "company";
    getIndustryLeader(industry: any): any;
    getRelevantFramework(axisId: any): any;
    calculatePriority(researchType: any, context: any): any;
    priorityOrder(priority: any): any;
    gapToQuery(gap: any, context: any): string;
    executeQuery(queryObj: any): Promise<any>;
    cleanCache(): void;
    synthesizeForConsulting(results: any, context: any): Promise<{
        summary: string;
        keyInsights: never[];
        recommendations: never[];
        sourceQuality?: undefined;
        citations?: undefined;
    } | {
        summary: string;
        keyInsights: {
            type: string;
            value: any;
            source: any;
        }[];
        recommendations: string[];
        sourceQuality: {
            totalSources: any;
            hasCredibleSources: any;
            quality: string;
        };
        citations: any[] | never[];
    }>;
    extractKeyInsights(results: any): {
        type: string;
        value: any;
        source: any;
    }[];
    generateRecommendations(results: any, context: any): string[];
    assessSourceQuality(results: any): {
        totalSources: any;
        hasCredibleSources: any;
        quality: string;
    };
    collectCitations(results: any): any[];
    decomposeQuestion(question: any): {
        text: any;
        intent: string;
    }[];
    crossReference(subResults: any, context: any): Promise<{
        commonThemes: any[];
        convergingInsights: {
            theme: any;
            count: any;
        }[];
    }>;
    createDeepSynthesis(question: any, subResults: any, crossRefs: any, context: any): Promise<"Insufficient research data for comprehensive synthesis." | {
        executiveSummary: string;
        keyFindings: any;
        convergingThemes: any;
        recommendedActions: string[];
        confidenceLevel: number;
    }>;
    generateStrategicRecommendations(results: any, context: any): string[];
    countUniqueSources(results: any): number;
    detectResearchNeed(message: any, state: any): boolean;
}
export const intelligentResearch: IntelligentResearch;
export namespace QUERY_TEMPLATES {
    namespace benchmark {
        let templates: string[];
        let enhancers: string[];
    }
    namespace caseStudy {
        let templates_1: string[];
        export { templates_1 as templates };
        let enhancers_1: string[];
        export { enhancers_1 as enhancers };
    }
    namespace bestPractice {
        let templates_2: string[];
        export { templates_2 as templates };
        let enhancers_2: string[];
        export { enhancers_2 as enhancers };
    }
    namespace trend {
        let templates_3: string[];
        export { templates_3 as templates };
        let enhancers_3: string[];
        export { enhancers_3 as enhancers };
    }
    namespace competitive {
        let templates_4: string[];
        export { templates_4 as templates };
        let enhancers_4: string[];
        export { enhancers_4 as enhancers };
    }
    namespace risk {
        let templates_5: string[];
        export { templates_5 as templates };
        let enhancers_5: string[];
        export { enhancers_5 as enhancers };
    }
    namespace roi {
        let templates_6: string[];
        export { templates_6 as templates };
        let enhancers_6: string[];
        export { enhancers_6 as enhancers };
    }
}
export namespace CONTEXT_RESEARCH_MAP {
    let discovery: string[];
    let assessment: string[];
    let initiatives: string[];
    let roadmap: string[];
    let execution: string[];
    let compare: string[];
    let understand: string[];
    let decide: string[];
    let implement: string[];
    let validate: string[];
}
//# sourceMappingURL=intelligentResearch.d.ts.map