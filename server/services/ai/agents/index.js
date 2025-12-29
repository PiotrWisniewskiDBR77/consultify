/**
 * AI Agents Module - Multi-Agent Architecture
 * 
 * This module provides a team of specialist AI agents that collaborate
 * to provide comprehensive consulting advice.
 * 
 * Usage:
 * ```javascript
 * const { getCoordinator } = require('./agents');
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
 * const { StrategyAgent } = require('./agents');
 * const strategy = new StrategyAgent();
 * const analysis = await strategy.process(query, context);
 * ```
 */

const { BaseAgent } = require('./baseAgent');
const { StrategyAgent } = require('./strategyAgent');
const { FinanceAgent } = require('./financeAgent');
const { ChangeAgent } = require('./changeAgent');
const { RiskAgent } = require('./riskAgent');
const { PMOAgent } = require('./pmoAgent');
const { AgentCoordinator, getCoordinator, resetCoordinator } = require('./agentCoordinator');

// Agent registry for dynamic access
const AGENT_REGISTRY = {
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
const createAgent = (domain, config = {}) => {
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
const getAvailableDomains = () => Object.keys(AGENT_REGISTRY);

/**
 * Get agent metadata for all agents
 * @returns {object[]} Array of agent metadata
 */
const getAllAgentMetadata = () => {
    return Object.entries(AGENT_REGISTRY).map(([domain, AgentClass]) => {
        const instance = new AgentClass();
        return {
            domain,
            ...instance.getMetadata()
        };
    });
};

module.exports = {
    // Base class
    BaseAgent,
    
    // Specialist agents
    StrategyAgent,
    FinanceAgent,
    ChangeAgent,
    RiskAgent,
    PMOAgent,
    
    // Coordinator
    AgentCoordinator,
    getCoordinator,
    resetCoordinator,
    
    // Registry utilities
    AGENT_REGISTRY,
    createAgent,
    getAvailableDomains,
    getAllAgentMetadata
};

