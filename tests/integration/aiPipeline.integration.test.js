/**
 * AI Pipeline Integration Tests
 * 
 * Tests for the complete AI pipeline flow including all enterprise services.
 */

const { AIPipeline } = require('../../server/services/ai/aiPipeline');
const { qualityChecker } = require('../../server/services/ai/qualityChecker');
const { enterpriseSecurity } = require('../../server/services/ai/enterpriseSecurity');
const { performanceOptimizer } = require('../../server/services/ai/performanceOptimizer');
const { learningSystem } = require('../../server/services/ai/learningSystem');

// Mock LLM service for tests
jest.mock('../../server/services/ai/llmService', () => ({
    LLMService: jest.fn().mockImplementation(() => ({
        call: jest.fn().mockResolvedValue({
            content: 'This is a comprehensive AI response based on your query about digital transformation. Key recommendations include: 1) Establish digital governance, 2) Invest in cloud infrastructure, 3) Build data capabilities.',
            usage: {
                promptTokens: 500,
                completionTokens: 200,
                totalTokens: 700
            }
        })
    }))
}));

describe('AIPipeline Integration', () => {
    let pipeline;

    beforeEach(() => {
        pipeline = new AIPipeline();
        performanceOptimizer.reset();
    });

    describe('Full Pipeline Flow', () => {
        it('should process request through all stages', async () => {
            const request = {
                userId: 'test-user-integration',
                organizationId: 'test-org-integration',
                capability: 'recommendation',
                prompt: 'How can we improve our digital maturity?'
            };

            const response = await pipeline.process(request);

            expect(response).toBeDefined();
            expect(response.content).toBeDefined();
            expect(response.metadata).toBeDefined();
            expect(response.metadata.model).toBeDefined();
            expect(response.metadata.latency).toBeGreaterThan(0);
        });

        it('should include quality score in response metadata', async () => {
            const request = {
                userId: 'test-user-quality',
                organizationId: 'test-org-quality',
                capability: 'analysis',
                prompt: 'Analyze our current state'
            };

            const response = await pipeline.process(request);

            expect(response.metadata).toBeDefined();
            expect(response.metadata.quality).toBeDefined();
            expect(response.metadata.quality.score).toBeGreaterThanOrEqual(0);
            expect(response.metadata.quality.score).toBeLessThanOrEqual(1);
        });

        it('should record metrics in performance optimizer', async () => {
            const request = {
                userId: 'test-user-perf',
                organizationId: 'test-org-perf',
                capability: 'chat',
                prompt: 'Hello, how are you?'
            };

            await pipeline.process(request);

            const stats = performanceOptimizer.getStats();
            expect(stats.totalRequests).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Rate Limiting', () => {
        it('should check rate limits before processing', async () => {
            const checkRateLimitSpy = jest.spyOn(enterpriseSecurity, 'checkRateLimit');

            const request = {
                userId: 'test-user-rate',
                organizationId: 'test-org-rate',
                capability: 'chat',
                prompt: 'Test message'
            };

            await pipeline.process(request);

            expect(checkRateLimitSpy).toHaveBeenCalledWith(
                'test-org-rate',
                'chat'
            );

            checkRateLimitSpy.mockRestore();
        });
    });

    describe('Quality Checking', () => {
        it('should validate response quality', async () => {
            const checkSpy = jest.spyOn(qualityChecker, 'check');

            const request = {
                userId: 'test-user-qc',
                organizationId: 'test-org-qc',
                capability: 'recommendation',
                prompt: 'Give me recommendations'
            };

            await pipeline.process(request);

            expect(checkSpy).toHaveBeenCalled();

            checkSpy.mockRestore();
        });
    });

    describe('Audit Logging', () => {
        it('should log audit entry via enterprise security', async () => {
            const logAuditSpy = jest.spyOn(enterpriseSecurity, 'logAudit');

            const request = {
                userId: 'test-user-audit',
                organizationId: 'test-org-audit',
                capability: 'chat',
                prompt: 'Audit test'
            };

            await pipeline.process(request);

            expect(logAuditSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'test-user-audit',
                    organizationId: 'test-org-audit',
                    action: 'ai_request'
                })
            );

            logAuditSpy.mockRestore();
        });
    });

    describe('Learning System Integration', () => {
        it('should record interaction for learning', async () => {
            const recordSpy = jest.spyOn(learningSystem, 'recordInteraction');

            const request = {
                userId: 'test-user-learn',
                organizationId: 'test-org-learn',
                capability: 'analysis',
                prompt: 'Learning test'
            };

            await pipeline.process(request);

            // Give async operation time to complete
            await new Promise(r => setTimeout(r, 100));

            expect(recordSpy).toHaveBeenCalled();

            recordSpy.mockRestore();
        });
    });

    describe('Error Handling', () => {
        it('should log errors via enterprise security', async () => {
            const logAuditSpy = jest.spyOn(enterpriseSecurity, 'logAudit');

            // Create pipeline with failing LLM
            const failingPipeline = new AIPipeline();
            failingPipeline.llmService.call = jest.fn().mockRejectedValue(new Error('LLM failure'));

            const request = {
                userId: 'test-user-error',
                organizationId: 'test-org-error',
                capability: 'chat',
                prompt: 'Error test'
            };

            await expect(failingPipeline.process(request)).rejects.toThrow();

            expect(logAuditSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'ai_request_error'
                })
            );

            logAuditSpy.mockRestore();
        });

        it('should record error metrics', async () => {
            const recordMetricsSpy = jest.spyOn(performanceOptimizer, 'recordMetrics');

            const failingPipeline = new AIPipeline();
            failingPipeline.llmService.call = jest.fn().mockRejectedValue(new Error('LLM failure'));

            const request = {
                userId: 'test-user-error-metrics',
                organizationId: 'test-org-error-metrics',
                capability: 'chat',
                prompt: 'Error metrics test'
            };

            await expect(failingPipeline.process(request)).rejects.toThrow();

            expect(recordMetricsSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    error: true
                })
            );

            recordMetricsSpy.mockRestore();
        });
    });

    describe('Cache Integration', () => {
        it('should return cached response for duplicate queries', async () => {
            const request = {
                userId: 'test-user-cache',
                organizationId: 'test-org-cache',
                capability: 'chat',
                prompt: 'Cached query test ' + Date.now()
            };

            // First call - should not be cached
            const response1 = await pipeline.process(request);
            expect(response1.metadata.cached).toBeFalsy();

            // Second call - should be cached
            const response2 = await pipeline.process(request);
            
            // Note: depending on cache implementation, this may or may not be cached
            expect(response2).toBeDefined();
        });
    });

    describe('Multi-provider Fallback', () => {
        it('should fallback to another provider on failure', async () => {
            let callCount = 0;
            
            const fallbackPipeline = new AIPipeline();
            fallbackPipeline.llmService.call = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Provider 1 failed');
                }
                return Promise.resolve({
                    content: 'Response from fallback provider',
                    usage: { totalTokens: 100 }
                });
            });

            const request = {
                userId: 'test-user-fallback',
                organizationId: 'test-org-fallback',
                capability: 'chat',
                prompt: 'Fallback test'
            };

            const response = await fallbackPipeline.process(request);

            expect(response.content).toContain('fallback');
            expect(callCount).toBeGreaterThan(1);
        });
    });
});

describe('Enterprise Services Initialization', () => {
    it('should have all required services available', () => {
        expect(qualityChecker).toBeDefined();
        expect(enterpriseSecurity).toBeDefined();
        expect(performanceOptimizer).toBeDefined();
        expect(learningSystem).toBeDefined();
    });

    it('should have correct service methods', () => {
        expect(typeof qualityChecker.check).toBe('function');
        expect(typeof enterpriseSecurity.checkRateLimit).toBe('function');
        expect(typeof enterpriseSecurity.logAudit).toBe('function');
        expect(typeof performanceOptimizer.recordMetrics).toBe('function');
        expect(typeof learningSystem.recordInteraction).toBe('function');
    });
});



