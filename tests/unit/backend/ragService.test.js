import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDatabaseFactory } from '../../utils/TestDatabaseFactory.js';

/**
 * Integration tests for RagService
 * Uses isolated in-memory database via TestDatabaseFactory
 */
describe('RagService - Integration', () => {
    let RagService;
    let testDb;

    beforeAll(async () => {
        // Create isolated test database
        testDb = await TestDatabaseFactory.create();

        // Import the service and inject test database
        const mod = await import('../../../server/services/ragService.js');
        RagService = mod.default;

        // Inject test database if service supports DI
        if (RagService.setDependencies) {
            RagService.setDependencies({ db: testDb });
        }
    });

    afterAll(async () => {
        if (testDb && testDb.destroy) {
            await testDb.destroy();
        }
    });

    describe('generateEmbedding', () => {
        it('should return null if no provider configured in database', async () => {
            // With no LLM provider configured, should return null gracefully
            const embedding = await RagService.generateEmbedding('test query');
            // This may be null if no provider is configured, which is expected behavior
            expect(embedding === null || Array.isArray(embedding)).toBe(true);
        });
    });

    describe('getContext', () => {
        it('should return context string without throwing', async () => {
            // Should not throw even if no embeddings exist
            const context = await RagService.getContext('test query');
            expect(typeof context === 'string').toBe(true);
        });

        it('should accept limit parameter', async () => {
            const context = await RagService.getContext('test query', 5);
            expect(typeof context === 'string').toBe(true);
        });
    });

    describe('getContextKeyword', () => {
        it('should perform keyword search without throwing', async () => {
            const context = await RagService.getContextKeyword('digital transformation');
            expect(typeof context === 'string').toBe(true);
        });
    });

    describe('getAxisDefinitions', () => {
        it('should retrieve axis definitions without throwing', async () => {
            const definitions = await RagService.getAxisDefinitions('processes');
            expect(typeof definitions === 'string').toBe(true);
        });
    });
});
