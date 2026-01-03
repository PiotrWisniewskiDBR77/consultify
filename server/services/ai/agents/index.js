/**
 * AI Agents Module - Multi-Agent Architecture
 * 
 * This module provides a team of specialist AI agents that collaborate
 * to provide comprehensive consulting advice.
 * 
 * Usage:
 * ```javascript
 * import { getCoordinator } from './agents';
 * 
 * const coordinator = getCoordinator();
 * const result = await coordinator.processQuery(
 *   "How should we prioritize our digital initiatives?",
 *   { organization: {...}, project: {...} }
 * );
 * ```
 * 
 * Direct agent access:
 * ```javascript
 * import { StrategyAgent } from './agents';
 * const strategy = new StrategyAgent();
 * const analysis = await strategy.process(query, context);
 * ```
 */

import { BaseAgent } from './baseAgent.js';
import { StrategyAgent } from './strategyAgent.js';
import { FinanceAgent } from './financeAgent.js';
import { ChangeAgent } from './changeAgent.js';
import { RiskAgent } from './riskAgent.js';
import { PMOAgent } from './pmoAgent.js';
import { AgentCoordinator, getCoordinator, resetCoordinator } from './agentCoordinator.js';

// Agent registry for dynamic access
export const AGENT_REGISTRY = {
    strategy: StrategyAgent,
    finance: FinanceAgent,
    change: ChangeAgent,
    risk: RiskAgent,
    pmo: PMOAgent
};

/**
 * Create a new agent instance by domain
 * @param {string} domain - Agent domain (strategy, finance, change, risk, pmo)
 * @param {object} config - Agent configuration
 * @returns {BaseAgent} Agent instance
 */
export const createAgent = (domain, config = {}) => {
    const AgentClass = AGENT_REGISTRY[domain];
    if (!AgentClass) {
        throw new Error(`Unknown agent domain: ${domain}. Available: ${Object.keys(AGENT_REGISTRY).join(', ')}`);
    }
    return new AgentClass(config);
};

/**
 * Get all available agent domains
 * @returns {string[]} List of domain names
 */
export const getAvailableDomains = () => Object.keys(AGENT_REGISTRY);

/**
 * Get agent metadata for all agents
 * @returns {object[]} Array of agent metadata
 */
export const getAllAgentMetadata = () => {
    return Object.entries(AGENT_REGISTRY).map(([domain, AgentClass]) => {
        const instance = new AgentClass();
        return {
            domain,
            ...instance.getMetadata()
        };
    });
};

export {
    BaseAgent,
    StrategyAgent,
    FinanceAgent,
    ChangeAgent,
    RiskAgent,
    PMOAgent,
    AgentCoordinator,
    getCoordinator,
    resetCoordinator
};

export default {
    BaseAgent,
    StrategyAgent,
    FinanceAgent,
    ChangeAgent,
    RiskAgent,
    PMOAgent,
    AgentCoordinator,
    getCoordinator,
    resetCoordinator,
    AGENT_REGISTRY,
    createAgent,
    getAvailableDomains,
    getAllAgentMetadata
};


