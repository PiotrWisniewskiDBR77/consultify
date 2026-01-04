/**
 * Reranker Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Type-safe ES module implementation with runtime validation.
 */

import { z } from 'zod';

import * as DbPromise from '../../utils/DbPromise.js';
import { isOpenAIResponse, validateDatabaseRow } from '../../utils/typeGuards.js';
import logger from '../../utils/Logger.js';

type RerankDocument = {
    id?: string | number;
    content?: string;
    hybridScore?: number;
    score?: number;
    [key: string]: unknown;
};

type RerankedDocument = RerankDocument & {
    rerankerScore: number;
    combinedScore?: number;
    originalRank?: number;
    rerankedPosition?: number;
    rankChange?: number;
    rerankerFailed?: boolean;
    rerankerMethod?: string;
};

type RerankOptions = {
    useCache?: boolean;
    model?: string;
};

type AiLogger = {
    debug: (component: string, message: string, data?: unknown) => void;
    info: (component: string, message: string, data?: unknown) => void;
    warn: (component: string, message: string, data?: unknown) => void;
    error: (component: string, message: string, error?: unknown) => void;
};

type OpenAIChatMessage = {
    role: 'user' | 'system' | 'assistant';
    content: string;
};

type OpenAIChatRequest = {
    model: string;
    messages: OpenAIChatMessage[];
    temperature?: number;
    max_tokens?: number;
};

type OpenAIChatResponse = {
    choices: Array<{
        message?: { content?: string | null } | null;
        text?: string;
    }>;
};

type OpenAIClient = {
    chat: {
        completions: {
            create: (params: OpenAIChatRequest) => Promise<OpenAIChatResponse>;
        };
    };
};

type OpenAIConstructor = new (config: { apiKey: string }) => OpenAIClient;

type OpenAIConfig = {
    api_key: string;
};

const OpenAIConfigSchema = z.object({
    api_key: z.string().min(1),
});

const ScoresSchema = z.array(z.number().min(0).max(1));

const fallbackLogger: AiLogger = {
    debug: (component, message, data) => logger.debug(`[AI:${component}] ${message}`, data ?? ''),
    info: (component, message, data) => logger.info(`[AI:${component}] ${message}`, data ?? ''),
    warn: (component, message, data) => logger.warn(`[AI:${component}] ${message}`, data ?? ''),
    error: (component, message, error) => logger.error(`[AI:${component}] ${message}`, error ?? ''),
};

// Dependency injection for testing
const deps: {
    aiLogger?: AiLogger;
    OpenAI?: OpenAIConstructor;
} = {};

/**
 * Initialize dependencies lazily
 */
async function initDeps(): Promise<void> {
    if (!deps.aiLogger) {
        const { aiLogger } = await import('../../../services/ai/logger.js');
        deps.aiLogger = aiLogger as AiLogger;
    }
    if (!deps.OpenAI) {
        const module = await import('openai');
        const OpenAI =
            (module as { OpenAI?: OpenAIConstructor; default?: OpenAIConstructor }).OpenAI ??
            (module as { default?: OpenAIConstructor }).default;
        if (!OpenAI) {
            throw new Error('OpenAI client not available');
        }
        deps.OpenAI = OpenAI;
    }
}

/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps: { aiLogger?: AiLogger; OpenAI?: OpenAIConstructor } = {}): void {
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
    cacheTTL: 3600000, // 1 hour
};

// Simple in-memory cache for re-ranking results
const rerankerCache = new Map<string, { results: RerankedDocument[]; timestamp: number }>();

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

const getLogger = (): AiLogger => deps.aiLogger ?? fallbackLogger;

const clampScore = (score: number): number => Math.min(1, Math.max(0, score));

const getDocContent = (doc: RerankDocument): string => (typeof doc.content === 'string' ? doc.content : '');

const getDocIdentity = (doc: RerankDocument): string => {
    if (doc.id !== undefined && doc.id !== null) {
        return String(doc.id);
    }
    return getDocContent(doc).substring(0, 50);
};

const parseScores = (scoresText: string): number[] => {
    const cleanedText = scoresText
        .replace(/```json\n?/g, '')
        .replace(/```/g, '')
        .trim();
    try {
        const parsed = JSON.parse(cleanedText) as unknown;
        const validated = ScoresSchema.safeParse(parsed);
        if (validated.success) {
            return validated.data.map(clampScore);
        }
    } catch {
        // fall through to regex parse
    }
    const numbers = scoresText.match(/\d+\.?\d*/g);
    return numbers ? numbers.map((n) => clampScore(parseFloat(n))) : [];
};

