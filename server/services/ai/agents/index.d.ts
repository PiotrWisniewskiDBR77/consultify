export namespace AGENT_REGISTRY {
    export { StrategyAgent as strategy };
    export { FinanceAgent as finance };
    export { ChangeAgent as change };
    export { RiskAgent as risk };
    export { PMOAgent as pmo };
}
export function createAgent(domain: string, config?: object): BaseAgent;
export function getAvailableDomains(): string[];
export function getAllAgentMetadata(): object[];
declare namespace _default {
    export { BaseAgent };
    export { StrategyAgent };
    export { FinanceAgent };
    export { ChangeAgent };
    export { RiskAgent };
    export { PMOAgent };
    export { AgentCoordinator };
    export { getCoordinator };
    export { resetCoordinator };
    export { AGENT_REGISTRY };
    export { createAgent };
    export { getAvailableDomains };
    export { getAllAgentMetadata };
}
export default _default;
import { StrategyAgent } from './strategyAgent.js';
import { FinanceAgent } from './financeAgent.js';
import { ChangeAgent } from './changeAgent.js';
import { RiskAgent } from './riskAgent.js';
import { PMOAgent } from './pmoAgent.js';
import { BaseAgent } from './baseAgent.js';
import { AgentCoordinator } from './agentCoordinator.js';
import { getCoordinator } from './agentCoordinator.js';
import { resetCoordinator } from './agentCoordinator.js';
export { BaseAgent, StrategyAgent, FinanceAgent, ChangeAgent, RiskAgent, PMOAgent, AgentCoordinator, getCoordinator, resetCoordinator };
//# sourceMappingURL=index.d.ts.map