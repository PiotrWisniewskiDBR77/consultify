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

// Feedback #1e3d749a / #682d4134 / #76ef6831 — the previous schemas rejected
// the exact payloads the UI (and DB) actually use:
//   - `role` only allowed USER/ADMIN/SUPERADMIN/MANAGER, but production users
//     carry MEMBER, OWNER, PROJECT_MANAGER, CONSULTANT, CLIENT, VIEWER, etc.
//     Editing such a user echoed their current role back and hit a 400.
//   - `status` only allowed upper-case ACTIVE/INACTIVE/SUSPENDED/PENDING, but
//     the DB and UI use lowercase `active|blocked|deleted|pending|trial|...`.
//     That blocked both "change status" and the Block/Unblock toggle.
//   - `organizationId` required a UUID, but tenant IDs are slugs
//     (`vts`, `aplix-na`, `ateliertoys-demo`, `org-dbr77-system`), so the
//     "move user to another org" action always failed validation.
//
// We normalize role/status in the controller layer, so at the schema level we
// just enforce length/shape and let the business logic decide what's valid.
const RoleString = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_\-]+$/, 'role must be a simple token');
const StatusString = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_\-]+$/, 'status must be a simple token');
// Organization IDs in this platform are slugs (or legacy UUIDs). Accept either.
const OrganizationIdString = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_\-]+$/, 'organizationId must be a slug or UUID');

export const UpdateOrganizationAdminSchema = z.object({
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended', 'cancelled', 'trial']).optional(),
  name: z.string().max(255).optional(),
});

export const CreateUserAdminSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  role: RoleString.optional(),
  organizationId: OrganizationIdString.optional(),
});

export const UpdateUserAdminSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  role: RoleString.optional(),
  organizationId: OrganizationIdString.optional(),
  status: StatusString.optional(),
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
  config: z.record(z.string(), z.unknown()).optional(),
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
