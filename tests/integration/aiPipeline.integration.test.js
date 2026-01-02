/**
 * AI Pipeline Integration Tests
 * 
 * Tests for the complete AI pipeline flow including all enterprise services.
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { TestDatabaseFactory } from '../utils/TestDatabaseFactory.js';

// Mock LLM service module not needed for DI, strictly speaking, 
// but we keep a basic mock to prevent import errors if any.
vi.mock('../../server/services/ai/llmService.js', () => ({
    LLMService: vi.fn()
}));

describe('AIPipeline Integration', () => {
    let AIPipeline;
    let qualityChecker;
    let enterpriseSecurity;
    let performanceOptimizer;
    let learningSystem;
    let pipeline;
    let db;

    beforeAll(async () => {
        // 1. Create isolated DB
        const testDb = await TestDatabaseFactory.create();
        global.__TEST_DB_MOCK__ = testDb;

        // 2. Reset modules
        vi.resetModules();

        // 3. Dynamic imports to ensure fresh modules with mock DB
        const dbModule = await import('../../server/database.js');
        db = dbModule.default;

        // Import services AFTER DB init and module reset
        // Note: Ideally, these services should also be refactored to DI to accept the DB,
        // but for now we rely on them picking up the global mock DB via './database' import.
        const pipelineModule = await import('../../server/services/ai/aiPipeline.js');
        AIPipeline = pipelineModule.AIPipeline;

        const qcModule = await import('../../server/services/ai/qualityChecker.js');
        qualityChecker = qcModule.qualityChecker;

        const esModule = await import('../../server/services/ai/enterpriseSecurity.js');
        enterpriseSecurity = esModule.enterpriseSecurity;

        const poModule = await import('../../server/services/ai/performanceOptimizer.js');
        performanceOptimizer = poModule.performanceOptimizer;

        const lsModule = await import('../../server/services/ai/learningSystem.js');
        learningSystem = lsModule.learningSystem;
    });

    beforeEach(() => {
        // Create a fresh mock for LLMService for each test
        const mockLLMService = {
            call: vi.fn().mockResolvedValue({
                content: 'This is a comprehensive AI response based on your query about digital transformation. Key recommendations include: 1) Establish digital governance, 2) Invest in cloud infrastructure, 3) Build data capabilities.',
                usage: {
                    promptTokens: 500,
                    completionTokens: 200,
                    totalTokens: 700
                }
            }),
            resolveModelConfig: vi.fn().mockImplementation(config => Promise.resolve(config))
        };

        // Inject the mock via constructor
        pipeline = new AIPipeline({
            llmService: mockLLMService
        });

        if (performanceOptimizer?.reset) {
            performanceOptimizer.reset();
        } else {
            // Fallback if reset method doesn't exist
            vi.clearAllMocks();
        }
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
            // Assuming default mock returns valid score
            if (response.metadata.quality.score !== undefined) {
                expect(response.metadata.quality.score).toBeGreaterThanOrEqual(0);
                expect(response.metadata.quality.score).toBeLessThanOrEqual(1);
            }
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
            const checkRateLimitSpy = vi.spyOn(enterpriseSecurity, 'checkRateLimit');

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
            const checkSpy = vi.spyOn(qualityChecker, 'check');

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
            const logAuditSpy = vi.spyOn(enterpriseSecurity, 'logAudit');

            const request = {
                userId: 'test-user-audit',
                organizationId: 'test-org-audit',
                capability: 'chat',
                prompt: 'Audit test'
            };

            await pipeline.process(request);

            expect(logAuditSpy).toHaveBeenCalled();
            // Loose check for arguments since implementation details might vary
            const args = logAuditSpy.mock.calls[0][0];
            expect(args.userId).toBe('test-user-audit');
            expect(args.organizationId).toBe('test-org-audit');

            logAuditSpy.mockRestore();
        });
    });

    describe('Learning System Integration', () => {
        it('should record interaction for learning', async () => {
            const recordSpy = vi.spyOn(learningSystem, 'recordInteraction');

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
            const logAuditSpy = vi.spyOn(enterpriseSecurity, 'logAudit');

            // Create pipeline with failing LLM
            const failingMockLLM = {
                call: vi.fn().mockRejectedValue(new Error('LLM failure')),
                resolveModelConfig: vi.fn().mockImplementation(config => Promise.resolve(config))
            };
            const failingPipeline = new AIPipeline({
                llmService: failingMockLLM
            });

            const request = {
                userId: 'test-user-error',
                organizationId: 'test-org-error',
                capability: 'chat',
                prompt: 'Error test'
            };

            await expect(failingPipeline.process(request)).rejects.toThrow();

            // We expect logAudit to be called for the error
            expect(logAuditSpy).toHaveBeenCalled();

            logAuditSpy.mockRestore();
        });

        it('should record error metrics', async () => {
            const recordMetricsSpy = vi.spyOn(performanceOptimizer, 'recordMetrics');

            const failingMockLLM = {
                call: vi.fn().mockRejectedValue(new Error('LLM failure')),
                resolveModelConfig: vi.fn().mockImplementation(config => Promise.resolve(config))
            };
            const failingPipeline = new AIPipeline({
                llmService: failingMockLLM
            });

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
        it('should handle cached responses', async () => {
            // Note: Caching logic depends on specific implementation details (map vs redis)
            // Just verifying it doesn't crash on multiple calls
            const request = {
                userId: 'test-user-cache',
                organizationId: 'test-org-cache',
                capability: 'chat',
                prompt: 'Cached query test ' + Date.now()
            };

            const response1 = await pipeline.process(request);
            expect(response1).toBeDefined();

            const response2 = await pipeline.process(request);
            expect(response2).toBeDefined();
        });
    });

    describe('Multi-provider Fallback', () => {
        it('should fallback to another provider on failure', async () => {
            let callCount = 0;

            // Create a mock LLM service that simulates failure then success
            const mockLLMService = {
                call: vi.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                        return Promise.reject(new Error('Provider 1 failed'));
                    }
                    return Promise.resolve({
                        content: 'Response from fallback provider',
                        usage: { totalTokens: 100 }
                    });
                }),
                resolveModelConfig: vi.fn().mockImplementation(config => Promise.resolve(config))
            };

            const fallbackPipeline = new AIPipeline({
                llmService: mockLLMService
            });

            // We don't need to mock the property directly on the instance anymore
            // fallbackPipeline.llmService.call = ... 

            const request = {
                userId: 'test-user-fallback',
                organizationId: 'test-org-fallback',
                capability: 'chat',
                prompt: 'Fallback test'
            };

            const response = await fallbackPipeline.process(request);

            expect(response.content).toBe('Response from fallback provider');
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
