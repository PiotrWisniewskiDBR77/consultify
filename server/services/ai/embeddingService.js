/**
 * Embedding Service
 * Generate and store vector embeddings using OpenAI text-embedding-3-small
 */

const { createOpenAI } = require('@ai-sdk/openai');
const db = require('../../database');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

class EmbeddingService {
    constructor() {
        this.openai = null;
        this.initProvider();
    }

    initProvider() {
        if (process.env.OPENAI_API_KEY) {
            this.openai = createOpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }
    }

    /**
     * Generate embedding for a text chunk
     * @param {string} text - Text to embed
     * @returns {number[]} Embedding vector
     */
    async generateEmbedding(text) {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            // Use fetch directly as AI SDK doesn't expose embeddings
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: text.substring(0, 8000) // Max input for embedding
                })
            });

            if (!response.ok) {
                throw new Error(`Embedding API error: ${response.status}`);
            }

            const data = await response.json();
            return data.data[0].embedding;

        } catch (error) {
            console.error('[EmbeddingService] Error:', error.message);
            throw error;
        }
    }

    /**
     * Store chunk with embedding in database
     * Works with both SQLite (JSON) and PostgreSQL (pgvector)
     */
    async storeChunk(chunk, embedding) {
        const { content, chunkIndex, documentId, organizationId, metadata } = chunk;

        // Detect database type
        const isPg = process.env.DB_TYPE === 'postgres';

        if (isPg) {
            // PostgreSQL with pgvector
            return this.storeChunkPg(chunk, embedding);
        } else {
            // SQLite fallback (store as JSON)
            return this.storeChunkSqlite(chunk, embedding);
        }
    }

    async storeChunkSqlite(chunk, embedding) {
        const { content, chunkIndex, documentId, organizationId, metadata } = chunk;
        import { v4 as uuidv4 } from 'uuid';

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ai_knowledge_embeddings 
                 (id, organization_id, document_id, chunk_index, content, embedding, metadata, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    uuidv4(),
                    organizationId,
                    documentId,
                    chunkIndex,
                    content,
                    JSON.stringify(embedding), // Store as JSON in SQLite
                    JSON.stringify(metadata || {})
                ],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    async storeChunkPg(chunk, embedding) {
        // PostgreSQL with pgvector - use native vector type
        const { content, chunkIndex, documentId, organizationId, metadata, sourceType } = chunk;

        // Format embedding as pgvector literal: '[0.1,0.2,...]'
        const vectorLiteral = `[${embedding.join(',')}]`;

        return new Promise((resolve, reject) => {
            db.query(
                `INSERT INTO ai_knowledge_embeddings 
                 (document_id, chunk_index, chunk_text, embedding, metadata, source_type)
                 VALUES ($1, $2, $3, $4::vector, $5, $6)
                 RETURNING id`,
                [
                    documentId,
                    chunkIndex || 0,
                    content,
                    vectorLiteral,
                    JSON.stringify(metadata || {}),
                    sourceType || 'project'
                ],
                (err, result) => {
                    if (err) reject(err);
                    else resolve({ id: result.rows[0]?.id });
                }
            );
        });
    }

    /**
     * Search for similar chunks using cosine similarity
     * @param {string} query - Search query
     * @param {Object} options - Search options
     */
    async search(query, options = {}) {
        const { limit = 5, organizationId, minSimilarity = 0.5 } = options;

        // Generate embedding for query
        const queryEmbedding = await this.generateEmbedding(query);

        const isPg = process.env.DB_TYPE === 'postgres';

        if (isPg) {
            return this.searchPg(queryEmbedding, options);
        } else {
            return this.searchSqlite(queryEmbedding, options);
        }
    }

    /**
     * SQLite search - compute cosine similarity in JS
     */
    async searchSqlite(queryEmbedding, options) {
        const { limit = 5, organizationId, minSimilarity = 0.5 } = options;

        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM ai_knowledge_embeddings`;
            const params = [];

            if (organizationId) {
                sql += ` WHERE organization_id = ?`;
                params.push(organizationId);
            }

            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!rows || rows.length === 0) {
                    resolve([]);
                    return;
                }

                // Compute cosine similarity for each row
                const results = rows.map(row => {
                    const embedding = JSON.parse(row.embedding || '[]');
                    const similarity = this.cosineSimilarity(queryEmbedding, embedding);
                    return {
                        ...row,
                        similarity,
                        metadata: JSON.parse(row.metadata || '{}')
                    };
                })
                    .filter(r => r.similarity >= minSimilarity)
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, limit);

                resolve(results);
            });
        });
    }

    /**
     * PostgreSQL search - use pgvector operators
     */
    async searchPg(queryEmbedding, options) {
        const { limit = 5, organizationId, minSimilarity = 0.5, sourceType } = options;

        // Format query embedding as pgvector literal
        const vectorLiteral = `[${queryEmbedding.join(',')}]`;

        let sql = `
            SELECT 
                id,
                document_id,
                chunk_text as content,
                metadata,
                source_type,
                1 - (embedding <=> $1::vector) as similarity
            FROM ai_knowledge_embeddings
            WHERE 1 - (embedding <=> $1::vector) > $2
        `;
        const params = [vectorLiteral, minSimilarity];
        let paramIndex = 3;

        if (sourceType) {
            sql += ` AND source_type = $${paramIndex}`;
            params.push(sourceType);
            paramIndex++;
        }

        sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIndex}`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, result) => {
                if (err) {
                    console.error('[EmbeddingService] PostgreSQL search error:', err.message);
                    reject(err);
                    return;
                }
                
                const rows = result.rows || [];
                resolve(rows.map(row => ({
                    ...row,
                    metadata: typeof row.metadata === 'string' 
                        ? JSON.parse(row.metadata) 
                        : row.metadata
                })));
            });
        });
    }

    /**
     * Compute cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Ensure the embeddings table exists
     */
    async ensureTable() {
        const isPg = process.env.DB_TYPE === 'postgres';

        if (isPg) {
            // PostgreSQL with pgvector
            console.log('[EmbeddingService] PostgreSQL - run migration for pgvector');
        } else {
            // SQLite
            return new Promise((resolve) => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS ai_knowledge_embeddings (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        document_id TEXT,
                        chunk_index INTEGER,
                        content TEXT NOT NULL,
                        embedding TEXT,
                        metadata TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) console.warn('[EmbeddingService] Table creation:', err.message);
                    resolve();
                });
            });
        }
    }
}

// Singleton
const embeddingService = new EmbeddingService();

export default {
    EmbeddingService,
    embeddingService,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS
};
