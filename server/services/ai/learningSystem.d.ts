declare namespace _default {
    export { LearningSystem };
    export { learningSystem };
    export { CONFIG };
}
export default _default;
export class LearningSystem {
    static setDependencies(newDeps?: {}): void;
    config: {
        successThreshold: number;
        failureThreshold: number;
        minSamplesForPatterns: number;
        minConfidenceForInjection: number;
        extractionInterval: number;
        insightInterval: number;
        interactionRetentionDays: number;
        patternRetentionDays: number;
        qualityWeights: {
            qualityScore: number;
            latencyPenalty: number;
            lengthBonus: number;
            structureBonus: number;
        };
        minConfidenceForConsolidation: number;
    };
    extractionCounters: Map<any, any>;
    setDependencies(newDeps?: {}): void;
    /**
     * Record interaction with automatic feedback calculation
     * This is the primary method called by aiPipeline
     */
    recordWithAutoFeedback(interaction: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        autoFeedback: {
            score: number;
            reason: string;
            breakdown: {
                qualityScore: any;
                latency: any;
                responseLength: any;
            };
        };
    } | null>;
    /**
     * Legacy method for backward compatibility
     */
    recordInteraction(interaction: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        autoFeedback: {
            score: number;
            reason: string;
            breakdown: {
                qualityScore: any;
                latency: any;
                responseLength: any;
            };
        };
    } | null>;
    /**
     * Calculate automatic feedback score based on quality metrics
     */
    calculateAutoFeedback(qualityResult: any, metrics: any): {
        score: number;
        reason: string;
        breakdown: {
            qualityScore: any;
            latency: any;
            responseLength: any;
        };
    };
    /**
     * Enhanced pattern extraction with AI insights
     */
    _maybeExtractPatternsEnhanced(organizationId: any, requestType: any): Promise<void>;
    /**
     * Extract patterns for a specific organization and capability
     */
    extractPatternsForCapability(organizationId: any, requestType: any): Promise<{
        successful: any;
        failed: any;
        confidence: number;
    } | null>;
    /**
     * Extract all patterns for all organizations (for scheduler)
     */
    extractAllPatterns(): Promise<{
        jobId: `${string}-${string}-${string}-${string}-${string}`;
        recordsProcessed: number;
        patternsExtracted: number;
        duration: number;
    }>;
    /**
     * Generate AI-powered insights from patterns
     */
    _extractInsightsWithAI(organizationId: any, requestType: any): Promise<{
        insights: {
            type: string;
            message: string;
            confidence: any;
        }[];
        suggestions: {
            type: string;
            description: string;
        }[];
    } | null>;
    /**
     * Generate insights locally without LLM call (fast, deterministic)
     */
    _generateInsightsLocally(patterns: any, recentInteractions: any): {
        insights: {
            type: string;
            message: string;
            confidence: any;
        }[];
        suggestions: {
            type: string;
            description: string;
        }[];
    };
    /**
     * Store extracted patterns
     */
    storePatterns(organizationId: any, requestType: any, data: any): Promise<void>;
    /**
     * Get learned patterns for a capability
     */
    getPatterns(organizationId: any, requestType: any): Promise<{
        successful: never[];
        failed: never[];
        confidence: number;
        sampleCount?: undefined;
        insights?: undefined;
        suggestions?: undefined;
        updatedAt?: undefined;
    } | {
        successful: any;
        failed: any;
        sampleCount: any;
        confidence: any;
        insights: any;
        suggestions: any;
        updatedAt: any;
    }>;
    /**
     * Generate learning context to inject into prompts
     * This is called by promptAssembler
     */
    getLearningContextForPrompt(organizationId: any, capability: any): Promise<{
        content: string;
        confidence: any;
        patternCount: any;
        sampleCount: any;
    } | null>;
    /**
     * Legacy method for backward compatibility
     */
    applyLearning(prompt: any, organizationId: any, requestType: any): Promise<any>;
    /**
     * Consolidate learnings across organizations into global strategies
     * Called by scheduler
     */
    consolidateLearnings(): Promise<{
        jobId: `${string}-${string}-${string}-${string}-${string}`;
        strategiesCreated: number;
        duration?: undefined;
    } | {
        jobId: `${string}-${string}-${string}-${string}-${string}`;
        strategiesCreated: number;
        duration: number;
    }>;
    /**
     * Create or update a global strategy
     */
    _createGlobalStrategy(data: any): Promise<void>;
    /**
     * Cleanup old learning data
     * Called by scheduler
     */
    cleanupOldData(): Promise<{
        jobId: `${string}-${string}-${string}-${string}-${string}`;
        deleted: any;
        duration: number;
    }>;
    /**
     * Get comprehensive learning analytics
     */
    getAnalytics(organizationId?: null): Promise<{
        totalInteractions: any;
        averageFeedback: number;
        averageQuality: number;
        averageAutoFeedback: number;
        organizationCount: any;
        capabilityCount: any;
        averageLatency: number;
        totalTokens: any;
        patterns: {
            total: any;
            avgConfidence: number;
            avgSamples: number;
        };
        topCapabilities: any;
        recentJobs: any;
        trend: any;
        error?: undefined;
    } | {
        totalInteractions: number;
        averageQuality: number;
        error: any;
        averageFeedback?: undefined;
        averageAutoFeedback?: undefined;
        organizationCount?: undefined;
        capabilityCount?: undefined;
        averageLatency?: undefined;
        totalTokens?: undefined;
        patterns?: undefined;
        topCapabilities?: undefined;
        recentJobs?: undefined;
        trend?: undefined;
    }>;
    /**
     * Get job history
     */
    getJobHistory(limit?: number): Promise<any>;
    /**
     * Generate prompt refinement suggestions
     */
    getPromptSuggestions(organizationId: any, requestType: any): Promise<{
        suggestions: never[];
        message: string;
        patterns?: undefined;
        improvementPotential?: undefined;
        confidence?: undefined;
    } | {
        suggestions: ({
            type: string;
            priority: string;
            description: string;
            recommendation: string;
            patterns: any;
        } | {
            type: any;
            priority: string;
            description: any;
            recommendation: any;
            patterns?: undefined;
        })[];
        patterns: {
            successful: never[];
            failed: never[];
            confidence: number;
            sampleCount?: undefined;
            insights?: undefined;
            suggestions?: undefined;
            updatedAt?: undefined;
        } | {
            successful: any;
            failed: any;
            sampleCount: any;
            confidence: any;
            insights: any;
            suggestions: any;
            updatedAt: any;
        };
        improvementPotential: number;
        confidence: any;
        message?: undefined;
    }>;
    /**
     * Hash prompt for pattern matching
     */
    hashPrompt(prompt: any): string;
    /**
     * Extract a signature from prompt (first 100 chars, normalized)
     */
    extractPromptSignature(prompt: any): any;
    /**
     * Extract a signature from response (structure indicators)
     */
    extractResponseSignature(response: any): string;
    _runQuery(sql: any, params?: any[]): Promise<any>;
    _getOne(sql: any, params?: any[]): Promise<any>;
    _getAll(sql: any, params?: any[]): Promise<any>;
}
export const learningSystem: LearningSystem;
export namespace CONFIG {
    let successThreshold: number;
    let failureThreshold: number;
    let minSamplesForPatterns: number;
    let minConfidenceForInjection: number;
    let extractionInterval: number;
    let insightInterval: number;
    let interactionRetentionDays: number;
    let patternRetentionDays: number;
    namespace qualityWeights {
        let qualityScore: number;
        let latencyPenalty: number;
        let lengthBonus: number;
        let structureBonus: number;
    }
    let minConfidenceForConsolidation: number;
}
//# sourceMappingURL=learningSystem.d.ts.map