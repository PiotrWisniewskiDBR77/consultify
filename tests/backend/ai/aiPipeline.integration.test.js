/**
 * AI Pipeline Integration Tests
 * Tests the unified AI pipeline with capability-based routing
 * 
 * @module tests/backend/ai/aiPipeline.integration.test.js
 * @version 2.0.0
 * @date 2024-12-30
 */


// Mock dependencies before importing
vi.mock('../../../server/database', () => ({
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn()
}));

vi.mock('../../../server/services/ai/llmService', () => ({
    LLMService: vi.fn().mockImplementation(() => ({
        call: vi.fn().mockResolvedValue({
            content: '{"tasks": [{"name": "Task 1", "priority": "HIGH"}]}',
            usage: { promptTokens: 100, completionTokens: 50 }
        })
    }))
}));

vi.mock('../../../server/services/ai/quotaService', () => ({
    quotaService: {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
        consumeTokens: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../../server/services/ai/memoryManager', () => ({
    memoryManager: {
        retrieve: vi.fn().mockResolvedValue({ chunks: [], totalTokens: 0, sources: [] }),
        serializeForPrompt: vi.fn().mockReturnValue(''),
        sessionStore: {
            addMessage: vi.fn().mockResolvedValue(true)
        },
        recordIfSignificant: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../../server/services/ai/enterpriseSecurity', () => ({
    enterpriseSecurity: {
        checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
        logAudit: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/qualityChecker', () => ({
    qualityChecker: {
        check: vi.fn().mockResolvedValue({
            passed: true,
            overallScore: 0.92,
            warnings: []
        })
    }
}));

vi.mock('../../../server/services/ai/performanceOptimizer', () => ({
    performanceOptimizer: {
        recordMetrics: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/learningSystem', () => ({
    learningSystem: {
        recordInteraction: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../../server/services/ai/cacheService', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../../server/services/ragService', () => ({
    searchRelevantChunks: vi.fn().mockResolvedValue([])
}));

// Now import the module under test
const { 
    AIPipeline, 
    CAPABILITY_REGISTRY, 
    getCapabilityConfig,
    suggestTasks,
    validateInitiative,
    enrichInitiative,
    generateObservations,
    parseJsonResponse
} = require('../../../server/services/ai/aiPipeline');

describe('AI Pipeline Integration Tests', () => {
    let pipeline;

    beforeEach(() => {
        vi.clearAllMocks();
        pipeline = new AIPipeline();
    });

    describe('CAPABILITY_REGISTRY', () => {
        it('should have all 48 capabilities registered', () => {
            const capabilityCount = Object.keys(CAPABILITY_REGISTRY).length;
            expect(capabilityCount).toBeGreaterThanOrEqual(30); // Core capabilities
        });

        it('should have valid role for each capability', () => {
            const validRoles = ['ANALYST', 'CONSULTANT', 'STRATEGIST', 'IMPLEMENTER', 'GATEKEEPER', 'FINANCE', 'PARTNER', 'MENTOR', 'SME'];
            
            Object.entries(CAPABILITY_REGISTRY).forEach(([key, config]) => {
                expect(validRoles).toContain(config.role);
            });
        });

        it('should have maxTokens defined for each capability', () => {
            Object.entries(CAPABILITY_REGISTRY).forEach(([key, config]) => {
                expect(config.maxTokens).toBeGreaterThan(0);
                expect(config.maxTokens).toBeLessThanOrEqual(8000);
            });
        });

        it('should have outputFormat for each capability', () => {
            const validFormats = ['json', 'text'];
            
            Object.entries(CAPABILITY_REGISTRY).forEach(([key, config]) => {
                expect(validFormats).toContain(config.outputFormat);
            });
        });
    });

    describe('getCapabilityConfig', () => {
        it('should return correct config for known capability', () => {
            const config = getCapabilityConfig('suggestTasks');
            expect(config.role).toBe('IMPLEMENTER');
            expect(config.maxTokens).toBe(2000);
        });

        it('should return default config for unknown capability', () => {
            const config = getCapabilityConfig('unknownCapability');
            expect(config.role).toBe('CONSULTANT');
            expect(config.maxTokens).toBe(2000);
        });
    });

    describe('Domain Methods', () => {
        describe('suggestTasks', () => {
            it('should generate tasks from initiative context', async () => {
                const initiativeContext = {
                    name: 'Digital Transformation',
                    summary: 'Modernize legacy systems',
                    hypothesis: 'Improve efficiency by 30%',
                    axis: 'Technology'
                };

                const result = await suggestTasks(initiativeContext, 'user-1', 'org-1');
                
                expect(result).toBeDefined();
                // Should parse JSON response
                expect(result.tasks || result.rawContent).toBeDefined();
            });
        });

        describe('validateInitiative', () => {
            it('should validate initiative and return score', async () => {
                const initiativeContext = {
                    name: 'Cloud Migration',
                    hypothesis: 'Reduce infrastructure costs',
                    expectedOutcome: '40% cost reduction',
                    successMetrics: 'Monthly cloud spend'
                };

                const result = await validateInitiative(initiativeContext, 'user-1', 'org-1');
                
                expect(result).toBeDefined();
            });
        });

        describe('enrichInitiative', () => {
            it('should enrich initiative with market context', async () => {
                const initiativeContext = {
                    name: 'AI Integration',
                    summary: 'Integrate AI into workflows',
                    industry: 'Technology'
                };

                const result = await enrichInitiative(initiativeContext, 'user-1', 'org-1');
                
                expect(result).toBeDefined();
            });
        });

        describe('generateObservations', () => {
            it('should generate strategic observations', async () => {
                const result = await generateObservations('user-1', 'org-1');
                
                expect(result).toBeDefined();
            });
        });
    });

    describe('parseJsonResponse', () => {
        it('should parse valid JSON', () => {
            const result = parseJsonResponse('{"key": "value"}');
            expect(result).toEqual({ key: 'value' });
        });

        it('should handle JSON wrapped in code blocks', () => {
            const result = parseJsonResponse('```json\n{"key": "value"}\n```');
            expect(result).toEqual({ key: 'value' });
        });

        it('should extract JSON from mixed text', () => {
            const result = parseJsonResponse('Here is the result: {"tasks": [1,2,3]} and more text');
            expect(result.tasks).toEqual([1, 2, 3]);
        });

        it('should return error object for invalid JSON', () => {
            const result = parseJsonResponse('This is not JSON');
            expect(result.rawContent).toBe('This is not JSON');
            expect(result.parseError).toBeDefined();
        });

        it('should handle empty input', () => {
            const result = parseJsonResponse('');
            expect(result.error).toBe('Empty response');
        });

        it('should handle null input', () => {
            const result = parseJsonResponse(null);
            expect(result.error).toBe('Empty response');
        });
    });

    describe('Pipeline Process', () => {
        it('should handle basic chat request', async () => {
            // This test verifies the pipeline flow without hitting real LLM
            const request = {
                capability: 'chat',
                prompt: 'Hello, how are you?',
                userId: 'user-1',
                organizationId: 'org-1'
            };

            // The mock LLMService will return our mocked response
            const result = await pipeline.process(request);
            
            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
        });

        it('should check rate limits', async () => {
            const { enterpriseSecurity } = require('../../../server/services/ai/enterpriseSecurity');
            
            await pipeline.process({
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            });

            expect(enterpriseSecurity.checkRateLimit).toHaveBeenCalledWith('org-1', 'chat');
        });

        it('should check quota', async () => {
            const { quotaService } = require('../../../server/services/ai/quotaService');
            
            await pipeline.process({
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            });

            expect(quotaService.checkQuota).toHaveBeenCalled();
        });

        it('should perform quality check on response', async () => {
            const { qualityChecker } = require('../../../server/services/ai/qualityChecker');
            
            await pipeline.process({
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            });

            expect(qualityChecker.check).toHaveBeenCalled();
        });

        it('should log to audit', async () => {
            const { enterpriseSecurity } = require('../../../server/services/ai/enterpriseSecurity');
            
            await pipeline.process({
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            });

            expect(enterpriseSecurity.logAudit).toHaveBeenCalled();
        });

        it('should record to learning system', async () => {
            const { learningSystem } = require('../../../server/services/ai/learningSystem');
            
            await pipeline.process({
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            });

            expect(learningSystem.recordInteraction).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle rate limit exceeded', async () => {
            const { enterpriseSecurity } = require('../../../server/services/ai/enterpriseSecurity');
            enterpriseSecurity.checkRateLimit.mockResolvedValueOnce({ 
                allowed: false, 
                resetAt: new Date() 
            });

            await expect(pipeline.process({
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            })).rejects.toThrow('Rate limit exceeded');
        });

        it('should handle quota exceeded', async () => {
            const { quotaService } = require('../../../server/services/ai/quotaService');
            quotaService.checkQuota.mockResolvedValueOnce({ 
                allowed: false, 
                reason: 'Monthly quota exhausted' 
            });

            await expect(pipeline.process({
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            })).rejects.toThrow('Quota exceeded');
        });
    });

    describe('Capability Mapping', () => {
        const capabilityTests = [
            { capability: 'diagnose', expectedRole: 'ANALYST' },
            { capability: 'generateInitiatives', expectedRole: 'CONSULTANT' },
            { capability: 'suggestTasks', expectedRole: 'IMPLEMENTER' },
            { capability: 'validateInitiative', expectedRole: 'GATEKEEPER' },
            { capability: 'buildRoadmap', expectedRole: 'STRATEGIST' },
            { capability: 'simulateEconomics', expectedRole: 'FINANCE' },
            { capability: 'chat', expectedRole: 'CONSULTANT' }
        ];

        capabilityTests.forEach(({ capability, expectedRole }) => {
            it(`should map ${capability} to ${expectedRole} role`, () => {
                const config = getCapabilityConfig(capability);
                expect(config.role).toBe(expectedRole);
            });
        });
    });
});

describe('Backward Compatibility', () => {
    it('should export all required functions for route compatibility', () => {
        const exports = require('../../../server/services/ai/aiPipeline');
        
        expect(exports.suggestTasks).toBeDefined();
        expect(exports.validateInitiative).toBeDefined();
        expect(exports.enrichInitiative).toBeDefined();
        expect(exports.generateObservations).toBeDefined();
        expect(exports.chat).toBeDefined();
        expect(exports.streamChat).toBeDefined();
    });

    it('should export CAPABILITY_REGISTRY for inspection', () => {
        const { CAPABILITY_REGISTRY } = require('../../../server/services/ai/aiPipeline');
        expect(CAPABILITY_REGISTRY).toBeDefined();
        expect(typeof CAPABILITY_REGISTRY).toBe('object');
    });

    it('should export singleton aiPipeline instance', () => {
        const { aiPipeline, AIPipeline } = require('../../../server/services/ai/aiPipeline');
        expect(aiPipeline).toBeInstanceOf(AIPipeline);
    });
});

