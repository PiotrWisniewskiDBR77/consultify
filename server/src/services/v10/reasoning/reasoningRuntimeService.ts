import {
  runReasoningFastChatPipeline,
  unsafeReasoningFastChatPipelineRunId,
} from '../../../models/v10/pipelines/ReasoningFastChatPipeline.js';
import type {
  ReasoningFastChatRequest,
  ReasoningFastChatResponse,
} from '../../../types/v10/reasoning-runtime.js';

export class ReasoningRuntimeService {
  fastChat(input: ReasoningFastChatRequest): ReasoningFastChatResponse {
    const now = input.now?.trim() || new Date().toISOString();
    const pipeline = runReasoningFastChatPipeline({
      runId: unsafeReasoningFastChatPipelineRunId(crypto.randomUUID()),
      prompt: input.prompt,
      now,
    });
    return { runId: String(pipeline.runId), now: pipeline.now, answer: pipeline.answer };
  }
}

export const reasoningRuntimeService = new ReasoningRuntimeService();
