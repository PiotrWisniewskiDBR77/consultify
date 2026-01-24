/**
 * Tool Validators
 * Zod schemas for tool workflow endpoints
 */

import { z } from 'zod';

export const CreateToolSessionSchema = z.object({
  toolType: z.string().min(1),
  name: z.string().min(1),
  projectId: z.string().optional().nullable(),
});

export const UpdateToolSessionSchema = z.object({
  answers: z.record(z.string(), z.unknown()).optional(),
  completionPercent: z.number().min(0).max(100).optional(),
  confidenceAvg: z.number().min(1).max(5).optional(),
  contextSnapshot: z.record(z.string(), z.unknown()).optional(),
});

export const ToolDecisionSchema = z.object({
  decisionOwnerId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export const GenerateInitiativesSchema = ToolDecisionSchema.extend({
  methodologyId: z.string().min(1),
  count: z.number().min(1).max(7),
  includeChatContext: z.boolean().optional(),
});

export const SendBackSchema = z.object({
  comment: z.string().min(2),
});

export const RequestReviewSchema = ToolDecisionSchema;
export const ApproveToolSchema = ToolDecisionSchema;

export type CreateToolSessionRequest = z.infer<typeof CreateToolSessionSchema>;
export type UpdateToolSessionRequest = z.infer<typeof UpdateToolSessionSchema>;
export type GenerateInitiativesRequest = z.infer<typeof GenerateInitiativesSchema>;
export type SendBackRequest = z.infer<typeof SendBackSchema>;
export type RequestReviewRequest = z.infer<typeof RequestReviewSchema>;
export type ApproveToolRequest = z.infer<typeof ApproveToolSchema>;
