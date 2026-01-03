/**
 * Project Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Zod schemas for project-related API endpoints
 */

import { z } from 'zod';

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required').max(255),
    ownerId: z.string().uuid().optional(),
    description: z.string().max(5000).optional(),
    goal: z.string().max(1000).optional(),
    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
});

export const UpdateProjectSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    goal: z.string().max(1000).optional(),
    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
});

export const ProjectNotificationSettingsSchema = z.object({
    task_overdue_enabled: z.boolean().optional(),
    task_due_today_enabled: z.boolean().optional(),
    blocker_detected_enabled: z.boolean().optional(),
    gate_ready_enabled: z.boolean().optional(),
    decision_required_enabled: z.boolean().optional(),
    escalation_enabled: z.boolean().optional(),
    escalation_days: z.number().int().min(1).max(30).optional(),
    email_notifications: z.boolean().optional(),
    in_app_notifications: z.boolean().optional(),
});

export const UpdateAIRoleSchema = z.object({
    aiRole: z.enum(['ADVISOR', 'MANAGER', 'OPERATOR']),
    justification: z.string().max(500).optional(),
});

export const UpdateRegulatoryModeSchema = z.object({
    enabled: z.boolean(),
    justification: z.string().max(500).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetProjectsQuerySchema = z.object({
    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
    ownerId: z.string().uuid().optional(),
    search: z.string().optional(),
});

// ==========================================
// TYPES
// ==========================================

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectSchema>;
export type ProjectNotificationSettingsRequest = z.infer<typeof ProjectNotificationSettingsSchema>;
export type UpdateAIRoleRequest = z.infer<typeof UpdateAIRoleSchema>;
export type UpdateRegulatoryModeRequest = z.infer<typeof UpdateRegulatoryModeSchema>;
export type GetProjectsQuery = z.infer<typeof GetProjectsQuerySchema>;



