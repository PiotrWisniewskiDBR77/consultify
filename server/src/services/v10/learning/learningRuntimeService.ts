import {
  runLearningFeedbackPipeline,
  unsafeLearningFeedbackPipelineRunId,
} from '../../../models/v10/pipelines/LearningFeedbackPipeline.js';
import type {
  LearningIngestRequest,
  LearningIngestResponse,
} from '../../../types/v10/learning-runtime.js';

export class LearningRuntimeService {
  ingest(input: LearningIngestRequest): LearningIngestResponse {
    const now = input.now?.trim() || new Date().toISOString();
    const pipeline = runLearningFeedbackPipeline({
      ingestionId: unsafeLearningFeedbackPipelineRunId(crypto.randomUUID()),
      signal: input.signal,
      now,
    });
    return { ingestionId: String(pipeline.ingestionId), now: pipeline.now, accepted: true };
  }
}

export const learningRuntimeService = new LearningRuntimeService();
