/**
 * User Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for user-related API endpoints
 */

import { z } from 'zod';

// ==========================================
// ENUMS
// ==========================================

export const UserRoleEnum = z.enum(['USER', 'ADMIN', 'SUPERADMIN', 'MANAGER', 'REVIEWER', 'LEADER']);
export const UserStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const UpdateUserSchema = z.object({
    firstName: z.string().max(255).optional(),
    lastName: z.string().max(255).optional(),
    email: z.string().email().optional(),
    role: UserRoleEnum.optional(),
    status: UserStatusEnum.optional(),
    phone: z.string().max(50).optional(),
    linkedinId: z.string().max(255).optional(),
});

export const UpdateUserRoleSchema = z.object({
    role: UserRoleEnum,
    reason: z.string().max(500).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetUsersQuerySchema = z.object({
    canReview: z.enum(['true', 'false']).optional(),
    role: UserRoleEnum.optional(),
    status: UserStatusEnum.optional(),
    search: z.string().optional(),
});

// ==========================================
// TYPES
// ==========================================

export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleSchema>;
export type GetUsersQuery = z.infer<typeof GetUsersQuerySchema>;
