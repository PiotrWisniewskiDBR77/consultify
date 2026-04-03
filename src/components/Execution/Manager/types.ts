/**
 * Manager 6-Lane Cockpit — shared types
 *
 * Every lane follows the same analytical cycle:
 *   Observations -> Insights -> Effects -> Suggestions -> Decisions -> Execution
 */

// ---------------------------------------------------------------------------
// Observation: raw facts from data
// ---------------------------------------------------------------------------

export interface ObservationItem {
  id: string;
  metric: string;
  scope: 'initiative' | 'team' | 'owner' | 'portfolio' | 'task' | 'decision';
  since?: string;
  trend: 'rising' | 'stable' | 'improving';
  severity: 'info' | 'warning' | 'critical';
  entityId?: string;
  entityName?: string;
  rawData?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Insight: system interpretation
// ---------------------------------------------------------------------------

export interface InsightItem {
  id: string;
  observationIds: string[];
  interpretation: string;
  isSystemic: boolean;
  requiresAction: boolean;
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Effect: consequences of inaction
// ---------------------------------------------------------------------------

export interface EffectItem {
  id: string;
  insightId: string;
  consequence: string;
  blastRadius: number;
  costImpact?: string;
  timelineImpact?: string;
  affectedEntities?: Array<{ id: string; name: string; type: string }>;
}

// ---------------------------------------------------------------------------
// Suggestion: proposed actions with feasibility
// ---------------------------------------------------------------------------

export type SuggestionFeasibility =
  | 'immediate'
  | 'manager_decision'
  | 'leadership_decision'
  | 'not_feasible_now';

export type SuggestionCategory =
  | 'operational'
  | 'organizational'
  | 'governance'
  | 'quality';

export interface SuggestionItem {
  id: string;
  action: string;
  reason: string;
  expectedOutcome: string;
  cost: string;
  feasibility: SuggestionFeasibility;
  requiresApproval: boolean;
  recommendedOwner?: string;
  category: SuggestionCategory;
}

// ---------------------------------------------------------------------------
// Decision: operator choice on a suggestion
// ---------------------------------------------------------------------------

export type DecisionState =
  | 'proposed'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'deferred'
  | 'in_execution'
  | 'verified';

export interface DecisionItem {
  id: string;
  suggestionId: string;
  state: DecisionState;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Execution plan: tasks created from a decision
// ---------------------------------------------------------------------------

export type VerificationStatus = 'pending' | 'in_progress' | 'verified' | 'failed';

export interface ExecutionTask {
  title: string;
  owner: string;
  deadline: string;
  status: string;
}

export interface ExecutionPlanItem {
  id: string;
  decisionId: string;
  tasks: ExecutionTask[];
  beforeState?: string;
  afterState?: string;
  verificationStatus: VerificationStatus;
}

// ---------------------------------------------------------------------------
// Full lane analysis (returned by backend)
// ---------------------------------------------------------------------------

export type LaneSeverity = 'ok' | 'warning' | 'critical';
export type LaneConfidence = 'high' | 'medium' | 'low' | 'degraded';

export interface LaneAnalysis {
  observations: ObservationItem[];
  insights: InsightItem[];
  effects: EffectItem[];
  suggestions: SuggestionItem[];
  decisions: DecisionItem[];
  executionPlan: ExecutionPlanItem[];
  severity: LaneSeverity;
  confidence: LaneConfidence;
  lastRefreshed: string;
}

// ---------------------------------------------------------------------------
// Lane identifiers
// ---------------------------------------------------------------------------

export type ManagerLaneId =
  | 'action-queue'
  | 'decisions'
  | 'blockers'
  | 'workload'
  | 'risk'
  | 'people-change';

// ---------------------------------------------------------------------------
// Lane action dispatched from UI
// ---------------------------------------------------------------------------

export type LaneActionType =
  | 'approve'
  | 'reject'
  | 'defer'
  | 'escalate'
  | 'execute'
  | 'request_info'
  | 'refresh';

export interface LaneAction {
  type: LaneActionType;
  targetId: string;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Metric definition for summary strip
// ---------------------------------------------------------------------------

export interface MetricDef {
  label: string;
  value: number | string;
  variant?: 'default' | 'warn' | 'critical';
}
