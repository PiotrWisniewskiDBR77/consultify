/**
 * Memory Manager - Unified 5-Layer Memory System
 * 
 * Orchestrates all memory layers for AI context:
 * Layer 1: Session Memory (Redis) - Current conversation context
 * Layer 2: Project Memory (PostgreSQL) - Project-specific decisions and learnings
 * Layer 3: Organization Memory (pgvector) - Org-wide patterns and best practices
 * Layer 4: Knowledge Base (pgvector) - DRD methodology and documentation
 * Layer 5: External (Web Research) - Real-time external data
 */

import { projectMemoryStore } from './projectMemoryStore.js';
import { organizationMemoryStore } from './organizationMemoryStore.js';
import { embeddingService } from './embeddingService.js';
import { PersistentSessionStore } from './persistentSessionStore.js';
import { aiLogger } from './logger.js';

// Memory layer configuration
const LAYER_CONFIG = {
    session: {
        weight: 1.0,
        maxChunks: 10,
        ttlMinutes: 120,
        enabled: true
    },
    project: {
        weight: 0.9,
        maxChunks: 15,
        enabled: true
    },
    organization: {
        weight: 0.8,
        maxChunks: 10,
        enabled: true
    },
    knowledge: {
        weight: 0.7,
        maxChunks: 8,
        enabled: true
    },
    external: {
        weight: 0.6,
        maxChunks: 5,
        enabled: false // Opt-in
    }
};

// Token budget for memory context
const DEFAULT_MAX_TOKENS = 3000;

class MemoryManager {
    constructor() {
        this.sessionStore = new PersistentSessionStore();
        this.projectStore = projectMemoryStore;
        this.orgStore = organizationMemoryStore;
        this.knowledgeStore = embeddingService;
        this.webResearchService = null; // Lazy load
    }

    /**
     * Retrieve relevant memory from all enabled layers
     * @param {Object} query - Memory query parameters
     * @returns {Object} Memory result with chunks and metadata
     */
    async retrieve(query) {
        const {
            userId,
            organizationId,
            projectId,
            queryText,
            layers = ['session', 'project', 'organization', 'knowledge'],
            maxTokens = DEFAULT_MAX_TOKENS,
            includeExternal = false
        } = query;

        const startTime = Date.now();
        const enabledLayers = includeExternal ? [...layers, 'external'] : layers;

        aiLogger.debug('MemoryManager', `Retrieving from layers: ${enabledLayers.join(', ')}`);

        // Parallel retrieval from all layers
        const retrievalPromises = enabledLayers.map(layer =>
            this._retrieveFromLayer(layer, {
                userId,
                organizationId,
                projectId,
                queryText
            }).catch(error => {
                aiLogger.warn('MemoryManager', `Layer ${layer} retrieval failed: ${error.message}`);
                return { layer, chunks: [], error: error.message };
            })
        );

        const results = await Promise.all(retrievalPromises);

        // Merge and rank all chunks
        const mergedChunks = this._mergeAndRank(results, maxTokens);

        // Calculate token usage
        const totalTokens = this._estimateTokens(mergedChunks);

        const latency = Date.now() - startTime;
        aiLogger.debug('MemoryManager', `Retrieved ${mergedChunks.length} chunks in ${latency}ms`);

        return {
            chunks: mergedChunks,
            sources: this._summarizeSources(results),
            totalTokens,
            latency,
            query: queryText
        };
    }

