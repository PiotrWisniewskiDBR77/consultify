const db = require('../database');
const { OpenAI } = require('openai'); // Assuming openai package is available

// Import new embedding service
const { embeddingService } = require('./ai/embeddingService');

// ============================================================================
// Similarity Functions
// ============================================================================

/**
 * Cosine Similarity between two vectors
 */
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

// ============================================================================
// BM25 Algorithm Implementation
// ============================================================================

/**
 * BM25 Parameters (standard values)
 */
const BM25_K1 = 1.5;  // Term frequency saturation
const BM25_B = 0.75;  // Document length normalization

/**
 * Tokenize text for BM25
 */
const tokenize = (text) => {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);
};

/**
 * Calculate term frequency in document
 */
const termFrequency = (term, tokens) => {
    return tokens.filter(t => t === term).length;
};

/**
 * Calculate BM25 score for a single document
 * @param {string[]} queryTokens - Tokenized query
 * @param {string[]} docTokens - Tokenized document
 * @param {number} avgDocLength - Average document length in corpus
 * @param {Object} idf - Inverse document frequency map
 */
const bm25Score = (queryTokens, docTokens, avgDocLength, idf) => {
    let score = 0;
    const docLength = docTokens.length;
    
    for (const term of queryTokens) {
        const tf = termFrequency(term, docTokens);
        const termIdf = idf[term] || 0;
        
        // BM25 formula
        const numerator = tf * (BM25_K1 + 1);
        const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
        
        score += termIdf * (numerator / denominator);
    }
    
    return score;
};

/**
 * Calculate IDF for terms across corpus
 * @param {string[]} terms - Query terms
 * @param {Array} documents - Array of tokenized documents
 */
const calculateIDF = (terms, documents) => {
    const N = documents.length;
    const idf = {};
    
    for (const term of terms) {
        // Count documents containing term
        const docsWithTerm = documents.filter(doc => doc.includes(term)).length;
        // IDF formula: log((N - n + 0.5) / (n + 0.5) + 1)
        idf[term] = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
    }
    
    return idf;
};

// ============================================================================
// Hybrid Search Configuration
// ============================================================================

