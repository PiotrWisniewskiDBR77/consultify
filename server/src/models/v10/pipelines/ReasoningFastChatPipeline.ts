export type ReasoningFastChatPipelineRunId = string & { readonly __brand: 'ReasoningFastChatPipelineRunId' };

export function unsafeReasoningFastChatPipelineRunId(value: string): ReasoningFastChatPipelineRunId {
  return String(value) as ReasoningFastChatPipelineRunId;
}

export type ReasoningFastChatPipelineOutput = {
  readonly runId: ReasoningFastChatPipelineRunId;
  readonly answer: string;
  readonly now: string;
};

export function runReasoningFastChatPipeline(input: {
  readonly runId: ReasoningFastChatPipelineRunId;
  readonly prompt: string;
  readonly now: string;
}): ReasoningFastChatPipelineOutput {
  return {
    runId: input.runId,
    now: input.now,
    answer: `ReasoningFastChatPipeline(MVP): ${input.prompt}`,
  };
}

