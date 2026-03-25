import { v8Get } from './client';

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

export const V8ExecutionControlApi = {
  getRiskSignals: (projectId?: string) =>
    v8Get<{ signals: V8ExecutionRiskSignal[]; count: number }>(
      '/execution-control/risk-signals',
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
};
