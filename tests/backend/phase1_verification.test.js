import { describe, it, expect, beforeAll } from 'vitest';
import db from '../../server/database'; // Adjust path if needed, might need mock
import KnowledgeService from '../../server/services/knowledgeService';
import RagService from '../../server/services/ragService';

// Note: Testing against real SQLite DB in this env might be tricky if it's a singleton relying on file.
// Ideally we mock the DB, but for "Integration Verification" we want to see if the queries run.

describe('Phase 1: Intelligence Layer Verification', () => {

    it('should have new tables in database', async () => {
        return new Promise((resolve) => {
            db.serialize(() => {
                db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                    const tableNames = tables.map(t => t.name);
                    expect(tableNames).toContain('knowledge_candidates');
                    expect(tableNames).toContain('global_strategies');
                    expect(tableNames).toContain('client_context');
                    resolve();
                });
            });
        });
    });

    it('should have embedding column in knowledge_chunks', async () => {
        return new Promise((resolve) => {
            db.all("PRAGMA table_info(knowledge_chunks)", (err, columns) => {
                const colNames = columns.map(c => c.name);
                expect(colNames).toContain('embedding');
                resolve();
            });
        });
    });

    it('KnowledgeService should add and retrieve candidates', async () => {
        const id = await KnowledgeService.addCandidate('Test Idea', 'Reasoning', 'test');
        expect(id).toBeDefined();

        const candidates = await KnowledgeService.getCandidates('pending');
        const found = candidates.find(c => c.id === id);
        expect(found).toBeDefined();
        expect(found.content).toBe('Test Idea');
    });

    it('RagService should have generateEmbedding method', () => {
        expect(typeof RagService.generateEmbedding).toBe('function');
    });

    it('RagService should have getContext method', () => {
        expect(typeof RagService.getContext).toBe('function');
    });

});
