/**
 * RAG Service
 * Hybrid search (vector + BM25) with optional re-ranking.
 */

import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import * as DbPromise from '../utils/DbPromise.js';
import { embeddingService } from './ai/embeddingService.js';
import { aiLogger } from './ai/logger.js';

type DbRow = Record<string, unknown>;

type RerankableChunk = {
    id?: string;
    content: string;
    filename?: string;
    vectorScore?: number;
    bm25Score?: number;
    bm25ScoreNormalized?: number;
    hybridScore?: number;
    source?: string;
    scoreBreakdown?: Record<string, unknown>;
};

type SearchOptions = {
    limit?: number;
    organizationId?: string | null;
    minSimilarity?: number;
};

type HybridOptions = {
    limit?: number;
    organizationId?: string | null;
    alpha?: number;
    enableReranking?: boolean;
};

type ScreenContext = {
    screenId?: string;
    data?: { _meta?: { title?: string } };
};

const BM25_K1 = 1.5;
const BM25_B = 0.75;

const HYBRID_CONFIG = {
    alpha: 0.6,
    minVectorScore: 0.3,
    minBm25Score: 0.1,
    rerankerEnabled: true
};

const tokenize = (text: string): string[] => {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2);
};

const termFrequency = (term: string, tokens: string[]): number => {
    return tokens.filter(token => token === term).length;
};

const bm25Score = (queryTokens: string[], docTokens: string[], avgDocLength: number, idf: Record<string, number>): number => {
    let score = 0;
    const docLength = docTokens.length;

    for (const term of queryTokens) {
        const tf = termFrequency(term, docTokens);
        const termIdf = idf[term] || 0;
        const numerator = tf * (BM25_K1 + 1);
        const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
        score += termIdf * (numerator / denominator);
    }

    return score;
};

