/**
 * Initiative Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for initiative-related API endpoints
 */

import { z } from 'zod';

import { INITIATIVE_STATUSES } from '../services/statusMachine.js';

// ==========================================
// ENUMS
// ==========================================

// FLOW-INITIATIVE-001: Central status machine
const INITIATIVE_STATUSES_LIST = Object.values(INITIATIVE_STATUSES) as readonly string[];

export const InitiativeStatusEnum = z
  .string()
  .transform((value) => value.toUpperCase())
  .refine((value) => INITIATIVE_STATUSES_LIST.includes(value), {
    message: 'Invalid initiative status',
  });
export const InitiativeAxisEnum = z.enum([
  'strategic',
  'operational',
  'transformational',
  'compliance',
]);
export const ConfidenceLevelEnum = z.enum(['low', 'medium', 'high', 'very_high']);
export const InitiativePriorityEnum = z
  .enum(['critical', 'high', 'medium', 'low'])
  .transform((v) => v.toLowerCase());

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateInitiativeSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(255),
  axis: InitiativeAxisEnum.optional(),
  area: z.string().max(255).optional(),
  summary: z.string().max(5000).optional(),
  /**
   * UI alias: InitiativeDocumentView uses `description` for the long-form narrative.
   * Backend historically stored this as `hypothesis`.
   */
  description: z.string().max(20000).optional(),
  hypothesis: z.string().max(2000).optional(),
  status: InitiativeStatusEnum.optional().default('DRAFT'),
  priority: InitiativePriorityEnum.optional(),
  businessValue: z.number().optional(),
  costCapex: z.number().optional(),
  costOpex: z.number().optional(),
  expectedRoi: z.number().optional(),
  valueDriver: z.string().max(255).optional(),
  confidenceLevel: ConfidenceLevelEnum.optional(),
  valueTiming: z.string().max(255).optional(),
  plannedStartDate: z.string().datetime().optional().nullable(),
  plannedEndDate: z.string().datetime().optional().nullable(),
  /** UI alias: InitiativeDocumentView uses `ownerId` (single owner). */
  ownerId: z.string().optional().nullable(),
  ownerBusinessId: z.string().optional().nullable(),
  ownerExecutionId: z.string().optional().nullable(),
  /** UI alias: InitiativeDocumentView uses `sponsorId`. */
  sponsorId: z.string().optional().nullable(),
  marketContext: z.string().max(5000).optional(),
  problemStatement: z.string().max(5000).optional(),
  deliverables: z.array(z.string()).optional(),
  successCriteria: z.array(z.string()).optional(),
  scopeIn: z.array(z.string()).optional(),
  scopeOut: z.array(z.string()).optional(),
  killCriteria: z.array(z.string()).optional(),
  keyRisks: z.array(z.string()).optional(),
  // SaaS persistence helpers used by the N-mode UI
  estimatedBudget: z.number().optional().nullable(),
  resourceTools: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  targetState: z
    .object({
      description: z.string().max(20000).optional(),
    })
    .optional(),
});

export const UpdateInitiativeSchema = CreateInitiativeSchema.partial().omit({ projectId: true });

export const UpdateInitiativeStatusSchema = z.object({
  status: InitiativeStatusEnum,
  reason: z.string().max(500).optional(),
});

export const TransferToRoadmapSchema = z.object({
  targetProjectId: z.string().optional(),
});

export const QuickUpdateInitiativeSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  status: InitiativeStatusEnum.optional(),
  notes: z.string().max(1000).optional(),
  plannedStartDate: z.string().datetime().optional().nullable(),
  plannedEndDate: z.string().datetime().optional().nullable(),
  ownerBusinessId: z.string().optional().nullable(),
  ownerExecutionId: z.string().optional().nullable(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
});

export const UpdateInitiativeTemplateSchema = z.object({
  templateId: z.string().min(1).nullable(),
});

export const BulkStatusUpdateSchema = z.object({
  initiativeIds: z.array(z.string()),
  status: InitiativeStatusEnum,
  reason: z.string().max(500).optional(),
});

export const ReorderInitiativesSchema = z.object({
  initiativeIds: z.array(z.string()),
});

export const CreateKPISchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  targetValue: z.number().optional(),
  unit: z.string().max(50).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
});

export const UpdateKPISchema = CreateKPISchema.partial();

export const CreateKPIMeasurementSchema = z.object({
  value: z.number(),
  measuredAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetInitiativesQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: InitiativeStatusEnum.optional(),
  axis: InitiativeAxisEnum.optional(),
  search: z.string().optional(),
});

// ==========================================
// TYPES
// ==========================================

export type CreateInitiativeRequest = z.infer<typeof CreateInitiativeSchema>;
export type UpdateInitiativeRequest = z.infer<typeof UpdateInitiativeSchema>;
export type UpdateInitiativeStatusRequest = z.infer<typeof UpdateInitiativeStatusSchema>;
export type TransferToRoadmapRequest = z.infer<typeof TransferToRoadmapSchema>;
export type QuickUpdateInitiativeRequest = z.infer<typeof QuickUpdateInitiativeSchema>;
export type UpdateInitiativeTemplateRequest = z.infer<typeof UpdateInitiativeTemplateSchema>;
export type BulkStatusUpdateRequest = z.infer<typeof BulkStatusUpdateSchema>;
export type ReorderInitiativesRequest = z.infer<typeof ReorderInitiativesSchema>;
export type CreateKPIRequest = z.infer<typeof CreateKPISchema>;
export type UpdateKPIRequest = z.infer<typeof UpdateKPISchema>;
export type CreateKPIMeasurementRequest = z.infer<typeof CreateKPIMeasurementSchema>;
export type GetInitiativesQuery = z.infer<typeof GetInitiativesQuerySchema>;
