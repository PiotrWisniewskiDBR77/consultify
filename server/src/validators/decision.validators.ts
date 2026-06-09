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
    status: z.enum(['APPROVED', 'REJECTED', 'PENDING', 'ESCALATED']).optional(),
    rationale: z.string().min(1).max(2000).optional(),
    outcome: z.string().max(2000).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => data.decision || data.status, {
    message: 'Decision status required',
    path: ['decision'],
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
