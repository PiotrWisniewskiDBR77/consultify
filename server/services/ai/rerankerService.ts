/**
 * Re-ranker Service
 *
 * Uses LLM to re-rank retrieved documents based on relevance to query.
 * This improves RAG precision by leveraging semantic understanding.
 *
 * @module rerankerService
 */

import db from '../../database';
import { aiLogger } from './logger';
import { OpenAI } from 'openai';

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
}

interface AILogger {
    info: (service: string, message: string, data?: unknown) => void;
    debug: (service: string, message: string, data?: unknown) => void;
    warn: (service: string, message: string) => void;
    error: (service: string, message: string) => void;
}

interface LLMProvider {
    provider: string;
    api_key: string;
    is_active: number;
}

export interface Document {
    id?: string;
    content: string;
    hybridScore?: number;
    score?: number;
    rerankerScore?: number;
    combinedScore?: number;
    originalRank?: number;
    rerankedPosition?: number;
    rankChange?: number;
    rerankerFailed?: boolean;
    rerankerMethod?: string;
}

export interface RerankerOptions {
    useCache?: boolean;
    model?: string;
}

export interface RerankerMetrics {
    documentsRanked: number;
    topKReturned: number;
    avgScoreChange: number;
    model: string;
}

export interface CacheEntry {
    results: Document[];
    timestamp: number;
}

export interface RerankerStatistics {
    cacheSize: number;
    config: typeof RERANKER_CONFIG;
}

// Dependency injection for testing
interface Dependencies {
    db: Database;
    aiLogger: AILogger;
    OpenAI: typeof OpenAI;
}

const deps: Dependencies = {
    db: db as Database,
    aiLogger: aiLogger as AILogger,
    OpenAI
};

/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps: Partial<Dependencies> = {}): void {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.aiLogger) deps.aiLogger = newDeps.aiLogger;
    if (newDeps.OpenAI) deps.OpenAI = newDeps.OpenAI;
}

// Configuration
const RERANKER_CONFIG = {
    model: 'gpt-4o-mini',
    maxDocuments: 10,
    timeout: 15000,
    batchSize: 5,
    cacheEnabled: true,
    cacheTTL: 3600000 // 1 hour
} as const;

// Simple in-memory cache for re-ranking results
const rerankerCache = new Map<string, CacheEntry>();

/**
 * Clean up expired cache entries
 */
const cleanupCache = (): void => {
    const now = Date.now();
    for (const [key, value] of rerankerCache.entries()) {
        if (now - value.timestamp > RERANKER_CONFIG.cacheTTL) {
            rerankerCache.delete(key);
        }
    }
};

// Run cache cleanup every 10 minutes
setInterval(cleanupCache, 600000);

export interface RerankerService {
    rerankDocuments: (query: string, documents: Document[], topK?: number, options?: RerankerOptions) => Promise<Document[]>;
    rerankCrossEncoder: (query: string, documents: Document[], topK?: number) => Promise<Document[]>;
    getStatistics: () => Promise<RerankerStatistics>;
    clearCache: () => Promise<void>;
}

