import { z } from 'zod';

const taskStatusEnum = z.enum(['todo', 'in_progress', 'review', 'done', 'blocked', 'on_hold']);
const priorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
const taskTypeEnum = z.enum(['execution', 'analysis', 'decision', 'design', 'build', 'test', 'deploy', 'other']);

const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required").max(255),
    projectId: z.string().uuid().optional().nullable(), // Optional if context-implied? Usually required.
    organizationId: z.string().uuid().optional(), // Often inferred from token
    description: z.string().optional().nullable(),
    status: taskStatusEnum.optional().default('todo'),
    priority: priorityEnum.optional().default('medium'),
    assigneeId: z.string().uuid().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable().or(z.string()), // Accept ISO string
    estimatedHours: z.number().min(0).optional().nullable(),
    tags: z.array(z.string()).optional(),
    taskType: taskTypeEnum.optional().default('execution'),
    initiativeId: z.string().uuid().optional().nullable(),
    why: z.string().optional().nullable(),

    // Arrays often sent as JSON or raw arrays
    assignees: z.array(z.string()).optional(), // Array of IDs
    checklist: z.array(z.any()).optional(),

    // Strategic fields
    expectedOutcome: z.string().optional(),
    decisionImpact: z.any().optional(),
    evidenceRequired: z.any().optional(),
    strategicContribution: z.any().optional(),

    // Progress
    progress: z.number().min(0).max(100).optional(),
    blockedReason: z.string().optional()
});

const updateTaskSchema = createTaskSchema.partial().omit({ organizationId: true });

export {
createTaskSchema,
    updateTaskSchema
};

export default {
    createTaskSchema,
    updateTaskSchema
};
