/**
 * Assessment Validators
 * Zod schemas for assessment workflow endpoints
 */

import { z } from 'zod';

export const AssessmentTypeSchema = z.enum(['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN']);

/**
 * Odbiór 05.09 (05-ocena, `assessment-list`): kolumna JEDNOSTKA z zatwierdzonego
 * obrazu („Logistics BU", „Grupa — Zarząd", „Sales BU"). `validateBody` podmienia
 * `req.body` na WYNIK parsowania, a `z.object` domyślnie WYCINA nieznane klucze —
 * bez tego pola `businessUnit` wysłane przez klienta ginęłoby po cichu, zanim
 * kontroler zdążyłby je zobaczyć. Kolumna: `assessments.business_unit`
 * (server/migrations/20260905_assessment_business_unit.sql).
 */
const BusinessUnitSchema = z.string().max(200).optional().nullable();

export const CreateAssessmentSchema = z.object({
  assessmentType: AssessmentTypeSchema,
  name: z.string().min(1).max(200),
  projectId: z.string().optional().nullable(),
  businessUnit: BusinessUnitSchema,
});

export const UpdateAssessmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  businessUnit: BusinessUnitSchema,
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
  /**
   * Optional report context for initiative generation.
   * When provided, initiatives should be generated using BOTH:
   * - detailed assessment answers (assessment)
   * - report narrative/synthesis (report)
   */
  reportId: z.string().min(1).optional(),
});

/**
 * Enterprise: create a generation run (supports 50+ initiatives via sub-batches).
 * The server orchestrates multiple batches (default batch size = 7) and exposes progress.
 */
export const CreateInitiativeGenerationRunSchema = AssessmentDecisionSchema.extend({
  mode: z.enum(['ASSESSMENT_REPORT', 'REPORT_ONLY']),
  methodologyId: z.string().min(1),
  requestedCount: z.number().min(1).max(200),
  batchSize: z.number().min(1).max(7).optional(),
  includeChatContext: z.boolean().optional(),
  reportId: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  consultantBrief: z.string().max(20000).optional(),
});

export const GenerateReportSchema = z.object({
  // Report generation might have additional options in the future
  includeRecommendations: z.boolean().optional(),
  includeGapAnalysis: z.boolean().optional(),
});

// =============================================================================
// MANAGE (RBAC / access requests) – v2
// =============================================================================

const AssessmentRoleSchema = z.enum(['admin', 'manager', 'editor', 'viewer']);

const ManagerPermissionOverridesSchema = z
  .object({
    canEdit: z.boolean().optional(),
    canApprove: z.boolean().optional(),
    canManageTeam: z.boolean().optional(),
    canChangeStatus: z.boolean().optional(),
    canGenerateReport: z.boolean().optional(),
    canGenerateInitiatives: z.boolean().optional(),
  })
  .optional();

export const UpsertAssessmentRoleSchema = z.object({
  role: AssessmentRoleSchema,
  permissions: ManagerPermissionOverridesSchema,
  assignedAreas: z.array(z.string().min(1)).optional().nullable(),
});

export const AssignAssessmentRoleSchema = UpsertAssessmentRoleSchema.extend({
  userId: z.string().min(1),
});

export const ApproveAssessmentAccessRequestSchema = z.object({
  grantedRole: z.enum(['editor', 'manager']),
  grantedPermissions: z
    .object({
      canEdit: z.boolean().optional(),
      canApprove: z.boolean().optional(),
      canManageTeam: z.boolean().optional(),
      canChangeStatus: z.boolean().optional(),
      canGenerateReport: z.boolean().optional(),
      canGenerateInitiatives: z.boolean().optional(),
    })
    .optional(),
  grantedAreas: z.array(z.string().min(1)).optional().nullable(),
  notes: z.string().optional(),
});

export const RejectAssessmentAccessRequestSchema = z.object({
  reason: z.string().min(2, 'Reason must be at least 2 characters'),
});

export const CreateManualInitiativeFromAssessmentSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(20000).optional().nullable(),
  category: z.string().max(200).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
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
export type CreateInitiativeGenerationRunRequest = z.infer<
  typeof CreateInitiativeGenerationRunSchema
>;
export type GenerateReportRequest = z.infer<typeof GenerateReportSchema>;

export type UpsertAssessmentRoleRequest = z.infer<typeof UpsertAssessmentRoleSchema>;
export type AssignAssessmentRoleRequest = z.infer<typeof AssignAssessmentRoleSchema>;
export type ApproveAssessmentAccessRequestRequest = z.infer<
  typeof ApproveAssessmentAccessRequestSchema
>;
export type RejectAssessmentAccessRequestRequest = z.infer<
  typeof RejectAssessmentAccessRequestSchema
>;
export type CreateManualInitiativeFromAssessmentRequest = z.infer<
  typeof CreateManualInitiativeFromAssessmentSchema
>;
