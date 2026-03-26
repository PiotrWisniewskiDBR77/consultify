import { v8Get, v8Post } from './client';

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

export const V8ExecutionControlApi = {
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
  }) => v8Post<{ success: boolean; signalId: string }>('/execution-control/delay-signals/dismiss', payload),

  updateTimeline: (payload: V8ExecutionTimelineUpdatePayload) =>
    v8Post<{
      success: boolean;
      field: string;
      oldValue: string | null;
      newValue: string;
    }>('/execution-control/timeline-update', payload),

  createBudgetEntry: (payload: V8ExecutionBudgetEntryPayload) =>
    v8Post<{ success: boolean; id: string }>('/execution-control/budget/entries', payload),
};
