import { v8Get, v8Patch, v8Post } from './client';

export interface V8ExecutionManagementSectionProvenance {
  source: string;
  state: 'available' | 'degraded';
  reason?: string;
}

export interface V8ExecutionManagementSnapshot {
  contractVersion: 'execution_management_snapshot_v1';
  asOf: string;
  initiative: {
    id: string;
    projectId: string | null;
    name: string;
    status: string;
    ownerId: string | null;
    ownerName: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
  };
  milestones: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  provenance: Record<string, V8ExecutionManagementSectionProvenance>;
  degradedSections: string[];
}

export const shouldFallbackToLegacyExecutionControl = (error: any) => {
  const status = Number(error?.status);
  const code = String(error?.data?.error?.code ?? error?.data?.code ?? error?.code ?? '').trim();

  // Execution-control is a canonical, mounted capability. Validation and
  // not-found responses are business truth and must never redirect reads or
  // writes into the legacy aggregate. A fallback is permitted only when the
  // server explicitly declares that this capability is unavailable during a
  // controlled compatibility window.
  return status === 501 && code === 'EXECUTION_CONTROL_CAPABILITY_UNAVAILABLE';
};

export interface V8ExecutionRiskSignal {
  id: string;
  initiativeId: string;
  initiativeName: string;
  signalType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  suggestedAction: string;
}

export interface V8ExecutionDelaySignal {
  id: string;
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  entityName: string;
  deviationType: 'LATE_START' | 'LATE_FINISH_RISK' | 'DEADLINE_RISK' | 'OVERDUE';
  severity: 'WARNING' | 'CRITICAL';
  daysDeviation: number;
  plannedDate: string | null;
  actualOrCurrent: string | null;
  whySlipReasons: Array<{ reason: string; detail: string }>;
  isDismissed: boolean;
}

export interface V8ExecutionBudgetInitiativeSummary {
  initiativeId: string;
  initiativeName: string;
  currency: string;
  planned: { total: number; capex: number; opex: number };
  actual: { total: number; capex: number; opex: number };
  variance: { total: number; percent: number };
  burnRate: number;
  forecast: { total: number; isOverBudget: boolean };
  status: 'GREEN' | 'AMBER' | 'RED';
}

export interface V8ExecutionPortfolioBudgetSummary {
  totalPlanned: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  currency: string;
  initiativeSummaries: V8ExecutionBudgetInitiativeSummary[];
  overspendCount: number;
  topOverspenders: { initiativeId: string; name: string; variancePercent: number }[];
}

export interface V8ExecutionOverspendSignal {
  id: string;
  initiativeId: string | null;
  initiativeName: string;
  signalType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  plannedAmount: number;
  actualAmount: number;
  variancePercent: number;
  message: string;
}

export interface V8ManagerProblemAction {
  id: string;
  label: string;
  variant?: 'default' | 'primary' | 'danger';
}

export interface V8ManagerProblemRow {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  problemType: string;
  title: string;
  rootCause: string;
  sourceEntityType: 'INITIATIVE' | 'TASK' | 'DECISION' | 'RAID_ITEM' | 'PERSON';
  sourceEntityId: string;
  sourceEntityName: string;
  ownerId: string | null;
  ownerName: string | null;
  daysOverdue: number | null;
  impactCount: number;
  affectedEntities: Array<{ id: string; name: string; type: string }>;
  actions: V8ManagerProblemAction[];
  meta: Record<string, unknown>;
}

export interface V8ManagerActionExecutionResult {
  success: boolean;
  message: string;
  changedCount: number;
  changedEntities: Array<{ entityType: string; entityId: string }>;
}

// AI recommendation types
export interface V8AiStep {
  order: number;
  action: string;
  owner: string;
  timeframe: string;
  outcome: string;
}

export interface V8AiRecommendation {
  problemId: string;
  diagnosis: string;
  recommendation: string;
  steps: V8AiStep[];
  confidence: number;
  reasoning: string;
  alternativeApproach: string;
}

export interface V8AiTriageCluster {
  theme: string;
  severity: 'critical' | 'warning' | 'info';
  problemIds: string[];
  summary: string;
  suggestedAction: string;
}

export interface V8AiTriageResult {
  clusters: V8AiTriageCluster[];
  topPriority: string[];
  executiveSummary: string;
}

export interface V8AiManageAllCluster {
  theme: string;
  severity: 'critical' | 'warning' | 'info';
  diagnosis: string;
  steps: V8AiStep[];
  affectedProblemIds: string[];
}

export interface V8AiManageAllResult {
  laneId: string;
  executiveSummary: string;
  clusters: V8AiManageAllCluster[];
  quickWins: string[];
  escalationNeeded: string[];
}

