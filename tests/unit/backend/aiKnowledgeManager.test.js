import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('AI Knowledge Manager Service', () => {
    let AIKnowledgeManager;
    let mockDb;
    let mockRagService;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        mockRagService = {
            generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
            storeChunks: vi.fn().mockResolvedValue({})
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('../../../server/services/ragService', () => ({ default: mockRagService }));

        AIKnowledgeManager = require('../../../server/services/aiKnowledgeManager.js');
        
        // Inject mock dependencies
        AIKnowledgeManager.setDependencies({
            db: mockDb,
            RagService: mockRagService,
            uuidv4: () => 'mock-uuid-doc'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/services/ragService');
    });

    describe('Logic: _cosineSimilarity', () => {
        it('should calculate similarity correctly', () => {
            const vecA = [1, 0, 0];
            const vecB = [1, 0, 0];
            const vecC = [0, 1, 0];

            expect(AIKnowledgeManager._cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
            expect(AIKnowledgeManager._cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0);
        });

        it('should handle empty or mismatched vectors', () => {
            expect(AIKnowledgeManager._cosineSimilarity([], [])).toBeNaN();
            expect(AIKnowledgeManager._cosineSimilarity([1], [1, 2])).toBe(0);
        });
    });

    describe('Logic: _formatKnowledgeForPrompt', () => {
        it('should format chunks with citations', () => {
            const chunks = [
                { filename: 'doc1.pdf', score: 0.9, content: 'Content 1' },
                { filename: 'doc2.txt', score: 0.5, content: 'Content 2' }
            ];

            const formatted = AIKnowledgeManager._formatKnowledgeForPrompt(chunks, true);
            expect(formatted).toContain('### INTERNAL KNOWLEDGE BASE');
            expect(formatted).toContain('doc1.pdf (90% relevance)');
            expect(formatted).toContain('Content 1');
        });
    });

    describe('getContextualKnowledge', () => {
        it('should retrieve and rank knowledge chunks', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('project_rag_settings')) {
                    cb(null, { rag_enabled: 1, min_relevance_score: 0.5, max_chunks_per_query: 5 });
                } else {
                    cb(null, null);
                }
            });

            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, [
                    { 
                        id: 'c1', 
                        content: 'Test content', 
                        embedding: JSON.stringify([1, 0, 0]), 
                        doc_id: 'doc1',
                        filename: 'f1.pdf',
                        phase: 'Planning',
                        knowledge_type: 'general'
                    }
                ]);
            });

            const result = await AIKnowledgeManager.getContextualKnowledge({
                organizationId: 'org-1',
                projectId: 'project-1',
                query: 'test query',
                maxChunks: 5
            });

            expect(result).toBeDefined();
            expect(result.chunksUsed).toBeGreaterThanOrEqual(0);
            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should return empty when organizationId missing', async () => {
            const result = await AIKnowledgeManager.getContextualKnowledge({
                projectId: 'project-1',
                query: 'test'
            });

            expect(result.scoped).toBe(false);
            expect(result.context).toBe('');
        });
    });

    describe('captureDecision', () => {
        it('should store decision and generate embeddings', async () => {
            mockDb.run.mockImplementation(function (sql, params, cb) { 
                if (cb) cb.call({ changes: 1 }, null); 
            });

            const result = await AIKnowledgeManager.captureDecision({ 
                organizationId: 'o1', 
                projectId: 'p1',
                title: 'Test Decision',
                rationale: 'Test rationale',
                outcome: 'Approved',
                phase: 'Planning',
                createdBy: 'user-1'
            });
            
            expect(result.captured).toBe(true);
            expect(result.docId).toBeDefined();
            expect(mockRagService.storeChunks).toHaveBeenCalled();
        });
    });
});
