/**
 * AgentCoordinator - Orchestrates multi-agent collaboration
 * 
 * Responsibilities:
 * - Route queries to relevant specialist agents
 * - Coordinate agent debates for complex decisions
 * - Synthesize multi-agent responses
 * - Manage agent memory and context sharing
 * - Track agent performance and calibration
 */

import { StrategyAgent } from './strategyAgent.js';
import { FinanceAgent } from './financeAgent.js';
import { ChangeAgent } from './changeAgent.js';
import { RiskAgent } from './riskAgent.js';
import { PMOAgent } from './pmoAgent.js';
import llmService from '../llmService.js';
import { v4 as uuidv4 } from 'uuid';

export class AgentCoordinator {
    constructor(config = {}) {
        this.id = uuidv4();
        this.name = 'AgentCoordinator';

        // Initialize specialist agents
        this.agents = {
            strategy: new StrategyAgent(),
            finance: new FinanceAgent(),
            change: new ChangeAgent(),
            risk: new RiskAgent(),
            pmo: new PMOAgent()
        };

        // Coordination settings
        this.minAgentsForDebate = config.minAgentsForDebate || 2;
        this.maxAgentsPerQuery = config.maxAgentsPerQuery || 3;
        this.debateRounds = config.debateRounds || 2;
        this.confidenceThreshold = config.confidenceThreshold || 0.7;

        // Metrics tracking
        this.metrics = {
            queriesProcessed: 0,
            debatesHeld: 0,
            averageAgentsPerQuery: 0,
            agentUsage: {}
        };

        // Initialize agent usage tracking
        Object.keys(this.agents).forEach(id => {
            this.metrics.agentUsage[id] = 0;
        });
    }

