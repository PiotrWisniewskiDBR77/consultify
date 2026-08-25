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

const userStatusValues = [
  'active',
  'blocked',
  'inactive',
  'suspended',
  'pending',
  'deleted',
] as const;

const userStatusSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(userStatusValues));

// Restored from abf1c6de58 (feedback #1e3d749a): production users carry roles
// beyond USER/ADMIN/SUPERADMIN/MANAGER (OWNER, MEMBER, PROJECT_MANAGER,
// CONSULTANT, VIEWER…). The Edit User dialog echoes the current role back, so a
// narrow enum 400s every edit of such a user. The merge d675885189 silently
// re-narrowed this; keep the schema permissive — the controller normalizes and
// validates roles against business logic.
const roleTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'role must be a simple token');

export const UpdateOrganizationAdminSchema = z.object({
  plan: z.enum(['free', 'trial', 'starter', 'pro', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'pending', 'blocked', 'suspended', 'cancelled', 'trial']).optional(),
  name: z.string().max(255).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  confirmation: z.boolean().optional(),
  reason: z.string().trim().min(3).max(4000).optional(),
});

export const CreateUserAdminSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  role: roleTokenSchema.optional(),
  organizationId: z.string().trim().min(1).max(255).optional(),
  password: z.string().min(8).max(255).optional(),
  licensePlanId: z.string().trim().max(255).nullable().optional(),
  department: z.string().trim().max(255).optional(),
  jobTitle: z.string().trim().max(255).optional(),
  projectRole: z.string().trim().max(100).optional(),
});

export const UpdateUserAdminSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  role: roleTokenSchema.optional(),
  organizationId: z.string().trim().min(1).max(255).optional(),
  status: userStatusSchema.optional(),
  licensePlanId: z.string().trim().max(255).nullable().optional(),
  department: z.string().trim().max(255).optional(),
  jobTitle: z.string().trim().max(255).optional(),
  projectRole: z.string().trim().max(100).optional(),
});

export const ImpersonateUserSchema = z.object({
  userId: z.string().trim().min(1).max(255),
});

export const CreateAccessCodeSchema = z.object({
  code: z.string().trim().min(1).max(100).optional().or(z.literal('')),
  role: z.string().trim().min(1).max(50).optional(),
  maxUses: z.coerce.number().int().positive().optional(),
  organizationId: z.string().trim().min(1).max(255).optional(),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'expiresAt must be a valid date',
    }),
});

export const UpdateUserTierSchema = z.object({
  tier: z.enum(['STANDARD', 'PREMIUM', 'ENTERPRISE']),
});

export const CreateAdminAlertSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['usage', 'cost', 'security', 'performance', 'compliance']),
  threshold: z.number().optional(),
  enabled: z.boolean().optional().default(true),
  config: z.record(z.string(), z.unknown()).optional(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetAdminDataQuerySchema = z.object({
  orgId: z.string().trim().min(1).max(255).optional(),
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
