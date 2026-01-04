export default aiPipeline;
export class AIPipeline extends BaseService {
    constructor(dependencies?: {});
    gateway: AIGateway;
    contextBuilder: import("./enhancedContextBuilder.js").EnhancedContextBuilder;
    promptAssembler: PromptAssembler;
    modelRouter: ModelRouter;
    llmService: any;
    memoryManager: any;
    quotaService: any;
    enterpriseSecurity: any;
    qualityChecker: any;
    performanceOptimizer: any;
    learningSystem: any;
    cacheService: any;
    ragService: {
        setDependencies: (newDeps?: {}) => void;
        generateEmbedding: (text: any) => Promise<any>;
        getContext: (query: string, limit?: number, filterOptions?: Object) => Promise<any>;
        getContextKeyword: (query: any, limit?: number, organizationId?: null) => Promise<any>;
        storeChunks: (docId: any, chunks: any) => Promise<void>;
        getAxisDefinitions: (axisName: any) => Promise<any>;
        searchRelevantChunks: (query: string, options?: Object) => Promise<any>;
        ingestDocument: (params: Object) => Promise<{
            documentId: any;
            totalChunks: any;
            embeddedChunks: number;
            success: boolean;
        }>;
        bm25Search: (query: string, limit?: number, organizationId?: string) => Promise<any[]>;
        hybridSearch: (query: string, options?: Object) => Promise<any[]>;
        _vectorSearch: (query: any, limit: any, organizationId: any) => Promise<any>;
        _logSearchMetrics: (query: any, organizationId: any, metrics: any) => Promise<void>;
        getContextHybrid: (query: string, options?: Object) => Promise<{
            context: string;
            sources: {
                filename: any;
                score: any;
                method: any;
                breakdown: any;
            }[];
            metrics: {
                totalResults: number;
                topScore: any;
                method: string;
            };
        }>;
    } | null;
    settingsService: any;
    initDeps(): Promise<void>;
    /**
     * Safe wrapper for rate limit check - fails open (allows) on error
     */
    safeCheckRateLimit(organizationId: any, capability: any): Promise<any>;
    /**
     * Safe wrapper for quota check - fails open (allows) on error
     */
    safeCheckQuota(userId: any, organizationId: any, projectId: any): Promise<any>;
    /**
     * Safe wrapper for quality check - fails open (passes) on error
     */
    safeQualityCheck(response: any, context: any, options: any): Promise<any>;
    /**
     * Safe wrapper for gateway processing - continues on non-critical errors
     */
    safeGatewayProcess(request: any): Promise<{
        success: boolean;
        warning?: undefined;
    } | {
        success: boolean;
        warning: any;
    }>;
    /**
     * Safe wrapper for audit logging - non-blocking
     */
    safeLogAudit(auditData: any): void;
    /**
     * Safe wrapper for learning system - non-blocking
     * @deprecated Use safeRecordLearningEnhanced instead
     */
    safeRecordLearning(data: any): void;
    /**
     * Enhanced learning system wrapper with quality-based auto-feedback
     * Records interaction with quality scores for pattern extraction
     */
    safeRecordLearningEnhanced(data: any): void;
    /**
     * Safe wrapper for performance metrics - non-blocking
     */
    safeRecordPerformance(traceId: any, metrics: any): void;
    process(request: any, onProgress?: null): Promise<any>;
    /**
     * Determine fallback model for a given model ID using fallback chain
     * @param {string} modelId - Current model that failed
     * @param {Array} excludeModels - Models already tried (to skip)
     * @param {string} tier - Model tier for selecting appropriate chain
     */
    getFallbackModel(modelId: string, excludeModels?: any[], tier?: string): any;
    /**
     * Execute LLM call with automatic multi-provider fallback
     * @param {Object} params - LLM call parameters
     * @param {Object} modelConfig - Initial model configuration
     * @param {number} maxRetries - Maximum retry attempts
     */
    executeWithFallback(params: Object, modelConfig: Object, maxRetries?: number): Promise<{
        response: any;
        modelConfig: Object;
        attempts: number;
    }>;
    /**
     * Check if error should not trigger retry
     */
    isNonRetryableError(error: any): boolean;
    /**
     * Create a hash of the screen context for audit purposes
     * (Don't store full context to avoid data retention issues)
     */
    hashContext(context: any): string;
    /**
     * Log AI request to audit table (with cost tracking)
     */
    logAudit(data: any): Promise<void>;
    /**
     * Get available tools for the pipeline
     */
    getAvailableTools(): {
        name: any;
        description: any;
        parameters: {
            type: string;
            properties: {};
            required?: undefined;
            additionalProperties?: undefined;
        } | {
            type: string;
            properties: {};
            required: string[];
            additionalProperties: boolean;
        };
    }[];
    /**
     * Record interaction to memory asynchronously (non-blocking)
     * @private
     */
    private _recordToMemoryAsync;
    /**
     * Calculate significance score for memory recording
     * @private
     */
    private _calculateSignificance;
}
export const aiPipeline: AIPipeline;
export namespace CAPABILITY_REGISTRY {
    namespace diagnose {
        let role: string;
        let maxTokens: number;
        let description: string;
        let outputFormat: string;
    }
    namespace deepDiagnose {
        let role_1: string;
        export { role_1 as role };
        let maxTokens_1: number;
        export { maxTokens_1 as maxTokens };
        let description_1: string;
        export { description_1 as description };
        let outputFormat_1: string;
        export { outputFormat_1 as outputFormat };
    }
    namespace generateList {
        let role_2: string;
        export { role_2 as role };
        let maxTokens_2: number;
        export { maxTokens_2 as maxTokens };
        let description_2: string;
        export { description_2 as description };
        let outputFormat_2: string;
        export { outputFormat_2 as outputFormat };
    }
    namespace generateTable {
        let role_3: string;
        export { role_3 as role };
        let maxTokens_3: number;
        export { maxTokens_3 as maxTokens };
        let description_3: string;
        export { description_3 as description };
        let outputFormat_3: string;
        export { outputFormat_3 as outputFormat };
    }
    namespace generateInitiatives {
        let role_4: string;
        export { role_4 as role };
        let maxTokens_4: number;
        export { maxTokens_4 as maxTokens };
        let description_4: string;
        export { description_4 as description };
        let outputFormat_4: string;
        export { outputFormat_4 as outputFormat };
    }
    namespace generateObservations {
        let role_5: string;
        export { role_5 as role };
        let maxTokens_5: number;
        export { maxTokens_5 as maxTokens };
        let description_5: string;
        export { description_5 as description };
        let outputFormat_5: string;
        export { outputFormat_5 as outputFormat };
    }
    namespace generateFirstValuePlan {
        let role_6: string;
        export { role_6 as role };
        let maxTokens_6: number;
        export { maxTokens_6 as maxTokens };
        let description_6: string;
        export { description_6 as description };
        let outputFormat_6: string;
        export { outputFormat_6 as outputFormat };
    }
    namespace suggestTasks {
        let role_7: string;
        export { role_7 as role };
        let maxTokens_7: number;
        export { maxTokens_7 as maxTokens };
        let description_7: string;
        export { description_7 as description };
        let outputFormat_7: string;
        export { outputFormat_7 as outputFormat };
    }
    namespace generateTaskInsight {
        let role_8: string;
        export { role_8 as role };
        let maxTokens_8: number;
        export { maxTokens_8 as maxTokens };
        let description_8: string;
        export { description_8 as description };
        let outputFormat_8: string;
        export { outputFormat_8 as outputFormat };
    }
    namespace generateExecutionStrategy {
        let role_9: string;
        export { role_9 as role };
        let maxTokens_9: number;
        export { maxTokens_9 as maxTokens };
        let description_9: string;
        export { description_9 as description };
        let outputFormat_9: string;
        export { outputFormat_9 as outputFormat };
    }
    namespace validateInitiative {
        let role_10: string;
        export { role_10 as role };
        let maxTokens_10: number;
        export { maxTokens_10 as maxTokens };
        let description_10: string;
        export { description_10 as description };
        let outputFormat_10: string;
        export { outputFormat_10 as outputFormat };
    }
    namespace enrichInitiative {
        let role_11: string;
        export { role_11 as role };
        let maxTokens_11: number;
        export { maxTokens_11 as maxTokens };
        let description_11: string;
        export { description_11 as description };
        let outputFormat_11: string;
        export { outputFormat_11 as outputFormat };
    }
    namespace generateInsights {
        let role_12: string;
        export { role_12 as role };
        let maxTokens_12: number;
        export { maxTokens_12 as maxTokens };
        let description_12: string;
        export { description_12 as description };
        let outputFormat_12: string;
        export { outputFormat_12 as outputFormat };
    }
    namespace generateStrategicFit {
        let role_13: string;
        export { role_13 as role };
        let maxTokens_13: number;
        export { maxTokens_13 as maxTokens };
        let description_13: string;
        export { description_13 as description };
        let outputFormat_13: string;
        export { outputFormat_13 as outputFormat };
    }
    namespace buildRoadmap {
        let role_14: string;
        export { role_14 as role };
        let maxTokens_14: number;
        export { maxTokens_14 as maxTokens };
        let description_14: string;
        export { description_14 as description };
        let outputFormat_14: string;
        export { outputFormat_14 as outputFormat };
    }
    namespace validateRoadmap {
        let role_15: string;
        export { role_15 as role };
        let maxTokens_15: number;
        export { maxTokens_15 as maxTokens };
        let description_15: string;
        export { description_15 as description };
        let outputFormat_15: string;
        export { outputFormat_15 as outputFormat };
    }
    namespace explainRoadmap {
        let role_16: string;
        export { role_16 as role };
        let maxTokens_16: number;
        export { maxTokens_16 as maxTokens };
        let description_16: string;
        export { description_16 as description };
        let outputFormat_16: string;
        export { outputFormat_16 as outputFormat };
    }
    namespace optimizeRoadmap {
        let role_17: string;
        export { role_17 as role };
        let maxTokens_17: number;
        export { maxTokens_17 as maxTokens };
        let description_17: string;
        export { description_17 as description };
        let outputFormat_17: string;
        export { outputFormat_17 as outputFormat };
    }
    namespace reviewQuarter {
        let role_18: string;
        export { role_18 as role };
        let maxTokens_18: number;
        export { maxTokens_18 as maxTokens };
        let description_18: string;
        export { description_18 as description };
        let outputFormat_18: string;
        export { outputFormat_18 as outputFormat };
    }
    namespace suggestPlacement {
        let role_19: string;
        export { role_19 as role };
        let maxTokens_19: number;
        export { maxTokens_19 as maxTokens };
        let description_19: string;
        export { description_19 as description };
        let outputFormat_19: string;
        export { outputFormat_19 as outputFormat };
    }
    namespace generateRoadmapSummary {
        let role_20: string;
        export { role_20 as role };
        let maxTokens_20: number;
        export { maxTokens_20 as maxTokens };
        let description_20: string;
        export { description_20 as description };
        let outputFormat_20: string;
        export { outputFormat_20 as outputFormat };
    }
    namespace generatePlacementReason {
        let role_21: string;
        export { role_21 as role };
        let maxTokens_21: number;
        export { maxTokens_21 as maxTokens };
        let description_21: string;
        export { description_21 as description };
        let outputFormat_21: string;
        export { outputFormat_21 as outputFormat };
    }
    namespace rebalanceRoadmap {
        let role_22: string;
        export { role_22 as role };
        let maxTokens_22: number;
        export { maxTokens_22 as maxTokens };
        let description_22: string;
        export { description_22 as description };
        let outputFormat_22: string;
        export { outputFormat_22 as outputFormat };
    }
    namespace generateWorkloadAnalysis {
        let role_23: string;
        export { role_23 as role };
        let maxTokens_23: number;
        export { maxTokens_23 as maxTokens };
        let description_23: string;
        export { description_23 as description };
        let outputFormat_23: string;
        export { outputFormat_23 as outputFormat };
    }
    namespace simulateEconomics {
        let role_24: string;
        export { role_24 as role };
        let maxTokens_24: number;
        export { maxTokens_24 as maxTokens };
        let description_24: string;
        export { description_24 as description };
        let outputFormat_24: string;
        export { outputFormat_24 as outputFormat };
    }
    namespace chat {
        let role_25: string;
        export { role_25 as role };
        let maxTokens_25: number;
        export { maxTokens_25 as maxTokens };
        let description_25: string;
        export { description_25 as description };
        let outputFormat_25: string;
        export { outputFormat_25 as outputFormat };
        export let supportsStreaming: boolean;
    }
    namespace chat_simple {
        let role_26: string;
        export { role_26 as role };
        let maxTokens_26: number;
        export { maxTokens_26 as maxTokens };
        let description_26: string;
        export { description_26 as description };
        let outputFormat_26: string;
        export { outputFormat_26 as outputFormat };
        let supportsStreaming_1: boolean;
        export { supportsStreaming_1 as supportsStreaming };
    }
    namespace generateReportSectionContent {
        let role_27: string;
        export { role_27 as role };
        let maxTokens_27: number;
        export { maxTokens_27 as maxTokens };
        let description_27: string;
        export { description_27 as description };
        let outputFormat_27: string;
        export { outputFormat_27 as outputFormat };
    }
    namespace parseReportEditIntent {
        let role_28: string;
        export { role_28 as role };
        let maxTokens_28: number;
        export { maxTokens_28 as maxTokens };
        let description_28: string;
        export { description_28 as description };
        let outputFormat_28: string;
        export { outputFormat_28 as outputFormat };
    }
    namespace buildReportAIContext {
        let role_29: string;
        export { role_29 as role };
        let maxTokens_29: number;
        export { maxTokens_29 as maxTokens };
        let description_29: string;
        export { description_29 as description };
        let outputFormat_29: string;
        export { outputFormat_29 as outputFormat };
    }
    namespace runChainOfThought {
        let role_30: string;
        export { role_30 as role };
        let maxTokens_30: number;
        export { maxTokens_30 as maxTokens };
        let description_30: string;
        export { description_30 as description };
        let outputFormat_30: string;
        export { outputFormat_30 as outputFormat };
    }
    namespace extractInsights {
        let role_31: string;
        export { role_31 as role };
        let maxTokens_31: number;
        export { maxTokens_31 as maxTokens };
        let description_31: string;
        export { description_31 as description };
        let outputFormat_31: string;
        export { outputFormat_31 as outputFormat };
    }
    namespace verifyWithWeb {
        let role_32: string;
        export { role_32 as role };
        let maxTokens_32: number;
        export { maxTokens_32 as maxTokens };
        let description_32: string;
        export { description_32 as description };
        let outputFormat_32: string;
        export { outputFormat_32 as outputFormat };
    }
    namespace getStrategicIdeas {
        let role_33: string;
        export { role_33 as role };
        let maxTokens_33: number;
        export { maxTokens_33 as maxTokens };
        let description_33: string;
        export { description_33 as description };
        let outputFormat_33: string;
        export { outputFormat_33 as outputFormat };
    }
    namespace generateStructuredContent {
        let role_34: string;
        export { role_34 as role };
        let maxTokens_34: number;
        export { maxTokens_34 as maxTokens };
        let description_34: string;
        export { description_34 as description };
        let outputFormat_34: string;
        export { outputFormat_34 as outputFormat };
    }
    namespace queueTask {
        let role_35: string;
        export { role_35 as role };
        let maxTokens_35: number;
        export { maxTokens_35 as maxTokens };
        let description_35: string;
        export { description_35 as description };
        let outputFormat_35: string;
        export { outputFormat_35 as outputFormat };
        export let async: boolean;
    }
}
/**
 * Get capability configuration
 * @param {string} capability - Capability name
 * @returns {Object} Capability configuration
 */
