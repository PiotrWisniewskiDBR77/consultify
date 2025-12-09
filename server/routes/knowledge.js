const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge');

// Helper: Run DB Run
const dbRun = (query, params) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

// Helper: Run DB Get
const dbGet = (query, params) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// Helper: Run DB All
const dbAll = (query, params) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// GET /api/knowledge/files
router.get('/files', async (req, res) => {
    try {
        // 1. Check DB for existing docs
        const docs = await dbAll("SELECT * FROM knowledge_docs ORDER BY created_at DESC");

        // 2. Scan directory
        let files = [];
        if (fs.existsSync(KNOWLEDGE_DIR)) {
            files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
        }

        res.json({
            docs,
            availableFiles: files
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// POST /api/knowledge/index
// Triggers indexing of all files in the directory that aren't already indexed
router.post('/index', async (req, res) => {
    try {
        if (!fs.existsSync(KNOWLEDGE_DIR)) {
            return res.status(404).json({ error: 'Knowledge directory not found' });
        }

        const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
        let indexedCount = 0;

        for (const file of files) {
            // Check if already indexed
            const existing = await dbGet("SELECT id FROM knowledge_docs WHERE filename = ?", [file]);
            if (existing) continue;

            const filePath = path.join(KNOWLEDGE_DIR, file);
            const docId = uuidv4();

            // Insert Doc Record
            await dbRun("INSERT INTO knowledge_docs (id, filename, filepath, status) VALUES (?, ?, ?, ?)",
                [docId, file, filePath, 'indexing']);

            try {
                // Read and Parse PDF
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);

                // Chunking Strategy (Simple paragraph/page split)
                // pdf-parse creates long modification strings. We'll split by newlines for now.
                const text = data.text;
                // Simple chunking: ~1000 chars overlap
                const chunkSize = 1000;
                const overlap = 200;
                let chunks = [];

                for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
                    chunks.push(text.substring(i, i + chunkSize));
                }

                // Save Chunks
                let chunkIndex = 0;
                const insertChunk = db.prepare("INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index) VALUES (?, ?, ?, ?)");

                for (const chunkContent of chunks) {
                    if (chunkContent.trim().length > 50) { // filter empty noise
                        insertChunk.run(uuidv4(), docId, chunkContent.trim(), chunkIndex++);
                    }
                }
                insertChunk.finalize();

                // Update Status
                await dbRun("UPDATE knowledge_docs SET status = ? WHERE id = ?", ['indexed', docId]);
                indexedCount++;

            } catch (err) {
                console.error(`Error indexing ${file}:`, err);
                await dbRun("UPDATE knowledge_docs SET status = ? WHERE id = ?", ['error', docId]);
            }
        }

        res.json({ message: 'Indexing complete', indexedCount });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Indexing failed' });
    }
});

// POST /api/knowledge/query
// Simple RAG retrieval
router.post('/query', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        // Very basic semantic search (keyword matching) for MVP
        // In prod, use embeddings (pgvector / pinecone)
        // Here we just use LIKE %keyword% or simple scoring

        const keywords = query.split(' ').filter(w => w.length > 3);
        if (keywords.length === 0) return res.json({ chunks: [] });

        // Build dynamic SQL for keywords
        // Note: This is inefficient but functional for small datasets (8 books)
        const sqlParts = keywords.map(() => "content LIKE ?").join(" OR ");
        const params = keywords.map(w => `%${w}%`);

        const chunks = await dbAll(`
            SELECT content, doc_id, filename 
            FROM knowledge_chunks 
            JOIN knowledge_docs ON knowledge_chunks.doc_id = knowledge_docs.id
            WHERE ${sqlParts} 
            LIMIT 5
        `, params);

        res.json({ chunks });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Query failed' });
    }
});

module.exports = router;
