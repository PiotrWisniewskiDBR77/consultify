/**
 * Task Schemas
 * Enterprise SaaS Architecture - Task Input Validation
 */

import { z } from 'zod';

// ==========================================
// TASK
// ==========================================

export const CreateTaskSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Task title is required').max(255, 'Task title too long').trim(),
  description: z.string().max(10000, 'Description too long').optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0).max(10000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  taskType: z.string().max(50).optional(),
  initiativeId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),

  // Checklist items
  checklist: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string().min(1).max(500),
        completed: z.boolean().default(false),
      })
    )
    .max(50)
    .optional(),

  // PMO integration
  why: z.string().max(1000).optional(),
  stepPhase: z.enum(['design', 'pilot', 'rollout']).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial()
  .omit({ projectId: true })
  .extend({
    actualHours: z.number().min(0).max(100000).optional(),
  });

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ==========================================
// TASK COMMENT
// ==========================================

export const CreateTaskCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment too long').trim(),
  parentCommentId: z.string().uuid().optional(),
});

export type CreateTaskCommentInput = z.infer<typeof CreateTaskCommentSchema>;

// ==========================================
// TASK FILTERS
// ==========================================

export const TaskFilterSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigneeId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(['title', 'created_at', 'updated_at', 'due_date', 'priority'])
    .optional()
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type TaskFilterInput = z.infer<typeof TaskFilterSchema>;

// ==========================================
// BULK OPERATIONS
// ==========================================

export const BulkUpdateTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(100),
  updates: z.object({
    status: z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    tags: z.array(z.string().max(50)).optional(),
  }),
});

export type BulkUpdateTasksInput = z.infer<typeof BulkUpdateTasksSchema>;

export const BulkDeleteTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(100),
});

export type BulkDeleteTasksInput = z.infer<typeof BulkDeleteTasksSchema>;