const RerankerService: RerankerService = {
    /**
     * Re-rank documents using LLM-based relevance scoring
     */
    rerankDocuments: async (query: string, documents: Document[], topK: number = 5, options: RerankerOptions = {}): Promise<Document[]> => {
        const {
            useCache = RERANKER_CONFIG.cacheEnabled,
            model = RERANKER_CONFIG.model
        } = options;

        if (!documents || documents.length === 0) {
            return [];
        }

        // Limit documents to process
        const docsToRank = documents.slice(0, RERANKER_CONFIG.maxDocuments);

        deps.aiLogger.info('RerankerService', `Re-ranking ${docsToRank.length} documents for query: "${query.substring(0, 50)}..."`);

        // Check cache
        if (useCache) {
            const cacheKey = RerankerService._generateCacheKey(query, docsToRank);
            const cached = rerankerCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < RERANKER_CONFIG.cacheTTL) {
                deps.aiLogger.debug('RerankerService', 'Returning cached re-ranking results');
                return cached.results.slice(0, topK);
            }
        }

        try {
            // Get OpenAI client
            const openaiConfig = await RerankerService._getOpenAIConfig();
            if (!openaiConfig) {
                deps.aiLogger.warn('RerankerService', 'OpenAI not configured, returning original ranking');
                return docsToRank.slice(0, topK);
            }

            const OpenAI = deps.OpenAI;
            const openai = new OpenAI({ apiKey: openaiConfig.api_key });

            // Score documents in batches
            const scoredDocs: Document[] = [];

            for (let i = 0; i < docsToRank.length; i += RERANKER_CONFIG.batchSize) {
                const batch = docsToRank.slice(i, i + RERANKER_CONFIG.batchSize);
                const batchScores = await RerankerService._scoreBatch(openai, query, batch, model);
                scoredDocs.push(...batchScores);
            }

            // Sort by LLM relevance score
            scoredDocs.sort((a, b) => (b.rerankerScore || 0) - (a.rerankerScore || 0));

            // Add re-ranking metadata
            const results = scoredDocs.map((doc, idx) => ({
                ...doc,
                originalRank: docsToRank.findIndex(d =>
                    (d.id && d.id === doc.id) ||
                    d.content.substring(0, 100) === doc.content.substring(0, 100)
                ) + 1,
                rerankedPosition: idx + 1,
                rankChange: (docsToRank.findIndex(d =>
                    (d.id && d.id === doc.id) ||
                    d.content.substring(0, 100) === doc.content.substring(0, 100)
                ) + 1) - (idx + 1)
            }));

            // Cache results
            if (useCache) {
                const cacheKey = RerankerService._generateCacheKey(query, docsToRank);
                rerankerCache.set(cacheKey, {
                    results,
                    timestamp: Date.now()
                });
            }

            // Log metrics
            RerankerService._logRerankerMetrics(query, {
                documentsRanked: docsToRank.length,
                topKReturned: Math.min(topK, results.length),
                avgScoreChange: RerankerService._calculateAvgScoreChange(results),
                model
            });

            return results.slice(0, topK);

        } catch (error) {
            deps.aiLogger.error('RerankerService', `Re-ranking failed: ${(error as Error).message}`);
            // Return original ranking on error
            return docsToRank.slice(0, topK).map(doc => ({
                ...doc,
                rerankerScore: doc.hybridScore || doc.score || 0,
                rerankerFailed: true
            }));
        }
    },

    /**
     * Score a batch of documents
     */
    _scoreBatch: async (openai: OpenAI, query: string, documents: Document[], model: string): Promise<Document[]> => {
        const scoredDocs: Document[] = [];

        // Build prompt for batch scoring
        const docsText = documents.map((doc, idx) => {
            const content = (doc.content || '').substring(0, 500);
            return `[Document ${idx + 1}]\n${content}`;
        }).join('\n\n');

        const prompt = `You are a relevance scorer. Given a query and multiple documents, rate each document's relevance to the query.

QUERY: "${query}"

DOCUMENTS:
${docsText}

For each document, provide a relevance score from 0.0 to 1.0 where:
- 1.0 = Perfectly relevant, directly answers the query
- 0.7-0.9 = Highly relevant, contains key information
- 0.4-0.6 = Moderately relevant, related but not directly answering
- 0.1-0.3 = Marginally relevant, loosely related
- 0.0 = Not relevant at all

Respond ONLY with a JSON array of scores, e.g.: [0.9, 0.7, 0.3, 0.5]
Do not include any explanation, just the JSON array.`;

        try {
            const response = await openai.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 100
            });

            const scoresText = response.choices[0]?.message?.content?.trim() || '[]';

            // Parse scores from response
            let scores: number[];
            try {
                // Handle various response formats
                const cleanedText = scoresText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                scores = JSON.parse(cleanedText) as number[];
            } catch (e) {
                // Try to extract numbers if JSON parse fails
                const numbers = scoresText.match(/\d+\.?\d*/g);
                scores = numbers ? numbers.map(n => Math.min(1, parseFloat(n))) : [];
            }

            // Map scores to documents
            for (let i = 0; i < documents.length; i++) {
                scoredDocs.push({
                    ...documents[i],
                    rerankerScore: scores[i] !== undefined ? scores[i] : 0.5,
                    // Combine with hybrid score if available
                    combinedScore: RerankerService._combineScores(
                        documents[i].hybridScore || documents[i].score || 0.5,
                        scores[i] !== undefined ? scores[i] : 0.5
                    )
                });
            }

        } catch (error) {
            deps.aiLogger.error('RerankerService', `Batch scoring failed: ${(error as Error).message}`);
            // Return documents with fallback scores
            for (const doc of documents) {
                scoredDocs.push({
                    ...doc,
                    rerankerScore: doc.hybridScore || doc.score || 0.5,
                    rerankerFailed: true
                });
            }
        }

        return scoredDocs;
    },

    /**
     * Combine hybrid score with re-ranker score
     */
    _combineScores: (hybridScore: number, rerankerScore: number, hybridWeight: number = 0.3): number => {
        return hybridWeight * hybridScore + (1 - hybridWeight) * rerankerScore;
    },

    /**
     * Get OpenAI configuration from database
     */
    _getOpenAIConfig: async (): Promise<LLMProvider | null> => {
        return new Promise((resolve) => {
            deps.db.get(
                "SELECT * FROM llm_providers WHERE provider = 'openai' AND is_active = 1 LIMIT 1",
                (err, row) => {
                    if (err || !row) resolve(null);
                    else resolve(row as LLMProvider);
                }
            );
        });
    },

    /**
     * Generate cache key for query + documents
     */
    _generateCacheKey: (query: string, documents: Document[]): string => {
        const docIds = documents.map(d => d.id || d.content.substring(0, 50)).join('|');
        return `${query.substring(0, 100)}::${docIds}`;
    },

    /**
     * Calculate average score change from re-ranking
     */
    _calculateAvgScoreChange: (results: Document[]): number => {
        if (results.length === 0) return 0;
        const totalChange = results.reduce((sum, r) => sum + Math.abs(r.rankChange || 0), 0);
        return totalChange / results.length;
    },

    /**
     * Log re-ranker metrics
     */
    _logRerankerMetrics: async (query: string, metrics: RerankerMetrics): Promise<void> => {
        deps.aiLogger.info('RerankerService', 'Re-ranking metrics:', {
            query: query.substring(0, 50),
            ...metrics
        });
    },

    /**
     * Cross-encoder style re-ranking (more accurate but slower)
     * Scores query-document pairs individually for maximum accuracy
     */
    rerankCrossEncoder: async (query: string, documents: Document[], topK: number = 5): Promise<Document[]> => {
        if (!documents || documents.length === 0) return [];

        const openaiConfig = await RerankerService._getOpenAIConfig();
        if (!openaiConfig) return documents.slice(0, topK);

        const OpenAI = deps.OpenAI;
        const openai = new OpenAI({ apiKey: openaiConfig.api_key });

        const scoredDocs: Document[] = [];

        for (const doc of documents.slice(0, RERANKER_CONFIG.maxDocuments)) {
            const content = (doc.content || '').substring(0, 800);

            const prompt = `Rate the relevance of this document to the query.
Query: "${query}"
Document: "${content}"

Respond with ONLY a number between 0.0 and 1.0 indicating relevance.`;

            try {
                const response = await openai.chat.completions.create({
                    model: RERANKER_CONFIG.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0,
                    max_tokens: 10
                });

                const scoreText = response.choices[0]?.message?.content?.trim() || '0.5';
                const score = parseFloat(scoreText) || 0.5;

                scoredDocs.push({
                    ...doc,
                    rerankerScore: Math.min(1, Math.max(0, score)),
                    rerankerMethod: 'cross_encoder'
                });

            } catch (error) {
                deps.aiLogger.error('RerankerService', `Cross-encoder scoring failed: ${(error as Error).message}`);
                scoredDocs.push({
                    ...doc,
                    rerankerScore: doc.hybridScore || 0.5,
                    rerankerFailed: true
                });
            }
        }

        scoredDocs.sort((a, b) => (b.rerankerScore || 0) - (a.rerankerScore || 0));
        return scoredDocs.slice(0, topK);
    },

    /**
     * Get re-ranker statistics
     */
    getStatistics: async (): Promise<RerankerStatistics> => {
        return {
            cacheSize: rerankerCache.size,
            config: RERANKER_CONFIG
        };
    },

    /**
     * Clear re-ranker cache
     */
    clearCache: async (): Promise<void> => {
        rerankerCache.clear();
        deps.aiLogger.info('RerankerService', 'Cache cleared');
    }
};

export default RerankerService;


