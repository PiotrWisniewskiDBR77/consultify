/**
 * Closed-Loop Workaround Service (V4-EXEC-05)
 *
 * Manages the lifecycle of closed-loop workarounds:
 * signal → RAID → mitigation plan → task → verify → close
 */

export interface WorkaroundStep {
  id: string;
  type:
    | 'signal_detected'
    | 'raid_created'
    | 'mitigation_planned'
    | 'task_created'
    | 'task_completed'
    | 'verified'
    | 'closed';
  status: 'pending' | 'done' | 'skipped';
  entityType?: string;
  entityId?: string;
  completedAt?: string;
  completedBy?: string;
}

export interface ClosedLoopWorkaround {
  id: string;
  signalId: string;
  signalType: string;
  raidItemId?: string;
  initiativeId: string;
  organizationId: string;
  status: 'open' | 'in_progress' | 'pending_verification' | 'closed';
  steps: WorkaroundStep[];
  createdAt: string;
  closedAt?: string;
}

export function buildWorkaroundFromSignal(signal: {
  id: string;
  signalType: string;
  initiativeId: string;
}): Partial<ClosedLoopWorkaround> {
  return {
    signalId: signal.id,
    signalType: signal.signalType,
    initiativeId: signal.initiativeId,
    status: 'open',
    steps: [
      { id: 'detect', type: 'signal_detected', status: 'done', completedAt: new Date().toISOString() },
      { id: 'raid', type: 'raid_created', status: 'pending' },
      { id: 'mitigate', type: 'mitigation_planned', status: 'pending' },
      { id: 'task', type: 'task_created', status: 'pending' },
      { id: 'complete', type: 'task_completed', status: 'pending' },
      { id: 'verify', type: 'verified', status: 'pending' },
      { id: 'close', type: 'closed', status: 'pending' },
    ],
  };
}

export function advanceWorkaround(
  workaround: ClosedLoopWorkaround,
  stepId: string,
  entityType?: string,
  entityId?: string,
  userId?: string,
): ClosedLoopWorkaround {
  const step = workaround.steps.find((s) => s.id === stepId);
  if (step && step.status === 'pending') {
    step.status = 'done';
    step.completedAt = new Date().toISOString();
    step.completedBy = userId;
    if (entityType) step.entityType = entityType;
    if (entityId) step.entityId = entityId;
  }

  const allDone = workaround.steps.every((s) => s.status === 'done' || s.status === 'skipped');
  if (allDone) {
    workaround.status = 'closed';
    workaround.closedAt = new Date().toISOString();
  } else {
    const lastDone = [...workaround.steps].reverse().find((s) => s.status === 'done');
    if (lastDone?.type === 'verified') {
      workaround.status = 'pending_verification';
    } else if (lastDone?.type !== 'signal_detected') {
      workaround.status = 'in_progress';
    }
  }

  return workaround;
}
