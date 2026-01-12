/**
 * Authentication Schemas
 * Enterprise SaaS Architecture - Auth Input Validation
 */

import { z } from 'zod';

// Password requirements (OWASP guidelines)
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Email with domain validation
const emailSchema = z.string().email('Invalid email address').max(255, 'Email too long').toLowerCase().trim();

// ==========================================
// LOGIN
// ==========================================

export const LoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ==========================================
// REGISTRATION
// ==========================================

export const RegisterSchema = z
    .object({
        firstName: z.string().min(1, 'First name is required').max(100),
        lastName: z.string().min(1, 'Last name is required').max(100),
        email: emailSchema,
        password: passwordSchema,
        confirmPassword: z.string(),
        companyName: z.string().min(1, 'Company name is required').max(255),
        industry: z.string().optional(),
        country: z.string().optional(),
        timezone: z.string().optional(),
        acceptTerms: z.boolean().refine((val) => val === true, 'You must accept the terms'),
        acceptPrivacy: z.boolean().refine((val) => val === true, 'You must accept the privacy policy'),
        marketingConsent: z.boolean().optional().default(false),
        referralCode: z.string().optional(),
        accessCode: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ==========================================
// PASSWORD RESET
// ==========================================

export const ForgotPasswordSchema = z.object({
    email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
    .object({
        token: z.string().min(1, 'Reset token is required'),
        password: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ==========================================
// CHANGE PASSWORD
// ==========================================

export const ChangePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: passwordSchema,
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: 'New password must be different from current password',
        path: ['newPassword'],
    });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ==========================================
// MFA
// ==========================================

export const MFAVerifySchema = z.object({
    code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
    trustDevice: z.boolean().optional().default(false),
});

export type MFAVerifyInput = z.infer<typeof MFAVerifySchema>;

// ==========================================
// ACCESS CODE
// ==========================================

export const AccessCodeSchema = z.object({
    code: z
        .string()
        .min(6, 'Access code must be at least 6 characters')
        .max(20, 'Access code too long')
        .regex(/^[A-Z0-9-]+$/i, 'Access code can only contain letters, numbers, and dashes'),
});

export type AccessCodeInput = z.infer<typeof AccessCodeSchema>;
