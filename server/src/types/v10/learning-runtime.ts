import { z } from 'zod';

export const LearningIngestRequestSchema = z.object({
  signal: z.string().trim().min(1),
  now: z.string().trim().min(1).optional(),
});

export type LearningIngestRequest = z.infer<typeof LearningIngestRequestSchema>;

export interface LearningIngestResponse {
  readonly ingestionId: string;
  readonly now: string;
  readonly accepted: true;
}

