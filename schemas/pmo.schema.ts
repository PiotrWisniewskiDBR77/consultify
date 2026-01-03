/**
 * PMO Schemas
 * Enterprise SaaS Architecture - PMO & Governance Validation
 * Aligned with ISO 21500, PMBOK 7, PRINCE2
 */

import { z } from 'zod';

// ==========================================
// DECISION
// ==========================================

export const CreateDecisionSchema = z.object({
    projectId: z.string().uuid(),
    title: z.string()
        .min(1, 'Decision title is required')
        .max(255, 'Title too long')
        .trim(),
    description: z.string()
        .min(10, 'Please provide more detail')
        .max(5000, 'Description too long'),
    status: z.enum(['pending', 'approved', 'rejected', 'deferred'])
        .optional()
        .default('pending'),
    deciderId: z.string().uuid().optional(),
    decisionDate: z.string().datetime().optional(),
    rationale: z.string().max(2000).optional(),
    impact: z.string().max(2000).optional(),
    alternatives: z.array(z.object({
        title: z.string().max(255),
        description: z.string().max(1000),
        pros: z.array(z.string().max(500)).max(10).optional(),
        cons: z.array(z.string().max(500)).max(10).optional(),
    })).max(10).optional(),
    
    // PMO Domain mapping (ISO/PMBOK/PRINCE2)
    pmoDomain: z.enum([
        'GOVERNANCE_DECISION_MAKING',
        'SCOPE_CHANGE_CONTROL',
        'SCHEDULE_MILESTONES',
        'RISK_ISSUE_MANAGEMENT',
        'RESOURCE_RESPONSIBILITY',
        'PERFORMANCE_MONITORING',
        'BENEFITS_REALIZATION'
    ]),
    
    // Standards compliance
    isoMapping: z.string().max(100).optional(),
    pmbokMapping: z.string().max(100).optional(),
    prince2Mapping: z.string().max(100).optional(),
});

export type CreateDecisionInput = z.infer<typeof CreateDecisionSchema>;

export const UpdateDecisionSchema = CreateDecisionSchema.partial().omit({ projectId: true });

export type UpdateDecisionInput = z.infer<typeof UpdateDecisionSchema>;

// ==========================================
// RAID ITEM (Risk, Assumption, Issue, Dependency)
// ==========================================

export const CreateRAIDItemSchema = z.object({
    projectId: z.string().uuid(),
    type: z.enum(['risk', 'assumption', 'issue', 'dependency']),
    title: z.string()
        .min(1, 'Title is required')
        .max(255, 'Title too long')
        .trim(),
    description: z.string()
        .max(5000, 'Description too long'),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    status: z.enum(['open', 'in_progress', 'mitigated', 'closed'])
        .optional()
        .default('open'),
    owner: z.string().uuid().optional(),
    dueDate: z.string().datetime().optional(),
    
    // Risk-specific fields
    probability: z.number().min(0).max(100).optional(),
    impact: z.number().min(0).max(100).optional(),
    mitigationPlan: z.string().max(2000).optional(),
    contingencyPlan: z.string().max(2000).optional(),
    
    // Dependency-specific fields
    dependsOnProjectId: z.string().uuid().optional(),
    dependsOnTaskId: z.string().uuid().optional(),
    dependsOnMilestoneId: z.string().uuid().optional(),
    
    // Standards compliance
    isoMapping: z.string().max(100).optional(),
    pmbokMapping: z.string().max(100).optional(),
    prince2Mapping: z.string().max(100).optional(),
});

export type CreateRAIDItemInput = z.infer<typeof CreateRAIDItemSchema>;

export const UpdateRAIDItemSchema = CreateRAIDItemSchema.partial().omit({ projectId: true, type: true });

export type UpdateRAIDItemInput = z.infer<typeof UpdateRAIDItemSchema>;

// ==========================================
// STAGE GATE
// ==========================================

export const CreateStageGateSchema = z.object({
    projectId: z.string().uuid(),
    name: z.string()
        .min(1, 'Gate name is required')
        .max(100, 'Name too long')
        .trim(),
    description: z.string().max(2000).optional(),
    phase: z.number().int().min(0).max(20),
    status: z.enum(['not_started', 'in_progress', 'passed', 'failed'])
        .optional()
        .default('not_started'),
    criteria: z.array(z.object({
        id: z.string().optional(),
        description: z.string().max(500),
        isMet: z.boolean().default(false),
        evidence: z.string().max(1000).optional(),
    })).min(1, 'At least one criterion is required').max(20),
    approver: z.string().uuid().optional(),
    scheduledDate: z.string().datetime().optional(),
});

export type CreateStageGateInput = z.infer<typeof CreateStageGateSchema>;

export const UpdateStageGateSchema = CreateStageGateSchema.partial().omit({ projectId: true });

export type UpdateStageGateInput = z.infer<typeof UpdateStageGateSchema>;

// ==========================================
// GOVERNANCE SETTINGS
// ==========================================

export const UpdateGovernanceSettingsSchema = z.object({
    approvalWorkflow: z.enum(['none', 'single', 'multi_level', 'matrix']).optional(),
    escalationRules: z.array(z.object({
        condition: z.string().max(255),
        escalateTo: z.string().uuid(),
        timeoutHours: z.number().int().min(1).max(720), // Max 30 days
    })).max(10).optional(),
    changeControlThreshold: z.number().min(0).optional(),
    mandatoryStageGates: z.boolean().optional(),
    riskToleranceLevel: z.enum(['low', 'medium', 'high']).optional(),
    reportingFrequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
    auditTrailEnabled: z.boolean().optional(),
    standardsCompliance: z.array(z.enum(['ISO21500', 'PMBOK7', 'PRINCE2', 'IPMA', 'CUSTOM'])).optional(),
});

export type UpdateGovernanceSettingsInput = z.infer<typeof UpdateGovernanceSettingsSchema>;

// ==========================================
// PMO FILTERS
// ==========================================

export const PMOFilterSchema = z.object({
    projectId: z.string().uuid().optional(),
    type: z.enum(['risk', 'assumption', 'issue', 'dependency', 'decision', 'gate']).optional(),
    status: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    owner: z.string().uuid().optional(),
    pmoDomain: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type PMOFilterInput = z.infer<typeof PMOFilterSchema>;


