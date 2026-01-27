/**
 * Decisions Module - Unified Decision Management
 * Cross-cutting decision system (gates) for all modules
 */

export { DecisionCard } from './DecisionCard';
export type { Decision } from './DecisionCard';

// Main Hub (ModuleHub pattern)
export { DecisionsHub } from './DecisionsHub';

// Embedded components (for use in other modules)
export { DecisionInbox } from './DecisionInbox';
export { DecisionsByInitiative } from './DecisionsByInitiative';
export { EscalationDashboard } from './EscalationDashboard';
