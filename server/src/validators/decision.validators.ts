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

export const DecisionStatusEnum = z.enum(['pending', 'approved', 'rejected', 'deferred']);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateDecisionSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  pmoDomain: z.nativeEnum(PMODomain),
  decisionOwnerId: z.string().optional().nullable(),
  relatedObjectType: z.enum(['task', 'initiative', 'gate', 'risk']).optional(),
  relatedObjectId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const DecideSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'deferred']),
  rationale: z.string().min(1).max(2000),
  notes: z.string().max(1000).optional(),
});

export const EscalateDecisionSchema = z.object({
  reason: z.string().min(1).max(500),
  escalateToUserId: z.string().optional(),
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
export type GetDecisionsQuery = z.infer<typeof GetDecisionsQuerySchema>;
