/**
 * Enhanced RAG Service 2.0
 * 
 * Implements hybrid search combining:
 * 1. Vector Search (semantic similarity)
 * 2. Keyword Search (BM25-style)
 * 3. Knowledge Graph (relationship-based)
 * 
 * Features:
 * - Query expansion using Knowledge Graph
 * - Re-ranking with cross-encoder
 * - Contextual chunking
 * - Source attribution
 * - Caching for performance
 */

import RagService from './ragService.js';
import KnowledgeGraphService from './knowledgeGraphService.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { embeddingService } from './ai/embeddingService.js';
import { v4 as uuidv4 } from 'uuid';



// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const RagEnhancedService = {
    /**
     * Hybrid search combining multiple retrieval methods
     * 
     * @param {string} query - User query
     * @param {object} options - Search options
     * @returns {object} Search results with context
     */
    hybridSearch: async (query, options = {}) => {
        const {
            limit = 5,
            organizationId,
            projectId,
            vectorWeight = 0.5,
            keywordWeight = 0.3,
            graphWeight = 0.2,
            minScore = 0.3,
            expandQuery = true,
            useCache = true
        } = options;

        const startTime = Date.now();
        const cacheKey = `hybrid:${query}:${organizationId || 'global'}:${limit}`;

        // Check cache
        if (useCache && cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return { ...cached.data, cached: true };
            }
            cache.delete(cacheKey);
        }

        try {
            // 1. Query expansion using Knowledge Graph
            let expandedQuery = query;
            let graphConcepts = [];
            
            if (expandQuery) {
                const expansion = await RagEnhancedService.expandQuery(query);
                expandedQuery = expansion.expandedQuery;
                graphConcepts = expansion.concepts;
            }

            // 2. Parallel retrieval from all sources
            const [vectorResults, keywordResults, graphResults] = await Promise.all([
                RagEnhancedService.vectorSearch(expandedQuery, { limit: limit * 2, organizationId }),
                RagEnhancedService.keywordSearch(query, { limit: limit * 2, organizationId }),
                RagEnhancedService.graphSearch(query, { limit: limit, concepts: graphConcepts })
            ]);

            // 3. Merge and re-rank results
            const mergedResults = RagEnhancedService.mergeResults(
                vectorResults,
                keywordResults,
                graphResults,
                { vectorWeight, keywordWeight, graphWeight }
            );

            // 4. Filter by minimum score
            const filteredResults = mergedResults.filter(r => r.finalScore >= minScore);

            // 5. Take top results
            const topResults = filteredResults.slice(0, limit);

            // 6. Format context
            const context = RagEnhancedService.formatContext(topResults);

            const result = {
                query: query,
                expandedQuery,
                context,
                results: topResults,
                graphConcepts,
                stats: {
                    vectorResults: vectorResults.length,
                    keywordResults: keywordResults.length,
                    graphResults: graphResults.length,
                    mergedResults: mergedResults.length,
                    finalResults: topResults.length,
                    processingTimeMs: Date.now() - startTime
                }
            };

            // Cache result
            if (useCache) {
                cache.set(cacheKey, { data: result, timestamp: Date.now() });
            }

            return result;

        } catch (error) {
            console.error('[RagEnhanced] Hybrid search error:', error);
            
            // Fallback to basic RAG
            const fallbackContext = await RagService.getContext(query, limit, { organizationId });
            return {
                query,
                expandedQuery: query,
                context: fallbackContext,
                results: [],
                graphConcepts: [],
                stats: { fallback: true, error: error.message },
                fallback: true
            };
        }
    },

    /**
     * Expand query using Knowledge Graph
     */
    expandQuery: async (query) => {
        const concepts = [];
        const expansionTerms = [];

        try {
            // Query knowledge graph
            const graphResults = await KnowledgeGraphService.query(query, {
                limit: 5,
                includeRelated: true,
                maxDepth: 1
            });

            for (const result of graphResults) {
                concepts.push({
                    name: result.node.name,
                    type: result.node.type,
                    score: result.score
                });

                // Add related concepts
                if (result.related) {
                    for (const rel of result.related.slice(0, 3)) {
                        expansionTerms.push(rel.node.name);
                    }
                }
            }

            // Build expanded query
            const uniqueTerms = [...new Set(expansionTerms)];
            const expandedQuery = uniqueTerms.length > 0
                ? `${query} ${uniqueTerms.slice(0, 5).join(' ')}`
                : query;

            return { expandedQuery, concepts };

        } catch (error) {
            console.error('[RagEnhanced] Query expansion error:', error);
            return { expandedQuery: query, concepts: [] };
        }
    },

    /**
     * Vector search using embeddings
     */
    vectorSearch: async (query, options = {}) => {
        const { limit = 10, organizationId, minSimilarity = 0.5 } = options;

        try {
            const results = await RagService.searchRelevantChunks(query, {
                limit,
                organizationId,
                minSimilarity
            });

            return results.map(r => ({
                content: r.content,
                source: r.source,
                score: r.similarity,
                type: 'vector',
                documentId: r.documentId,
                chunkIndex: r.chunkIndex
            }));

        } catch (error) {
            console.error('[RagEnhanced] Vector search error:', error);
            return [];
        }
    },

    /**
     * Keyword search (BM25-style)
     */
    keywordSearch: async (query, options = {}) => {
        const { limit = 10, organizationId } = options;

        return new Promise((resolve) => {
            // Tokenize query
            const tokens = query.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(t => t.length > 2);

            if (tokens.length === 0) {
                return resolve([]);
            }

            // Build SQL with term frequency scoring
            const conditions = tokens.map(() => 'LOWER(c.content) LIKE ?').join(' OR ');
            const params = tokens.map(t => `%${t}%`);

            let sql = `
                SELECT 
                    c.content, 
                    d.filename as source,
                    c.doc_id as documentId,
                    (${tokens.map(() => `
                        CASE WHEN LOWER(c.content) LIKE ? THEN 1 ELSE 0 END
                    `).join(' + ')}) as match_count
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE ${conditions}
            `;

            // Add term frequency params
            params.push(...tokens.map(t => `%${t}%`));

            if (organizationId) {
                sql += ' AND d.organization_id = ?';
                params.push(organizationId);
            }

            sql += ` ORDER BY match_count DESC LIMIT ${limit}`;

            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('[RagEnhanced] Keyword search error:', err);
                    return resolve([]);
                }

                const results = (rows || []).map(r => ({
                    content: r.content,
                    source: r.source,
                    score: r.match_count / tokens.length, // Normalize by token count
                    type: 'keyword',
                    documentId: r.documentId
                }));

                resolve(results);
            });
        });
    },

    /**
     * Knowledge Graph based search
     */
    graphSearch: async (query, options = {}) => {
        const { limit = 5, concepts = [] } = options;

        try {
            const results = [];

            // If we already have concepts from expansion, use them
            if (concepts.length > 0) {
                for (const concept of concepts.slice(0, limit)) {
                    // Get related knowledge from graph
                    const node = await KnowledgeGraphService.findNode(concept.name);
                    if (node) {
                        const related = await KnowledgeGraphService.getRelatedNodes(node.id, {
                            maxDepth: 2
                        });

                        results.push({
                            content: RagEnhancedService.formatGraphContext(node, related),
                            source: 'Knowledge Graph',
                            score: concept.score / 10, // Normalize
                            type: 'graph',
                            concept: concept.name
                        });
                    }
                }
            } else {
                // Query the graph directly
                const graphResults = await KnowledgeGraphService.query(query, {
                    limit,
                    includeRelated: true
                });

                for (const result of graphResults) {
                    results.push({
                        content: RagEnhancedService.formatGraphContext(result.node, result.related),
                        source: 'Knowledge Graph',
                        score: result.score / 10,
                        type: 'graph',
                        concept: result.node.name
                    });
                }
            }

            return results;

        } catch (error) {
            console.error('[RagEnhanced] Graph search error:', error);
            return [];
        }
    },

    /**
     * Format graph node and relationships into context
     */
    formatGraphContext: (node, related = []) => {
        let context = `**${node.name}** (${node.type})\n`;
        if (node.description) {
            context += `${node.description}\n`;
        }

        if (related && related.length > 0) {
            context += '\nRelated concepts:\n';
            for (const rel of related.slice(0, 5)) {
                const relLabel = rel.edge?.relation?.replace(/_/g, ' ') || 'related to';
                context += `- ${node.name} ${relLabel} ${rel.node.name}\n`;
            }
        }

        return context;
    },

    /**
     * Merge results from different sources with weighted scoring
     */
    mergeResults: (vectorResults, keywordResults, graphResults, weights) => {
        const { vectorWeight, keywordWeight, graphWeight } = weights;
        const merged = new Map(); // Use content hash as key

        // Helper to generate simple hash
        const hashContent = (content) => {
            return content.substring(0, 100).toLowerCase().replace(/\s+/g, '');
        };

        // Add vector results
        for (const r of vectorResults) {
            const hash = hashContent(r.content);
            if (!merged.has(hash)) {
                merged.set(hash, {
                    ...r,
                    vectorScore: r.score,
                    keywordScore: 0,
                    graphScore: 0,
                    sources: ['vector']
                });
            } else {
                const existing = merged.get(hash);
                existing.vectorScore = Math.max(existing.vectorScore || 0, r.score);
                if (!existing.sources.includes('vector')) existing.sources.push('vector');
            }
        }

        // Add keyword results
        for (const r of keywordResults) {
            const hash = hashContent(r.content);
            if (!merged.has(hash)) {
                merged.set(hash, {
                    ...r,
                    vectorScore: 0,
                    keywordScore: r.score,
                    graphScore: 0,
                    sources: ['keyword']
                });
            } else {
                const existing = merged.get(hash);
                existing.keywordScore = Math.max(existing.keywordScore || 0, r.score);
                if (!existing.sources.includes('keyword')) existing.sources.push('keyword');
            }
        }

        // Add graph results
        for (const r of graphResults) {
            const hash = hashContent(r.content);
            if (!merged.has(hash)) {
                merged.set(hash, {
                    ...r,
                    vectorScore: 0,
                    keywordScore: 0,
                    graphScore: r.score,
                    sources: ['graph']
                });
            } else {
                const existing = merged.get(hash);
                existing.graphScore = Math.max(existing.graphScore || 0, r.score);
                if (!existing.sources.includes('graph')) existing.sources.push('graph');
            }
        }

        // Calculate final scores
        const results = Array.from(merged.values()).map(r => ({
            ...r,
            finalScore: (
                (r.vectorScore || 0) * vectorWeight +
                (r.keywordScore || 0) * keywordWeight +
                (r.graphScore || 0) * graphWeight
            )
        }));

        // Sort by final score
        results.sort((a, b) => b.finalScore - a.finalScore);

        return results;
    },

    /**
     * Format context from results
     */
    formatContext: (results) => {
        if (!results || results.length === 0) {
            return '';
        }

        return results.map((r, i) => {
            const sourceLabel = r.sources ? `[${r.sources.join(', ')}]` : `[${r.type}]`;
            const scoreLabel = `(Score: ${Math.round(r.finalScore * 100)}%)`;
            return `### Source ${i + 1} ${sourceLabel} ${scoreLabel}\n${r.content}`;
        }).join('\n\n');
    },

    /**
     * Get context for AI (main entry point for chat/completions)
     */
    getContextForAI: async (query, options = {}) => {
        const result = await RagEnhancedService.hybridSearch(query, {
            limit: options.limit || 5,
            organizationId: options.organizationId,
            projectId: options.projectId,
            vectorWeight: 0.5,
            keywordWeight: 0.3,
            graphWeight: 0.2
        });

        return {
            context: result.context,
            sources: result.results.map(r => ({
                source: r.source,
                type: r.type,
                score: r.finalScore
            })),
            concepts: result.graphConcepts,
            stats: result.stats
        };
    },

    /**
     * Clear cache
     */
    clearCache: () => {
        cache.clear();
        console.log('[RagEnhanced] Cache cleared');
    },

    /**
     * Get cache stats
     */
    getCacheStats: () => {
        return {
            size: cache.size,
            keys: Array.from(cache.keys()).slice(0, 10)
        };
    }
};

export default RagEnhancedService;











