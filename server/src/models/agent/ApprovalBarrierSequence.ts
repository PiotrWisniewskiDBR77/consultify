import type { TenantId } from './ExecutionProposalV1.js';

export type ApprovalBarrier = {
  readonly id: string;
  readonly stepOrdinal: number;
  readonly reason: string;
};

export type ApprovalBarrierSequence = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly stepCount: number;
  readonly barriers: readonly ApprovalBarrier[];
};

export type BarrierPauseState = {
  readonly sequenceId: string;
  readonly barrierId: string;
  readonly stepOrdinal: number;
  readonly emittedAt: string;
};

export type BarrierResumeResult =
  | { readonly outcome: 'resumed'; readonly resumedAt: string; readonly pause: BarrierPauseState }
  | { readonly outcome: 'cancelled'; readonly resumedAt: string; readonly pause: BarrierPauseState };

export function simulateBarrierSequence(
  sequence: ApprovalBarrierSequence,
  input: { readonly untilStepOrdinal?: number; readonly emittedAt: string }
): { readonly outcome: 'completed'; readonly completedSteps: number } | { readonly outcome: 'paused'; readonly pause: BarrierPauseState } {
  const until = input.untilStepOrdinal ?? sequence.stepCount - 1;
  const nextBarrier = [...sequence.barriers].sort((a, b) => a.stepOrdinal - b.stepOrdinal).find((b) => b.stepOrdinal <= until);
  if (!nextBarrier) {
    return { outcome: 'completed', completedSteps: Math.min(sequence.stepCount, until + 1) };
  }
  return {
    outcome: 'paused',
    pause: {
      sequenceId: sequence.id,
      barrierId: nextBarrier.id,
      stepOrdinal: nextBarrier.stepOrdinal,
      emittedAt: input.emittedAt,
    },
  };
}

export function assertBarrierEventEmitted(
  simulation: ReturnType<typeof simulateBarrierSequence>
): void {
  if (simulation.outcome === 'paused') {
    if (!simulation.pause?.barrierId) {
      throw new Error('Barrier pause missing barrierId');
    }
  }
}

export function resumeAfterBarrier(
  pause: BarrierPauseState,
  decision: 'approved' | 'rejected',
  resumedAt: string
): BarrierResumeResult {
  return decision === 'approved'
    ? { outcome: 'resumed', resumedAt, pause }
    : { outcome: 'cancelled', resumedAt, pause };
}

export function assertResumePoint(pause: BarrierPauseState, resume: BarrierResumeResult): void {
  if (String(resume.pause.sequenceId) !== String(pause.sequenceId)) {
    throw new Error('Resume pause mismatch');
  }
}

