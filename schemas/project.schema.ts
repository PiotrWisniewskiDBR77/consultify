/**
 * Project Schemas
 * Enterprise SaaS Architecture - Project Input Validation
 */

import { z } from 'zod';

// ==========================================
// PROJECT
// ==========================================

export const CreateProjectSchema = z.object({
    name: z.string()
        .min(1, 'Project name is required')
        .max(255, 'Project name too long')
        .trim(),
    description: z.string()
        .max(5000, 'Description too long')
        .optional(),
    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled'])
        .optional()
        .default('draft'),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    budget: z.number().min(0).max(1000000000).optional(),
    currency: z.string().length(3).optional().default('USD'),
    tags: z.array(z.string().max(50)).max(20).optional(),
    methodology: z.enum(['agile', 'waterfall', 'hybrid', 'custom']).optional(),
    visibility: z.enum(['private', 'team', 'organization']).optional().default('team'),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, {
    message: 'End date must be after start date',
    path: ['endDate'],
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
    ownerId: z.string().uuid().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// ==========================================
// PROJECT MEMBER
// ==========================================

export const AddProjectMemberSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
});

export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;

export const UpdateProjectMemberSchema = z.object({
    role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export type UpdateProjectMemberInput = z.infer<typeof UpdateProjectMemberSchema>;

// ==========================================
// PROJECT FILTERS
// ==========================================

export const ProjectFilterSchema = z.object({
    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
    ownerId: z.string().uuid().optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.enum(['name', 'created_at', 'updated_at', 'start_date', 'end_date']).optional().default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ProjectFilterInput = z.infer<typeof ProjectFilterSchema>;
