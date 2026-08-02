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

const DateOnlyOrDateTimeString = z
  .string()
  .transform((v) => String(v ?? '').trim())
  .refine(
    (v) => {
      if (!v) return true;
      // Accept HTML date input values (YYYY-MM-DD) and full ISO date-times.
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
      return z.string().datetime().safeParse(v).success;
    },
    { message: 'Invalid date format (expected YYYY-MM-DD or ISO datetime)' }
  );

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const SourceTypeEnum = z
  .enum(['manual', 'tool', 'assessment', 'assessment_report', 'financial_analysis', 'audit'])
  .or(z.string().max(50));

const InitiativePayloadBaseSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(255),
  category: z.string().max(255).optional(),
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
  impact: z.string().max(50).optional(),
  effort: z.string().max(50).optional(),
  businessValue: z.number().optional(),
  costCapex: z.number().optional(),
  costOpex: z.number().optional(),
  expectedRoi: z.number().optional(),
  valueDriver: z.string().max(255).optional(),
  confidenceLevel: ConfidenceLevelEnum.optional(),
  valueTiming: z.string().max(255).optional(),
  plannedStartDate: DateOnlyOrDateTimeString.optional().nullable(),
  plannedEndDate: DateOnlyOrDateTimeString.optional().nullable(),
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
  // V3-A01: Traceability — every output must have a canonical source
  sourceType: SourceTypeEnum.optional().default('manual'),
  sourceId: z.string().max(255).optional().nullable(),
  sourcePack: z.record(z.string(), z.unknown()).optional(),
  actionContract: z.record(z.string(), z.unknown()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  reportName: z.string().max(500).optional(),
  // V4-INIT-02: Program hierarchy
  programId: z.string().max(255).optional().nullable(),
});

export const CreateInitiativeSchema = InitiativePayloadBaseSchema.refine(
  (data) => {
    const st = (data.sourceType || 'manual').toLowerCase();
    if (st !== 'manual' && !data.sourceId) return false;
    return true;
  },
  { message: 'sourceId is required when sourceType is not manual', path: ['sourceId'] }
);

export const UpdateInitiativeSchema = InitiativePayloadBaseSchema.omit({
  projectId: true,
})
  .partial()
  .extend({
    // Mark Complete (AI signal) — map of sectionId → completed. Persisted as a
    // JSON string in the lazy-ALTER'd `section_completions` TEXT column.
    sectionCompletions: z.record(z.string(), z.boolean()).optional(),
    // Canon sections persisted via dedicated lazy-ALTER'd columns. `hypothesisStatement`
    // is intentionally separate from the legacy `hypothesis` column (which stores the
    // Initiative Scope narrative via the `description` alias).
    hypothesisStatement: z.string().max(5000).optional().nullable(),
    lessonsLearned: z.string().max(10000).optional().nullable(),
    changeLog: z
      .array(
        z.object({
          id: z.string(),
          date: z.string().optional(),
          user: z.string().optional(),
          change: z.string(),
          reason: z.string().optional(),
          impact: z.string().optional(),
        })
      )
      .optional(),
    okrs: z
      .array(
        z.object({
          id: z.string(),
          objective: z.string(),
          keyResults: z.array(z.string()).optional(),
          confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
        })
      )
      .optional(),
  });

export const UpdateInitiativeStatusSchema = z.object({
  status: InitiativeStatusEnum,
  reason: z.string().max(500).optional(),
  // M13 Depth AI-gate soft-block override. The controller reads
  // `req.body.overrideReason`, but validateBody replaces req.body with the
  // parsed (stripped) object — without this field the override silently never
  // arrives and a below-threshold initiative can NEVER leave the gate (422 loop).
  overrideReason: z.string().max(1000).optional(),
});

export const TransferToRoadmapSchema = z.object({
  targetProjectId: z.string().optional(),
});

export const QuickUpdateInitiativeSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  status: InitiativeStatusEnum.optional(),
  notes: z.string().max(1000).optional(),
  plannedStartDate: DateOnlyOrDateTimeString.optional().nullable(),
  plannedEndDate: DateOnlyOrDateTimeString.optional().nullable(),
  ownerBusinessId: z.string().optional().nullable(),
  ownerExecutionId: z.string().optional().nullable(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  // EXE-006: retry-safe progress updates. validateBody() replaces req.body with
  // this schema's parsed output — a field the controller reads from req.body
  // but that isn't declared here is silently stripped before it arrives (found
  // via the real-Postgres idempotency test in
  // tests/integration/execution-change-progress-spine.golden-flow.realdb.test.ts,
  // same class of bug as CreateTaskSchema in the prior EXE-002-004 task).
  idempotencyKey: z.string().max(255).optional().nullable(),
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
