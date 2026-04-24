export type LearningFeedbackPipelineRunId = string & {
  readonly __brand: 'LearningFeedbackPipelineRunId';
};

export function unsafeLearningFeedbackPipelineRunId(value: string): LearningFeedbackPipelineRunId {
  return String(value) as LearningFeedbackPipelineRunId;
}

export type LearningFeedbackPipelineOutput = {
  readonly ingestionId: LearningFeedbackPipelineRunId;
  readonly now: string;
  readonly accepted: true;
};

export function runLearningFeedbackPipeline(input: {
  readonly ingestionId: LearningFeedbackPipelineRunId;
  readonly signal: string;
  readonly now: string;
}): LearningFeedbackPipelineOutput {
  void input.signal;
  return { ingestionId: input.ingestionId, now: input.now, accepted: true };
}
