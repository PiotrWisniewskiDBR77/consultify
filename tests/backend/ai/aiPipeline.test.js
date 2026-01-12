/**
 * AI Pipeline Tests
 * Tests for the main AI processing pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIPipeline } from '../../../server/services/ai/aiPipeline.js';

// Mock dependencies
vi.mock('../../../server/services/ai/aiGateway', () => ({
    AIGateway: class {
        async process() { return true; }
    }
}));

vi.mock('../../../server/services/ai/aiContext', () => ({
    ContextBuilder: class {
        async build({ userId }) {
            return {
                user: { id: userId },
                timestamp: '2025-01-01'
            };
        }
    }
}));

vi.mock('../../../server/services/ai/promptAssembler', () => ({
    PromptAssembler: class {
        async build({ request }) {
            return {
                systemPrompt: "Mock System Prompt",
                messages: [...(request.messages || [])]
            };
        }
    }
}));

vi.mock('../../../server/services/ai/modelRouter', () => ({
    ModelRouter: class {
        async select() {
            return {
                id: 'mock-model',
                provider: 'openai',
                tier: 'STANDARD'
            };
        }
    }
}));

vi.mock('../../../server/services/ai/llmService', () => ({
    LLMService: class {
        async call({ messages }) {
            return {
                content: "Mock AI Response",
                usage: { total_tokens: 10 }
            };
        }
    }
}));

vi.mock('../../../server/services/ai/logger', () => ({
    aiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/qualityChecker', () => ({
    qualityChecker: {
        check: vi.fn().mockResolvedValue({
            passed: true,
            overallScore: 0.9,
            checks: {}
        })
    }
}));

vi.mock('../../../server/services/ai/enterpriseSecurity', () => ({
    enterpriseSecurity: {
        checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
        logAudit: vi.fn().mockResolvedValue({})
    }
}));

vi.mock('../../../server/services/ai/performanceOptimizer', () => ({
    performanceOptimizer: {
        recordMetrics: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/learningSystem', () => ({
    learningSystem: {
        recordInteraction: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/quotaService', () => ({
    quotaService: {
        check: vi.fn().mockResolvedValue({ allowed: true }),
        consume: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/cacheService', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/ragService', () => ({
    ragService: {
        search: vi.fn().mockResolvedValue([])
    }
}));

vi.mock('../../../server/services/ai/memoryManager', () => ({
    memoryManager: {
        retrieve: vi.fn().mockResolvedValue({ chunks: [] }),
        recordIfSignificant: vi.fn()
    }
}));

describe('AIPipeline', () => {
    let pipeline;

    beforeEach(() => {
        pipeline = new AIPipeline();
        vi.clearAllMocks();
    });

    it('should instantiate correctly', () => {
        expect(pipeline).toBeDefined();
        expect(pipeline.gateway).toBeDefined();
        expect(pipeline.contextBuilder).toBeDefined();
        expect(pipeline.promptAssembler).toBeDefined();
        expect(pipeline.modelRouter).toBeDefined();
        expect(pipeline.llmService).toBeDefined();
    });

    it('should have process method', () => {
        expect(typeof pipeline.process).toBe('function');
    });

    it('should have executeWithFallback method', () => {
        expect(typeof pipeline.executeWithFallback).toBe('function');
    });

    it('should have isNonRetryableError method', () => {
        expect(typeof pipeline.isNonRetryableError).toBe('function');
    });

    describe('isNonRetryableError()', () => {
        it('should return true for authentication errors', () => {
            // Method expects error object with message
            expect(pipeline.isNonRetryableError({ message: 'unauthorized access' })).toBe(true);
            expect(pipeline.isNonRetryableError({ message: 'authentication failed' })).toBe(true);
        });

        it('should return true for budget errors', () => {
            expect(pipeline.isNonRetryableError({ message: 'insufficient budget' })).toBe(true);
            expect(pipeline.isNonRetryableError({ message: 'quota exceeded' })).toBe(true);
        });

        it('should return false for other errors', () => {
            expect(pipeline.isNonRetryableError({ message: 'timeout error' })).toBe(false);
            expect(pipeline.isNonRetryableError({ message: 'network error' })).toBe(false);
        });

        it('should handle errors without message', () => {
            expect(pipeline.isNonRetryableError({})).toBe(false);
            expect(pipeline.isNonRetryableError({ message: '' })).toBe(false);
        });
    });
});
