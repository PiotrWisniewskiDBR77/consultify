import { z } from 'zod';

export const ReasoningFastChatRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  now: z.string().trim().min(1).optional(),
});

export type ReasoningFastChatRequest = z.infer<typeof ReasoningFastChatRequestSchema>;

export interface ReasoningFastChatResponse {
  readonly runId: string;
  readonly answer: string;
  readonly now: string;
}