const RerankerService = {
    /**
     * Re-rank documents using LLM-based relevance scoring
     */
    rerankDocuments: async (
        query: string,
        documents: RerankDocument[],
        topK = 5,
        options: RerankOptions = {},
    ): Promise<RerankedDocument[]> => {
        const { useCache = RERANKER_CONFIG.cacheEnabled, model = RERANKER_CONFIG.model } = options;

        if (!documents || documents.length === 0) {
            return [];
        }

        // Limit documents to process
        const docsToRank = documents.slice(0, RERANKER_CONFIG.maxDocuments);

        await initDeps();
        const logger = getLogger();
        logger.info(
            'RerankerService',
            `Re-ranking ${docsToRank.length} documents for query: "${query.substring(0, 50)}..."`,
        );

        // Check cache
        if (useCache) {
            const cacheKey = RerankerService._generateCacheKey(query, docsToRank);
            const cached = rerankerCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < RERANKER_CONFIG.cacheTTL) {
                logger.debug('RerankerService', 'Returning cached re-ranking results');
                return cached.results.slice(0, topK);
            }
        }

        try {
            // Get OpenAI client
            const openaiConfig = await RerankerService._getOpenAIConfig();
            if (!openaiConfig) {
                logger.warn('RerankerService', 'OpenAI not configured, returning original ranking');
                return docsToRank.slice(0, topK).map((doc) => ({
                    ...doc,
                    rerankerScore: doc.hybridScore || doc.score || 0,
                }));
            }

            const OpenAI = deps.OpenAI;
            if (!OpenAI) {
                logger.warn('RerankerService', 'OpenAI client not available, returning original ranking');
                return docsToRank.slice(0, topK).map((doc) => ({
                    ...doc,
                    rerankerScore: doc.hybridScore || doc.score || 0,
                }));
            }

            const openai = new OpenAI({ apiKey: openaiConfig.api_key });

            // Score documents in batches
            const scoredDocs: RerankedDocument[] = [];

            for (let i = 0; i < docsToRank.length; i += RERANKER_CONFIG.batchSize) {
                const batch = docsToRank.slice(i, i + RERANKER_CONFIG.batchSize);
                const batchScores = await RerankerService._scoreBatch(openai, query, batch, model);
                scoredDocs.push(...batchScores);
            }

            // Sort by LLM relevance score
            scoredDocs.sort((a, b) => b.rerankerScore - a.rerankerScore);

            // Add re-ranking metadata
            const results = scoredDocs.map((doc, idx) => {
                const originalRank =
                    docsToRank.findIndex(
                        (d) =>
                            (d.id !== undefined && d.id === doc.id) ||
                            getDocContent(d).substring(0, 100) === getDocContent(doc).substring(0, 100),
                    ) + 1;
                return {
                    ...doc,
                    originalRank,
                    rerankedPosition: idx + 1,
                    rankChange: originalRank - (idx + 1),
                };
            });

            // Cache results
            if (useCache) {
                const cacheKey = RerankerService._generateCacheKey(query, docsToRank);
                rerankerCache.set(cacheKey, {
                    results,
                    timestamp: Date.now(),
                });
            }

            // Log metrics
            RerankerService._logRerankerMetrics(query, {
                documentsRanked: docsToRank.length,
                topKReturned: Math.min(topK, results.length),
                avgScoreChange: RerankerService._calculateAvgScoreChange(results),
                model,
            });

            return results.slice(0, topK);
        } catch (error: unknown) {
            const logger = getLogger();
            const err = error as Error;
            logger.error('RerankerService', `Re-ranking failed: ${err.message}`, err);
            // Return original ranking on error
            return docsToRank.slice(0, topK).map((doc) => ({
                ...doc,
                rerankerScore: doc.hybridScore || doc.score || 0,
                rerankerFailed: true,
            }));
        }
    },

    /**
     * Score a batch of documents
     */
    _scoreBatch: async (
        openai: OpenAIClient,
        query: string,
        documents: RerankDocument[],
        model: string,
    ): Promise<RerankedDocument[]> => {
        const scoredDocs: RerankedDocument[] = [];

        // Build prompt for batch scoring
        const docsText = documents
            .map((doc, idx) => {
                const content = getDocContent(doc).substring(0, 500);
                return `[Document ${idx + 1}]\n${content}`;
            })
            .join('\n\n');

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
                max_tokens: 100,
            });

            const responseContent = isOpenAIResponse(response)
                ? response.choices[0]?.message?.content?.trim()
                : undefined;
            const scoresText = responseContent ?? '[]';
            const scores = parseScores(scoresText);

            // Map scores to documents
            for (let i = 0; i < documents.length; i++) {
                const hybridScore = documents[i].hybridScore ?? documents[i].score ?? 0.5;
                const rerankerScore = scores[i] !== undefined ? scores[i] : 0.5;
                scoredDocs.push({
                    ...documents[i],
                    rerankerScore,
                    combinedScore: RerankerService._combineScores(hybridScore, rerankerScore),
                });
            }
        } catch (error: unknown) {
            await initDeps();
            const logger = getLogger();
            const err = error as Error;
            logger.error('RerankerService', `Batch scoring failed: ${err.message}`, err);
            // Return documents with fallback scores
            for (const doc of documents) {
                scoredDocs.push({
                    ...doc,
                    rerankerScore: doc.hybridScore || doc.score || 0.5,
                    rerankerFailed: true,
                });
            }
        }

        return scoredDocs;
    },

    /**
     * Combine hybrid score with re-ranker score
     */
    _combineScores: (hybridScore: number, rerankerScore: number, hybridWeight = 0.3): number => {
        return hybridWeight * hybridScore + (1 - hybridWeight) * rerankerScore;
    },

    /**
     * Get OpenAI configuration from database
     */
    _getOpenAIConfig: async (): Promise<OpenAIConfig | null> => {
        const row = await DbPromise.get<unknown>(
            "SELECT * FROM llm_providers WHERE provider = 'openai' AND is_active = 1 LIMIT 1",
        );
        if (!row) {
            return null;
        }
        try {
            return validateDatabaseRow(row, OpenAIConfigSchema);
        } catch (error: unknown) {
            const logger = getLogger();
            logger.warn('RerankerService', 'Invalid OpenAI config row', error);
            return null;
        }
    },

    /**
     * Generate cache key for query + documents
     */
    _generateCacheKey: (query: string, documents: RerankDocument[]): string => {
        const docIds = documents.map(getDocIdentity).join('|');
        return `${query.substring(0, 100)}::${docIds}`;
    },

    /**
     * Calculate average score change from re-ranking
     */
    _calculateAvgScoreChange: (results: RerankedDocument[]): number => {
        if (results.length === 0) return 0;
        const totalChange = results.reduce((sum, r) => sum + Math.abs(r.rankChange || 0), 0);
        return totalChange / results.length;
    },

    /**
     * Log re-ranker metrics
     */
    _logRerankerMetrics: (query: string, metrics: Record<string, unknown>): void => {
        const logger = getLogger();
        logger.info('RerankerService', 'Re-ranking metrics:', {
            query: query.substring(0, 50),
            ...metrics,
        });
    },

    /**
     * Cross-encoder style re-ranking (more accurate but slower)
     * Scores query-document pairs individually for maximum accuracy
     */
    rerankCrossEncoder: async (query: string, documents: RerankDocument[], topK = 5): Promise<RerankedDocument[]> => {
        if (!documents || documents.length === 0) return [];

        await initDeps();
        const logger = getLogger();
        const openaiConfig = await RerankerService._getOpenAIConfig();
        if (!openaiConfig) {
            return documents.slice(0, topK).map((doc) => ({
                ...doc,
                rerankerScore: doc.hybridScore || doc.score || 0,
            }));
        }

        const OpenAI = deps.OpenAI;
        if (!OpenAI) {
            logger.warn('RerankerService', 'OpenAI client not available, returning original ranking');
            return documents.slice(0, topK).map((doc) => ({
                ...doc,
                rerankerScore: doc.hybridScore || doc.score || 0,
            }));
        }

        const openai = new OpenAI({ apiKey: openaiConfig.api_key });
        const scoredDocs: RerankedDocument[] = [];

        for (const doc of documents.slice(0, RERANKER_CONFIG.maxDocuments)) {
            const content = getDocContent(doc).substring(0, 800);

            const prompt = `Rate the relevance of this document to the query.
Query: "${query}"
Document: "${content}"

Respond with ONLY a number between 0.0 and 1.0 indicating relevance.`;

            try {
                const response = await openai.chat.completions.create({
                    model: RERANKER_CONFIG.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0,
                    max_tokens: 10,
                });

                const responseContent = isOpenAIResponse(response)
                    ? response.choices[0]?.message?.content?.trim()
                    : undefined;
                const score = clampScore(parseFloat(responseContent ?? '0.5') || 0.5);

                scoredDocs.push({
                    ...doc,
                    rerankerScore: score,
                    rerankerMethod: 'cross_encoder',
                });
            } catch (error: unknown) {
                scoredDocs.push({
                    ...doc,
                    rerankerScore: doc.hybridScore || 0.5,
                    rerankerFailed: true,
                });
            }
        }

        scoredDocs.sort((a, b) => b.rerankerScore - a.rerankerScore);
        return scoredDocs.slice(0, topK);
    },

    /**
     * Get re-ranker statistics
     */
    getStatistics: (): { cacheSize: number; config: typeof RERANKER_CONFIG } => {
        return {
            cacheSize: rerankerCache.size,
            config: RERANKER_CONFIG,
        };
    },

    /**
     * Clear re-ranker cache
     */
    clearCache: (): void => {
        rerankerCache.clear();
        const logger = getLogger();
        logger.info('RerankerService', 'Cache cleared');
    },
};

export default RerankerService;