const HYBRID_CONFIG = {
    alpha: 0.6,           // Weight for vector search (0.6 vector, 0.4 BM25)
    minVectorScore: 0.3,  // Minimum vector similarity
    minBm25Score: 0.1,    // Minimum BM25 score
    rerankerEnabled: true // Enable LLM re-ranking (Phase 1.2)
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
    },

    // ========================================================================
    // BM25 Search Implementation
    // ========================================================================

    /**
     * BM25 keyword-based search
     * @param {string} query - Search query
     * @param {number} limit - Number of results
     * @param {string} organizationId - Organization filter
     * @returns {Promise<Array>} Scored results with BM25 scores
     */
    bm25Search: async (query, limit = 10, organizationId = null) => {
        return new Promise((resolve) => {
            // Build SQL to fetch all candidate chunks
            let sql = `
                SELECT c.id, c.content, d.filename, d.id as doc_id
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE 1=1
            `;
            const params = [];

            if (organizationId) {
                sql += " AND d.organization_id = ?";
                params.push(organizationId);
            }

            db.all(sql, params, (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    return resolve([]);
                }

                // Tokenize query
                const queryTokens = tokenize(query);
                if (queryTokens.length === 0) {
                    return resolve([]);
                }

                // Tokenize all documents
                const tokenizedDocs = rows.map(row => tokenize(row.content));

                // Calculate average document length
                const totalLength = tokenizedDocs.reduce((sum, doc) => sum + doc.length, 0);
                const avgDocLength = totalLength / tokenizedDocs.length;

                // Calculate IDF for query terms
                const idf = calculateIDF(queryTokens, tokenizedDocs);

                // Score each document
                const scored = rows.map((row, idx) => ({
                    ...row,
                    bm25Score: bm25Score(queryTokens, tokenizedDocs[idx], avgDocLength, idf),
                    tokens: tokenizedDocs[idx]
                }));

                // Filter out zero scores and sort
                const results = scored
                    .filter(r => r.bm25Score > HYBRID_CONFIG.minBm25Score)
                    .sort((a, b) => b.bm25Score - a.bm25Score)
                    .slice(0, limit);

                // Normalize BM25 scores to 0-1 range
                const maxBm25 = results.length > 0 ? results[0].bm25Score : 1;
                const normalized = results.map(r => ({
                    ...r,
                    bm25ScoreNormalized: r.bm25Score / maxBm25
                }));

                resolve(normalized);
            });
        });
    },

    // ========================================================================
    // Hybrid Search (BM25 + Vector)
    // ========================================================================

    /**
     * Hybrid search combining BM25 and Vector similarity
     * @param {string} query - Search query
     * @param {Object} options - { limit, organizationId, alpha, enableReranking }
     * @returns {Promise<Array>} Combined and ranked results
     */
    hybridSearch: async (query, options = {}) => {
        const {
            limit = 5,
            organizationId = null,
            alpha = HYBRID_CONFIG.alpha,
            enableReranking = HYBRID_CONFIG.rerankerEnabled
        } = options;

        console.log(`[RagService] Hybrid search: query="${query.substring(0, 50)}...", alpha=${alpha}`);

        // Fetch more candidates for better fusion
        const candidateLimit = limit * 3;

        // Run BM25 and Vector search in parallel
        const [bm25Results, vectorResults] = await Promise.all([
            RagService.bm25Search(query, candidateLimit, organizationId),
            RagService._vectorSearch(query, candidateLimit, organizationId)
        ]);

        console.log(`[RagService] BM25 results: ${bm25Results.length}, Vector results: ${vectorResults.length}`);

        // Create a map for combining results
        const resultMap = new Map();

        // Add BM25 results
        for (const result of bm25Results) {
            const key = result.id || result.content.substring(0, 100);
            resultMap.set(key, {
                ...result,
                bm25Score: result.bm25ScoreNormalized || 0,
                vectorScore: 0,
                source: 'bm25'
            });
        }

        // Merge Vector results
        for (const result of vectorResults) {
            const key = result.id || result.content.substring(0, 100);
            const existing = resultMap.get(key);
            
            if (existing) {
                // Result found in both - combine scores
                existing.vectorScore = result.vectorScore || result.score || 0;
                existing.source = 'hybrid';
            } else {
                // New result from vector search only
                resultMap.set(key, {
                    ...result,
                    bm25Score: 0,
                    vectorScore: result.vectorScore || result.score || 0,
                    source: 'vector'
                });
            }
        }

        // Calculate hybrid scores using Reciprocal Rank Fusion
        const combined = Array.from(resultMap.values()).map(result => {
            // Weighted combination: alpha * vector + (1-alpha) * bm25
            const hybridScore = alpha * result.vectorScore + (1 - alpha) * result.bm25Score;
            
            return {
                ...result,
                hybridScore,
                scoreBreakdown: {
                    vector: result.vectorScore,
                    bm25: result.bm25Score,
                    hybrid: hybridScore,
                    alpha
                }
            };
        });

        // Sort by hybrid score
        combined.sort((a, b) => b.hybridScore - a.hybridScore);

        // Take top candidates
        let finalResults = combined.slice(0, limit);

        // Optional: Apply LLM re-ranking (implemented in Phase 1.2)
        if (enableReranking && finalResults.length > 1) {
            try {
                const RerankerService = require('./ai/rerankerService');
                finalResults = await RerankerService.rerankDocuments(query, finalResults, limit);
                console.log(`[RagService] Re-ranked ${finalResults.length} results`);
            } catch (e) {
                // Reranker not yet implemented or failed - continue with hybrid scores
                console.log(`[RagService] Re-ranking skipped: ${e.message}`);
            }
        }

        // Log search metrics
        RagService._logSearchMetrics(query, organizationId, {
            bm25Count: bm25Results.length,
            vectorCount: vectorResults.length,
            hybridCount: combined.length,
            finalCount: finalResults.length,
            topScore: finalResults[0]?.hybridScore || 0
        });

        return finalResults;
    },

    /**
     * Internal vector search helper
     */
    _vectorSearch: async (query, limit, organizationId) => {
        const queryEmbedding = await RagService.generateEmbedding(query);
        if (!queryEmbedding) return [];

        return new Promise((resolve) => {
            let sql = `
                SELECT c.id, c.content, d.filename, c.embedding
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE c.embedding IS NOT NULL
            `;
            const params = [];

            if (organizationId) {
                sql += " AND d.organization_id = ?";
                params.push(organizationId);
            }

            db.all(sql, params, (err, rows) => {
                if (err || !rows) return resolve([]);

                const scored = rows.map(row => {
                    let vec;
                    try {
                        vec = JSON.parse(row.embedding);
                    } catch (e) {
                        return { ...row, vectorScore: 0 };
                    }
                    return {
                        ...row,
                        vectorScore: cosineSimilarity(queryEmbedding, vec)
                    };
                });

                // Filter by minimum score and sort
                const results = scored
                    .filter(r => r.vectorScore > HYBRID_CONFIG.minVectorScore)
                    .sort((a, b) => b.vectorScore - a.vectorScore)
                    .slice(0, limit);

                resolve(results);
            });
        });
    },

    /**
     * Log search metrics for analysis
     */
    _logSearchMetrics: (query, organizationId, metrics) => {
        if (!organizationId) return;

        db.run(
            `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
             VALUES (?, ?, NULL, 'hybrid_search', 'knowledge', NULL, ?, CURRENT_TIMESTAMP)`,
            [
                require('uuid').v4(),
                organizationId,
                JSON.stringify({
                    query: query.substring(0, 200),
                    ...metrics,
                    timestamp: new Date().toISOString()
                })
            ],
            (err) => {
                if (err) console.error('[RagService] Failed to log search metrics:', err.message);
            }
        );
    },

    // ========================================================================
    // Enhanced Context Retrieval using Hybrid Search
    // ========================================================================

    /**
     * Get context using hybrid search (BM25 + Vector + optional re-ranking)
     * This is the PRIMARY method for RAG context retrieval
     * @param {string} query - User query
     * @param {Object} options - { limit, organizationId, screenContext }
     */
    getContextHybrid: async (query, options = {}) => {
        const { limit = 5, organizationId, screenContext } = options;

        // Expand query with screen context
        let expandedQuery = query;
        if (screenContext) {
            const screenTitle = screenContext.data?._meta?.title || screenContext.screenId || '';
            if (screenTitle) expandedQuery += ` ${screenTitle}`;
        }

        // Run hybrid search
        const results = await RagService.hybridSearch(expandedQuery, {
            limit,
            organizationId,
            enableReranking: true
        });

        // Format as context string with citations
        const context = results
            .filter(r => r.hybridScore > 0.2)
            .map((r, idx) => {
                const source = r.filename || 'Knowledge Base';
                const score = Math.round((r.hybridScore || 0) * 100);
                return `[${idx + 1}] [Source: ${source}] (Relevance: ${score}%, Method: ${r.source})\n${r.content}`;
            })
            .join('\n\n---\n\n');

        return {
            context,
            sources: results.map(r => ({
                filename: r.filename,
                score: r.hybridScore,
                method: r.source,
                breakdown: r.scoreBreakdown
            })),
            metrics: {
                totalResults: results.length,
                topScore: results[0]?.hybridScore || 0,
                method: 'hybrid_bm25_vector'
            }
        };
    }
};

module.exports = RagService;
