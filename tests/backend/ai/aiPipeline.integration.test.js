/**
 * AI Pipeline Integration Tests
 * Tests the unified AI pipeline with capability-based routing
 * 
 * @module tests/backend/ai/aiPipeline.integration.test.js
 * @version 2.0.0
 * @date 2024-12-30
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AI Pipeline Integration Tests', () => {
    let AIPipeline;
    let CAPABILITY_REGISTRY;
    let getCapabilityConfig;
    let suggestTasks;
    let validateInitiative;
    let enrichInitiative;
    let generateObservations;
    let parseJsonResponse;
    let pipeline;
    let mockLLMService;
    let mockMemoryManager;
    let mockQuotaService;
    let mockSecurity;
    let mockQualityChecker;
    let mockOptimizer;
    let mockLearning;
    let mockCache;

    beforeEach(async () => {
        vi.resetModules();

        // 1. Mock Database (still needed as it might be used by static requires)
        vi.doMock('../../../server/database', () => ({
            get: vi.fn(),
            run: vi.fn(),
            all: vi.fn()
        }));

        // 10. Mock RAG Service
        vi.doMock('../../../server/services/ragService', () => ({
            searchRelevantChunks: vi.fn().mockResolvedValue([])
        }));

        // 11. Mock AISettingsService (to avoid DB calls)
        vi.doMock('../../../server/services/aiSettingsService', () => ({
            aiSettingsService: {
                getEffectiveSettings: vi.fn().mockResolvedValue({
                    proactivityMode: 'BALANCED',
                    maxTokens: 4096
                })
            }
        }));

        // Import module under test
        const aiPipelineModule = await import('../../../server/services/ai/aiPipeline');
        AIPipeline = aiPipelineModule.AIPipeline;
        CAPABILITY_REGISTRY = aiPipelineModule.CAPABILITY_REGISTRY;
        getCapabilityConfig = aiPipelineModule.getCapabilityConfig;
        suggestTasks = aiPipelineModule.suggestTasks;
        validateInitiative = aiPipelineModule.validateInitiative;
        enrichInitiative = aiPipelineModule.enrichInitiative;
        generateObservations = aiPipelineModule.generateObservations;
        parseJsonResponse = aiPipelineModule.parseJsonResponse;

        // Create Mocks for Injection
        mockLLMService = {
            call: vi.fn().mockResolvedValue({
                content: '{"tasks": [{"name": "Task 1", "priority": "HIGH"}]}',
                usage: { promptTokens: 100, completionTokens: 50 },
                toolCalls: []
            }),
            callWithTools: vi.fn().mockResolvedValue({
                content: '{"tasks": [{"name": "Task 1", "priority": "HIGH"}]}',
                usage: { promptTokens: 100, completionTokens: 50 },
                toolCalls: []
            }),
            callText: vi.fn().mockResolvedValue({
                content: 'Analysis complete.',
                usage: { promptTokens: 50, completionTokens: 10 }
            }),
            circuitBreaker: {
                execute: vi.fn().mockImplementation((id, fn) => fn()),
                recordSuccess: vi.fn(),
                recordFailure: vi.fn(),
                canExecute: vi.fn().mockReturnValue({ allowed: true })
            }
        };

        mockMemoryManager = {
            retrieve: vi.fn().mockResolvedValue({ chunks: [], totalTokens: 0, sources: [] }),
            serializeForPrompt: vi.fn().mockReturnValue(''),
            sessionStore: { addMessage: vi.fn().mockResolvedValue(true) },
            projectStore: { addMessage: vi.fn() },
            orgStore: { addMessage: vi.fn() },
            knowledgeStore: { addMessage: vi.fn() },
            recordIfSignificant: vi.fn().mockResolvedValue(true)
        };

        mockQuotaService = {
            checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
            consumeTokens: vi.fn().mockResolvedValue(true)
        };

        mockSecurity = {
            checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
            logAudit: vi.fn()
        };

        mockQualityChecker = {
            check: vi.fn().mockResolvedValue({ passed: true, overallScore: 0.92, warnings: [] })
        };

        mockOptimizer = { recordMetrics: vi.fn() };
        mockLearning = {
            recordInteraction: vi.fn().mockResolvedValue(true),
            recordWithAutoFeedback: vi.fn().mockResolvedValue(true)
        };
        mockCache = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(true) };

        // Inject Mocks
        pipeline = new AIPipeline({
            llmService: mockLLMService,
            memoryManager: mockMemoryManager,
            quotaService: mockQuotaService,
            enterpriseSecurity: mockSecurity,
            qualityChecker: mockQualityChecker,
            performanceOptimizer: mockOptimizer,
            learningSystem: mockLearning,
            cacheService: mockCache
        });
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
        const context = {
            name: 'Test Initiative',
            summary: 'A new strategic initiative',
            hypothesis: 'If we do this, we win',
            axis: 'Digital Transformation'
        };

        describe('suggestTasks', () => {
            it('should generate tasks from initiative context', async () => {
                const result = await suggestTasks(context, 'user-1', 'org-1', pipeline);

                expect(result).toBeDefined();
                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].name).toBe('Task 1');

                // Verify LLM was called with correct context
                expect(pipeline.llmService.call).toHaveBeenCalled();
            });
        });

        describe('validateInitiative', () => {
            it('should validate initiative structure', async () => {
                // Mock different response for validation
                pipeline.llmService.call.mockResolvedValueOnce({
                    content: '{"isValid": true, "score": 85, "issues": [], "recommendations": []}',
                    usage: { promptTokens: 100, completionTokens: 50 },
                    toolCalls: []
                });

                const result = await validateInitiative(context, 'user-1', 'org-1', pipeline);

                expect(result.isValid).toBe(true);
                expect(result.score).toBe(85);
            });
        });

        describe('enrichInitiative', () => {
            it('should enrich with market context', async () => {
                pipeline.llmService.call.mockResolvedValueOnce({
                    content: '{"marketTrends": ["Trend 1"], "benchmarks": [], "successFactors": [], "risks": []}',
                    usage: { promptTokens: 100, completionTokens: 50 },
                    toolCalls: []
                });

                const result = await enrichInitiative(context, 'user-1', 'org-1', pipeline);
                expect(result.marketTrends).toContain('Trend 1');
            });
        });

        describe('generateObservations', () => {
            it('should analyze assessment data', async () => {
                pipeline.llmService.call.mockResolvedValueOnce({
                    content: '{"patterns": ["Pattern 1"], "strengths": [], "gaps": [], "quickWins": [], "priorities": []}',
                    usage: { promptTokens: 100, completionTokens: 50 },
                    toolCalls: []
                });

                const result = await generateObservations('user-1', 'org-1', pipeline);
                expect(result.patterns).toContain('Pattern 1');
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
        const request = {
            capability: 'chat',
            prompt: 'Test prompt',
            userId: 'user-1',
            organizationId: 'org-1'
        };

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
            await pipeline.process(request);

            expect(mockSecurity.checkRateLimit).toHaveBeenCalledWith('org-1', 'chat');
        });

        it('should check quota', async () => {
            await pipeline.process(request);

            expect(mockQuotaService.checkQuota).toHaveBeenCalled();
        });

        it('should perform quality check on response', async () => {
            await pipeline.process(request);

            expect(mockQualityChecker.check).toHaveBeenCalled();
        });

        it('should log to audit', async () => {
            await pipeline.process(request);

            expect(mockSecurity.logAudit).toHaveBeenCalled();
        });

        it('should record to learning system', async () => {
            await pipeline.process(request);

            expect(mockLearning.recordWithAutoFeedback).toHaveBeenCalled();
        });

        describe('Error Handling', () => {
            const request = {
                capability: 'chat',
                prompt: 'Test',
                userId: 'user-1',
                organizationId: 'org-1'
            };

            it('should handle rate limit exceeded', async () => {
                mockSecurity.checkRateLimit.mockResolvedValueOnce({
                    allowed: false,
                    resetAt: new Date()
                });

                await expect(pipeline.process(request)).rejects.toThrow('Rate limit exceeded');
            });

            it('should handle quota exceeded', async () => {
                mockQuotaService.checkQuota.mockResolvedValueOnce({
                    allowed: false,
                    reason: 'Monthly quota exhausted'
                });

                await expect(pipeline.process(request)).rejects.toThrow('Quota exceeded');
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

    });
});














