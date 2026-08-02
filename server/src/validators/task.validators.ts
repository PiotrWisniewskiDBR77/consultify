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
const FlexibleId = z.string().min(1);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  projectId: FlexibleId.optional().nullable(),
  organizationId: FlexibleId.optional(),
  programId: FlexibleId.optional().nullable(),
  description: z.string().optional().nullable(),
  status: TaskStatusEnum.optional().default('todo'),
  priority: PriorityEnum.optional().default('medium'),
  assigneeId: FlexibleId.optional().nullable(),
  backupAssigneeId: FlexibleId.optional().nullable(),
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
  initiativeId: FlexibleId.optional().nullable(),
  listId: FlexibleId.optional().nullable(),
  workstreamId: FlexibleId.optional().nullable(),
  ownerId: FlexibleId.optional().nullable(),
  requiresAcceptance: z.boolean().optional(),
  acceptanceType: z.enum(['manual', 'automatic']).optional().nullable(),
  acceptorId: FlexibleId.optional().nullable(),
  why: z.string().optional().nullable(),
  assignees: z.array(FlexibleId).optional(),
  checklist: z.array(z.unknown()).optional(),
  expectedOutcome: z.string().optional(),
  decisionImpact: z.unknown().optional(),
  evidenceRequired: z.unknown().optional(),
  strategicContribution: z.unknown().optional(),
  progress: z.number().min(0).max(100).optional(),
  blockedReason: z.string().optional(),
  blockedByDecisionId: FlexibleId.optional().nullable(),
  weight: z.number().min(0.1).max(100).optional(),
  weightReason: z.string().max(500).optional().nullable(),
  roadmapInitiativeId: FlexibleId.optional().nullable(),
  kpiId: FlexibleId.optional().nullable(),
  raidItemId: FlexibleId.optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  // EXE-002-004: retry-safe create. validateBody() replaces req.body with
  // this schema's parsed output (z.object() strips unknown keys by
  // default), so a field TaskController.createTask reads from req.body
  // MUST be declared here or it never survives past this middleware —
  // silently, with no validation error (found via the real-Postgres
  // idempotency test in tests/integration/execution-spine.golden-flow.realdb.test.ts).
  idempotencyKey: z.string().max(255).optional().nullable(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().omit({ organizationId: true });

export const AssignTaskSchema = z.object({
  assigneeId: FlexibleId,
  notify: z.boolean().optional().default(true),
  slaHours: z.number().positive().optional(),
});

export const ReassignTaskSchema = z.object({
  fromAssigneeId: FlexibleId,
  toAssigneeId: FlexibleId,
  reason: z.string().optional(),
});

export const EscalateTaskSchema = z.object({
  reason: z.string().min(1, 'Escalation reason is required'),
  priority: PriorityEnum.optional(),
  assignTo: FlexibleId.optional(),
});

export const ResolveEscalationSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required'),
});

export const BlockTaskSchema = z.object({
  reason: z.string().min(1, 'Block reason is required'),
  decisionId: FlexibleId.optional().nullable(),
});

export const UnblockTaskSchema = z.object({
  newStatus: TaskStatusEnum.optional(),
});

export const AddTaskCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(5000),
  mentions: z.array(FlexibleId).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const ScopeEnum = z.enum(['personal', 'initiative', 'program']);
export const GetTasksQuerySchema = z.object({
  projectId: FlexibleId.optional(),
  programId: FlexibleId.optional(),
  listId: FlexibleId.optional(),
  status: TaskStatusEnum.optional(),
  assigneeId: FlexibleId.optional(),
  reporterId: FlexibleId.optional(),
  priority: PriorityEnum.optional(),
  initiativeId: FlexibleId.optional(),
  taskType: TaskTypeEnum.optional(),
  search: z.string().optional(),
  scope: ScopeEnum.optional(),
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
export type BlockTaskRequest = z.infer<typeof BlockTaskSchema>;
export type UnblockTaskRequest = z.infer<typeof UnblockTaskSchema>;
export type AddTaskCommentRequest = z.infer<typeof AddTaskCommentSchema>;
export type GetTasksQuery = z.infer<typeof GetTasksQuerySchema>;
