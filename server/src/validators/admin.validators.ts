/**
 * Admin Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for admin-related API endpoints
 */

import { z } from 'zod';

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const UpdateOrganizationAdminSchema = z.object({
    plan: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
    status: z.enum(['active', 'suspended', 'cancelled', 'trial']).optional(),
    name: z.string().max(255).optional(),
});

export const CreateUserAdminSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(255),
    lastName: z.string().min(1).max(255),
    role: z.enum(['USER', 'ADMIN', 'SUPERADMIN', 'MANAGER']).optional(),
    organizationId: z.string().uuid().optional(),
});

export const UpdateUserAdminSchema = z.object({
    email: z.string().email().optional(),
    firstName: z.string().max(255).optional(),
    lastName: z.string().max(255).optional(),
    role: z.enum(['USER', 'ADMIN', 'SUPERADMIN', 'MANAGER']).optional(),
    organizationId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
});

export const ImpersonateUserSchema = z.object({
    userId: z.string().uuid(),
});

export const CreateAccessCodeSchema = z.object({
    code: z.string().min(1).max(100),
    maxUses: z.number().int().positive().optional(),
    expiresAt: z.string().datetime().optional(),
});

export const UpdateUserTierSchema = z.object({
    tier: z.enum(['STANDARD', 'PREMIUM', 'ENTERPRISE']),
});

export const CreateAdminAlertSchema = z.object({
    name: z.string().min(1).max(255),
    type: z.enum(['usage', 'cost', 'security', 'performance', 'compliance']),
    threshold: z.number().optional(),
    enabled: z.boolean().optional().default(true),
    config: z.record(z.unknown()).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetAdminDataQuerySchema = z.object({
    orgId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
});

// ==========================================
// TYPES
// ==========================================

export type UpdateOrganizationAdminRequest = z.infer<typeof UpdateOrganizationAdminSchema>;
export type CreateUserAdminRequest = z.infer<typeof CreateUserAdminSchema>;
export type UpdateUserAdminRequest = z.infer<typeof UpdateUserAdminSchema>;
export type ImpersonateUserRequest = z.infer<typeof ImpersonateUserSchema>;
export type CreateAccessCodeRequest = z.infer<typeof CreateAccessCodeSchema>;
export type UpdateUserTierRequest = z.infer<typeof UpdateUserTierSchema>;
export type CreateAdminAlertRequest = z.infer<typeof CreateAdminAlertSchema>;
export type GetAdminDataQuery = z.infer<typeof GetAdminDataQuerySchema>;



