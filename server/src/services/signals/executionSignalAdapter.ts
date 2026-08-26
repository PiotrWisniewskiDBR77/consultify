import type { ExecutionSignalType, SourceObjectType } from '../../types/executionVisibility.js';
import type { RuleHit, SignalRule } from '../../types/workSignals.js';
import { emitSignal } from '../v8/executionVisibilityService.js';

const EXECUTION_SIGNAL_TYPE_BY_RULE: Readonly<Record<string, ExecutionSignalType>> = {
  'exec.task.overdue': 'overdue_tasks_count',
  'exec.task.blocked_stale': 'blocked_tasks_count',
  'exec.task.due_soon_not_started': 'milestones_at_risk_count',
  'exec.initiative.no_baseline': 'missing_baseline_count',
};

const LEGACY_SOURCE_TYPES = new Set<SourceObjectType>([
  'task',
  'decision',
  'initiative',
  'project',
  'program',
]);

export async function adaptNewExecutionSignal(params: {
  organizationId: string;
  canonicalSignalId: string;
  rule: SignalRule;
  hit: RuleHit;
}): Promise<boolean> {
  if (params.rule.domain !== 'EXECUTION') return false;
  const signalType = EXECUTION_SIGNAL_TYPE_BY_RULE[params.rule.ruleId];
  if (!signalType || !LEGACY_SOURCE_TYPES.has(params.rule.subjectType as SourceObjectType)) {
    return false;
  }

  await emitSignal({
    signalType,
    sourceObjectType: params.rule.subjectType as SourceObjectType,
    sourceObjectId: params.hit.subjectId,
    organizationId: params.organizationId,
    severity:
      typeof params.rule.severity === 'function'
        ? params.rule.severity(params.hit)
        : params.rule.severity,
    payload: {
      canonicalSignalId: params.canonicalSignalId,
      canonicalSignalType: params.rule.signalType,
      ruleId: params.rule.ruleId,
      observedValue: params.hit.observedValue,
    },
  });
  return true;
}
