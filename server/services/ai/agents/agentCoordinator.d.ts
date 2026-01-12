export class AgentCoordinator {
    constructor(config?: {});
    id: string;
    name: string;
    agents: {
        strategy: StrategyAgent;
        finance: FinanceAgent;
        change: ChangeAgent;
        risk: RiskAgent;
        pmo: PMOAgent;
    };
    minAgentsForDebate: any;
    maxAgentsPerQuery: any;
    debateRounds: any;
    confidenceThreshold: any;
    metrics: {
        queriesProcessed: number;
        debatesHeld: number;
        averageAgentsPerQuery: number;
        agentUsage: {};
    };
    /**
     * Main entry point - process a query and coordinate agents
     * @param {string} query - User query
     * @param {object} context - Full context object
     * @param {object} options - Processing options
     * @returns {object} Coordinated response
     */
    processQuery(query: string, context: object, options?: object): object;
    /**
     * Select which agents should respond to the query
     */
    selectAgents(query: any, context: any): Promise<(StrategyAgent | FinanceAgent | ChangeAgent | RiskAgent | PMOAgent)[]>;
    /**
     * Gather responses from selected agents in parallel
     */
    gatherAgentResponses(query: any, context: any, agents: any): Promise<any[]>;
    /**
     * Conduct debate between agents for consensus
     */
    conductDebate(query: any, initialResponses: any, context: any): Promise<null>;
    /**
     * Synthesize debate into final recommendation
     */
    synthesizeDebate(debate: any, query: any, context: any): Promise<{
        type: string;
        synthesis: string;
        confidence: number;
        mainInsight?: undefined;
        recommendations?: undefined;
        agent?: undefined;
        perspectives?: undefined;
    } | {
        type: string;
        synthesis: any;
        mainInsight: any;
        recommendations: any;
        confidence: any;
        agent: any;
        perspectives?: undefined;
    } | {
        type: string;
        synthesis: any;
        perspectives: any;
        recommendations: any[];
        confidence: number;
        mainInsight?: undefined;
        agent?: undefined;
    } | {
        type: string;
        synthesis: any;
        confidence: number;
        agentsInvolved: any;
        debateRounds: any;
        timestamp: string;
    }>;
    /**
     * Simple synthesis when debate is not needed
     */
    synthesizeResponses(responses: any): {
        type: string;
        synthesis: string;
        confidence: number;
        mainInsight?: undefined;
        recommendations?: undefined;
        agent?: undefined;
        perspectives?: undefined;
    } | {
        type: string;
        synthesis: any;
        mainInsight: any;
        recommendations: any;
        confidence: any;
        agent: any;
        perspectives?: undefined;
    } | {
        type: string;
        synthesis: any;
        perspectives: any;
        recommendations: any[];
        confidence: number;
        mainInsight?: undefined;
        agent?: undefined;
    };
    /**
     * Get general response when no specific agent is relevant
     */
    getGeneralResponse(query: any, context: any): Promise<{
        type: string;
        synthesis: any;
        confidence: number;
        suggestSpecialist: boolean;
        error?: undefined;
    } | {
        type: string;
        synthesis: string;
        confidence: number;
        error: any;
        suggestSpecialist?: undefined;
    }>;
    /**
     * Update metrics after processing
     */
    updateMetrics(agents: any, processingTime: any): void;
    /**
     * Get specific agent by domain
     */
    getAgent(domain: any): any;
    /**
     * Get all agents
     */
    getAllAgents(): (StrategyAgent | FinanceAgent | ChangeAgent | RiskAgent | PMOAgent)[];
    /**
     * Get coordinator metrics
     */
    getMetrics(): {
        agentCount: number;
        uptime: number;
        queriesProcessed: number;
        debatesHeld: number;
        averageAgentsPerQuery: number;
        agentUsage: {};
    };
    /**
     * Direct query to specific agent (bypass coordination)
     */
    queryAgent(domain: any, query: any, context: any): Promise<any>;
    /**
     * Get agent recommendations for a specific topic
     */
    getSpecialistRecommendations(topic: any, context: any): Promise<{}>;
}
export function getCoordinator(config?: {}): any;
export function resetCoordinator(): void;
declare namespace _default {
    export { AgentCoordinator };
    export { getCoordinator };
    export { resetCoordinator };
}
export default _default;
import { StrategyAgent } from './strategyAgent.js';
import { FinanceAgent } from './financeAgent.js';
import { ChangeAgent } from './changeAgent.js';
import { RiskAgent } from './riskAgent.js';
import { PMOAgent } from './pmoAgent.js';
//# sourceMappingURL=agentCoordinator.d.ts.map