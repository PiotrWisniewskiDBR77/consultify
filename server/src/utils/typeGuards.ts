/**
 * Type Guards and Runtime Validation
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Type guards for database results, API responses, and external service responses
 */

import { z } from 'zod';

// ============================================================================
// DATABASE RESULT TYPE GUARDS
// ============================================================================

/**
 * Type guard for database row result
 */
export function isDatabaseRow(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for database rows array
 */
export function isDatabaseRows(value: unknown): value is Array<Record<string, unknown>> {
    return Array.isArray(value) && value.every(isDatabaseRow);
}

/**
 * Type guard for database run result
 */
export function isDatabaseRunResult(value: unknown): value is { lastID?: number; changes: number } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'changes' in value &&
        typeof (value as { changes: unknown }).changes === 'number'
    );
}

/**
 * Validate database row with Zod schema
 */
export function validateDatabaseRow<T>(row: unknown, schema: z.ZodSchema<T>): T {
    return schema.parse(row);
}

/**
 * Validate database rows array with Zod schema
 */
export function validateDatabaseRows<T>(rows: unknown, schema: z.ZodSchema<T>): T[] {
    if (!Array.isArray(rows)) {
        throw new Error('Expected array of database rows');
    }
    return rows.map(row => schema.parse(row));
}

// ============================================================================
// API RESPONSE TYPE GUARDS
// ============================================================================

/**
 * Type guard for successful API response
 */
export function isSuccessResponse(value: unknown): value is { success: true; data?: unknown } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'success' in value &&
        (value as { success: unknown }).success === true
    );
}

/**
 * Type guard for error API response
 */
export function isErrorResponse(value: unknown): value is { success: false; error: string; code?: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'success' in value &&
        (value as { success: unknown }).success === false &&
        'error' in value &&
        typeof (value as { error: unknown }).error === 'string'
    );
}

/**
 * Type guard for paginated API response
 */
export function isPaginatedResponse<T>(value: unknown): value is {
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
} {
    return (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        Array.isArray((value as { data: unknown }).data) &&
        'pagination' in value &&
        typeof (value as { pagination: unknown }).pagination === 'object'
    );
}

/**
 * Validate API response with Zod schema
 */
export function validateApiResponse<T>(response: unknown, schema: z.ZodSchema<T>): T {
    return schema.parse(response);
}

// ============================================================================
// EXTERNAL SERVICE RESPONSE TYPE GUARDS
// ============================================================================

/**
 * Type guard for Stripe API response
 */
export function isStripeResponse(value: unknown): value is {
    id: string;
    object: string;
    [key: string]: unknown;
} {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        typeof (value as { id: unknown }).id === 'string' &&
        'object' in value &&
        typeof (value as { object: unknown }).object === 'string'
    );
}

/**
 * Type guard for OpenAI API response
 */
export function isOpenAIResponse(value: unknown): value is {
    choices: Array<{
        message?: { role: string; content: string };
        text?: string;
        [key: string]: unknown;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    [key: string]: unknown;
} {
    return (
        typeof value === 'object' &&
        value !== null &&
        'choices' in value &&
        Array.isArray((value as { choices: unknown }).choices)
    );
}

/**
 * Type guard for email service response
 */
export function isEmailServiceResponse(value: unknown): value is {
    success: boolean;
    messageId?: string;
    error?: string;
} {
    return (
        typeof value === 'object' &&
        value !== null &&
        'success' in value &&
        typeof (value as { success: unknown }).success === 'boolean'
    );
}

/**
 * Validate external service response with Zod schema
 */
export function validateExternalServiceResponse<T>(response: unknown, schema: z.ZodSchema<T>): T {
    return schema.parse(response);
}

// ============================================================================
// COMMON TYPE GUARDS
// ============================================================================

/**
 * Type guard for string
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * Type guard for number
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for boolean
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/**
 * Type guard for array
 */
export function isArray<T>(value: unknown): value is T[] {
    return Array.isArray(value);
}

/**
 * Type guard for object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for non-null value
 */
export function isNotNull<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * Type guard for UUID string
 */
export function isUUID(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Type guard for email string
 */
export function isEmail(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

/**
 * Type guard for ISO date string
 */
export function isISODateString(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime()) && value === date.toISOString();
}

// ============================================================================
// ZOD SCHEMAS FOR COMMON TYPES
// ============================================================================

/**
 * Zod schema for UUID
 */
export const UUIDSchema = z.string().uuid();

/**
 * Zod schema for email
 */
export const EmailSchema = z.string().email();

/**
 * Zod schema for ISO date string
 */
export const ISODateSchema = z.string().datetime();

/**
 * Zod schema for pagination parameters
 */
export const PaginationSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
});

/**
 * Zod schema for database row (generic)
 */
export const DatabaseRowSchema = z.record(z.unknown());

/**
 * Zod schema for database rows array (generic)
 */
export const DatabaseRowsSchema = z.array(DatabaseRowSchema);

/**
 * Zod schema for database run result
 */
export const DatabaseRunResultSchema = z.object({
    lastID: z.number().optional(),
    changes: z.number().int().nonnegative(),
});

/**
 * Zod schema for API error response
 */
export const ApiErrorResponseSchema = z.object({
    success: z.literal(false),
    error: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
});

/**
 * Zod schema for API success response
 */
export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.literal(true),
        data: dataSchema.optional(),
    });

/**
 * Zod schema for paginated response
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        pagination: z.object({
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().nonnegative(),
            totalPages: z.number().int().nonnegative(),
        }),
    });



