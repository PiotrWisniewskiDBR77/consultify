import { z } from 'zod';

/**
 * Schema for the payload to request access.
 */
export const RequestAccessPayloadSchema = z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
    organizationName: z.string(),
    requestType: z.string().optional(),
});

/**
 * Schema for the response of a successful access request.
 */
export const RequestAccessResponseSchema = z.object({
    success: z.boolean(),
    requestId: z.string(),
    message: z.string(),
});

/**
 * Schema for verifying an access code (public endpoint).
 */
export const VerifyAccessCodeResponseSchema = z.object({
    valid: z.boolean(),
    organizationName: z.string().optional(),
    role: z.string().optional(),
    reason: z.string().optional(),
});

/**
 * Schema for the payload to register with an access code.
 */
export const RegisterWithCodePayloadSchema = z.object({
    code: z.string(),
    email: z.string().email(),
    password: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
});

/**
 * Schema for the response of a successful registration.
 */
export const RegisterWithCodeResponseSchema = z.object({
    success: z.boolean(),
    user: z.object({
        id: z.string(),
        email: z.string().email(),
        firstName: z.string(),
        lastName: z.string(),
        // Additional user fields can be added as needed
    }),
    message: z.string(),
});

/**
 * Schema for an access request object (used by super admin).
 */
export const AccessRequestSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    organizationName: z.string(),
    status: z.string(),
    createdAt: z.string(),
    // other fields as defined by backend can be added
});

/**
 * Schema for an access code object (super admin).
 */
export const AccessCodeSchema = z.object({
    id: z.string(),
    code: z.string(),
    role: z.string().optional(),
    maxUses: z.number().optional(),
    expiresAt: z.string().optional(),
    isActive: z.boolean(),
});

/**
 * Schema for usage statistics by organization.
 */
export const UsageByOrgSchema = z.object({
    organizationId: z.string(),
    usage: z.record(z.string(), z.unknown()), // Adjust based on actual shape
});

/**
 * Export collection for easy import.
 */
export const AccessControlSchemas = {
    RequestAccessPayloadSchema,
    RequestAccessResponseSchema,
    VerifyAccessCodeResponseSchema,
    RegisterWithCodePayloadSchema,
    RegisterWithCodeResponseSchema,
    AccessRequestSchema,
    AccessCodeSchema,
    UsageByOrgSchema,
};
