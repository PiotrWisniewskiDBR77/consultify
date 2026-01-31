/**
 * Assessment Validators
 * Zod schemas for assessment workflow endpoints
 */

import { z } from 'zod';

export const AssessmentTypeSchema = z.enum(['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN']);

export const CreateAssessmentSchema = z.object({
  assessmentType: AssessmentTypeSchema,
  name: z.string().min(1).max(200),
  projectId: z.string().optional().nullable(),
});

export const UpdateAssessmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  completionPercent: z.number().min(0).max(100).optional(),
  confidenceAvg: z.number().min(1).max(5).optional(),
  contextSnapshot: z.record(z.string(), z.unknown()).optional(),
  scoreSummary: z.record(z.string(), z.unknown()).optional(),
  currentSectionId: z.string().optional().nullable(),
  navigation: z
    .object({
      axisId: z.number().int().positive(),
      areaId: z.string().min(1),
      level: z.number().int().min(1),
    })
    .optional(),
});

export const UpdateUserStateSchema = z.object({
  navigation: z
    .object({
      axisId: z.number().int().positive(),
      areaId: z.string().min(1),
      level: z.number().int().min(1),
    })
    .optional(),
});

export const UpsertAssignmentSchema = z.object({
  areaId: z.string().min(1),
  assignedUserId: z.string().min(1),
  dueAt: z.string().optional().nullable(),
  status: z.string().optional(),
});

export const AssessmentDecisionSchema = z.object({
  decisionOwnerId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export const RequestReviewSchema = AssessmentDecisionSchema;

export const ApproveReportSchema = AssessmentDecisionSchema.extend({
  comment: z.string().optional(),
});

export const ApproveAssessmentSchema = AssessmentDecisionSchema;

export const SendBackSchema = z.object({
  comment: z.string().min(2, 'Comment must be at least 2 characters'),
});

export const GenerateInitiativesSchema = AssessmentDecisionSchema.extend({
  methodologyId: z.string().min(1),
  count: z.number().min(1).max(7, 'Maximum 7 initiatives per batch'),
  includeChatContext: z.boolean().optional(),
});

export const GenerateReportSchema = z.object({
  // Report generation might have additional options in the future
  includeRecommendations: z.boolean().optional(),
  includeGapAnalysis: z.boolean().optional(),
});

// List query params
export const ListAssessmentsQuerySchema = z.object({
  projectId: z.string().optional(),
  status: z
    .enum(['DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'])
    .optional(),
  assessmentType: AssessmentTypeSchema.optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// Type exports
export type CreateAssessmentRequest = z.infer<typeof CreateAssessmentSchema>;
export type UpdateAssessmentRequest = z.infer<typeof UpdateAssessmentSchema>;
export type UpdateUserStateRequest = z.infer<typeof UpdateUserStateSchema>;
export type UpsertAssignmentRequest = z.infer<typeof UpsertAssignmentSchema>;
export type RequestReviewRequest = z.infer<typeof RequestReviewSchema>;
export type ApproveReportRequest = z.infer<typeof ApproveReportSchema>;
export type ApproveAssessmentRequest = z.infer<typeof ApproveAssessmentSchema>;
export type SendBackRequest = z.infer<typeof SendBackSchema>;
export type GenerateInitiativesRequest = z.infer<typeof GenerateInitiativesSchema>;
export type GenerateReportRequest = z.infer<typeof GenerateReportSchema>;
