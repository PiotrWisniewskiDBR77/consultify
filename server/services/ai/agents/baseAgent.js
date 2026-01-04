/**
 * BaseAgent - Foundation for all specialist AI agents
 * 
 * Each agent is a domain expert that can:
 * - Analyze context within its specialty
 * - Generate domain-specific insights
 * - Collaborate with other agents via debate protocol
 * - Provide confidence scores for its recommendations
 */

import { v4 as uuidv4 } from 'uuid';

export class BaseAgent {
    constructor(config = {}) {
        this.id = uuidv4();
        this.name = config.name || 'BaseAgent';
        this.domain = config.domain || 'general';
        this.expertise = config.expertise || [];
        this.systemPrompt = config.systemPrompt || '';
        this.confidenceThreshold = config.confidenceThreshold || 0.7;
        this.maxTokens = config.maxTokens || 2000;
        this.temperature = config.temperature || 0.7;

        // Debate protocol settings
        this.canInitiateDebate = config.canInitiateDebate !== false;
        this.debateWeight = config.debateWeight || 1.0;

        // Efficiency settings
        this.costConscious = config.costConscious || false;

        // Memory for context across interactions
        this.shortTermMemory = [];
        this.maxMemoryItems = config.maxMemoryItems || 10;
    }

    /**
     * Check if this agent is relevant for the given query
     * @param {string} query - User query
     * @param {object} context - Full context object
     * @returns {object} { isRelevant: boolean, confidence: number, reason: string }
     */
    async checkRelevance(query, context) {
        const keywords = this.getKeywords();
        const queryLower = query.toLowerCase();

        let matchCount = 0;
        const matchedKeywords = [];

        for (const keyword of keywords) {
            if (queryLower.includes(keyword.toLowerCase())) {
                matchCount++;
                matchedKeywords.push(keyword);
            }
        }

        const confidence = Math.min(matchCount / Math.max(keywords.length * 0.3, 1), 1);

        return {
            isRelevant: confidence >= 0.3,
            confidence,
            reason: matchedKeywords.length > 0
                ? `Matched keywords: ${matchedKeywords.join(', ')}`
                : 'No direct keyword matches'
        };
    }

    /**
     * Get domain-specific keywords for relevance matching
     * Override in subclasses
     */
    getKeywords() {
        return [];
    }

    /**
     * Process query within agent's domain
     * @param {string} query - User query
     * @param {object} context - Full context object
     * @returns {object} Agent response with insights
     */
    async process(query, context) {
        throw new Error('process() must be implemented by subclass');
    }

    /**
     * Generate domain-specific prompt
     * @param {string} query - User query
     * @param {object} context - Context object
     * @returns {string} Full prompt for LLM
     */
    buildPrompt(query, context) {
        const contextSummary = this.summarizeContext(context);

        return `${this.systemPrompt}

DOMAIN EXPERTISE: ${this.domain}
SPECIALIZATIONS: ${this.expertise.join(', ')}

CURRENT CONTEXT:
${contextSummary}

USER QUERY: ${query}

Provide your expert analysis from the perspective of ${this.name}. 
Include:
1. Key observations relevant to your domain
2. Specific recommendations with rationale
3. Potential risks or concerns in your area
4. Confidence level (0-100%) in your assessment

Respond in a structured, actionable format.`;
    }

    /**
     * Resolve model configuration, respecting cost-conscious settings
     */
    async resolveModelConfig(context) {
        if (context.preferredModel && context.preferredModel !== 'default') {
            return context.preferredModel;
        }

        if (this.costConscious) {
            return 'budget';
        }

        return 'default';
    }

    /**
     * Summarize context for prompt injection
     * Override for domain-specific context handling
     */
    summarizeContext(context) {
        const parts = [];

        if (context.project) {
            parts.push(`Project: ${context.project.name || 'Unknown'} `);
            parts.push(`Status: ${context.project.status || 'Unknown'} `);
        }

        if (context.organization) {
            parts.push(`Organization: ${context.organization.name || 'Unknown'} `);
            parts.push(`Industry: ${context.organization.industry || 'Unknown'} `);
        }

        if (context.assessment) {
            parts.push(`Assessment Score: ${context.assessment.overallScore || 'Not assessed'} `);
        }

        if (context.initiatives?.length) {
            parts.push(`Active Initiatives: ${context.initiatives.length} `);
        }

        return parts.join('\n') || 'No specific context available';
    }

    /**
     * Participate in debate with other agents
     * @param {string} topic - Debate topic
     * @param {array} otherPerspectives - Insights from other agents
     * @param {object} context - Full context
     * @returns {object} Debate contribution
     */
    async contributeToDebate(topic, otherPerspectives, context) {
        const myInitialView = await this.process(topic, context);

        // Analyze other perspectives
        const agreements = [];
        const disagreements = [];
        const additions = [];

        for (const perspective of otherPerspectives) {
            if (perspective.agentId === this.id) continue;

            // Simple heuristic - in production, use LLM for nuanced analysis
            if (perspective.confidence > 0.8) {
                agreements.push({
                    agentId: perspective.agentId,
                    point: perspective.mainInsight
                });
            } else if (perspective.confidence < 0.5) {
                disagreements.push({
                    agentId: perspective.agentId,
                    point: perspective.mainInsight,
                    concern: `Low confidence(${perspective.confidence}) suggests uncertainty`
                });
            }
        }

        return {
            agentId: this.id,
            agentName: this.name,
            domain: this.domain,
            initialView: myInitialView,
            agreements,
            disagreements,
            additions,
            finalPosition: myInitialView.mainInsight,
            confidence: myInitialView.confidence,
            weight: this.debateWeight
        };
    }

    /**
     * Add item to short-term memory
     */
    remember(item) {
        this.shortTermMemory.unshift({
            ...item,
            timestamp: new Date().toISOString()
        });

        if (this.shortTermMemory.length > this.maxMemoryItems) {
            this.shortTermMemory.pop();
        }
    }

    /**
     * Get recent memory items
     */
    getRecentMemory(count = 5) {
        return this.shortTermMemory.slice(0, count);
    }

    /**
     * Clear short-term memory
     */
    clearMemory() {
        this.shortTermMemory = [];
    }

    /**
     * Get agent metadata
     */
    getMetadata() {
        return {
            id: this.id,
            name: this.name,
            domain: this.domain,
            expertise: this.expertise,
            confidenceThreshold: this.confidenceThreshold,
            canInitiateDebate: this.canInitiateDebate,
            debateWeight: this.debateWeight
        };
    }
}

export default BaseAgent;








