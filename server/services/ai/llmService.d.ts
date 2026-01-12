export const MagicWandSchema: z.ZodObject<{
    suggestions: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        value: z.ZodString;
        reasoning: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export const AnalysisResultSchema: z.ZodObject<{
    summary: z.ZodString;
    keyFindings: z.ZodArray<z.ZodString>;
    recommendations: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        priority: z.ZodEnum<{
            LOW: "LOW";
            MEDIUM: "MEDIUM";
            HIGH: "HIGH";
        }>;
    }, z.core.$strip>>;
    overallScore: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export const RoadmapSchema: z.ZodObject<{
    year1: z.ZodObject<{
        q1: z.ZodArray<z.ZodString>;
        q2: z.ZodArray<z.ZodString>;
        q3: z.ZodArray<z.ZodString>;
        q4: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    year2: z.ZodOptional<z.ZodObject<{
        q1: z.ZodArray<z.ZodString>;
        q2: z.ZodArray<z.ZodString>;
        q3: z.ZodArray<z.ZodString>;
        q4: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    year3: z.ZodOptional<z.ZodObject<{
        q1: z.ZodArray<z.ZodString>;
        q2: z.ZodArray<z.ZodString>;
        q3: z.ZodArray<z.ZodString>;
        q4: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    reasoning: z.ZodString;
}, z.core.$strip>;
export class LLMService extends BaseService {
    maxTokens: number;
    temperature: number;
    _llmConfigService: {
        providerCache: Map<any, any>;
        cacheExpiry: number;
        cacheTTL: number;
        healthStatus: Map<any, any>;
        initialized: boolean;
        initialize(): Promise<void>;
        ensureTableExists(): Promise<void>;
        migrateTable(): Promise<void>;
        getApiKeyFromEnv(providerId: string): string | null;
        syncDatabaseWithEnv(): Promise<void>;
        clearCache(): void;
        updateProviderTier(providerId: string, tier: string): Promise<boolean>;
        getProviderFromDb(providerId: any): Promise<any>;
        getProviderById(id: any): Promise<any>;
        updateProviderInDb(providerId: any, updates: any): Promise<any>;
        createProviderInDb(provider: any): Promise<any>;
        getOrganizationProviders(organizationId: any): Promise<any[]>;
        toggleOrganizationProvider(organizationId: any, providerId: any, isEnabled: any): Promise<{
            success: boolean;
        }>;
        getAllProviders(useCache?: boolean): Promise<any[]>;
        getProviderConfig(providerId: string): Promise<Object | null>;
        getDefaultProvider(): Promise<Object | null>;
        enrichProviderConfig(dbRow: any): any;
        getFallbackChain(tier?: string): Promise<any[]>;
        getNextFallback(excludeProviders?: any[], tier?: string): Promise<Object | null>;
        _db: any;
        _cache: any;
        _queryHelpers: any;
        init(): Promise</*elided*/ any>;
        setDependencies(deps?: {}): void;
        queryAll(sql: any, params?: any[], options?: {}): Promise<any>;
        queryOne(sql: any, params?: any[], options?: {}): Promise<any>;
        queryRun(sql: any, params?: any[]): Promise<any>;
        logInfo(message: any, meta?: {}): void;
        logError(message: any, error?: {}): void;
    } | null;
    _mcpServer: import("./mcpServer.js").MCPServer | null;
    getLLMConfigService(): Promise<{
        providerCache: Map<any, any>;
        cacheExpiry: number;
        cacheTTL: number;
        healthStatus: Map<any, any>;
        initialized: boolean;
        initialize(): Promise<void>;
        ensureTableExists(): Promise<void>;
        migrateTable(): Promise<void>;
        getApiKeyFromEnv(providerId: string): string | null;
        syncDatabaseWithEnv(): Promise<void>;
        clearCache(): void;
        updateProviderTier(providerId: string, tier: string): Promise<boolean>;
        getProviderFromDb(providerId: any): Promise<any>;
        getProviderById(id: any): Promise<any>;
        updateProviderInDb(providerId: any, updates: any): Promise<any>;
        createProviderInDb(provider: any): Promise<any>;
        getOrganizationProviders(organizationId: any): Promise<any[]>;
        toggleOrganizationProvider(organizationId: any, providerId: any, isEnabled: any): Promise<{
            success: boolean;
        }>;
        getAllProviders(useCache?: boolean): Promise<any[]>;
        getProviderConfig(providerId: string): Promise<Object | null>;
        getDefaultProvider(): Promise<Object | null>;
        enrichProviderConfig(dbRow: any): any;
        getFallbackChain(tier?: string): Promise<any[]>;
        getNextFallback(excludeProviders?: any[], tier?: string): Promise<Object | null>;
        _db: any;
        _cache: any;
        _queryHelpers: any;
        init(): Promise</*elided*/ any>;
        setDependencies(deps?: {}): void;
        queryAll(sql: any, params?: any[], options?: {}): Promise<any>;
        queryOne(sql: any, params?: any[], options?: {}): Promise<any>;
        queryRun(sql: any, params?: any[]): Promise<any>;
        logInfo(message: any, meta?: {}): void;
        logError(message: any, error?: {}): void;
    } | null>;
    getMCPServer(): Promise<import("./mcpServer.js").MCPServer | null>;
    /**
     * Get API key for a provider
     * Tries: 1) passed apiKey, 2) LLMConfigService, 3) environment variable
     */
    getApiKey(providerName: any, passedKey: any): Promise<any>;
    /**
     * Get endpoint for a provider
     */
    getEndpoint(providerName: any, passedEndpoint: any): Promise<any>;
    getDefaultEndpoint(providerName: any): any;
    getProvider(modelConfig: any): Promise<import("@ai-sdk/openai").OpenAIProvider | import("@ai-sdk/google").GoogleGenerativeAIProvider>;
    /**
     * Check if model is a reasoning/o1 model
     */
    isReasoningModel(modelId: any): boolean;
    resolveModelConfig(modelConfig: any): Promise<any>;
    call(params: any): Promise<{
        stream: import("ai").AsyncIterableStream<string>;
    } | {
        object: any;
        usage: any;
    } | {
        content: any;
        usage: any;
    }>;
    generateResponse(params: any): Promise<{
        stream: import("ai").AsyncIterableStream<string>;
    } | {
        object: any;
        usage: any;
    } | {
        content: any;
        usage: any;
    }>;
    callReasoningModel(params: any): Promise<{
        content: any;
        usage: any;
        isReasoningModel: boolean;
        model: any;
    }>;
    callWithTools(params: any): Promise<{
        content: any;
        usage: any;
        toolCalls: {
            name: any;
            args: any;
            result: any;
        }[];
    }>;
    callWithToolsStream(params: any): Promise<{
        stream: import("ai").AsyncIterableStream<string>;
    }>;
    callText(params: any): Promise<{
        content: any;
        usage: any;
    }>;
    callStream(params: any): Promise<{
        stream: import("ai").AsyncIterableStream<string>;
    }>;
    callStructured(params: any): Promise<{
        object: any;
        usage: any;
    }>;
    testConnection(modelConfig: any): Promise<{
        success: boolean;
        response: string;
        usage: import("ai").LanguageModelUsage;
        circuitState: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        circuitState: any;
        response?: undefined;
        usage?: undefined;
    }>;
    getCircuitStatus(): Promise<any>;
    resetCircuit(providerId: any): Promise<void>;
}
export const llmService: LLMService;
export default llmService;
import { z } from 'zod';
import BaseService from '../BaseService.js';
//# sourceMappingURL=llmService.d.ts.map