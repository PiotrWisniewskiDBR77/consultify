/**
 * Enhanced Context Builder
 * 
 * Builds comprehensive context by merging data from all 5 knowledge layers:
 * 1. Session Memory - Current conversation
 * 2. Project Memory - Project-specific context
 * 3. Organization Memory - Company-wide knowledge
 * 4. Knowledge Base - Documents and training materials
 * 5. External/Web - Real-time research
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

const { memoryManager } = require('./memoryManager');
const { intelligentResearch } = require('./intelligentResearch');
const { knowledgeIndexer } = require('./knowledgeIndexer');
const { projectMemoryStore } = require('./projectMemoryStore');
const ragService = require('../ragService');
const { aiLogger } = require('./logger');

// Context priorities by conversation phase
const PHASE_CONTEXT_PRIORITIES = {
    discovery: {
        organization: 0.4,
        project: 0.2,
        session: 0.2,
        knowledge: 0.1,
        external: 0.1
    },
    assessment: {
        project: 0.3,
        organization: 0.2,
        knowledge: 0.25,
        session: 0.15,
        external: 0.1
    },
    initiatives: {
        project: 0.25,
        knowledge: 0.25,
        external: 0.2,
        session: 0.15,
        organization: 0.15
    },
    roadmap: {
        project: 0.35,
        session: 0.25,
        knowledge: 0.2,
        organization: 0.1,
        external: 0.1
    },
    execution: {
        project: 0.3,
        session: 0.3,
        knowledge: 0.2,
        external: 0.1,
        organization: 0.1
    }
};

// Maximum context tokens by layer
const MAX_TOKENS_PER_LAYER = {
    session: 2000,
    project: 3000,
    organization: 1500,
    knowledge: 4000,
    external: 2000
};

class EnhancedContextBuilder {
    constructor(dependencies = {}) {
        this.contextCache = new Map();
        this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes

        // Dependency Injection with defaults
        this.memoryManager = dependencies.memoryManager || memoryManager;
        this.intelligentResearch = dependencies.intelligentResearch || intelligentResearch;
        this.projectMemoryStore = dependencies.projectMemoryStore || projectMemoryStore;
        this.ragService = dependencies.ragService || ragService;
        this.knowledgeIndexer = dependencies.knowledgeIndexer || knowledgeIndexer;
    }

    /**
     * Build comprehensive context from all layers
     * @param {Object} params - Build parameters
     * @returns {Object} Merged context with metadata
     */
    async build(params) {
        const {
            userId,
            projectId,
            organizationId,
            conversationId,
            currentMessage,
            phase = 'discovery',
            intent,
            topic,
            knowledgeGaps = [],
            includeResearch = true,
            maxTokens = 12000
        } = params;

        const startTime = Date.now();
        aiLogger.info('EnhancedContextBuilder', `Building context for phase: ${phase}`);

        // Check cache
        const cacheKey = `${projectId}:${phase}:${topic}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            aiLogger.debug('EnhancedContextBuilder', 'Using cached context');
            return { ...cached, fromCache: true };
        }

        // Get priorities for current phase
        const priorities = PHASE_CONTEXT_PRIORITIES[phase] || PHASE_CONTEXT_PRIORITIES.discovery;

        // Fetch all layers in parallel
        const [
            sessionContext,
            projectContext,
            organizationContext,
            knowledgeContext,
            externalContext
        ] = await Promise.allSettled([
            this.getSessionContext(conversationId, userId),
            this.getProjectContext(projectId),
            this.getOrganizationContext(organizationId),
            this.getKnowledgeContext(currentMessage, topic, organizationId),
            includeResearch ? this.getExternalContext(currentMessage, {
                intent,
                phase,
                topic,
                knowledgeGaps,
                industry: null // Will be filled from org context
            }) : Promise.resolve({ content: '', sources: [] })
        ]);

        // Process and merge contexts
        const mergedContext = await this.mergeContexts({
            session: this.extractValue(sessionContext),
            project: this.extractValue(projectContext),
            organization: this.extractValue(organizationContext),
            knowledge: this.extractValue(knowledgeContext),
            external: this.extractValue(externalContext)
        }, priorities, maxTokens);

        // Build final context object
        const finalContext = {
            // Merged narrative context
            narrative: mergedContext.narrative,

            // Structured data
            structured: {
                project: mergedContext.projectData,
                organization: mergedContext.orgData,
                assessment: mergedContext.assessmentData,
                initiatives: mergedContext.initiativesData
            },

            // Conversation history
            recentMessages: mergedContext.sessionHistory,

            // Knowledge base matches
            knowledgeMatches: mergedContext.knowledgeMatches,

            // External research
            research: mergedContext.externalResearch,

            // Metadata
            metadata: {
                phase,
                intent,
                topic,
                buildTime: Date.now() - startTime,
                tokenEstimate: this.estimateTokens(mergedContext.narrative),
                layerContributions: mergedContext.contributions,
                fromCache: false
            }
        };

        // Cache the result
        this.setCache(cacheKey, finalContext);

        return finalContext;
    }

    /**
     * Get session context (current conversation)
     */
    async getSessionContext(conversationId, userId) {
        try {
            const sessionMemory = this.memoryManager.stores?.session;
            if (!sessionMemory) {
                return { history: [], currentTopics: [], preferences: {} };
            }

            const history = await sessionMemory.getRecent(conversationId, 10);
            const topics = await sessionMemory.getTopics?.(conversationId) || [];

            return {
                history: history || [],
                currentTopics: topics,
                preferences: await this.getUserPreferences(userId)
            };
        } catch (error) {
            aiLogger.error('EnhancedContextBuilder', `Session context error: ${error.message}`);
            return { history: [], currentTopics: [], preferences: {} };
        }
    }

    /**
     * Get project context
     */
    async getProjectContext(projectId) {
        if (!projectId) return null;

        try {
            const memories = await this.projectMemoryStore.getProjectMemory(projectId, {
                types: ['decision', 'learning', 'milestone', 'risk'],
                limit: 20
            });

            // Get assessment data
            const assessment = await this.getProjectAssessment(projectId);

            // Get initiatives
            const initiatives = await this.getProjectInitiatives(projectId);

            // Get roadmap status
            const roadmap = await this.getProjectRoadmap(projectId);

            return {
                memories,
                assessment,
                initiatives,
                roadmap,
                summary: await this.summarizeProject(projectId)
            };
        } catch (error) {
            aiLogger.error('EnhancedContextBuilder', `Project context error: ${error.message}`);
            return null;
        }
    }

    /**
     * Get organization context
     */
    async getOrganizationContext(organizationId) {
        if (!organizationId) return null;

        try {
            const orgMemory = this.memoryManager.stores?.organization;
            if (!orgMemory) return null;

            const context = await orgMemory.retrieve(organizationId);

            return {
                profile: context.profile || {},
                preferences: context.preferences || {},
                industry: context.profile?.industry,
                size: context.profile?.employeeCount,
                strategicGoals: context.strategicGoals || [],
                previousProjects: context.projectHistory || []
            };
        } catch (error) {
            aiLogger.error('EnhancedContextBuilder', `Organization context error: ${error.message}`);
            return null;
        }
    }

    /**
     * Get knowledge base context
     */
    async getKnowledgeContext(query, topic, organizationId) {
        try {
            // RAG search for relevant documents
            const ragResults = await this.ragService.searchRelevantChunks(
                query || topic || 'digital transformation',
                {
                    topK: 5,
                    minScore: 0.6,
                    organizationId
                }
            );

            // Get indexed knowledge if available
            let indexedKnowledge = [];
            try {
                indexedKnowledge = await this.knowledgeIndexer.search(query || topic, {
                    topK: 3,
                    threshold: 0.5
                });
            } catch (e) {
                // Knowledge indexer might not be initialized
            }

            return {
                ragResults: ragResults?.chunks || [],
                indexedKnowledge,
                totalMatches: (ragResults?.chunks?.length || 0) + indexedKnowledge.length
            };
        } catch (error) {
            aiLogger.error('EnhancedContextBuilder', `Knowledge context error: ${error.message}`);
            return { ragResults: [], indexedKnowledge: [], totalMatches: 0 };
        }
    }

    /**
     * Get external/web research context
     */
    async getExternalContext(query, options = {}) {
        try {
            // Use intelligent research for context-aware queries
            const research = await this.intelligentResearch.supportConversation(
                { content: query },
                {
                    currentIntent: options.intent,
                    currentPhase: options.phase,
                    knowledgeGaps: options.knowledgeGaps,
                    organization: { industry: options.industry },
                    language: options.language || 'en'
                }
            );

            if (!research.needed || !research.available) {
                return { content: '', sources: [], needed: research.needed };
            }

            return {
                content: research.synthesis?.summary || '',
                insights: research.synthesis?.keyInsights || [],
                sources: research.citations || [],
                queries: research.queries,
                needed: true
            };
        } catch (error) {
            aiLogger.error('EnhancedContextBuilder', `External context error: ${error.message}`);
            return { content: '', sources: [], needed: false };
        }
    }

    /**
     * Merge contexts from all layers with priorities
     */
    async mergeContexts(contexts, priorities, maxTokens) {
        const contributions = {};
        const narrativeParts = [];
        let totalTokens = 0;

        // Calculate token budget per layer
        const tokenBudgets = {};
        for (const [layer, priority] of Object.entries(priorities)) {
            tokenBudgets[layer] = Math.min(
                Math.floor(maxTokens * priority),
                MAX_TOKENS_PER_LAYER[layer]
            );
        }

        // Session context (recent conversation)
        if (contexts.session?.history?.length > 0) {
            const sessionText = this.formatSessionContext(contexts.session);
            const sessionTokens = this.estimateTokens(sessionText);

            if (totalTokens + sessionTokens <= maxTokens) {
                narrativeParts.push({
                    layer: 'session',
                    text: sessionText,
                    tokens: sessionTokens
                });
                totalTokens += sessionTokens;
                contributions.session = sessionTokens;
            }
        }

        // Project context
        if (contexts.project) {
            const projectText = this.formatProjectContext(contexts.project);
            const projectTokens = this.estimateTokens(projectText);
            const budgetedTokens = Math.min(projectTokens, tokenBudgets.project);

            if (totalTokens + budgetedTokens <= maxTokens) {
                narrativeParts.push({
                    layer: 'project',
                    text: this.truncateToTokens(projectText, budgetedTokens),
                    tokens: budgetedTokens
                });
                totalTokens += budgetedTokens;
                contributions.project = budgetedTokens;
            }
        }

        // Organization context
        if (contexts.organization) {
            const orgText = this.formatOrganizationContext(contexts.organization);
            const orgTokens = this.estimateTokens(orgText);
            const budgetedTokens = Math.min(orgTokens, tokenBudgets.organization);

            if (totalTokens + budgetedTokens <= maxTokens) {
                narrativeParts.push({
                    layer: 'organization',
                    text: this.truncateToTokens(orgText, budgetedTokens),
                    tokens: budgetedTokens
                });
                totalTokens += budgetedTokens;
                contributions.organization = budgetedTokens;
            }
        }

        // Knowledge context
        if (contexts.knowledge?.totalMatches > 0) {
            const knowledgeText = this.formatKnowledgeContext(contexts.knowledge);
            const knowledgeTokens = this.estimateTokens(knowledgeText);
            const budgetedTokens = Math.min(knowledgeTokens, tokenBudgets.knowledge);

            if (totalTokens + budgetedTokens <= maxTokens) {
                narrativeParts.push({
                    layer: 'knowledge',
                    text: this.truncateToTokens(knowledgeText, budgetedTokens),
                    tokens: budgetedTokens
                });
                totalTokens += budgetedTokens;
                contributions.knowledge = budgetedTokens;
            }
        }

        // External research context
        if (contexts.external?.content) {
            const externalText = this.formatExternalContext(contexts.external);
            const externalTokens = this.estimateTokens(externalText);
            const budgetedTokens = Math.min(externalTokens, tokenBudgets.external);

            if (totalTokens + budgetedTokens <= maxTokens) {
                narrativeParts.push({
                    layer: 'external',
                    text: this.truncateToTokens(externalText, budgetedTokens),
                    tokens: budgetedTokens
                });
                totalTokens += budgetedTokens;
                contributions.external = budgetedTokens;
            }
        }

        // Build merged narrative
        const narrative = narrativeParts
            .sort((a, b) => priorities[b.layer] - priorities[a.layer])
            .map(p => p.text)
            .join('\n\n');

        return {
            narrative,
            sessionHistory: contexts.session?.history || [],
            projectData: contexts.project,
            orgData: contexts.organization,
            assessmentData: contexts.project?.assessment,
            initiativesData: contexts.project?.initiatives,
            knowledgeMatches: contexts.knowledge?.ragResults || [],
            externalResearch: contexts.external,
            contributions,
            totalTokens
        };
    }

    // =========================================================================
    // Formatting Methods
    // =========================================================================

    formatSessionContext(session) {
        const parts = ['## Recent Conversation'];

        if (session.history?.length > 0) {
            const recentMessages = session.history.slice(-5);
            for (const msg of recentMessages) {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                const content = msg.content?.substring(0, 200) || '';
                parts.push(`${role}: ${content}${msg.content?.length > 200 ? '...' : ''}`);
            }
        }

        if (session.currentTopics?.length > 0) {
            parts.push(`\nCurrent Topics: ${session.currentTopics.join(', ')}`);
        }

        return parts.join('\n');
    }

    formatProjectContext(project) {
        const parts = ['## Project Context'];

        if (project.summary) {
            parts.push(project.summary);
        }

        if (project.assessment) {
            parts.push('\n### Assessment Status');
            const scores = Object.entries(project.assessment)
                .filter(([k, v]) => v?.currentLevel)
                .map(([axis, data]) => `${axis}: Level ${data.currentLevel}`)
                .join(', ');
            parts.push(scores);
        }

        if (project.initiatives?.length > 0) {
            parts.push('\n### Active Initiatives');
            const topInitiatives = project.initiatives.slice(0, 5);
            for (const init of topInitiatives) {
                parts.push(`- ${init.name} (${init.status || 'draft'})`);
            }
        }

        if (project.memories?.length > 0) {
            parts.push('\n### Key Decisions & Learnings');
            const recentMemories = project.memories.slice(0, 5);
            for (const mem of recentMemories) {
                parts.push(`- [${mem.type}] ${mem.content?.substring(0, 100)}...`);
            }
        }

        return parts.join('\n');
    }

    formatOrganizationContext(org) {
        const parts = ['## Organization Context'];

        if (org.profile) {
            const profile = org.profile;
            parts.push(`Industry: ${profile.industry || 'Not specified'}`);
            if (profile.employeeCount) parts.push(`Size: ${profile.employeeCount} employees`);
            if (profile.region) parts.push(`Region: ${profile.region}`);
        }

        if (org.strategicGoals?.length > 0) {
            parts.push('\n### Strategic Goals');
            for (const goal of org.strategicGoals.slice(0, 3)) {
                parts.push(`- ${goal}`);
            }
        }

        if (org.preferences) {
            const prefs = org.preferences;
            if (prefs.language) parts.push(`\nPreferred Language: ${prefs.language}`);
            if (prefs.communicationStyle) parts.push(`Communication Style: ${prefs.communicationStyle}`);
        }

        return parts.join('\n');
    }

    formatKnowledgeContext(knowledge) {
        const parts = ['## Relevant Knowledge'];

        if (knowledge.ragResults?.length > 0) {
            parts.push('\n### From Knowledge Base');
            for (const chunk of knowledge.ragResults.slice(0, 3)) {
                const content = chunk.content?.substring(0, 300) || '';
                const source = chunk.source || 'Unknown source';
                parts.push(`[${source}]: ${content}...`);
            }
        }

        if (knowledge.indexedKnowledge?.length > 0) {
            parts.push('\n### From Indexed Documents');
            for (const doc of knowledge.indexedKnowledge.slice(0, 2)) {
                parts.push(`[${doc.title}]: ${doc.excerpt?.substring(0, 200)}...`);
            }
        }

        return parts.join('\n');
    }

    formatExternalContext(external) {
        const parts = ['## External Research'];

        if (external.content) {
            parts.push(external.content.substring(0, 800));
        }

        if (external.insights?.length > 0) {
            parts.push('\n### Key Insights');
            for (const insight of external.insights.slice(0, 3)) {
                parts.push(`- ${insight.type}: ${insight.value}`);
            }
        }

        if (external.sources?.length > 0) {
            parts.push('\n### Sources');
            for (const source of external.sources.slice(0, 3)) {
                const title = source.title || source.url || 'Source';
                parts.push(`- ${title}`);
            }
        }

        return parts.join('\n');
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    extractValue(settledPromise) {
        if (settledPromise.status === 'fulfilled') {
            return settledPromise.value;
        }
        return null;
    }

    estimateTokens(text) {
        if (!text) return 0;
        // Rough estimate: 4 characters per token
        return Math.ceil(text.length / 4);
    }

    truncateToTokens(text, maxTokens) {
        if (!text) return '';
        const maxChars = maxTokens * 4;
        if (text.length <= maxChars) return text;
        return text.substring(0, maxChars) + '...';
    }

    async getUserPreferences(userId) {
        // Would fetch from personalization engine
        return {};
    }

    async getProjectAssessment(projectId) {
        // Fetch assessment scores
        return {};
    }

    async getProjectInitiatives(projectId) {
        // Fetch initiatives
        return [];
    }

    async getProjectRoadmap(projectId) {
        // Fetch roadmap
        return {};
    }

    async summarizeProject(projectId) {
        // Generate project summary
        return '';
    }

    getCached(key) {
        const cached = this.contextCache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.cacheMaxAge) {
            this.contextCache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key, data) {
        this.contextCache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Cleanup old entries
        if (this.contextCache.size > 50) {
            const now = Date.now();
            for (const [k, v] of this.contextCache.entries()) {
                if (now - v.timestamp > this.cacheMaxAge) {
                    this.contextCache.delete(k);
                }
            }
        }
    }

    clearCache() {
        this.contextCache.clear();
    }
}

// Singleton instance
const enhancedContextBuilder = new EnhancedContextBuilder();

export default {
    EnhancedContextBuilder,
    enhancedContextBuilder,
    PHASE_CONTEXT_PRIORITIES,
    MAX_TOKENS_PER_LAYER
};
