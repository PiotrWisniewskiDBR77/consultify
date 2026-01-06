/**
 * Invitation Validators
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Zod schemas for invitation-related API endpoints
 */

import { z } from 'zod';

import { MemberRoleEnum } from './organization.validators.js';

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const CreateInvitationSchema = z.object({
    email: z.string().email(),
    role: MemberRoleEnum,
    organizationId: z.string().uuid(),
    message: z.string().max(500).optional(),
});

export const ResendInvitationSchema = z.object({
    invitationId: z.string().uuid(),
});

export const AcceptInvitationSchema = z.object({
    token: z.string().min(1),
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    password: z.string().min(8),
});

// ==========================================
// TYPES
// ==========================================

export type CreateInvitationRequest = z.infer<typeof CreateInvitationSchema>;
export type ResendInvitationRequest = z.infer<typeof ResendInvitationSchema>;
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationSchema>;