const calculateIDF = (terms: string[], documents: string[][]): Record<string, number> => {
    const N = documents.length;
    const idf: Record<string, number> = {};

    for (const term of terms) {
        const docsWithTerm = documents.filter(doc => doc.includes(term)).length;
        idf[term] = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
    }

    return idf;
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
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

const parseEmbedding = (value: unknown): number[] | null => {
    if (!value) return null;
    try {
        return JSON.parse(String(value)) as number[];
    } catch {
        return null;
    }
};

const RagService = {
    setDependencies: (newDeps: { OpenAI?: typeof OpenAI; embeddingService?: typeof embeddingService; uuidv4?: typeof uuidv4 } = {}) => {
        if (newDeps.OpenAI) deps.OpenAI = newDeps.OpenAI;
        if (newDeps.embeddingService) deps.embeddingService = newDeps.embeddingService;
        if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
    },

    generateEmbedding: async (text: string): Promise<number[] | null> => {
        await initDeps();
        const provider = await DbPromise.get<{ api_key?: string }>(
            "SELECT * FROM llm_providers WHERE provider = 'openai' AND is_active = 1 LIMIT 1",
            [],
            { fallback: true }
        );
        if (!provider || !provider.api_key) {
            return null;
        }

        try {
            const openai = new deps.OpenAI({ apiKey: provider.api_key });
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
                encoding_format: 'float'
            });
            return response.data[0]?.embedding || null;
        } catch (error: unknown) {
            aiLogger.error('RagService', 'Embedding Error', error);
            return null;
        }
    },

    getContext: async (
        query: string,
        limit = 3,
        filterOptions: { organizationId?: string; screenContext?: ScreenContext } = {}
    ): Promise<string> => {
        await initDeps();
        const { organizationId, screenContext } = filterOptions;

        let expandedQuery = query;
        if (screenContext) {
            const screenTitle = screenContext.data?._meta?.title || screenContext.screenId || '';
            if (screenTitle) expandedQuery += ` ${screenTitle}`;
        }

        const queryEmbedding = await RagService.generateEmbedding(expandedQuery);
        if (!queryEmbedding) {
            return RagService.getContextKeyword(expandedQuery, limit, organizationId || null);
        }

        let sql = `
            SELECT c.content, d.filename, c.embedding 
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON c.doc_id = d.id
            WHERE c.embedding IS NOT NULL
        `;
        const params: unknown[] = [];

        if (organizationId) {
            sql += ' AND d.organization_id = ?';
            params.push(organizationId);
        }

        const rows = await DbPromise.all<{ content: string; filename: string; embedding: string }>(
            sql,
            params,
            { fallback: true }
        );

        if (!rows || rows.length === 0) {
            return RagService.getContextKeyword(expandedQuery, limit, organizationId || null);
        }

        const scored = rows.map(row => {
            const vec = parseEmbedding(row.embedding);
            return {
                ...row,
                score: vec ? cosineSimilarity(queryEmbedding, vec) : 0
            };
        });

        scored.sort((a, b) => b.score - a.score);
        const topChunks = scored.slice(0, limit);

        const context = topChunks
            .filter(chunk => chunk.score > 0.5)
            .map(row => `[Source: ${row.filename}] (Relevance: ${Math.round(row.score * 100)}%)\n${row.content}`)
            .join('\n\n');

        if (organizationId) {
            await DbPromise.run(
                `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
                 VALUES (?, ?, NULL, 'rag_query', 'knowledge', NULL, ?, CURRENT_TIMESTAMP)`,
                [
                    deps.uuidv4(),
                    organizationId,
                    JSON.stringify({
                        query: query.substring(0, 200),
                        resultsCount: topChunks.filter(chunk => chunk.score > 0.5).length,
                        topScore: topChunks[0]?.score
                    })
                ],
                { fallback: true }
            );
        }

        return context;
    },

    getContextKeyword: async (query: string, limit = 3, organizationId: string | null = null): Promise<string> => {
        await initDeps();
        if (!query) return '';
        const keywords = query
            .split(' ')
            .map(word => word.trim().replace(/[^\w\s]/gi, ''))
            .filter(word => word.length > 3);
        if (keywords.length === 0) return '';

        const sqlParts = keywords.map(() => 'c.content LIKE ?').join(' OR ');
        const params: unknown[] = keywords.map(word => `%${word}%`);

        let sql = `
            SELECT c.content, d.filename
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON c.doc_id = d.id
            WHERE (${sqlParts})
        `;

        if (organizationId) {
            sql += ' AND d.organization_id = ?';
            params.push(organizationId);
        }

        sql += ` LIMIT ${limit}`;

        const rows = await DbPromise.all<{ content: string; filename: string }>(sql, params, { fallback: true });
        return (rows || []).map(row => `[Source: ${row.filename}]\n${row.content}`).join('\n\n');
    },

    storeChunks: async (docId: string, chunks: string[]): Promise<void> => {
        await initDeps();
        for (let i = 0; i < chunks.length; i++) {
            const chunkId = `${docId}-chk-${i}`;
            const embedding = await RagService.generateEmbedding(chunks[i]);

            await DbPromise.run(
                `INSERT INTO knowledge_chunks (id, doc_id, content, embedding)
                 VALUES (?, ?, ?, ?)`,
                [chunkId, docId, chunks[i], JSON.stringify(embedding || [])],
                { fallback: true }
            );
        }
    },

    getAxisDefinitions: (axisName: string): Promise<string> => {
        const query = `${axisName} maturity levels definitions 1 2 3 4 5`;
        return RagService.getContext(query, 5);
    },

    searchRelevantChunks: async (
        query: string,
        options: SearchOptions = {}
    ): Promise<Array<{ content: string; source: string; similarity: number; documentId?: string; chunkIndex?: number }>> => {
        await initDeps();
        const { limit = 5, organizationId, minSimilarity = 0.5 } = options;

        try {
            const results = await deps.embeddingService.search(query, {
                limit,
                organizationId,
                minSimilarity
            });

            if (!results || results.length === 0) {
                const legacyContext = await RagService.getContext(query, limit, { organizationId: organizationId || undefined });
                if (legacyContext) {
                    return [{
                        content: legacyContext,
                        source: 'legacy_knowledge_base',
                        similarity: 0.7
                    }];
                }
                return [];
            }

            return results.map(result => ({
                content: result.content || '',
                source: (result.metadata as { filename?: string })?.filename || 'Knowledge Base',
                similarity: result.similarity || 0,
                documentId: result.document_id || undefined,
                chunkIndex: result.chunk_index || undefined
            }));
        } catch (error: unknown) {
            const err = error as Error;
            aiLogger.error('RagService', `searchRelevantChunks error: ${err.message}`);
            const keywordContext = await RagService.getContextKeyword(query, limit, organizationId || null);
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

    ingestDocument: async (params: {
        content: string;
        filename: string;
        mimeType?: string;
        organizationId?: string;
    }): Promise<{ documentId: string; totalChunks: number; embeddedChunks: number; success: boolean }> => {
        await initDeps();
        const { content, filename, mimeType, organizationId } = params;
        const ingestionModule = await import('./ai/ingestionPipeline.js');
        const ingestionPipeline = (ingestionModule.ingestionPipeline || ingestionModule.default) as {
            process?: (args: Record<string, unknown>) => Promise<{ chunks: Array<{ content: string; chunkIndex: number }> }>;
        };

        if (!ingestionPipeline.process) {
            throw new Error('Ingestion pipeline does not support process()');
        }

        const documentId = deps.uuidv4();

        const { chunks } = await ingestionPipeline.process({
            content,
            filename,
            mimeType,
            documentId,
            organizationId
        });

        let successCount = 0;
        for (const chunk of chunks) {
            try {
                const embedding = await deps.embeddingService.generateEmbedding(chunk.content);
                await deps.embeddingService.storeChunk(chunk, embedding);
                successCount++;
            } catch (error: unknown) {
                const err = error as Error;
                aiLogger.warn('RagService', `Failed to embed chunk ${chunk.chunkIndex}: ${err.message}`);
            }
        }

        return {
            documentId,
            totalChunks: chunks.length,
            embeddedChunks: successCount,
            success: successCount > 0
        };
    },

    bm25Search: async (query: string, limit = 10, organizationId: string | null = null): Promise<RerankableChunk[]> => {
        await initDeps();
        let sql = `
            SELECT c.id, c.content, d.filename, d.id as doc_id
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON c.doc_id = d.id
            WHERE 1=1
        `;
        const params: unknown[] = [];

        if (organizationId) {
            sql += ' AND d.organization_id = ?';
            params.push(organizationId);
        }

        const rows = await DbPromise.all<{ id: string; content: string; filename: string }>(sql, params, { fallback: true });
        if (!rows || rows.length === 0) {
            return [];
        }

        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) {
            return [];
        }

        const tokenizedDocs = rows.map(row => tokenize(row.content));
        const totalLength = tokenizedDocs.reduce((sum, doc) => sum + doc.length, 0);
        const avgDocLength = totalLength / tokenizedDocs.length;
        const idf = calculateIDF(queryTokens, tokenizedDocs);

        const scored = rows.map((row, idx) => ({
            ...row,
            bm25Score: bm25Score(queryTokens, tokenizedDocs[idx], avgDocLength, idf),
            tokens: tokenizedDocs[idx]
        }));

        const results = scored
            .filter(result => (result.bm25Score || 0) > HYBRID_CONFIG.minBm25Score)
            .sort((a, b) => (b.bm25Score || 0) - (a.bm25Score || 0))
            .slice(0, limit);

        const maxBm25 = results.length > 0 ? results[0].bm25Score || 1 : 1;
        return results.map(result => ({
            ...result,
            bm25ScoreNormalized: (result.bm25Score || 0) / maxBm25
        }));
    },

    hybridSearch: async (query: string, options: HybridOptions = {}): Promise<RerankableChunk[]> => {
        await initDeps();
        const {
            limit = 5,
            organizationId = null,
            alpha = HYBRID_CONFIG.alpha,
            enableReranking = HYBRID_CONFIG.rerankerEnabled
        } = options;

        aiLogger.info('RagService', `Hybrid search: query="${query.substring(0, 50)}...", alpha=${alpha}`);

        const candidateLimit = limit * 3;
        const [bm25Results, vectorResults] = await Promise.all([
            RagService.bm25Search(query, candidateLimit, organizationId),
            RagService._vectorSearch(query, candidateLimit, organizationId)
        ]);

        aiLogger.info('RagService', `BM25 results: ${bm25Results.length}, Vector results: ${vectorResults.length}`);

        const resultMap = new Map<string, RerankableChunk>();

        for (const result of bm25Results) {
            const key = result.id || result.content.substring(0, 100);
            resultMap.set(key, {
                ...result,
                bm25Score: result.bm25ScoreNormalized || 0,
                vectorScore: 0,
                source: 'bm25'
            });
        }

        for (const result of vectorResults) {
            const key = result.id || result.content.substring(0, 100);
            const existing = resultMap.get(key);
            const vectorScore = (result.vectorScore || 0);

            if (existing) {
                existing.vectorScore = vectorScore;
                existing.source = 'hybrid';
            } else {
                resultMap.set(key, {
                    ...result,
                    bm25Score: 0,
                    vectorScore,
                    source: 'vector'
                });
            }
        }

        const combined = Array.from(resultMap.values()).map(result => {
            const hybridScore = alpha * (result.vectorScore || 0) + (1 - alpha) * (result.bm25Score || 0);
            return {
                ...result,
                hybridScore,
                scoreBreakdown: {
                    vector: result.vectorScore || 0,
                    bm25: result.bm25Score || 0,
                    hybrid: hybridScore,
                    alpha
                }
            };
        });

        combined.sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0));
        let finalResults = combined.slice(0, limit);

        if (enableReranking && finalResults.length > 1) {
            try {
                const rerankerModule = await import('./ai/rerankerService.js');
                const reranker = (rerankerModule.default || rerankerModule) as {
                    rerankDocuments: (queryText: string, docs: RerankableChunk[], topK: number) => Promise<RerankableChunk[]>;
                };
                finalResults = await reranker.rerankDocuments(query, finalResults, limit);
                aiLogger.info('RagService', `Re-ranked ${finalResults.length} results`);
            } catch (error: unknown) {
                const err = error as Error;
                aiLogger.warn('RagService', `Re-ranking skipped: ${err.message}`);
            }
        }

        await RagService._logSearchMetrics(query, organizationId, {
            bm25Count: bm25Results.length,
            vectorCount: vectorResults.length,
            hybridCount: combined.length,
            finalCount: finalResults.length,
            topScore: finalResults[0]?.hybridScore || 0
        });

        return finalResults;
    },

    _vectorSearch: async (
        query: string,
        limit: number,
        organizationId: string | null = null
    ): Promise<Array<RerankableChunk & { vectorScore: number }>> => {
        await initDeps();
        const queryEmbedding = await RagService.generateEmbedding(query);
        if (!queryEmbedding) return [];

        let sql = `
            SELECT c.id, c.content, d.filename, c.embedding
            FROM knowledge_chunks c
            JOIN knowledge_docs d ON c.doc_id = d.id
            WHERE c.embedding IS NOT NULL
        `;
        const params: unknown[] = [];

        if (organizationId) {
            sql += ' AND d.organization_id = ?';
            params.push(organizationId);
        }

        const rows = await DbPromise.all<{ id: string; content: string; filename: string; embedding: string }>(
            sql,
            params,
            { fallback: true }
        );

        const scored = rows.map(row => {
            const vec = parseEmbedding(row.embedding);
            return {
                ...row,
                vectorScore: vec ? cosineSimilarity(queryEmbedding, vec) : 0
            };
        });

        return scored
            .filter(result => result.vectorScore > HYBRID_CONFIG.minVectorScore)
            .sort((a, b) => b.vectorScore - a.vectorScore)
            .slice(0, limit);
    },

    _logSearchMetrics: async (
        query: string,
        organizationId: string | null,
        metrics: Record<string, unknown>
    ): Promise<void> => {
        if (!organizationId) return;
        await initDeps();

        await DbPromise.run(
            `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
             VALUES (?, ?, NULL, 'hybrid_search', 'knowledge', NULL, ?, CURRENT_TIMESTAMP)`,
            [
                deps.uuidv4(),
                organizationId,
                JSON.stringify({
                    query: query.substring(0, 200),
                    ...metrics,
                    timestamp: new Date().toISOString()
                })
            ],
            { fallback: true }
        );
    },

    getContextHybrid: async (
        query: string,
        options: { limit?: number; organizationId?: string; screenContext?: ScreenContext } = {}
    ): Promise<{
        context: string;
        sources: Array<{ filename?: string; score?: number; method?: string; breakdown?: Record<string, unknown> }>;
        metrics: Record<string, unknown>;
    }> => {
        const { limit = 5, organizationId, screenContext } = options;
        let expandedQuery = query;

        if (screenContext) {
            const screenTitle = screenContext.data?._meta?.title || screenContext.screenId || '';
            if (screenTitle) expandedQuery += ` ${screenTitle}`;
        }

        const results = await RagService.hybridSearch(expandedQuery, {
            limit,
            organizationId,
            enableReranking: true
        });

        const context = results
            .filter(result => (result.hybridScore || 0) > 0.2)
            .map((result, idx) => {
                const source = result.filename || 'Knowledge Base';
                const score = Math.round(((result.hybridScore || 0) * 100));
                return `[${idx + 1}] [Source: ${source}] (Relevance: ${score}%, Method: ${result.source})\n${result.content}`;
            })
            .join('\n\n---\n\n');

        return {
            context,
            sources: results.map(result => ({
                filename: result.filename,
                score: result.hybridScore,
                method: result.source,
                breakdown: result.scoreBreakdown
            })),
            metrics: {
                totalResults: results.length,
                topScore: results[0]?.hybridScore || 0,
                method: 'hybrid_bm25_vector'
            }
        };
    }
};

const deps = {
    OpenAI,
    embeddingService,
    uuidv4
};

async function initDeps(): Promise<void> {
    if (!deps.OpenAI) {
        const mod = await import('openai');
        deps.OpenAI = (mod as { OpenAI?: typeof OpenAI }).OpenAI || OpenAI;
    }
    if (!deps.embeddingService) {
        deps.embeddingService = embeddingService;
    }
    if (!deps.uuidv4) {
        deps.uuidv4 = uuidv4;
    }
}

export default RagService;
