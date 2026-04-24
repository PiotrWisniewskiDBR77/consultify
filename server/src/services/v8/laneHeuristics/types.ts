/**
 * Shared types for lane heuristic functions.
 * These mirror the frontend types but are backend-only.
 */

export type SuggestionFeasibility =
  | 'immediate'
  | 'manager_decision'
  | 'leadership_decision'
  | 'not_feasible_now';

export type SuggestionCategory = 'operational' | 'organizational' | 'governance' | 'quality';

export interface ObservationItem {
  id: string;
  metric: string;
  scope: 'initiative' | 'team' | 'owner' | 'portfolio' | 'task' | 'decision';
  since?: string;
  trend: 'rising' | 'stable' | 'improving';
  severity: 'info' | 'warning' | 'critical';
  entityId?: string;
  entityName?: string;
}

export interface InsightItem {
  id: string;
  observationIds: string[];
  interpretation: string;
  isSystemic: boolean;
  requiresAction: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface EffectItem {
  id: string;
  insightId: string;
  consequence: string;
  blastRadius: number;
  costImpact?: string;
  timelineImpact?: string;
  affectedEntities?: Array<{ id: string; name: string; type: string }>;
}

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

export interface DecisionItem {
  id: string;
  suggestionId: string;
  state: string;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
}

export interface ExecutionPlanItem {
  id: string;
  decisionId: string;
  tasks: Array<{ title: string; owner: string; deadline: string; status: string }>;
  beforeState?: string;
  afterState?: string;
  verificationStatus: 'pending' | 'in_progress' | 'verified' | 'failed';
}

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

export interface HeuristicInput {
  organizationId: string;
  projectId?: string;
  controlTowerQueues: Record<string, any[]>;
  controlTowerCounts: Record<string, number>;
  riskSignals: any[];
  delaySignals: any[];
  capacityAlerts: any[];
  decisions: any[];
  initiatives: any[];
  tasks: any[];
}

export interface HeuristicOutput {
  observations: ObservationItem[];
  insights: InsightItem[];
  effects: EffectItem[];
  suggestions: SuggestionItem[];
}
