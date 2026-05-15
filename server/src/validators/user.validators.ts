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

export const UserRoleEnum = z.enum([
  'USER',
  'ADMIN',
  'SUPERADMIN',
  'MANAGER',
  'REVIEWER',
  'LEADER',
]);
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
  avatarUrl: z.string().max(2048).nullable().optional(),
  licensePlanId: z.string().max(255).nullable().optional(),
  jobTitle: z.string().trim().max(255).nullable().optional(),
  title: z.string().trim().max(255).nullable().optional(),
  department: z.string().trim().max(255).nullable().optional(),
  siteLocation: z.string().trim().max(255).nullable().optional(),
  seniorityLevel: z.string().trim().max(255).nullable().optional(),
  tenureYears: z.string().trim().max(50).nullable().optional(),
  managesTeam: z.boolean().optional(),
  teamSize: z.string().trim().max(50).nullable().optional(),
  expertiseTags: z.array(z.string().trim().max(100)).max(25).optional(),
  engagementLevel: z.string().trim().max(100).nullable().optional(),
  displayName: z.string().trim().max(255).nullable().optional(),
  pronouns: z.string().trim().max(100).nullable().optional(),
  statusMessage: z.string().trim().max(255).nullable().optional(),
  isOutOfOffice: z.boolean().optional(),
  outOfOfficeUntil: z.string().trim().max(100).nullable().optional(),
  timezone: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  profileSurveyCompletedAt: z.string().trim().max(100).nullable().optional(),
  profileSurveyDismissedCount: z.number().int().min(0).max(20).optional(),
  profileSurveyLastDismissedAt: z.string().trim().max(100).nullable().optional(),
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
