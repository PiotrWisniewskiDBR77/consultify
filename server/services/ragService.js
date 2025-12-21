const db = require('../database');
const { OpenAI } = require('openai'); // Assuming openai package is available

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
                db.run(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
                        VALUES (?, NULL, 'rag_query', 'knowledge', NULL, ?, CURRENT_TIMESTAMP)`,
                    [require('uuid').v4(), JSON.stringify({
                        query: query.substring(0, 200),
                        resultsCount: topChunks.filter(c => c.score > 0.5).length,
                        topScore: topChunks[0]?.score
                    })]
                );

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
    }
};

module.exports = RagService;
