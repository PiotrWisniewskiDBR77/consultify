/**
 * Decision Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for decision-related API endpoints
 */

import { z } from 'zod';

// PMO Domain enum
// PMO Domain enum
export const PMODomain = {
  GOVERNANCE_DECISION_MAKING: 'GOVERNANCE_DECISION_MAKING',
  SCOPE_CHANGE_CONTROL: 'SCOPE_CHANGE_CONTROL',
  SCHEDULE_MILESTONES: 'SCHEDULE_MILESTONES',
  RISK_ISSUE_MANAGEMENT: 'RISK_ISSUE_MANAGEMENT',
  RESOURCE_RESPONSIBILITY: 'RESOURCE_RESPONSIBILITY',
  PERFORMANCE_MONITORING: 'PERFORMANCE_MONITORING',
  BENEFITS_REALIZATION: 'BENEFITS_REALIZATION',
} as const;

export type PMODomain = (typeof PMODomain)[keyof typeof PMODomain];

// ==========================================
// ENUMS
// ==========================================

export const DecisionStatusEnum = z.enum([
  'pending',
  'approved',
  'rejected',
  'escalated',
  'cancelled',
]);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateDecisionSchema = z.object({
  projectId: z.string().optional(),
  initiativeId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  pmoDomain: z.nativeEnum(PMODomain).optional(),
  decisionOwnerId: z.string().optional().nullable(),
  // Accept case-insensitively: the UI sends e.g. 'PROJECT' while the canonical
  // enum is lowercase. Normalize before validating to avoid spurious 400s (#10).
  relatedObjectType: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.toLowerCase() : v),
      z.enum(['task', 'initiative', 'project', 'gate', 'risk'])
    )
    .optional(),
  relatedObjectId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  impact: z.enum(['low', 'medium', 'high']).optional(),
  decisionType: z.string().optional(),
  type: z.string().optional(),
  // OKR-E006 (IO-6 additive cross-module seam, docs/product/results-vnext/
  // OKR_E006_DESIGN.md §10.2): optional origin-tracking pair — already-
  // existing, already-nullable, already-indexed columns on `decisions`
  // (server/migrations/20260311_origin_tracking.sql) that `createDecision`
  // never read or wrote before this change. Purely additive: omitting both
  // fields (every existing caller) leaves validation and behavior
  // byte-for-byte unchanged.
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  impacts: z
    .array(
      z.object({
        impactedType: z.enum(['task', 'initiative', 'project', 'gate']),
        impactedId: z.string().min(1),
        impactDescription: z.string().max(1000).optional(),
        isBlocker: z.boolean().optional(),
      })
    )
    .optional(),
});

export const DecideSchema = z
  .object({
    decision: z.enum(['approved', 'rejected', 'deferred']).optional(),
    // MW-DEC-001: RETURNED_FOR_CLARIFICATION added to the OUTCOME axis
    // (decisions.status) — see decisionOutcomeService.ts. PENDING/ESCALATED
    // kept for backward compatibility with existing callers; ESCALATED is
    // rejected downstream by decisionOutcomeService (escalation stays on its
    // own dedicated endpoint/axis, untouched by this schema).
    status: z
      .enum(['APPROVED', 'REJECTED', 'PENDING', 'ESCALATED', 'RETURNED_FOR_CLARIFICATION'])
      .optional(),
    rationale: z.string().min(1).max(2000).optional(),
    outcome: z.string().max(2000).optional(),
    notes: z.string().max(1000).optional(),
    // Optimistic-concurrency token (decisions.version). Optional for
    // backward compatibility; when present and stale, the server returns 409
    // instead of silently overwriting a concurrent change.
    version: z.number().int().nonnegative().optional(),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .refine((data) => data.decision || data.status, {
    message: 'Decision status required',
    path: ['decision'],
  });

// ==========================================
// COLLABORATION SCHEMAS (MW-DEC-001 — comments / alternatives / risks)
// ==========================================

export const CreateDecisionCommentSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const UpdateDecisionCommentSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const CreateDecisionAlternativeSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  benefits: z.string().max(5000).optional(),
  drawbacks: z.string().max(5000).optional(),
  costOrFeasibility: z.string().max(2000).optional(),
  isRecommended: z.boolean().optional(),
});

export const UpdateDecisionAlternativeSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  benefits: z.string().max(5000).optional().nullable(),
  drawbacks: z.string().max(5000).optional().nullable(),
  costOrFeasibility: z.string().max(2000).optional().nullable(),
  isRecommended: z.boolean().optional(),
});

export const DecisionRiskSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const DecisionRiskLikelihoodEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const CreateDecisionRiskSchema = z.object({
  description: z.string().min(1).max(2000),
  severity: DecisionRiskSeverityEnum.optional(),
  likelihood: DecisionRiskLikelihoodEnum.optional(),
  mitigation: z.string().max(2000).optional(),
  ownerId: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  contingency: z.string().max(2000).optional().nullable(),
});

export const UpdateDecisionRiskSchema = z.object({
  description: z.string().min(1).max(2000).optional(),
  severity: DecisionRiskSeverityEnum.optional(),
  likelihood: DecisionRiskLikelihoodEnum.optional(),
  mitigation: z.string().max(2000).optional().nullable(),
  ownerId: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  contingency: z.string().max(2000).optional().nullable(),
});

export const DecisionStakeholderRoleEnum = z.enum([
  'responsible',
  'accountable',
  'consulted',
  'informed',
]);

export const ReplaceDecisionStakeholdersSchema = z.object({
  stakeholders: z.array(
    z.object({
      userId: z.string().min(1),
      role: DecisionStakeholderRoleEnum,
    })
  ),
});

export const EscalateDecisionSchema = z.object({
  reason: z.string().max(500).optional(),
  escalateToUserId: z.string().optional(),
});

export const UpdateDecisionSchema = z.object({
  decisionOwnerId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  impact: z.enum(['low', 'medium', 'high']).optional(),
  status: z.string().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  delegationNote: z.string().max(500).optional(),
  // MW-DEC-001 fix (2026-08-30): DecisionDetailView.tsx's `publishPayload`
  // has always sent `rationale` here (draft-time autosave, before a formal
  // decide()), but this schema never declared it — the sanitizing
  // validation middleware (validation.middleware.ts) silently stripped it
  // before updateDecision ever saw it, so a typed-in rationale never
  // actually saved until the decision was finalized via PUT
  // /:id/decide (DecideSchema, which already accepted it). Declared here so
  // the draft path is honest too; `updateDecision` below persists it to
  // `decisions.decision_rationale` — the same column decide() writes.
  rationale: z.string().max(2000).optional(),
});

export const RemindDecisionSchema = z.object({
  message: z.string().max(500).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetDecisionsQuerySchema = z.object({
  projectId: z.string().optional(),
  status: DecisionStatusEnum.optional(),
  relatedObjectId: z.string().optional(),
  pmoDomain: z.nativeEnum(PMODomain).optional(),
});

// ==========================================
// TYPES
// ==========================================

export type CreateDecisionRequest = z.infer<typeof CreateDecisionSchema>;
export type DecideRequest = z.infer<typeof DecideSchema>;
export type EscalateDecisionRequest = z.infer<typeof EscalateDecisionSchema>;
export type UpdateDecisionRequest = z.infer<typeof UpdateDecisionSchema>;
export type RemindDecisionRequest = z.infer<typeof RemindDecisionSchema>;
export type GetDecisionsQuery = z.infer<typeof GetDecisionsQuerySchema>;
export type CreateDecisionCommentRequest = z.infer<typeof CreateDecisionCommentSchema>;
export type UpdateDecisionCommentRequest = z.infer<typeof UpdateDecisionCommentSchema>;
export type CreateDecisionAlternativeRequest = z.infer<typeof CreateDecisionAlternativeSchema>;
export type UpdateDecisionAlternativeRequest = z.infer<typeof UpdateDecisionAlternativeSchema>;
export type CreateDecisionRiskRequest = z.infer<typeof CreateDecisionRiskSchema>;
export type UpdateDecisionRiskRequest = z.infer<typeof UpdateDecisionRiskSchema>;
export type ReplaceDecisionStakeholdersRequest = z.infer<typeof ReplaceDecisionStakeholdersSchema>;