export interface V8ExecutionTimelineWarning {
  initiativeId: string;
  initiativeName: string;
  type: 'overdue' | 'blocked' | 'dependency_conflict' | 'sla_approaching';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  daysOverdue?: number;
}

export interface V8ExecutionCapacityAlert {
  userId: string;
  name: string;
  capacityHours: number;
  allocatedHours: number;
  overloadHours: number;
  severity: 'warning' | 'critical';
  suggestion: string;
}

export interface V8ExecutionCapacityWeek {
  weekStart: string;
  capacityHours: number;
  allocatedHours: number;
  availableHours: number;
  /** 0..100; org-wide average utilization for that week. */
  utilizationPercent?: number;
}

export interface V8ExecutionTimelineUpdatePayload {
  initiativeId: string;
  field:
    | 'status'
    | 'planned_start_date'
    | 'planned_end_date'
    | 'start_date'
    | 'actual_end_date'
    | 'progress';
  value: string;
  reason?: string;
}

export interface V8ExecutionBudgetEntryPayload {
  initiativeId: string;
  entryType: 'ACTUAL' | 'FORECAST' | 'ADJUSTMENT';
  costType: 'CAPEX' | 'OPEX';
  category?: string;
  amount: number;
  currency?: string;
  description?: string;
  periodMonth?: number;
  periodYear?: number;
  source?: string;
}

// M14 → M15 feed-forward: record a human-entered realized benefit value for an
// initiative from the Execution context. Flows into Results (M15) ROI portfolio.
export interface V8ExecutionRealizationPayload {
  initiativeId: string;
  /** ISO date (YYYY-MM-DD) for the realization period. */
  periodMonth: string;
  realizedRevenueDelta?: number | null;
  realizedCostDelta?: number | null;
  realizedSavings?: number | null;
  varianceNotes?: string;
}

export interface V8ExecutionRealizationEntry {
  id: string;
  initiativeId: string;
  organizationId: string;
  periodMonth: string;
  realizedRevenueDelta: number | null;
  realizedCostDelta: number | null;
  realizedSavings: number | null;
  source: 'execution';
  varianceNotes: string | null;
  recordedBy: string;
}

// FIN-007: keyed, baseline-bound realization write — stamps WHICH approved
// Finance baseline (model + version) this actual was recorded against, at
// write time, so later reconciliation reads that frozen pointer rather than
// "whatever is currently approved". Same canonical `roi_realized_values`
// table as V8ExecutionRealizationPayload above — never a second ledger.
export interface V8ExecutionBaselineRealizationPayload {
  initiativeId: string;
  /** ISO date (YYYY-MM-DD) for the realization period. */
  periodMonth: string;
  realizedRevenueDelta?: number | null;
  realizedCostDelta?: number | null;
  realizedSavings?: number | null;
  varianceNotes?: string;
  baselineModelId: string;
  /** The model's `version` as observed by the caller — a stale value is a
   * 409 BASELINE_VERSION_CONFLICT, never silently rebound to the new one. */
  baselineExpectedVersion: number;
  evidenceRef?: string | null;
}

export interface V8ExecutionBaselineRealizationEntry extends V8ExecutionRealizationEntry {
  baselineModelId: string;
  baselineVersion: number;
  evidenceRef: string | null;
}

export interface V8ExecutionRaidMitigationPayload {
  raidItemId: string;
  mitigationPlan?: string;
  responseStrategy?: 'AVOID' | 'TRANSFER' | 'MITIGATE' | 'ACCEPT' | 'ESCALATE';
  mitigationOwnerId?: string;
  mitigationDueDate?: string;
  mitigationStatus?: 'OPEN' | 'IN_PROGRESS' | 'MITIGATED' | 'ACCEPTED' | 'CLOSED';
}

// ── Manager Lane Analysis Types ────────────────────────────────────────────

export interface V8LaneObservation {
  id: string;
  metric: string;
  scope: string;
  since?: string;
  trend: 'rising' | 'stable' | 'improving';
  severity: 'info' | 'warning' | 'critical';
  entityId?: string;
  entityName?: string;
}

