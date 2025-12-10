import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for KnowledgeService
 * Uses real database - tests actual service behavior
 */
describe('KnowledgeService - Integration', () => {
    let KnowledgeService;

    beforeAll(async () => {
        // Clear any mock flags
        delete process.env.MOCK_DB;

        // Import the real service (no mocks)
        const mod = await import('../../../server/services/knowledgeService.js');
        KnowledgeService = mod.default;
    });

    describe('Candidate Management', () => {
        it('should add a candidate idea without throwing', async () => {
            const testCandidate = {
                content: 'Test knowledge candidate ' + Date.now(),
                reasoning: 'Test reasoning',
                source: 'test'
            };

            await expect(
                KnowledgeService.addCandidate(testCandidate.content, testCandidate.reasoning, testCandidate.source)
            ).resolves.not.toThrow();
        });

        it('should get candidates without throwing', async () => {
            const candidates = await KnowledgeService.getCandidates('pending');
            expect(Array.isArray(candidates)).toBe(true);
        });
    });

    describe('Strategies', () => {
        it('should add a global strategy without throwing', async () => {
            const uniqueTitle = 'Test Strategy ' + Date.now();

            await expect(
                KnowledgeService.addStrategy(uniqueTitle, 'Test description')
            ).resolves.not.toThrow();
        });

        it('should get active strategies without throwing', async () => {
            const strategies = await KnowledgeService.getActiveStrategies();
            expect(Array.isArray(strategies)).toBe(true);
        });
    });

    describe('Document Management', () => {
        it('should get knowledge documents without throwing', async () => {
            const docs = await KnowledgeService.getDocuments();
            expect(Array.isArray(docs)).toBe(true);
        });
    });
});