    /**
     * Retrieve from a specific layer
     * @private
     */
    async _retrieveFromLayer(layer, context) {
        const config = LAYER_CONFIG[layer];
        if (!config?.enabled) {
            return { layer, chunks: [] };
        }

        const { userId, organizationId, projectId, queryText } = context;

        switch (layer) {
            case 'session':
                return {
                    layer,
                    chunks: await this.sessionStore.getRecentContext(userId, config.maxChunks)
                };

            case 'project':
                if (!projectId) return { layer, chunks: [] };
                const projectContext = await this.projectStore.getProjectContext(projectId, {
                    maxTokens: config.maxChunks * 100
                });
                return {
                    layer,
                    chunks: this._parseProjectMemory(projectContext)
                };

            case 'organization':
                if (!organizationId) return { layer, chunks: [] };
                const patterns = await this.orgStore.searchPatterns(
                    organizationId,
                    queryText,
                    { limit: config.maxChunks }
                );
                return {
                    layer,
                    chunks: patterns.map(p => ({
                        content: `[${p.memory_type}] ${p.title}: ${p.description}`,
                        source: 'organization_memory',
                        relevance: p.similarity || 0.5,
                        metadata: { type: p.memory_type, id: p.id }
                    }))
                };

            case 'knowledge':
                const knowledgeResults = await this.knowledgeStore.search(queryText, {
                    limit: config.maxChunks,
                    minSimilarity: 0.4
                });
                return {
                    layer,
                    chunks: knowledgeResults.map(r => ({
                        content: r.content || r.chunk_text,
                        source: 'knowledge_base',
                        relevance: r.similarity || 0.5,
                        metadata: r.metadata
                    }))
                };

            case 'external':
                return this._retrieveExternal(queryText, config.maxChunks);

            default:
                return { layer, chunks: [] };
        }
    }

    /**
     * Retrieve from external web research
     * @private
     */
    async _retrieveExternal(query, maxChunks) {
        if (!this.webResearchService) {
            try {
                const { WebResearchService } = require('./webResearchService');
                this.webResearchService = new WebResearchService();
            } catch {
                return { layer: 'external', chunks: [] };
            }
        }

        try {
            const results = await this.webResearchService.search(query, { maxResults: maxChunks });
            return {
                layer: 'external',
                chunks: (results || []).map(r => ({
                    content: r.content || r.snippet,
                    source: 'web_research',
                    relevance: r.relevance || 0.5,
                    metadata: { url: r.url, title: r.title }
                }))
            };
        } catch (error) {
            aiLogger.warn('MemoryManager', `External retrieval failed: ${error.message}`);
            return { layer: 'external', chunks: [] };
        }
    }

    /**
     * Parse project memory into chunks
     * @private
     */
    _parseProjectMemory(projectContext) {
        if (!projectContext?.context) return [];

        // Split context into chunks
        const lines = projectContext.context.split('\n\n').filter(Boolean);
        return lines.map(line => ({
            content: line,
            source: 'project_memory',
            relevance: 0.7,
            metadata: { projectId: projectContext.projectId }
        }));
    }

    /**
     * Merge and rank chunks from all layers
     * @private
     */
    _mergeAndRank(results, maxTokens) {
        const allChunks = [];

        for (const result of results) {
            const layerWeight = LAYER_CONFIG[result.layer]?.weight || 1.0;

            for (const chunk of (result.chunks || [])) {
                allChunks.push({
                    ...chunk,
                    layer: result.layer,
                    weightedRelevance: (chunk.relevance || 0.5) * layerWeight
                });
            }
        }

        // Sort by weighted relevance
        allChunks.sort((a, b) => b.weightedRelevance - a.weightedRelevance);

        // Truncate to token budget
        const tokenBudget = maxTokens;
        let currentTokens = 0;
        const selectedChunks = [];

        for (const chunk of allChunks) {
            const chunkTokens = this._estimateTokens([chunk]);
            if (currentTokens + chunkTokens > tokenBudget) break;

            selectedChunks.push(chunk);
            currentTokens += chunkTokens;
        }

        return selectedChunks;
    }

    /**
     * Summarize sources for metadata
     * @private
     */
    _summarizeSources(results) {
        const summary = {};
        for (const result of results) {
            summary[result.layer] = {
                count: result.chunks?.length || 0,
                error: result.error
            };
        }
        return summary;
    }

    /**
     * Estimate token count for chunks
     * @private
     */
    _estimateTokens(chunks) {
        // Rough estimation: 1 token ≈ 4 characters
        const totalChars = chunks.reduce((sum, chunk) =>
            sum + (chunk.content?.length || 0), 0
        );
        return Math.ceil(totalChars / 4);
    }

