/**
 * Organization Schemas
 * Enterprise SaaS Architecture - Organization & Team Validation
 */

import { z } from 'zod';

// ==========================================
// ORGANIZATION
// ==========================================

export const CreateOrganizationSchema = z.object({
    name: z.string().min(1, 'Organization name is required').max(255, 'Organization name too long').trim(),
    slug: z
        .string()
        .min(3, 'Slug must be at least 3 characters')
        .max(50, 'Slug too long')
        .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and dashes')
        .optional(),
    description: z.string().max(1000).optional(),
    website: z.string().url().optional(),
    industry: z.string().max(100).optional(),
    size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
    country: z.string().length(2).optional(), // ISO country code
    timezone: z.string().max(50).optional(),
    locale: z.string().max(10).optional(),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

// ==========================================
// ORGANIZATION BRANDING
// ==========================================

export const UpdateBrandingSchema = z.object({
    primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
        .optional(),
    secondaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
        .optional(),
    logoUrl: z.string().url().optional().nullable(),
    faviconUrl: z.string().url().optional().nullable(),
    fontFamily: z.string().max(100).optional(),
});

export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>;

// ==========================================
// ORGANIZATION SETTINGS
// ==========================================

export const UpdateOrgSettingsSchema = z.object({
    timezone: z.string().max(50).optional(),
    locale: z.string().max(10).optional(),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    currency: z.string().length(3).optional(),
    weekStartsOn: z.enum(['sunday', 'monday']).optional(),

    // Feature toggles
    enableAI: z.boolean().optional(),
    enableCollaboration: z.boolean().optional(),
    enableExternalSharing: z.boolean().optional(),

    // Security settings
    enforceSSO: z.boolean().optional(),
    enforceMFA: z.boolean().optional(),
    sessionTimeoutMinutes: z.number().int().min(5).max(10080).optional(), // Max 7 days
    ipWhitelist: z.array(z.string().ip()).max(50).optional(),
});

export type UpdateOrgSettingsInput = z.infer<typeof UpdateOrgSettingsSchema>;

// ==========================================
// ORGANIZATION MEMBER
// ==========================================

export const InviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(['administrator', 'project_manager', 'team_member', 'viewer', 'consultant']),
    message: z.string().max(500).optional(),
    projectIds: z.array(z.string().uuid()).optional(),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
    role: z.enum(['administrator', 'project_manager', 'team_member', 'viewer', 'consultant']),
});

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

// ==========================================
// TEAM
// ==========================================

export const CreateTeamSchema = z.object({
    name: z.string().min(1, 'Team name is required').max(100, 'Team name too long').trim(),
    description: z.string().max(500).optional(),
    leadId: z.string().uuid().optional(),
    memberIds: z.array(z.string().uuid()).max(100).optional(),
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = CreateTeamSchema.partial();

export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;

export const AddTeamMemberSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(['lead', 'member']).default('member'),
});

export type AddTeamMemberInput = z.infer<typeof AddTeamMemberSchema>;

// ==========================================
// CONSULTANT
// ==========================================

export const CreateConsultantInviteSchema = z.object({
    email: z.string().email(),
    invitationType: z.enum(['firm', 'individual']),
    firmName: z.string().max(255).optional(),
    projectName: z.string().max(255).optional(),
    accessLevel: z.enum(['read', 'write', 'admin']).default('read'),
    expiresAt: z.string().datetime().optional(),
});

export type CreateConsultantInviteInput = z.infer<typeof CreateConsultantInviteSchema>;
