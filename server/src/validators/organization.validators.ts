/**
 * Organization Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for organization-related API endpoints
 */

import { z } from 'zod';

// ==========================================
// ENUMS
// ==========================================

export const OrganizationPlanEnum = z.enum(['free', 'starter', 'professional', 'enterprise']);
export const OrganizationStatusEnum = z.enum(['active', 'suspended', 'cancelled', 'trial']);
export const MemberRoleEnum = z.enum(['OWNER', 'ADMIN', 'USER', 'MEMBER', 'VIEWER']);

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().max(100).optional(),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().max(100).optional(),
  plan: OrganizationPlanEnum.optional(),
  status: OrganizationStatusEnum.optional(),
});

export const AddMemberSchema = z.object({
  targetUserId: z.string().uuid(),
  role: MemberRoleEnum,
});

export const UpdateMemberRoleSchema = z.object({
  role: MemberRoleEnum,
});

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: MemberRoleEnum,
  message: z.string().max(500).optional(),
});

// ==========================================
// TYPES
// ==========================================

export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationSchema>;
export type AddMemberRequest = z.infer<typeof AddMemberSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleSchema>;
export type InviteMemberRequest = z.infer<typeof InviteMemberSchema>;
