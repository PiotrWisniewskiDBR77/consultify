const db = require('../database');
const { OpenAI } = require('openai'); // Assuming openai package is available

// Import new embedding service
const { embeddingService } = require('./ai/embeddingService');

// Helper: Cosine Similarity
const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const RagService = {
    /**
     * Generates an embedding for the given text using the configured provider (default: OpenAI).
     */
    generateEmbedding: async (text) => {
        return new Promise((resolve, reject) => {
            // 1. Get embedding provider
            db.get("SELECT * FROM llm_providers WHERE provider = 'openai' AND is_active = 1 LIMIT 1", async (err, row) => {
                if (err || !row) {
                    // Fallback - no embedding provider configured
                    return resolve(null);
                }

                try {
                    const openai = new OpenAI({ apiKey: row.api_key });
                    const response = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: text,
                        encoding_format: "float",
                    });
                    resolve(response.data[0].embedding);
                } catch (e) {
                    console.error("[RAG] Embedding Error:", e);
                    resolve(null);
                }
            });
        });
    },

    /**
     * Retrieves relevant context using Vector Search (Cosine Similarity).
     * @param {string} query - The search query
     * @param {number} limit - Number of chunks to return
     * @param {Object} filterOptions - { organizationId, screenContext }
     */
    getContext: async (query, limit = 3, filterOptions = {}) => {
        const { organizationId, screenContext } = filterOptions;

        // 0. Contextual Query Expansion
        let expandedQuery = query;
        if (screenContext) {
            // E.g. if viewing "Strategy" screen, hint the search
            const screenTitle = screenContext.data?._meta?.title || screenContext.screenId || '';
            if (screenTitle) expandedQuery += ` ${screenTitle}`;
        }

        // 1. Generate Query Embedding
        const queryEmbedding = await RagService.generateEmbedding(expandedQuery);

        return new Promise((resolve, reject) => {
            if (!queryEmbedding) {
                // Fallback to Keyword Search if no embedding
                return resolve(RagService.getContextKeyword(expandedQuery, limit, organizationId));
            }

            // 2. Fetch chunks with Secure Filtering
            // We join with knowledge_docs to filter by organization_id
            let sql = `
                SELECT c.content, d.filename, c.embedding 
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE c.embedding IS NOT NULL
            `;
            const params = [];

            if (organizationId) {
                sql += " AND d.organization_id = ?";
                params.push(organizationId);
            }

            // Optimization: In a real DB, use a Vector Index. 
            db.all(sql, params, (err, rows) => {
                if (err) return resolve('');

                if (!rows || rows.length === 0) {
                    return resolve(RagService.getContextKeyword(expandedQuery, limit, organizationId));
                }

                // 3. Rank by Similarity
                const scored = rows.map(row => {
                    let vec;
                    try {
                        vec = JSON.parse(row.embedding);
                    } catch (e) { return { ...row, score: 0 }; }

                    return {
                        ...row,
                        score: cosineSimilarity(queryEmbedding, vec)
                    };
                });

                // 4. Sort and Slice
                scored.sort((a, b) => b.score - a.score);
                const topChunks = scored.slice(0, limit);

                // 5. Format Context
                const context = topChunks
                    .filter(c => c.score > 0.5) // Minimum relevance threshold
                    .map(r => `[Source: ${r.filename}] (Relevance: ${Math.round(r.score * 100)}%)\n${r.content}`)
                    .join('\n\n');

                // GAP-13: Log RAG query for audit
                // Only log if organizationId is available (required by NOT NULL constraint)
                if (organizationId) {
                    db.run(`INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
                            VALUES (?, ?, NULL, 'rag_query', 'knowledge', NULL, ?, CURRENT_TIMESTAMP)`,
                        [require('uuid').v4(), organizationId, JSON.stringify({
                            query: query.substring(0, 200),
                            resultsCount: topChunks.filter(c => c.score > 0.5).length,
                            topScore: topChunks[0]?.score
                        })]
                    );
                }

                resolve(context);
            });
        });
    },

    /**
     * Legacy Keyword Search (Fallback)
     */
    /**
     * Legacy Keyword Search (Fallback)
     */
    getContextKeyword: (query, limit = 3, organizationId = null) => {
        return new Promise((resolve, reject) => {
            if (!query) return resolve('');
            const keywords = query.split(' ').map(w => w.trim().replace(/[^\w\s]/gi, '')).filter(w => w.length > 3);
            if (keywords.length === 0) return resolve('');

            const sqlParts = keywords.map(() => "c.content LIKE ?").join(" OR ");
            const params = keywords.map(w => `%${w}%`);

            let sql = `
                SELECT c.content, d.filename
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE (${sqlParts})
            `;

            if (organizationId) {
                sql += " AND d.organization_id = ?";
                params.push(organizationId);
            }

            sql += ` LIMIT ${limit}`;

            db.all(sql, params, (err, rows) => {
                if (err) return resolve('');
                const context = (rows || []).map(r => `[Source: ${r.filename}]\n${r.content}`).join('\n\n');
                resolve(context);
            });
        });
    },

    /**
     * Store processed chunks for a document
     */
    storeChunks: async (docId, chunks) => {
        // Prepare statement
        const stmt = db.prepare(`
            INSERT INTO knowledge_chunks (id, doc_id, content, embedding)
            VALUES (?, ?, ?, ?)
        `);

        // Serialized processing to be safe with SQLite
        // Generate embeddings in parallel for speed if provider allows, 
        // but simple loop is safer for stability.
        for (let i = 0; i < chunks.length; i++) {
            const chunkId = `${docId}-chk-${i}`;
            const embedding = await RagService.generateEmbedding(chunks[i]);

            await new Promise((resolve, reject) => {
                stmt.run(
                    chunkId,
                    docId,
                    chunks[i],
                    JSON.stringify(embedding || []),
                    (err) => {
                        if (err) console.error("Chunk Insert Error", err);
                        resolve();
                    }
                );
            });
        }
        stmt.finalize();
    },

    getAxisDefinitions: (axisName) => {
        const query = `${axisName} maturity levels definitions 1 2 3 4 5`;
        return RagService.getContext(query, 5);
    },

    /**
     * Search for relevant chunks using the new embedding service
     * This is the primary method for RAG integration
     * @param {string} query - Search query
     * @param {Object} options - { limit, organizationId, minSimilarity }
     */
    searchRelevantChunks: async (query, options = {}) => {
        const { limit = 5, organizationId, minSimilarity = 0.5 } = options;

        try {
            // Use new embedding service for vector search
            const results = await embeddingService.search(query, {
                limit,
                organizationId,
                minSimilarity
            });

            // If no results from new embeddings table, fallback to legacy
            if (!results || results.length === 0) {
                const legacyContext = await RagService.getContext(query, limit, { organizationId });
                if (legacyContext) {
                    return [{
                        content: legacyContext,
                        source: 'legacy_knowledge_base',
                        similarity: 0.7
                    }];
                }
                return [];
            }

            return results.map(r => ({
                content: r.content,
                source: r.metadata?.filename || 'Knowledge Base',
                similarity: r.similarity,
                documentId: r.document_id,
                chunkIndex: r.chunk_index
            }));

        } catch (error) {
            console.error('[RagService] searchRelevantChunks error:', error.message);
            // Fallback to legacy keyword search
            const keywordContext = await RagService.getContextKeyword(query, limit, organizationId);
            if (keywordContext) {
                return [{
                    content: keywordContext,
                    source: 'keyword_search',
                    similarity: 0.5
                }];
            }
            return [];
        }
    },

    /**
     * Ingest a document into the vector database
     * @param {Object} params - { content, filename, mimeType, organizationId }
     */
    ingestDocument: async (params) => {
        const { content, filename, mimeType, organizationId } = params;
        const { v4: uuidv4 } = require('uuid');
        const { ingestionPipeline } = require('./ai/ingestionPipeline');

        const documentId = uuidv4();

        // 1. Process document into chunks
        const { chunks } = await ingestionPipeline.process({
            content,
            filename,
            mimeType,
            documentId,
            organizationId
        });

        // 2. Generate embeddings and store
        let successCount = 0;
        for (const chunk of chunks) {
            try {
                const embedding = await embeddingService.generateEmbedding(chunk.content);
                await embeddingService.storeChunk(chunk, embedding);
                successCount++;
            } catch (e) {
                console.error(`[RagService] Failed to embed chunk ${chunk.chunkIndex}:`, e.message);
            }
        }

        return {
            documentId,
            totalChunks: chunks.length,
            embeddedChunks: successCount,
            success: successCount > 0
        };
    }
};

module.exports = RagService;
