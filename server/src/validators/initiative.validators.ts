/**
 * Initiative Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for initiative-related API endpoints
 */

import { z } from 'zod';

// ==========================================
// ENUMS
// ==========================================

// FLOW-INITIATIVE-001: Extended status machine
export const InitiativeStatusEnum = z.enum([
  'draft', // Generated from assessment, being edited
  'planning', // Details being worked on, completion checker
  'review', // Submitted for approval review
  'approved', // Approved, appears on timeline/roadmap
  'executing', // In execution phase (Kanban)
  'blocked', // Blocked (red flag)
  'done', // Completed, goes to Benefits tracking
  'on_hold', // Paused temporarily
  'cancelled', // Cancelled
  'archived', // In archive only
]);
export const InitiativeAxisEnum = z.enum([
  'strategic',
  'operational',
  'transformational',
  'compliance',
]);
export const ConfidenceLevelEnum = z.enum(['low', 'medium', 'high', 'very_high']);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateInitiativeSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(255),
  axis: InitiativeAxisEnum.optional(),
  area: z.string().max(255).optional(),
  summary: z.string().max(5000).optional(),
  hypothesis: z.string().max(2000).optional(),
  status: InitiativeStatusEnum.optional().default('draft'),
  businessValue: z.number().optional(),
  costCapex: z.number().optional(),
  costOpex: z.number().optional(),
  expectedRoi: z.number().optional(),
  valueDriver: z.string().max(255).optional(),
  confidenceLevel: ConfidenceLevelEnum.optional(),
  valueTiming: z.string().max(255).optional(),
  plannedStartDate: z.string().datetime().optional().nullable(),
  plannedEndDate: z.string().datetime().optional().nullable(),
  ownerBusinessId: z.string().optional().nullable(),
  ownerExecutionId: z.string().optional().nullable(),
  problemStatement: z.string().max(5000).optional(),
  deliverables: z.array(z.string()).optional(),
  successCriteria: z.array(z.string()).optional(),
  scopeIn: z.array(z.string()).optional(),
  scopeOut: z.array(z.string()).optional(),
  keyRisks: z.array(z.string()).optional(),
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
export type BulkStatusUpdateRequest = z.infer<typeof BulkStatusUpdateSchema>;
export type ReorderInitiativesRequest = z.infer<typeof ReorderInitiativesSchema>;
export type CreateKPIRequest = z.infer<typeof CreateKPISchema>;
export type UpdateKPIRequest = z.infer<typeof UpdateKPISchema>;
export type CreateKPIMeasurementRequest = z.infer<typeof CreateKPIMeasurementSchema>;
export type GetInitiativesQuery = z.infer<typeof GetInitiativesQuerySchema>;