export interface V8LaneInsight {
  id: string;
  observationIds: string[];
  interpretation: string;
  isSystemic: boolean;
  requiresAction: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface V8LaneEffect {
  id: string;
  insightId: string;
  consequence: string;
  blastRadius: number;
  costImpact?: string;
  timelineImpact?: string;
  affectedEntities?: Array<{ id: string; name: string; type: string }>;
}

export interface V8LaneSuggestion {
  id: string;
  action: string;
  reason: string;
  expectedOutcome: string;
  cost: string;
  feasibility: 'immediate' | 'manager_decision' | 'leadership_decision' | 'not_feasible_now';
  requiresApproval: boolean;
  recommendedOwner?: string;
  category: 'operational' | 'organizational' | 'governance' | 'quality';
}

export interface V8LaneDecision {
  id: string;
  suggestionId: string;
  state: string;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
}

export interface V8LaneExecutionPlan {
  id: string;
  decisionId: string;
  tasks: Array<{ title: string; owner: string; deadline: string; status: string }>;
  beforeState?: string;
  afterState?: string;
  verificationStatus: 'pending' | 'in_progress' | 'verified' | 'failed';
}

export interface V8LaneAnalysisResponse {
  observations: V8LaneObservation[];
  insights: V8LaneInsight[];
  effects: V8LaneEffect[];
  suggestions: V8LaneSuggestion[];
  decisions: V8LaneDecision[];
  executionPlan: V8LaneExecutionPlan[];
  severity: 'ok' | 'warning' | 'critical';
  confidence: 'high' | 'medium' | 'low' | 'degraded';
  lastRefreshed: string;
}

export const V8ExecutionControlApi = {
  getManagementSnapshot: (initiativeId: string, projectId?: string) =>
    v8Get<V8ExecutionManagementSnapshot>(
      `/execution/management/initiatives/${encodeURIComponent(initiativeId)}`,
      projectId ? { projectId } : undefined
    ),
  getRiskSignals: (projectId?: string) =>
    v8Get<{ signals: V8ExecutionRiskSignal[]; count: number }>(
      '/execution-control/risk-signals',
      projectId ? { projectId } : undefined
    ),

  getTimelineWarnings: (projectId?: string) =>
    v8Get<{ warnings: V8ExecutionTimelineWarning[]; total: number }>(
      '/execution-control/timeline-warnings',
      projectId ? { projectId } : undefined
    ),

  getDelaySignals: (params?: {
    projectId?: string;
    severity?: 'WARNING' | 'CRITICAL';
    entityType?: 'INITIATIVE' | 'TASK';
    persisted?: boolean;
  }) =>
    v8Get<{ signals: V8ExecutionDelaySignal[]; count: number; source: 'live' | 'persisted' }>(
      '/execution-control/delay-signals',
      params
        ? Object.fromEntries(
            Object.entries(params)
              .filter(([, value]) => value !== undefined)
              .map(([key, value]) => [key, String(value)])
          )
        : undefined
    ),

  getBudgetInitiativeSummary: (initiativeId: string) =>
    v8Get<{ summary: V8ExecutionBudgetInitiativeSummary }>(
      `/execution-control/budget/initiative/${encodeURIComponent(initiativeId)}`
    ),

  getBudgetPortfolio: (projectId?: string) =>
    v8Get<{ summary: V8ExecutionPortfolioBudgetSummary }>(
      '/execution-control/budget/portfolio',
      projectId ? { projectId } : undefined
    ),

  getOverspendSignals: (projectId?: string) =>
    v8Get<{ signals: V8ExecutionOverspendSignal[]; count: number }>(
      '/execution-control/budget/overspend-signals',
      projectId ? { projectId } : undefined
    ),

  getCapacityLevelingAlerts: () =>
    v8Get<{ alerts: V8ExecutionCapacityAlert[] }>('/execution-control/capacity/leveling-alerts'),

  getCapacityTimeline: (initiativeId?: string) =>
    v8Get<{ weeks: V8ExecutionCapacityWeek[] }>(
      '/execution-control/capacity/timeline',
      initiativeId ? { initiativeId } : undefined
    ),

  dismissRiskSignal: (signalId: string) =>
    v8Post<{ success: boolean; signalId: string }>('/execution-control/risk-signals/dismiss', {
      signalId,
    }),

  detectDelaySignals: (projectId?: string | null) =>
    v8Post<{ success: boolean; detected: number; persisted: number; alertsSent: number }>(
      '/execution-control/delay-signals/detect',
      { projectId: projectId || null }
    ),

  dismissDelaySignal: (payload: {
    signalId: string;
    entityType: 'INITIATIVE' | 'TASK';
    entityId: string;
    deviationType: string;
  }) =>
    v8Post<{ success: boolean; signalId: string }>(
      '/execution-control/delay-signals/dismiss',
      payload
    ),

  updateTimeline: (payload: V8ExecutionTimelineUpdatePayload) =>
    v8Post<{
      success: boolean;
      field: string;
      oldValue: string | null;
      newValue: string;
    }>('/execution-control/timeline-update', payload),

  updateRaidMitigation: (raidItemId: string, payload: V8ExecutionRaidMitigationPayload) =>
    v8Patch<{ success: boolean; raidItemId: string }>(
      `/execution-control/raid/${encodeURIComponent(raidItemId)}/mitigation`,
      payload
    ),

  createBudgetEntry: (payload: V8ExecutionBudgetEntryPayload) =>
    v8Post<{ success: boolean; id: string }>('/execution-control/budget/entries', payload),

  // M14 → M15 feed-forward: persist a human-entered realized benefit value that
  // Results (M15) reads back via its ROI portfolio rollup.
  recordRealization: (payload: V8ExecutionRealizationPayload) =>
    v8Post<{ success: boolean; entry: V8ExecutionRealizationEntry }>(
      '/execution-control/realizations',
      payload
    ),

  // FIN-007: requires an Idempotency-Key — a retry with the same key + same
  // payload returns the SAME entry (never a duplicate); a different payload
  // under the same key is a 409.
  recordBaselineRealization: (
    payload: V8ExecutionBaselineRealizationPayload,
    idempotencyKey: string
  ) =>
    v8Post<{ success: boolean; entry: V8ExecutionBaselineRealizationEntry }>(
      '/execution-control/realizations/baseline',
      payload,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),

  // ── Manager Lane Analysis (6-Lane Cockpit) ──────────────────────────────

  getControlTowerQueues: (projectId?: string) =>
    v8Get<{ queues: Record<string, unknown[]>; counts: Record<string, number> }>(
      '/execution-control/control-tower/queues',
      projectId ? { projectId } : undefined
    ),

  getControlTowerItemDetail: (entityType: string, entityId: string, projectId?: string) =>
    v8Get<{ why: string[]; whatNext: string[]; affectsNext: string[] }>(
      `/execution-control/control-tower/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/drill-down`,
      projectId ? { projectId } : undefined
    ),

  getLaneAnalysis: (laneId: string, projectId?: string) =>
    v8Get<V8LaneAnalysisResponse>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/analysis`,
      projectId ? { projectId } : undefined
    ),

  getManagerProblems: (laneId: string, projectId?: string) =>
    v8Get<{ problems: V8ManagerProblemRow[]; count: number }>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/problems`,
      projectId ? { projectId } : undefined
    ),

