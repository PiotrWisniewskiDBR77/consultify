import type { SignalRule } from '../../../types/workSignals.js';
import { decisionBlockingDependentsRule } from './decision/blockingDependents.js';
import { decisionPendingStaleRule } from './decision/pendingStale.js';
import { initiativeNoBaselineRule } from './execution/initiativeNoBaseline.js';
import { taskBlockedStaleRule } from './execution/taskBlockedStale.js';
import { taskDueSoonNotStartedRule } from './execution/taskDueSoonNotStarted.js';
import { taskOverdueRule } from './execution/taskOverdue.js';
import { budgetOverspendRule } from './finance/budgetOverspend.js';
import { kpiThresholdBreachedRule } from './results/kpiThresholdBreached.js';

export const deterministicSignalRules: readonly SignalRule[] = [
  taskOverdueRule,
  taskDueSoonNotStartedRule,
  taskBlockedStaleRule,
  initiativeNoBaselineRule,
  decisionPendingStaleRule,
  decisionBlockingDependentsRule,
  kpiThresholdBreachedRule,
  budgetOverspendRule,
];
