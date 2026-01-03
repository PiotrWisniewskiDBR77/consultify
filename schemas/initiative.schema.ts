/**
 * Initiative Schemas
 * Enterprise SaaS Architecture - Strategic Initiative Validation
 */

import { z } from 'zod';

// ==========================================
// INITIATIVE
// ==========================================

export const CreateInitiativeSchema = z.object({
    projectId: z.string().uuid('Invalid project ID'),
    title: z.string()
        .min(1, 'Initiative title is required')
        .max(255, 'Initiative title too long')
        .trim(),
    description: z.string()
        .max(10000, 'Description too long')
        .optional(),
    status: z.enum(['draft', 'planning', 'active', 'completed', 'cancelled'])
        .optional()
        .default('draft'),
    priority: z.enum(['low', 'medium', 'high', 'critical'])
        .optional()
        .default('medium'),
    owner: z.string().uuid().optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    
    // Financial metrics
    budget: z.number().min(0).max(1000000000).optional(),
    actualCost: z.number().min(0).optional(),
    roi: z.number().min(-100).max(10000).optional(),
    
    // Strategic alignment
    strategicAlignment: z.number().min(0).max(100).optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    
    // KPIs
    kpis: z.array(z.object({
        name: z.string().min(1).max(100),
        target: z.number(),
        current: z.number().default(0),
        unit: z.string().max(20),
    })).max(20).optional(),
    
    // Benefits
    expectedBenefits: z.array(z.object({
        description: z.string().max(500),
        type: z.enum(['financial', 'operational', 'strategic', 'compliance']),
        value: z.number().optional(),
    })).max(20).optional(),
});

export type CreateInitiativeInput = z.infer<typeof CreateInitiativeSchema>;

export const UpdateInitiativeSchema = CreateInitiativeSchema.partial().omit({ projectId: true });

export type UpdateInitiativeInput = z.infer<typeof UpdateInitiativeSchema>;

// ==========================================
// INITIATIVE VALIDATION (AI-POWERED)
// ==========================================

export const ValidateInitiativeSchema = z.object({
    initiativeId: z.string().uuid(),
    validationRules: z.array(z.enum([
        'budget_feasibility',
        'timeline_realistic',
        'resource_availability',
        'risk_assessment',
        'strategic_fit',
        'dependency_check',
        'kpi_measurability'
    ])).optional(),
});

export type ValidateInitiativeInput = z.infer<typeof ValidateInitiativeSchema>;

// ==========================================
// INITIATIVE FILTERS
// ==========================================

export const InitiativeFilterSchema = z.object({
    projectId: z.string().uuid().optional(),
    status: z.enum(['draft', 'planning', 'active', 'completed', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    owner: z.string().uuid().optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    category: z.string().optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.enum(['title', 'created_at', 'start_date', 'priority', 'roi']).optional().default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type InitiativeFilterInput = z.infer<typeof InitiativeFilterSchema>;