  executeManagerProblemAction: (
    laneId: string,
    payload: { problemId: string; actionId: string },
    projectId?: string
  ) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return v8Post<V8ManagerActionExecutionResult>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/problem-actions/execute${qs}`,
      payload
    );
  },

  applyManagerSuggestion: (
    laneId: string,
    payload: { suggestionId: string },
    projectId?: string
  ) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return v8Post<V8ManagerActionExecutionResult>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/suggestions/apply${qs}`,
      payload
    );
  },

  submitLaneDecision: (
    laneId: string,
    payload: { suggestionId: string; state: string; notes?: string }
  ) =>
    v8Post<{ success: boolean; decisionId: string }>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/decisions`,
      payload
    ),

  executeLanePlan: (laneId: string, payload: { decisionId: string }) =>
    v8Post<{ success: boolean; planId: string }>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/execute`,
      payload
    ),

  getLaneVerification: (laneId: string, projectId?: string) =>
    v8Get<{ plans: V8LaneExecutionPlan[] }>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/verification`,
      projectId ? { projectId } : undefined
    ),

  interveneReassign: (payload: {
    entityType: string;
    entityId: string;
    newOwnerId: string;
    reason?: string;
  }) => v8Post<{ success: boolean }>('/execution-control/interventions/reassign', payload),

  interveneSmooth: (payload: { entityId: string; strategy: string }) =>
    v8Post<{ success: boolean }>('/execution-control/interventions/smooth', payload),

  interveneReplan: (payload: { entityId: string; newDeadline: string; reason: string }) =>
    v8Post<{ success: boolean }>('/execution-control/interventions/replan', payload),

  interveneEscalate: (payload: { entityId: string; severity: string; message: string }) =>
    v8Post<{ success: boolean }>('/execution-control/interventions/escalate', payload),

  // AI Manager endpoints
  getAiRecommendation: (laneId: string, problemId: string, projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return v8Post<V8AiRecommendation>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/ai/recommend${qs}`,
      { problemId }
    );
  },

  getAiTriage: (laneId: string, projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return v8Post<V8AiTriageResult>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/ai/triage${qs}`,
      {}
    );
  },

  getAiManageAll: (laneId: string, projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return v8Post<V8AiManageAllResult>(
      `/execution-control/manager/lanes/${encodeURIComponent(laneId)}/ai/manage-all${qs}`,
      {}
    );
  },
};
