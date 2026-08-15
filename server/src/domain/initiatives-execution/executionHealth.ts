export type ExecutionHealthStatus = 'HEALTHY' | 'AT_RISK' | 'BLOCKED' | 'UNKNOWN';

export interface ExecutionHealth {
  status: ExecutionHealthStatus;
  reasons: string[];
}

export function deriveExecutionHealth(value: Record<string, any>): ExecutionHealth {
  const reasons: string[] = [];
  const state = String(value.state || '').toUpperCase();
  const gaps = Array.isArray(value.gaps) ? value.gaps : [];
  const openGaps = gaps.filter((gap) => String(gap?.status || 'OPEN').toUpperCase() !== 'CLOSED');
  const blockedTasks = Number(value.rollup?.tasksBlocked || 0);
  if (['BLOCKED', 'PAUSED'].includes(state)) reasons.push(`CASE_${state}`);
  if (blockedTasks > 0) reasons.push('TASKS_BLOCKED');
  if (openGaps.length > 0) reasons.push('HANDOFF_GAPS_OPEN');
  if (reasons.length) return { status: 'BLOCKED', reasons };
  if (!state) return { status: 'UNKNOWN', reasons: ['CASE_STATE_MISSING'] };
  if (!value.handoffPackageId || !Number(value.handoffPackageVersion || 0))
    return { status: 'AT_RISK', reasons: ['BASELINE_MISSING'] };
  return { status: 'HEALTHY', reasons: [] };
}
