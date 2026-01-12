/**
 * Learning System Tests
 * Tests for AI pattern learning and improvement
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LearningSystem } from '../../../server/services/ai/learningSystem.js';

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        run: vi.fn((sql, params, callback) => {
            if (callback) callback(null);
            return Promise.resolve();
        }),
        get: vi.fn((sql, params, callback) => {
            if (callback) callback(null, null);
            return Promise.resolve(null);
        }),
        all: vi.fn((sql, params, callback) => {
            if (callback) callback(null, []);
            return Promise.resolve([]);
        })
    }
}));

// Mock logger
vi.mock('../../../server/services/ai/logger', () => ({
    aiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('LearningSystem', () => {
    let learning;

    beforeEach(() => {
        learning = new LearningSystem();
        vi.clearAllMocks();
    });

    describe('hashPrompt()', () => {
        it('should create consistent hash for same prompts', () => {
            const prompt1 = 'What is the project status?';
            const prompt2 = 'What is the project status?';

            expect(learning.hashPrompt(prompt1)).toBe(learning.hashPrompt(prompt2));
        });

        it('should normalize case differences', () => {
            const prompt1 = 'WHAT is the Project STATUS?';
            const prompt2 = 'what is the project status?';

            expect(learning.hashPrompt(prompt1)).toBe(learning.hashPrompt(prompt2));
        });

        it('should normalize whitespace', () => {
            const prompt1 = 'What   is   the   status?';
            const prompt2 = 'What is the status?';

            expect(learning.hashPrompt(prompt1)).toBe(learning.hashPrompt(prompt2));
        });

        it('should normalize numbers', () => {
            const prompt1 = 'Show report for 2024';
            const prompt2 = 'Show report for 2023';

            expect(learning.hashPrompt(prompt1)).toBe(learning.hashPrompt(prompt2));
        });

        it('should return different hashes for different prompts', () => {
            const prompt1 = 'What is the project status?';
            const prompt2 = 'What are the risks?';

            expect(learning.hashPrompt(prompt1)).not.toBe(learning.hashPrompt(prompt2));
        });

        it('should handle empty prompts', () => {
            expect(learning.hashPrompt('')).toBe('0');
            expect(learning.hashPrompt(null)).toBe('0');
            expect(learning.hashPrompt(undefined)).toBe('0');
        });

        it('should return string hash', () => {
            const hash = learning.hashPrompt('Test prompt');

            expect(typeof hash).toBe('string');
        });
    });

    describe('recordInteraction()', () => {
        it('should record interaction without errors', async () => {
            const interaction = {
                userId: 'user-1',
                organizationId: 'org-1',
                requestType: 'chat',
                prompt: 'What is the status?',
                response: 'The project is on track.',
                metadata: { qualityScore: 0.85 }
            };

            await expect(learning.recordInteraction(interaction)).resolves.not.toThrow();
        });

        it('should handle missing optional fields', async () => {
            const interaction = {
                userId: 'user-1',
                organizationId: 'org-1',
                requestType: 'chat',
                prompt: 'Test'
            };

            await expect(learning.recordInteraction(interaction)).resolves.not.toThrow();
        });

        it('should handle feedback data', async () => {
            const interaction = {
                userId: 'user-1',
                organizationId: 'org-1',
                requestType: 'analysis',
                prompt: 'Analyze the data',
                feedback: { score: 5, comment: 'Great!' }
            };

            await expect(learning.recordInteraction(interaction)).resolves.not.toThrow();
        });
    });

    describe('getPatterns()', () => {
        it('should return patterns structure', async () => {
            const patterns = await learning.getPatterns('org-1', 'chat');

            expect(patterns).toHaveProperty('successful');
            expect(patterns).toHaveProperty('failed');
            expect(patterns).toHaveProperty('confidence');
            expect(Array.isArray(patterns.successful)).toBe(true);
            expect(Array.isArray(patterns.failed)).toBe(true);
        });
    });

    describe('getPromptSuggestions()', () => {
        it('should return no suggestions when confidence is low', async () => {
            // Mock low confidence patterns
            vi.spyOn(learning, 'getPatterns').mockResolvedValue({
                successful: [],
                failed: [],
                confidence: 0.2
            });

            const result = await learning.getPromptSuggestions('org-1', 'chat');

            expect(result.suggestions).toEqual([]);
            expect(result.message).toContain('Niewystarczająca');
        });

        it('should generate suggestions for failed patterns', async () => {
            vi.spyOn(learning, 'getPatterns').mockResolvedValue({
                successful: [],
                failed: [{ prompt_hash: 'abc', frequency: 5, avg_score: 1.5 }],
                confidence: 0.5,
                sampleCount: 50
            });

            const result = await learning.getPromptSuggestions('org-1', 'chat');

            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.suggestions[0].type).toBe('AVOID');
            expect(result.suggestions[0].priority).toBe('HIGH');
        });

        it('should generate suggestions for successful patterns', async () => {
            vi.spyOn(learning, 'getPatterns').mockResolvedValue({
                successful: [{ prompt_hash: 'xyz', frequency: 10, avg_score: 4.8 }],
                failed: [],
                confidence: 0.6,
                sampleCount: 60
            });

            const result = await learning.getPromptSuggestions('org-1', 'chat');

            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.suggestions[0].type).toBe('REINFORCE');
        });

        it('should calculate improvement potential', async () => {
            vi.spyOn(learning, 'getPatterns').mockResolvedValue({
                successful: [{ prompt_hash: 'a' }, { prompt_hash: 'b' }],
                failed: [{ prompt_hash: 'c' }],
                confidence: 0.5
            });

            const result = await learning.getPromptSuggestions('org-1', 'chat');

            expect(result.improvementPotential).toBe(33); // 1 out of 3 = 33%
        });
    });

    describe('getAnalytics()', () => {
        it('should return analytics object', async () => {
            const analytics = await learning.getAnalytics('org-1');

            expect(analytics).toHaveProperty('totalInteractions');
            expect(analytics).toHaveProperty('averageFeedback');
            expect(analytics).toHaveProperty('averageQuality');
        });

        it('should return organization-specific analytics', async () => {
            const analytics = await learning.getAnalytics('org-specific');

            expect(analytics).toBeDefined();
        });

        it('should return global analytics when no org specified', async () => {
            const analytics = await learning.getAnalytics();

            expect(analytics).toBeDefined();
        });
    });

    describe('applyLearning()', () => {
        it('should not modify prompt when confidence is low', async () => {
            vi.spyOn(learning, 'getPatterns').mockResolvedValue({
                successful: [],
                failed: [],
                confidence: 0.3
            });

            const originalPrompt = 'Original prompt text';
            const result = await learning.applyLearning(originalPrompt, 'org-1', 'chat');

            expect(result).toBe(originalPrompt);
        });

        it('should enhance prompt when confidence is high', async () => {
            vi.spyOn(learning, 'getPatterns').mockResolvedValue({
                successful: [{ prompt_hash: 'abc' }],
                failed: [],
                confidence: 0.7,
                sampleCount: 100
            });

            const originalPrompt = 'Original prompt text';
            const result = await learning.applyLearning(originalPrompt, 'org-1', 'chat');

            expect(result).toContain(originalPrompt);
            expect(result).toContain('[LEARNING_CONTEXT:');
            expect(result).toContain('100');
        });

        it('should not add context when no successful patterns', async () => {
            vi.spyOn(learning, 'getPatterns').mockResolvedValue({
                successful: [],
                failed: [{ prompt_hash: 'xyz' }],
                confidence: 0.7,
                sampleCount: 70
            });

            const originalPrompt = 'Original prompt';
            const result = await learning.applyLearning(originalPrompt, 'org-1', 'chat');

            expect(result).toBe(originalPrompt);
        });
    });

    describe('Configuration', () => {
        it('should have default learning rate', () => {
            expect(learning.learningRate).toBe(0.1);
        });

        it('should have minimum samples threshold', () => {
            expect(learning.minSamples).toBe(10);
        });

        it('should initialize with empty patterns', () => {
            expect(learning.patterns.successful).toEqual([]);
            expect(learning.patterns.failed).toEqual([]);
        });
    });

    describe('maybeExtractPatterns()', () => {
        it('should handle pattern extraction gracefully', async () => {
            // Test that the method doesn't throw
            await expect(learning.maybeExtractPatterns('org-1', 'chat')).resolves.not.toThrow();
        });
    });

    describe('storePatterns()', () => {
        it('should store patterns without errors', async () => {
            const patterns = {
                successful: [{ prompt_hash: 'a' }],
                failed: [{ prompt_hash: 'b' }]
            };

            await expect(learning.storePatterns('org-1', 'chat', patterns)).resolves.not.toThrow();
        });
    });
});
