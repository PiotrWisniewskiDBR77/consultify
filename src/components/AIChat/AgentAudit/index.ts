/**
 * Agent Audit Layer UI Components
 *
 * Components for displaying Agent Audit functionality in the AI Chat:
 * - AgentSuggestionCard: Pre-DT agent selection
 * - AgentAuditVerdictPanel: Post-DT audit results
 */

export { AgentSuggestionCard } from './AgentSuggestionCard';
export type {
  SuggestedAgent,
  AgentDefinition as AgentSuggestionDefinition,
  DecisionContext,
  UserIntent,
  AgentKind,
} from './AgentSuggestionCard';

export { AgentAuditVerdictPanel } from './AgentAuditVerdictPanel';
export type {
  QualityStatus,
  GateId,
  RiskArea,
  GateExplanation,
  SourceUsed,
  Finding,
  AgentReview,
  ActionableFollowup,
  OrchestratorVerdict,
  AgentDefinition,
} from './AgentAuditVerdictPanel';