    /**
     * Main entry point - process a query and coordinate agents
     * @param {string} query - User query
     * @param {object} context - Full context object
     * @param {object} options - Processing options
     * @returns {object} Coordinated response
     */
    async processQuery(query, context, options = {}) {
        const startTime = Date.now();
        const queryId = uuidv4();

        try {
            // 1. Determine which agents should respond
            const relevantAgents = await this.selectAgents(query, context);

            if (relevantAgents.length === 0) {
                return this.getGeneralResponse(query, context);
            }

            // 2. Get responses from each relevant agent
            const agentResponses = await this.gatherAgentResponses(
                query,
                context,
                relevantAgents
            );

            // 3. If multiple agents, conduct debate
            let finalResponse;
            if (relevantAgents.length >= this.minAgentsForDebate && !options.skipDebate) {
                finalResponse = await this.conductDebate(
                    query,
                    agentResponses,
                    context
                );
                this.metrics.debatesHeld++;
            } else {
                finalResponse = this.synthesizeResponses(agentResponses);
            }

            // 4. Update metrics
            this.updateMetrics(relevantAgents, Date.now() - startTime);

            return {
                queryId,
                query,
                response: finalResponse,
                agentsConsulted: relevantAgents.map(a => ({
                    id: a.id,
                    name: a.name,
                    domain: a.domain
                })),
                processingTimeMs: Date.now() - startTime,
                debateHeld: relevantAgents.length >= this.minAgentsForDebate,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[AgentCoordinator] Error processing query:', error);
            return {
                queryId,
                query,
                error: true,
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Select which agents should respond to the query
     */
    async selectAgents(query, context) {
        const relevanceResults = [];

        // Check each agent's relevance
        for (const [id, agent] of Object.entries(this.agents)) {
            const relevance = await agent.checkRelevance(query, context);
            if (relevance.isRelevant) {
                relevanceResults.push({
                    agent,
                    ...relevance
                });
            }
        }

        // Sort by confidence and take top N
        relevanceResults.sort((a, b) => b.confidence - a.confidence);

        return relevanceResults
            .slice(0, this.maxAgentsPerQuery)
            .map(r => r.agent);
    }

    /**
     * Gather responses from selected agents in parallel
     */
    async gatherAgentResponses(query, context, agents) {
        const responsePromises = agents.map(agent =>
            agent.process(query, context)
                .catch(error => ({
                    agentId: agent.id,
                    agentName: agent.name,
                    error: true,
                    message: error.message
                }))
        );

        const responses = await Promise.all(responsePromises);
        return responses.filter(r => !r.error);
    }

    /**
     * Conduct debate between agents for consensus
     */
    async conductDebate(query, initialResponses, context) {
        const debate = {
            topic: query,
            rounds: [],
            consensus: null
        };

        let currentPerspectives = initialResponses.map(r => ({
            agentId: r.agentId,
            agentName: r.agentName,
            domain: r.domain,
            mainInsight: r.mainInsight,
            recommendations: r.recommendations,
            confidence: r.confidence
        }));

        // Conduct debate rounds
        for (let round = 0; round < this.debateRounds; round++) {
            const roundContributions = [];

            // Each agent reviews others' perspectives and may refine position
            for (const response of initialResponses) {
                const agent = Object.values(this.agents).find(a => a.id === response.agentId);
                if (!agent) continue;

                const contribution = await agent.contributeToDebate(
                    query,
                    currentPerspectives.filter(p => p.agentId !== response.agentId),
                    context
                );

                roundContributions.push(contribution);
            }

            debate.rounds.push({
                round: round + 1,
                contributions: roundContributions
            });

            // Update perspectives for next round
            currentPerspectives = roundContributions.map(c => ({
                agentId: c.agentId,
                agentName: c.agentName,
                domain: c.domain,
                mainInsight: c.finalPosition,
                confidence: c.confidence
            }));
        }

        // Synthesize final consensus
        debate.consensus = await this.synthesizeDebate(debate, query, context);

        return debate.consensus;
    }

    /**
     * Synthesize debate into final recommendation
     */
    async synthesizeDebate(debate, query, context) {
        const lastRound = debate.rounds[debate.rounds.length - 1];

        // Weight contributions by confidence and agent weight
        const weightedInsights = lastRound.contributions
            .sort((a, b) => (b.confidence * b.weight) - (a.confidence * a.weight));

        // Build synthesis prompt
        const synthesisPrompt = `You are a Senior Partner synthesizing a multi-disciplinary consulting team's analysis.

ORIGINAL QUESTION: ${query}

EXPERT PERSPECTIVES:
${weightedInsights.map(c => `
## ${c.agentName} (${c.domain}) - Confidence: ${Math.round(c.confidence * 100)}%
Main View: ${c.finalPosition}
Agreements: ${c.agreements.map(a => a.point).join('; ') || 'None stated'}
Concerns: ${c.disagreements.map(d => d.concern).join('; ') || 'None stated'}
`).join('\n')}

Synthesize these perspectives into a unified recommendation that:
1. Acknowledges key points of agreement
2. Resolves or acknowledges disagreements
3. Provides a clear, actionable recommendation
4. Highlights the most important consideration from each domain
5. States overall confidence level

FORMAT:
## Executive Summary
[2-3 sentence synthesis]

## Key Insights
- Strategy: [Key point]
- Finance: [Key point]
- Risk: [Key point]
- Change: [Key point]
- PMO: [Key point]

## Unified Recommendation
[Clear, actionable recommendation]

## Considerations & Trade-offs
[What needs to be balanced]

## Confidence: [X]%`;

        try {
            const response = await llmService.generateResponse({
                prompt: synthesisPrompt,
                maxTokens: 1500,
                temperature: 0.6
            });

            const text = response.text || response;
            const confidenceMatch = text.match(/Confidence:\s*(\d+)/i);

            return {
                type: 'debate_synthesis',
                synthesis: text,
                confidence: confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7,
                agentsInvolved: weightedInsights.map(c => c.agentName),
                debateRounds: debate.rounds.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[AgentCoordinator] Error synthesizing debate:', error);
            return this.synthesizeResponses(
                lastRound.contributions.map(c => c.initialView)
            );
        }
    }

    /**
     * Simple synthesis when debate is not needed
     */
    synthesizeResponses(responses) {
        if (responses.length === 0) {
            return {
                type: 'no_response',
                synthesis: 'Unable to generate a response.',
                confidence: 0
            };
        }

        if (responses.length === 1) {
            return {
                type: 'single_agent',
                synthesis: responses[0].fullAnalysis || responses[0].mainInsight,
                mainInsight: responses[0].mainInsight,
                recommendations: responses[0].recommendations,
                confidence: responses[0].confidence,
                agent: responses[0].agentName
            };
        }

        // Combine multiple responses
        const combinedRecommendations = [];
        responses.forEach(r => {
            if (r.recommendations) {
                combinedRecommendations.push(...r.recommendations.map(rec => ({
                    recommendation: rec,
                    source: r.agentName,
                    domain: r.domain
                })));
            }
        });

        // Calculate weighted average confidence
        const avgConfidence = responses.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / responses.length;

        return {
            type: 'multi_agent_synthesis',
            synthesis: responses.map(r => `**${r.agentName}**: ${r.mainInsight}`).join('\n\n'),
            perspectives: responses.map(r => ({
                agent: r.agentName,
                domain: r.domain,
                insight: r.mainInsight,
                confidence: r.confidence
            })),
            recommendations: combinedRecommendations,
            confidence: avgConfidence
        };
    }

    /**
     * Get general response when no specific agent is relevant
     */
    async getGeneralResponse(query, context) {
        const prompt = `You are a senior management consultant. The user has asked a question that doesn't fall into a specific domain.

QUESTION: ${query}

CONTEXT:
- Organization: ${context.organization?.name || 'Unknown'}
- Industry: ${context.organization?.industry || 'Unknown'}
- Current Project: ${context.project?.name || 'None'}

Provide a helpful, professional response. If the question would benefit from specialist analysis, suggest which domain expert would be most helpful (Strategy, Finance, Change Management, Risk, or PMO).`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 1000,
                temperature: 0.7
            });

            return {
                type: 'general_response',
                synthesis: response.text || response,
                confidence: 0.6,
                suggestSpecialist: true
            };
        } catch (error) {
            return {
                type: 'error',
                synthesis: 'I apologize, but I was unable to process your request. Please try rephrasing your question.',
                confidence: 0,
                error: error.message
            };
        }
    }

    /**
     * Update metrics after processing
     */
    updateMetrics(agents, processingTime) {
        this.metrics.queriesProcessed++;

        // Update running average
        const n = this.metrics.queriesProcessed;
        this.metrics.averageAgentsPerQuery =
            ((n - 1) * this.metrics.averageAgentsPerQuery + agents.length) / n;

        // Track agent usage
        agents.forEach(agent => {
            const domain = agent.domain;
            if (this.metrics.agentUsage[domain] !== undefined) {
                this.metrics.agentUsage[domain]++;
            }
        });
    }

    /**
     * Get specific agent by domain
     */
    getAgent(domain) {
        return this.agents[domain] || null;
    }

    /**
     * Get all agents
     */
    getAllAgents() {
        return Object.values(this.agents);
    }

    /**
     * Get coordinator metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            agentCount: Object.keys(this.agents).length,
            uptime: process.uptime()
        };
    }

    /**
     * Direct query to specific agent (bypass coordination)
     */
    async queryAgent(domain, query, context) {
        const agent = this.agents[domain];
        if (!agent) {
            throw new Error(`Unknown agent domain: ${domain}`);
        }

        return await agent.process(query, context);
    }

    /**
     * Get agent recommendations for a specific topic
     */
    async getSpecialistRecommendations(topic, context) {
        const recommendations = {};

        for (const [domain, agent] of Object.entries(this.agents)) {
            try {
                const relevance = await agent.checkRelevance(topic, context);
                if (relevance.isRelevant && relevance.confidence > 0.5) {
                    const response = await agent.process(topic, context);
                    recommendations[domain] = {
                        agent: agent.name,
                        relevance: relevance.confidence,
                        recommendations: response.recommendations || [],
                        confidence: response.confidence
                    };
                }
            } catch (error) {
                console.error(`[AgentCoordinator] Error getting ${domain} recommendations:`, error);
            }
        }

        return recommendations;
    }
}

// Singleton instance
let coordinatorInstance = null;

export const getCoordinator = (config = {}) => {
    if (!coordinatorInstance) {
        coordinatorInstance = new AgentCoordinator(config);
    }
    return coordinatorInstance;
};

export const resetCoordinator = () => {
    coordinatorInstance = null;
};

export {
AgentCoordinator,
    getCoordinator,
    resetCoordinator
};

export default {
    AgentCoordinator,
    getCoordinator,
    resetCoordinator
};










