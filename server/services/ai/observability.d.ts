declare namespace _default {
    export { initLangfuse };
    export { createTrace };
    export { calculateCost };
    export { flush };
    export { shutdown };
    export { getStatus };
    export { TracingContext };
    export { MODEL_PRICING };
}
export default _default;
/**
 * Initialize Langfuse client
 */
export function initLangfuse(): Promise<boolean>;
/**
 * Create a trace for an AI request
 */
export function createTrace(params: any): TracingContext;
/**
 * Calculate cost for a request based on token usage
 */
export function calculateCost(modelId: any, usage: any): 0 | {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    inputTokens: any;
    outputTokens: any;
    totalTokens: any;
};
/**
 * Flush pending events (call on shutdown)
 */
export function flush(): Promise<void>;
/**
 * Shutdown observability service
 */
export function shutdown(): Promise<void>;
/**
 * Get observability status
 */
export function getStatus(): {
    langfuseEnabled: boolean;
    langfuseConfigured: boolean;
    pricingModels: number;
};
/**
 * Tracing context wrapper
 */
export class TracingContext {
    constructor(traceId: any, langfuseTrace: any);
    traceId: any;
    trace: any;
    spans: any[];
    startTime: number;
    /**
     * Start a new span (sub-operation)
     */
    startSpan(name: any, metadata?: {}): {
        id: string;
        name: any;
        startTime: number;
        metadata: {};
        langfuseSpan: null;
    };
    /**
     * End a span with results
     */
    endSpan(span: any, result?: {}): any;
    /**
     * Record LLM generation
     */
    recordGeneration(params: any): 0 | {
        inputCost: number;
        outputCost: number;
        totalCost: number;
        inputTokens: any;
        outputTokens: any;
        totalTokens: any;
    };
    getProviderFromModel(model: any): "unknown" | "openai" | "anthropic" | "google" | "deepseek" | "ollama";
    /**
     * Record an error
     */
    recordError(error: any, metadata?: {}): void;
    /**
     * Complete the trace
     */
    complete(result?: {}): {
        traceId: any;
        duration: number;
        spans: number;
    };
}
export const MODEL_PRICING: {
    'gpt-4o': {
        input: number;
        output: number;
    };
    'gpt-4o-mini': {
        input: number;
        output: number;
    };
    'gpt-4-turbo': {
        input: number;
        output: number;
    };
    'gpt-3.5-turbo': {
        input: number;
        output: number;
    };
    'o1-preview': {
        input: number;
        output: number;
    };
    'o1-mini': {
        input: number;
        output: number;
    };
    'claude-3-5-sonnet-20241022': {
        input: number;
        output: number;
    };
    'claude-3-opus': {
        input: number;
        output: number;
    };
    'claude-3-haiku': {
        input: number;
        output: number;
    };
    'gemini-1.5-pro': {
        input: number;
        output: number;
    };
    'gemini-1.5-flash': {
        input: number;
        output: number;
    };
    'gemini-2.0-flash': {
        input: number;
        output: number;
    };
    'deepseek-chat': {
        input: number;
        output: number;
    };
    'deepseek-coder': {
        input: number;
        output: number;
    };
    default: {
        input: number;
        output: number;
    };
};
//# sourceMappingURL=observability.d.ts.map