export function getCapabilityConfig(capability: string): Object;
import { FALLBACK_ROLES } from './promptAssembler.js';
/**
 * Extract thinking steps from AI response
 * Parses <thinking>...</thinking> blocks and returns structured steps
 * @param {string} content - Raw AI response content
 * @returns {{ cleanContent: string, thinkingSteps: Array }} Parsed content and thinking steps
 */
export function extractThinkingSteps(content: string): {
    cleanContent: string;
    thinkingSteps: any[];
};
/**
 * Extract artifacts from AI response
 * Parses ```artifact:type:title...``` blocks and returns structured artifacts
 * @param {string} content - Raw AI response content
 * @returns {{ cleanContent: string, artifacts: Array }} Parsed content and artifacts
 */
export function extractArtifacts(content: string): {
    cleanContent: string;
    artifacts: any[];
};
/**
 * Process AI response for World-Class Chat 2025 features
 * Extracts thinking steps, artifacts, and cleans up content
 * @param {Object} response - Raw AI response
 * @returns {Object} Enhanced response with thinking and artifacts
 */
export function enhanceResponse(response: Object): Object;
import BaseService from '../BaseService.js';
import { AIGateway } from './aiGateway.js';
import { PromptAssembler } from './promptAssembler.js';
import { ModelRouter } from './modelRouter.js';
export { FALLBACK_ROLES };
//# sourceMappingURL=aiPipeline.d.ts.map