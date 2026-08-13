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
  firstName: z.string().trim().min(1, 'First name is required before saving').max(255).optional(),
  lastName: z.string().max(255).optional(),
  email: z.string().email().optional(),
  role: UserRoleEnum.optional(),
  status: UserStatusEnum.optional(),
  phone: z.string().max(50).optional(),
  linkedinId: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  avatarUrl: z.string().max(1000).nullable().optional(),
  licensePlanId: z.string().max(255).nullable().optional(),
  displayName: z.string().max(255).optional(),
  pronouns: z.string().max(100).optional(),
  department: z.string().max(255).optional(),
  statusMessage: z.string().max(500).optional(),
  isOutOfOffice: z.boolean().optional(),
  outOfOfficeUntil: z.string().max(100).nullable().optional(),
  outOfOfficeMessage: z.string().max(1000).optional(),
  companyName: z.string().max(255).optional(),
  timezone: z.string().max(255).optional(),
  dateFormat: z.string().max(50).optional(),
  timeFormat: z.string().max(50).optional(),
  seniorityLevel: z.string().max(255).optional(),
  siteLocation: z.string().max(255).optional(),
  tenureYears: z.string().max(100).optional(),
  managesTeam: z.boolean().optional(),
  teamSize: z.string().max(100).optional(),
  expertiseTags: z.array(z.string().max(100)).optional(),
  engagementLevel: z.string().max(100).optional(),
  profileSurveyCompletedAt: z.string().max(100).nullable().optional(),
  profileSurveyDismissedCount: z.number().int().min(0).optional(),
  profileSurveyLastDismissedAt: z.string().max(100).nullable().optional(),
  // P0.3 (2026-07-26): interface language preference. Must stay in sync with
  // SUPPORTED_LANGUAGES in src/i18n.ts. ('ja' — S23-LOCALE, 2026-08-12: 'jp'
  // was not a valid BCP47 subtag for Japanese and was migrated to 'ja'.)
  language: z.enum(['en', 'pl', 'de', 'ar', 'ja', 'es']).nullable().optional(),
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
