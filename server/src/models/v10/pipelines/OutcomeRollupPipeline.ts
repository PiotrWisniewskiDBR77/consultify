export type OutcomeRollupPipelineRunId = string & {
  readonly __brand: 'OutcomeRollupPipelineRunId';
};

export function unsafeOutcomeRollupPipelineRunId(value: string): OutcomeRollupPipelineRunId {
  return String(value) as OutcomeRollupPipelineRunId;
}

export type OutcomeRollupPipelineOutput = {
  readonly outcomeId: OutcomeRollupPipelineRunId;
  readonly now: string;
  readonly status: 'resolved';
};

export function runOutcomeRollupPipeline(input: {
  readonly outcomeId: OutcomeRollupPipelineRunId;
  readonly kind: string;
  readonly payload: unknown;
  readonly now: string;
}): OutcomeRollupPipelineOutput {
  void input;
  return { outcomeId: input.outcomeId, now: input.now, status: 'resolved' };
}
