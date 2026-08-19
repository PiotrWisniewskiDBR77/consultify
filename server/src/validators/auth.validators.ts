/**
 * Auth Route Validators
 * Zod schemas for request validation
 */

import { z } from 'zod';

// Login Request
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(1, 'Password is required').optional(),
  mfaToken: z.string().optional(),
  mfaChallenge: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  trustDevice: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.mfaChallenge && value.mfaToken) return;
  if (value.email && value.password) return;
  context.addIssue({ code: z.ZodIssueCode.custom, message: 'Credentials or MFA challenge required' });
});

// Register Demo Request (minimal: email + password for demo-only signup)
export const RegisterDemoRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  acceptedLegalDocs: z.array(z.string().toUpperCase()).optional(),
  legalConsentAt: z.string().optional(),
});

// Register Request
export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyName: z.string().optional(),
  accessCode: z.string().optional(),
  isDemo: z.boolean().optional(),
  promoCode: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_medium: z.string().optional(),
  partner_code: z.string().optional(),
  acceptedLegalDocs: z.array(z.string().toUpperCase()).optional(),
  legalConsentAt: z.string().optional(),
});

// Refresh Token Request
export const RefreshTokenRequestSchema = z.object({
  // Can be provided in body (legacy) OR via httpOnly cookie (preferred).
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

// Change Password Request
// F2 fix: the special-char regex here diverged from the actual frontend gate.
// PasswordSecuritySettings.tsx shows "special character" as a strength hint but its
// `isPasswordValid` (which enables the submit button) only checks minLength/upper/
// lower/number/match — hasSpecial is NOT required to submit. With the special-char
// regex enforced here, a user could pass the frontend gate and still get rejected by
// the backend. Dropped to match the real frontend requirement (min 8 + upper/lower/
// number). If special chars become mandatory again, gate them in isPasswordValid too.
export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// Reset Password Request
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// Forgot Password Request
export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// Verify Email Request
export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// MFA Setup Request
export const MFASetupRequestSchema = z.object({
  // No body required for setup
});

// MFA Enable Request
export const MFAEnableRequestSchema = z.object({
  token: z.string().min(1, 'MFA token is required'),
});

// MFA Disable Request
export const MFADisableRequestSchema = z.object({
  token: z.string().min(1, 'MFA token is required'),
});

// Revoke All Tokens Request
export const RevokeAllTokensRequestSchema = z.object({
  userId: z.string().uuid().optional(),
});

// Session ID Param
export const SessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
});

// Type exports
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterDemoRequest = z.infer<typeof RegisterDemoRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;
export type MFASetupRequest = z.infer<typeof MFASetupRequestSchema>;
export type MFAEnableRequest = z.infer<typeof MFAEnableRequestSchema>;
export type MFADisableRequest = z.infer<typeof MFADisableRequestSchema>;
export type RevokeAllTokensRequest = z.infer<typeof RevokeAllTokensRequestSchema>;
export type SessionIdParam = z.infer<typeof SessionIdParamSchema>;
