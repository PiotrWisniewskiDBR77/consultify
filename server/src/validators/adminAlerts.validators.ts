/**
 * AdminAlerts Validators
 * Zod schemas for adminAlerts-related endpoints
 */

import { z } from 'zod';

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const AlertIdParamSchema = z.object({
    id: z.string().min(1),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetAlertsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
});

export const GetAlertHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const CreateAdminAlertBodySchema = z.object({
    name: z.string().min(1).max(255),
    type: z.enum(['usage', 'cost', 'security', 'performance', 'compliance']),
    alertType: z.enum(['cost_spike', 'usage_anomaly', 'budget_exceeded', 'seat_limit_reached']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    costThresholdUsd: z.number().positive().optional(),
    usageThresholdPercent: z.number().int().min(0).max(1000).optional(),
    seatThresholdPercent: z.number().int().min(0).max(100).optional(),
    notifyAdmins: z.boolean().optional().default(true),
    notifyBillingContact: z.boolean().optional().default(true),
    notifySuperadmin: z.boolean().optional().default(false),
    emailEnabled: z.boolean().optional().default(true),
    slackWebhookUrl: z.string().url().optional(),
    webhookUrl: z.string().url().optional(),
    alertFrequency: z.enum(['once', 'daily', 'weekly']).optional().default('once'),
    cooldownHours: z.number().int().min(1).max(168).optional().default(24),
    isActive: z.boolean().optional().default(true),
    config: z.record(z.unknown()).optional(),
});

export const UpdateAdminAlertBodySchema = CreateAdminAlertBodySchema.partial();

// ==========================================
// TYPES
// ==========================================

export type AlertIdParam = z.infer<typeof AlertIdParamSchema>;
export type GetAlertsQuery = z.infer<typeof GetAlertsQuerySchema>;
export type GetAlertHistoryQuery = z.infer<typeof GetAlertHistoryQuerySchema>;
export type CreateAdminAlertBody = z.infer<typeof CreateAdminAlertBodySchema>;
export type UpdateAdminAlertBody = z.infer<typeof UpdateAdminAlertBodySchema>;