    /**
     * Record a significant interaction to memory
     * @param {Object} interaction - Interaction data
     */
    async recordIfSignificant(interaction) {
        const {
            userId,
            organizationId,
            projectId,
            type,
            content,
            significance = 0.5 // 0-1 scale
        } = interaction;

        // Only record if significance threshold met
        if (significance < 0.6) {
            return { recorded: false, reason: 'Below significance threshold' };
        }

        // Determine where to record based on type and significance
        if (projectId && significance >= 0.7) {
            await this.projectStore.addMemory(projectId, {
                type: type === 'decision' ? 'DECISION' : 'AI_RECOMMENDATION',
                content,
                importance: Math.ceil(significance * 5),
                recordedBy: userId
            });
        }

        // For highly significant patterns, consider org memory
        if (significance >= 0.85 && organizationId) {
            // This would trigger pattern extraction job
            aiLogger.info('MemoryManager', `High-significance interaction recorded for potential pattern extraction`);
        }

        // Always update session
        await this.sessionStore.addMessage(userId, {
            role: 'assistant',
            content: typeof content === 'string' ? content : JSON.stringify(content),
            timestamp: new Date().toISOString()
        });

        return { recorded: true };
    }

    /**
     * Record a decision to project memory
     * @param {string} projectId - Project ID
     * @param {Object} decision - Decision data
     */
    async recordDecision(projectId, decision) {
        return this.projectStore.recordDecision(projectId, decision);
    }

    /**
     * Record a learning from project
     * @param {string} projectId - Project ID
     * @param {Object} learning - Learning data
     */
    async recordLearning(projectId, learning) {
        return this.projectStore.recordLearning(projectId, learning);
    }

    /**
     * Extract patterns from a completed project
     * @param {string} organizationId - Organization ID
     * @param {Object} projectData - Project data
     */
    async extractPatterns(organizationId, projectData) {
        // Get all project memories
        const memories = await this.projectStore.getApplicableLearnings(projectData.id);

        // Use org store to extract patterns via AI
        const enrichedProjectData = {
            ...projectData,
            learnings: memories.filter(m => m.memory_type === 'LEARNING'),
            decisions: memories.filter(m => m.memory_type === 'DECISION')
        };

        return this.orgStore.extractPatternsFromProject(organizationId, enrichedProjectData);
    }

    /**
     * Serialize memory context for AI prompt
     * @param {Object} memoryResult - Result from retrieve()
     * @returns {string} Formatted context string
     */
    serializeForPrompt(memoryResult) {
        if (!memoryResult?.chunks || memoryResult.chunks.length === 0) {
            return '';
        }

        const sections = {
            session: [],
            project: [],
            organization: [],
            knowledge: [],
            external: []
        };

        // Group by layer
        for (const chunk of memoryResult.chunks) {
            const layer = chunk.layer || 'knowledge';
            sections[layer].push(chunk.content);
        }

        // Build formatted context
        let context = '';

        if (sections.project.length > 0) {
            context += `## Project Context\n${sections.project.join('\n')}\n\n`;
        }

        if (sections.organization.length > 0) {
            context += `## Organization Patterns\n${sections.organization.join('\n')}\n\n`;
        }

        if (sections.knowledge.length > 0) {
            context += `## Knowledge Base\n${sections.knowledge.join('\n')}\n\n`;
        }

        if (sections.external.length > 0) {
            context += `## External Research\n${sections.external.join('\n')}\n\n`;
        }

        return context.trim();
    }

    /**
     * Get memory stats for diagnostics
     */
    async getStats(organizationId, projectId) {
        const stats = {
            session: { available: true },
            project: { available: !!projectId },
            organization: { available: !!organizationId },
            knowledge: { available: true },
            external: { available: LAYER_CONFIG.external.enabled }
        };

        if (projectId) {
            const projectMemories = await this.projectStore.getProjectMemory(projectId, { limit: 1 });
            stats.project.count = projectMemories.length;
        }

        if (organizationId) {
            const orgPatterns = await this.orgStore.getRecentPatterns(organizationId, { limit: 1 });
            stats.organization.count = orgPatterns.length;
        }

        return stats;
    }
}

// Singleton instance
const memoryManager = new MemoryManager();

// Periodic cleanup
setInterval(() => {
    memoryManager.sessionStore.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes

export {
MemoryManager,
    memoryManager,
    LAYER_CONFIG
};

export default {
    MemoryManager,
    memoryManager,
    LAYER_CONFIG
};














