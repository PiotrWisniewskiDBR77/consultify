/**
 * AI Agents Module — Multi-Agent Architecture (metadata registry)
 *
 * HISTORY / WHY THIS FILE IS REAL AGAIN:
 * During the TS/ESM migration the whole `ai/agents/*` tree was collapsed into
 * self-import lazy wrappers (`export default loadIndex()` pointing back at
 * `ai/agents/index.js` = itself). That made the DEFAULT export an unresolved
 * Promise, so `aiOrchestrator._AIAgents.getAllAgentMetadata()` blew up with
 * "getAllAgentMetadata is not a function" and crashed every `/api/agents/*`
 * call (RED-F W6). The original implementation (server/services/ai/agents/
 * index.js @ f7f1ed745d) instantiated the 5 agent classes and read their
 * getMetadata(). Those agent CLASS files are still gutted wrappers, so the
 * live coordinator/LLM machinery is genuinely unavailable — but the STATIC
 * agent metadata is stable and safe to serve directly.
 *
 * This module therefore serves the real agent-domain registry synchronously
 * (no lazy self-reference, no LLM dependency). Coordinator-backed features
 * throw a typed "not configured" error, which the agents routes convert into
 * a graceful 503 (feature unavailable) rather than a 500 crash.
 */

import { v4 as uuidv4 } from 'uuid';

export interface AgentMetadata {
  domain: string;
  name: string;
  expertise: string[];
  confidenceThreshold: number;
  canInitiateDebate: boolean;
  debateWeight: number;
}

interface AgentRegistryEntry {
  /** Public registry key used by the routes' validDomains list. */
  key: string;
  name: string;
  /** Internal specialist domain (matches the original agent class domain). */
  domain: string;
  expertise: string[];
  confidenceThreshold: number;
  debateWeight: number;
  canInitiateDebate: boolean;
}

/**
 * Static registry of the 5 specialist agent domains.
 * Values reproduced faithfully from the pre-migration agent classes
 * (StrategyAgent/FinanceAgent/ChangeAgent/RiskAgent/PMOAgent @ f7f1ed745d).
 */
const AGENT_REGISTRY_METADATA: AgentRegistryEntry[] = [
  {
    key: 'strategy',
    name: 'StrategyAgent',
    domain: 'strategy',
    expertise: [
      'Corporate Strategy',
      'Digital Transformation',
      'Market Analysis',
      'Competitive Positioning',
      'Strategic Planning',
      'Vision Alignment',
      'Portfolio Management',
      'Business Model Innovation',
    ],
    confidenceThreshold: 0.75,
    debateWeight: 1.2,
    canInitiateDebate: true,
  },
  {
    key: 'finance',
    name: 'FinanceAgent',
    domain: 'finance',
    expertise: [
      'ROI Analysis',
      'NPV/IRR Calculations',
      'Budget Planning',
      'Cost-Benefit Analysis',
      'Financial Modeling',
      'Investment Appraisal',
      'Cash Flow Management',
      'Business Case Development',
    ],
    confidenceThreshold: 0.8,
    debateWeight: 1.1,
    canInitiateDebate: true,
  },
  {
    key: 'change',
    name: 'ChangeAgent',
    domain: 'change_management',
    expertise: [
      'ADKAR Methodology',
      'Stakeholder Management',
      'Communication Strategy',
      'Resistance Management',
      'Training & Adoption',
      'Culture Transformation',
      'Change Readiness',
      'Organizational Development',
    ],
    confidenceThreshold: 0.7,
    debateWeight: 1.0,
    canInitiateDebate: true,
  },
  {
    key: 'risk',
    name: 'RiskAgent',
    domain: 'risk_management',
    expertise: [
      'Risk Identification',
      'Risk Assessment',
      'Risk Quantification',
      'Mitigation Planning',
      'Contingency Planning',
      'Compliance Risk',
      'Operational Risk',
      'Strategic Risk',
    ],
    confidenceThreshold: 0.75,
    debateWeight: 1.1,
    canInitiateDebate: true,
  },
  {
    key: 'pmo',
    name: 'PMOAgent',
    domain: 'project_management',
    expertise: [
      'Project Planning',
      'Resource Management',
      'Portfolio Management',
      'Stage Gate Governance',
      'Status Reporting',
      'Dependency Management',
      'PMBOK Framework',
      'PRINCE2 Methodology',
      'Agile/Scrum',
      'Critical Path Analysis',
    ],
    confidenceThreshold: 0.7,
    debateWeight: 1.0,
    canInitiateDebate: true,
  },
];

/** Registry keyed by public domain name (strategy, finance, change, risk, pmo). */
export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = Object.fromEntries(
  AGENT_REGISTRY_METADATA.map((a) => [a.key, a])
);

/**
 * List of available public agent domains.
 * @returns Domain keys usable in POST /api/agents/query/:domain.
 */
export const getAvailableDomains = (): string[] => AGENT_REGISTRY_METADATA.map((a) => a.key);

/**
 * Metadata for all registered specialist agents.
 * Shape matches the pre-migration BaseAgent.getMetadata() output (fresh uuid
 * per call, mirroring the original `new AgentClass()` behaviour), with the
 * internal specialist domain — exactly what the old getAllAgentMetadata()
 * produced.
 */
export const getAllAgentMetadata = (): AgentMetadata[] =>
  AGENT_REGISTRY_METADATA.map((a) => ({
    id: uuidv4(),
    name: a.name,
    domain: a.domain,
    expertise: a.expertise,
    confidenceThreshold: a.confidenceThreshold,
    canInitiateDebate: a.canInitiateDebate,
    debateWeight: a.debateWeight,
  })) as unknown as AgentMetadata[];

/**
 * Thrown by coordinator-backed helpers. The specialist coordinator / LLM
 * agents were removed during migration and are not wired in this build.
 * The agents routes catch this and return a graceful 503 (not a 500 crash).
 */
export class AgentCoordinatorUnavailableError extends Error {
  readonly code = 'agent_coordinator_not_configured';
  constructor() {
    super('Agent coordinator is not configured in this build');
    this.name = 'AgentCoordinatorUnavailableError';
  }
}

/**
 * Live coordinator accessor. Intentionally unavailable: the specialist agent
 * classes and coordinator were gutted during the ESM migration. Throws a typed
 * error so the routes degrade to 503 instead of surfacing an opaque 500.
 */
export const getCoordinator = (): never => {
  throw new AgentCoordinatorUnavailableError();
};

/**
 * Instantiate a specialist agent by domain. Unavailable in this build for the
 * same reason as getCoordinator().
 */
export const createAgent = (_domain: string): never => {
  throw new AgentCoordinatorUnavailableError();
};

const agentsModule = {
  AGENT_REGISTRY,
  getAvailableDomains,
  getAllAgentMetadata,
  getCoordinator,
  createAgent,
  AgentCoordinatorUnavailableError,
};

export default agentsModule;
