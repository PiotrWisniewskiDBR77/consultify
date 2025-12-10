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
     */
    getContext: async (query, limit = 3) => {
        // 1. Generate Query Embedding
        const queryEmbedding = await RagService.generateEmbedding(query);

        return new Promise((resolve, reject) => {
            if (!queryEmbedding) {
                // Fallback to Keyword Search if no embedding
                return resolve(RagService.getContextKeyword(query, limit));
            }

            // 2. Fetch all chunks with embeddings
            // Optimization: In a real DB, use a Vector Index. Here we do linear scan (fine for <10k docs).
            db.all("SELECT content, filename, embedding FROM knowledge_chunks WHERE embedding IS NOT NULL", (err, rows) => {
                if (err) return resolve('');

                if (!rows || rows.length === 0) {
                    return resolve(RagService.getContextKeyword(query, limit));
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

                resolve(context);
            });
        });
    },

    /**
     * Legacy Keyword Search (Fallback)
     */
    getContextKeyword: (query, limit = 3) => {
        return new Promise((resolve, reject) => {
            if (!query) return resolve('');
            const keywords = query.split(' ').map(w => w.trim().replace(/[^\w\s]/gi, '')).filter(w => w.length > 3);
            if (keywords.length === 0) return resolve('');

            const sqlParts = keywords.map(() => "content LIKE ?").join(" OR ");
            const params = keywords.map(w => `%${w}%`);

            const sql = `
                SELECT content, filename
                FROM knowledge_chunks 
                JOIN knowledge_docs ON knowledge_chunks.doc_id = knowledge_docs.id
                WHERE ${sqlParts} 
                LIMIT ${limit}
            `;

            db.all(sql, params, (err, rows) => {
                if (err) return resolve('');
                const context = (rows || []).map(r => `[Source: ${r.filename}]\n${r.content}`).join('\n\n');
                resolve(context);
            });
        });
    },

    getAxisDefinitions: (axisName) => {
        const query = `${axisName} maturity levels definitions 1 2 3 4 5`;
        return RagService.getContext(query, 5);
    }
};

module.exports = RagService;
