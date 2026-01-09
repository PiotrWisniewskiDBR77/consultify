/**
 * Projects Validators
 * Zod schemas for project-related endpoints
 */

import { z } from 'zod';

export const CreateProjectRequestSchema = z.object({
    name: z.string().min(1, 'Project name is required').max(255),
    ownerId: z.string().uuid().optional(),
    description: z.string().max(5000).optional().nullable(),
    goal: z.string().max(1000).optional().nullable(),
});

export const UpdateProjectRequestSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional().nullable(),
    goal: z.string().max(1000).optional().nullable(),
    status: z.enum(['active', 'archived', 'completed']).optional(),
});

export const ProjectIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const UpdateNotificationSettingsSchema = z.object({
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

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
export type UpdateNotificationSettings = z.infer<typeof UpdateNotificationSettingsSchema>;
export type UpdateAIRole = z.infer<typeof UpdateAIRoleSchema>;
export type UpdateRegulatoryMode = z.infer<typeof UpdateRegulatoryModeSchema>;




