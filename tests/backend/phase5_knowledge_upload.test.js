import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import KnowledgeService from '../../server/services/knowledgeService';
import db from '../../server/database';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 5: Knowledge Ingestion', () => {

    const docId = uuidv4();

    // Cleanup helper
    const cleanup = async () => {
        return new Promise(resolve => {
            db.run("DELETE FROM knowledge_chunks WHERE doc_id = ?", [docId], () => {
                db.run("DELETE FROM knowledge_docs WHERE id = ?", [docId], resolve);
            });
        });
    }

    it('should add a document metadata record', async () => {
        const id = await KnowledgeService.addDocument('test-doc.pdf', '/tmp/test-doc.pdf');
        expect(id).toBeDefined();

        // Check DB
        const docs = await KnowledgeService.getDocuments();
        const doc = docs.find(d => d.id === id);
        expect(doc).toBeDefined();
        expect(doc.filename).toBe('test-doc.pdf');
        expect(doc.status).toBe('pending');

        // Clean up this specific doc id if different from suite var (it returns new id)
        await new Promise(r => db.run("DELETE FROM knowledge_docs WHERE id = ?", [id], r));
    });

    it('should process text content into chunks and index them', async () => {
        // 1. Create Doc
        await new Promise(r => db.run("INSERT INTO knowledge_docs (id, filename, filepath, status) VALUES (?, ?, ?, ?)",
            [docId, 'manual-test.txt', '/tmp/manual.txt', 'pending'], r));

        // 2. Process Content
        const content = `
        This is a test document about AI Strategy.
        It has multiple lines and should be chunked.
        
        AI Strategy involves Data, Technology, and People.
        `;

        const chunkCount = await KnowledgeService.processDocument(docId, content);
        expect(chunkCount).toBeGreaterThan(0);

        // 3. Verify Chunks in DB
        const chunks = await new Promise((resolve) => {
            db.all("SELECT * FROM knowledge_chunks WHERE doc_id = ?", [docId], (err, rows) => resolve(rows));
        });

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].embedding).toBeDefined(); // Expects RagService mock or real call to return something or null

        // 4. Verify Doc Status Updated
        const doc = await new Promise((resolve) => {
            db.get("SELECT * FROM knowledge_docs WHERE id = ?", [docId], (err, row) => resolve(row));
        });
        expect(doc.status).toBe('indexed');

        await cleanup();
    });

});
