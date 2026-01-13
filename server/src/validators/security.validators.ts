/**
 * Security Validators
 * Enterprise SaaS Architecture - Security Hardening
 *
 * Centralized Zod schemas for security-critical operations
 */

import { z } from 'zod';

// ==========================================
// UUID VALIDATION
// ==========================================

/**
 * UUID v4 schema with custom error messages
 */
export const UUIDSchema = z.string().uuid({
  message: 'Invalid UUID format',
});

/**
 * Optional UUID schema
 */
export const OptionalUUIDSchema = UUIDSchema.optional().nullable();

// ==========================================
// EMAIL VALIDATION
// ==========================================

/**
 * Email schema with strict validation
 */
export const EmailSchema = z
  .string()
  .email({
    message: 'Invalid email format',
  })
  .max(320, 'Email too long');

/**
 * Normalized email (lowercase, trimmed)
 */
export const NormalizedEmailSchema = z
  .string()
  .email()
  .transform((email) => email.toLowerCase().trim());

// ==========================================
// PASSWORD VALIDATION
// ==========================================

/**
 * Password complexity requirements
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Basic password (for login - no complexity check)
 */
export const LoginPasswordSchema = z.string().min(1, 'Password is required');

// ==========================================
// INPUT SANITIZATION SCHEMAS
// ==========================================

/**
 * Safe string - no HTML, max length
 */
export const SafeStringSchema = z
  .string()
  .max(10000, 'String too long')
  .transform((s) => s.trim())
  .transform((s) => s.replace(/[<>]/g, '')); // Basic XSS prevention

/**
 * Safe name (alphanumeric, spaces, basic punctuation)
 */
export const SafeNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name too long')
  .regex(/^[a-zA-Z0-9\s\-_.,'()]+$/, 'Invalid characters in name');

/**
 * Safe title
 */
export const SafeTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(500, 'Title too long')
  .transform((s) => s.trim());

/**
 * Safe description (allows more characters)
 */
export const SafeDescriptionSchema = z
  .string()
  .max(50000, 'Description too long')
  .transform((s) => s.trim())
  .optional()
  .nullable();

// ==========================================
// URL & PATH VALIDATION
// ==========================================

/**
 * Safe URL (http/https only)
 */
export const SafeURLSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'Only HTTP and HTTPS URLs are allowed' }
  );

/**
 * Safe filename (no path traversal)
 */
export const SafeFilenameSchema = z
  .string()
  .max(255, 'Filename too long')
  .refine((name) => !name.includes('..') && !name.includes('/') && !name.includes('\\'), {
    message: 'Invalid filename',
  });

// ==========================================
// NUMERIC VALIDATION
// ==========================================

/**
 * Positive integer
 */
export const PositiveIntSchema = z.coerce
  .number()
  .int('Must be an integer')
  .positive('Must be positive');

/**
 * Non-negative integer (0 or more)
 */
export const NonNegativeIntSchema = z.coerce
  .number()
  .int('Must be an integer')
  .min(0, 'Must be non-negative');

/**
 * Pagination page number
 */
export const PageNumberSchema = z.coerce
  .number()
  .int()
  .min(1, 'Page must be at least 1')
  .default(1);

/**
 * Pagination limit
 */
export const PageLimitSchema = z.coerce
  .number()
  .int()
  .min(1, 'Limit must be at least 1')
  .max(1000, 'Limit cannot exceed 1000')
  .default(50);

// ==========================================
// DATE VALIDATION
// ==========================================

/**
 * ISO date string
 */
export const ISODateSchema = z.string().datetime({
  message: 'Invalid date format. Use ISO 8601 format.',
});

/**
 * Optional ISO date
 */
export const OptionalISODateSchema = ISODateSchema.optional().nullable();

/**
 * Date range schema
 */
export const DateRangeSchema = z
  .object({
    startDate: ISODateSchema,
    endDate: ISODateSchema,
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'Start date must be before or equal to end date',
  });

// ==========================================
// COMMON REQUEST SCHEMAS
// ==========================================

/**
 * Standard ID parameter schema
 */
export const IdParamSchema = z.object({
  id: UUIDSchema,
});

/**
 * Standard pagination query schema
 */
export const PaginationQuerySchema = z.object({
  page: PageNumberSchema.optional(),
  limit: PageLimitSchema.optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Standard search query schema
 */
export const SearchQuerySchema = PaginationQuerySchema.extend({
  q: z.string().max(500).optional(),
  search: z.string().max(500).optional(),
});

// ==========================================
// SECURITY-SPECIFIC SCHEMAS
// ==========================================

/**
 * API Key format
 */
export const ApiKeySchema = z.string().min(32, 'API key too short').max(256, 'API key too long');

/**
 * JWT Token format (basic validation)
 */
export const JWTTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, 'Invalid JWT format');

/**
 * CSRF Token schema
 */
export const CSRFTokenSchema = z.string().length(64, 'Invalid CSRF token'); // 32 bytes = 64 hex chars

/**
 * IP Address schema
 */
export const IPAddressSchema = z
  .string()
  .regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$/, {
    message: 'Invalid IP address',
  });

// ==========================================
// COMMON ENUMS
// ==========================================

/**
 * Standard status enum
 */
export const StatusEnum = z.enum(['active', 'inactive', 'pending', 'deleted', 'archived']);

/**
 * Priority enum
 */
export const PriorityEnum = z.enum(['low', 'medium', 'high', 'urgent', 'critical']);

/**
 * User role enum
 */
export const UserRoleEnum = z.enum(['user', 'admin', 'super_admin', 'owner', 'viewer', 'editor']);

// ==========================================
// TYPE EXPORTS
// ==========================================

export type UUID = z.infer<typeof UUIDSchema>;
export type Email = z.infer<typeof EmailSchema>;
export type SafeString = z.infer<typeof SafeStringSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
