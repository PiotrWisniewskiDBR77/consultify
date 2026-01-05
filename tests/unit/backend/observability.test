import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../../server/src/services/ai/logger', () => ({
    aiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../server/src/services/ai/llmConfigService', () => ({
    llmConfigService: {
        logEvent: vi.fn()
    }
}));

describe('AI Observability Service', () => {
    let observability;
    let originalEnv;

    beforeEach(async () => {
        originalEnv = { ...process.env };
        delete process.env.LANGFUSE_PUBLIC_KEY;
        delete process.env.LANGFUSE_SECRET_KEY;
        delete process.env.LANGFUSE_BASE_URL;
        
        // Clear module cache to get fresh instance
        vi.resetModules();
        // Dynamic import for ESM compatibility
        observability = await import('../../../server/src/services/ai/observability');
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    describe('calculateCost', () => {
        it('should calculate cost for OpenAI model', () => {
            const usage = {
                promptTokens: 1000,
                completionTokens: 500
            };
            const cost = observability.calculateCost('gpt-4o', usage);
            
            expect(cost.inputTokens).toBe(1000);
            expect(cost.outputTokens).toBe(500);
            expect(cost.totalTokens).toBe(1500);
            expect(cost.inputCost).toBeGreaterThan(0);
            expect(cost.outputCost).toBeGreaterThan(0);
            expect(cost.totalCost).toBeGreaterThan(0);
        });

        it('should calculate cost for Anthropic model', () => {
            const usage = {
                prompt_tokens: 2000,
                completion_tokens: 1000
            };
            const cost = observability.calculateCost('claude-3-5-sonnet-20241022', usage);
            
            expect(cost.inputTokens).toBe(2000);
            expect(cost.outputTokens).toBe(1000);
            expect(cost.totalCost).toBeGreaterThan(0);
        });

        it('should use default pricing for unknown model', () => {
            const usage = {
                promptTokens: 1000,
                completionTokens: 500
            };
            const cost = observability.calculateCost('unknown-model', usage);
            
            expect(cost.totalCost).toBeGreaterThan(0);
        });

        it('should return zero cost for null usage', () => {
            const cost = observability.calculateCost('gpt-4o', null);
            expect(cost).toBe(0);
        });

        it('should handle missing token fields', () => {
            const usage = {};
            const cost = observability.calculateCost('gpt-4o', usage);
            
            expect(cost.inputTokens).toBe(0);
            expect(cost.outputTokens).toBe(0);
            expect(cost.totalCost).toBe(0);
        });
    });

    describe('createTrace', () => {
        it('should create trace without Langfuse when not configured', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456'
            });
            
            expect(trace).toBeDefined();
            expect(trace.traceId).toBeDefined();
            expect(trace.trace).toBeNull();
        });

        it('should create trace with metadata', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456',
                sessionId: 'session-789',
                metadata: { custom: 'data' }
            });
            
            expect(trace.traceId).toBeDefined();
        });
    });

    describe('TracingContext', () => {
        it('should create tracing context', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456'
            });
            
            expect(trace.traceId).toBeDefined();
            expect(trace.startTime).toBeDefined();
            expect(Array.isArray(trace.spans)).toBe(true);
        });

        it('should start and end span', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456'
            });
            
            const span = trace.startSpan('test-span', { key: 'value' });
            expect(span).toBeDefined();
            expect(span.name).toBe('test-span');
            expect(span.startTime).toBeDefined();
            
            const endedSpan = trace.endSpan(span, { output: 'result' });
            expect(endedSpan.endTime).toBeDefined();
            expect(endedSpan.duration).toBeGreaterThanOrEqual(0);
            expect(endedSpan.result).toEqual({ output: 'result' });
        });

        it('should record generation', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456'
            });
            
            const costInfo = trace.recordGeneration({
                name: 'llm-call',
                model: 'gpt-4o',
                prompt: 'Test prompt',
                completion: 'Test completion',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50
                }
            });
            
            expect(costInfo).toBeDefined();
            expect(costInfo.totalTokens).toBe(150);
            expect(costInfo.totalCost).toBeGreaterThanOrEqual(0);
        });

        it('should record error', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456'
            });
            
            const error = new Error('Test error');
            trace.recordError(error, { model: 'gpt-4o' });
            
            // Should not throw
            expect(trace.traceId).toBeDefined();
        });

        it('should complete trace', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456'
            });
            
            const result = trace.complete({
                output: 'success',
                status: 'completed',
                metadata: { key: 'value' }
            });
            
            expect(result.traceId).toBeDefined();
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.spans).toBe(0);
        });

        it('should get provider from model name', () => {
            const trace = observability.createTrace({
                name: 'test-trace',
                userId: 'user-123',
                organizationId: 'org-456'
            });
            
            expect(trace.getProviderFromModel('gpt-4o')).toBe('openai');
            expect(trace.getProviderFromModel('claude-3-opus')).toBe('anthropic');
            expect(trace.getProviderFromModel('gemini-1.5-pro')).toBe('google');
            expect(trace.getProviderFromModel('deepseek-chat')).toBe('deepseek');
            expect(trace.getProviderFromModel('llama-2')).toBe('ollama');
            expect(trace.getProviderFromModel('unknown')).toBe('unknown');
        });
    });

    describe('getStatus', () => {
        it('should return status without Langfuse configured', () => {
            const status = observability.getStatus();
            
            expect(status.langfuseEnabled).toBe(false);
            expect(status.langfuseConfigured).toBe(false);
            expect(status.pricingModels).toBeGreaterThan(0);
        });
    });

    describe('MODEL_PRICING', () => {
        it('should have pricing for major models', () => {
            const pricing = observability.MODEL_PRICING;
            
            expect(pricing['gpt-4o']).toBeDefined();
            expect(pricing['claude-3-5-sonnet-20241022']).toBeDefined();
            expect(pricing['gemini-1.5-pro']).toBeDefined();
            expect(pricing['default']).toBeDefined();
        });
    });
});









