/**
 * AdminData Validators
 * Zod schemas for admin-data-related endpoints
 */

import { z } from 'zod';

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const OrgIdParamSchema = z.object({
    orgId: z.string().uuid(),
});

export const UserTierParamsSchema = OrgIdParamSchema.extend({
    userId: z.string().uuid(),
});

export const EventIdParamSchema = z.object({
    eventId: z.string().uuid(),
});

export const SessionIdParamSchema = z.object({
    sessionId: z.string().uuid(),
});

export const ScheduledEventIdParamSchema = z.object({
    eventId: z.string().uuid(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const UserTiersQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
});

export const SecurityEventsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
    resolved: z.enum(['true', 'false']).optional(),
});

export const RecentActivityQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const SessionsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
});

export const LoginHistoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
});

export const ScheduledEventsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    includeCompleted: z.enum(['true', 'false']).optional().default('false'),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const UpdateUserTierBodySchema = z.object({
    tier: z.enum(['STANDARD', 'PREMIUM', 'ENTERPRISE']),
});

export const ResolveSecurityEventBodySchema = z.object({
    resolved: z.boolean().optional().default(true),
});

export const CreateScheduledEventBodySchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    eventType: z.enum(['meeting', 'deadline', 'milestone', 'reminder', 'other']).optional().default('meeting'),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    location: z.string().optional(),
    isAllDay: z.boolean().optional().default(false),
    projectId: z.string().uuid().optional(),
    attendees: z.array(z.string().uuid()).optional().default([]),
});

export const UpdateScheduledEventBodySchema = CreateScheduledEventBodySchema.partial();

// ==========================================
// TYPES
// ==========================================

export type OrgIdParam = z.infer<typeof OrgIdParamSchema>;
export type UserTierParams = z.infer<typeof UserTierParamsSchema>;
export type EventIdParam = z.infer<typeof EventIdParamSchema>;
export type SessionIdParam = z.infer<typeof SessionIdParamSchema>;
export type ScheduledEventIdParam = z.infer<typeof ScheduledEventIdParamSchema>;
export type UserTiersQuery = z.infer<typeof UserTiersQuerySchema>;
export type SecurityEventsQuery = z.infer<typeof SecurityEventsQuerySchema>;
export type RecentActivityQuery = z.infer<typeof RecentActivityQuerySchema>;
export type SessionsQuery = z.infer<typeof SessionsQuerySchema>;
export type LoginHistoryQuery = z.infer<typeof LoginHistoryQuerySchema>;
export type ScheduledEventsQuery = z.infer<typeof ScheduledEventsQuerySchema>;
export type UpdateUserTierBody = z.infer<typeof UpdateUserTierBodySchema>;
export type ResolveSecurityEventBody = z.infer<typeof ResolveSecurityEventBodySchema>;
export type CreateScheduledEventBody = z.infer<typeof CreateScheduledEventBodySchema>;
export type UpdateScheduledEventBody = z.infer<typeof UpdateScheduledEventBodySchema>;
