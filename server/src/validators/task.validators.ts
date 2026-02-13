/**
 * Task Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for task-related API endpoints
 */

import { z } from 'zod';

// ==========================================
// ENUMS
// ==========================================

export const TaskStatusEnum = z.enum([
  'todo',
  'in_progress',
  'review',
  'done',
  'blocked',
  'on_hold',
  'backlog',
  'cancelled',
]);
export const PriorityEnum = z.enum(['low', 'medium', 'high', 'urgent', 'critical']);
export const TaskTypeEnum = z.enum([
  'execution',
  'analysis',
  'decision',
  'design',
  'build',
  'test',
  'deploy',
  'interview',
  'other',
]);
export const TaskSourceEnum = z.enum(['manual', 'ai']);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  projectId: z.string().uuid().optional().nullable(),
  organizationId: z.string().uuid().optional(),
  description: z.string().optional().nullable(),
  status: TaskStatusEnum.optional().default('todo'),
  priority: PriorityEnum.optional().default('medium'),
  assigneeId: z.string().uuid().optional().nullable(),
  backupAssigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable().or(z.string()),
  startedAt: z.string().datetime().optional().nullable().or(z.string()),
  // PMO notifications (optional flags)
  notifyOnOverdue: z.boolean().optional(),
  notifyOnAcceptance: z.boolean().optional(),
  notifyOnUnassigned: z.boolean().optional(),
  notifyOnBlocked: z.boolean().optional(),
  estimatedHours: z.number().min(0).optional().nullable(),
  tags: z.array(z.string()).optional(),
  taskType: TaskTypeEnum.optional().default('execution'),
  source: TaskSourceEnum.optional().default('manual'),
  initiativeId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  requiresAcceptance: z.boolean().optional(),
  acceptanceType: z.enum(['manual', 'automatic']).optional().nullable(),
  acceptorId: z.string().uuid().optional().nullable(),
  why: z.string().optional().nullable(),
  assignees: z.array(z.string().uuid()).optional(),
  checklist: z.array(z.unknown()).optional(),
  expectedOutcome: z.string().optional(),
  decisionImpact: z.unknown().optional(),
  evidenceRequired: z.unknown().optional(),
  strategicContribution: z.unknown().optional(),
  progress: z.number().min(0).max(100).optional(),
  blockedReason: z.string().optional(),
  blockedByDecisionId: z.string().uuid().optional().nullable(),
  weight: z.number().min(0.1).max(100).optional(),
  weightReason: z.string().max(500).optional().nullable(),
  roadmapInitiativeId: z.string().uuid().optional().nullable(),
  kpiId: z.string().uuid().optional().nullable(),
  raidItemId: z.string().uuid().optional().nullable(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().omit({ organizationId: true });

export const AssignTaskSchema = z.object({
  assigneeId: z.string().uuid(),
  notify: z.boolean().optional().default(true),
  slaHours: z.number().positive().optional(),
});

export const ReassignTaskSchema = z.object({
  fromAssigneeId: z.string().uuid(),
  toAssigneeId: z.string().uuid(),
  reason: z.string().optional(),
});

export const EscalateTaskSchema = z.object({
  reason: z.string().min(1, 'Escalation reason is required'),
  priority: PriorityEnum.optional(),
  assignTo: z.string().uuid().optional(),
});

export const ResolveEscalationSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required'),
});

export const AddTaskCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(5000),
  mentions: z.array(z.string().uuid()).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetTasksQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: TaskStatusEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  reporterId: z.string().uuid().optional(),
  priority: PriorityEnum.optional(),
  initiativeId: z.string().uuid().optional(),
  taskType: TaskTypeEnum.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
});

// ==========================================
// TYPES
// ==========================================

export type CreateTaskRequest = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskRequest = z.infer<typeof UpdateTaskSchema>;
export type AssignTaskRequest = z.infer<typeof AssignTaskSchema>;
export type ReassignTaskRequest = z.infer<typeof ReassignTaskSchema>;
export type EscalateTaskRequest = z.infer<typeof EscalateTaskSchema>;
export type ResolveEscalationRequest = z.infer<typeof ResolveEscalationSchema>;
export type AddTaskCommentRequest = z.infer<typeof AddTaskCommentSchema>;
export type GetTasksQuery = z.infer<typeof GetTasksQuerySchema>;
