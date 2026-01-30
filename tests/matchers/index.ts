/**
 * Professional Custom Matchers & Assertions
 *
 * Enterprise-grade custom Vitest matchers for domain-specific assertions
 */
import { expect } from 'vitest';

// ============================================================================
// Custom Matcher Extensions
// ============================================================================

export interface CustomMatchers<R = unknown> {
    // Date matchers
    toBeWithinDays(days: number): R;
    toBeFutureDate(): R;
    toBePastDate(): R;
    toBeValidDate(): R;

    // Number matchers
    toBePositive(): R;
    toBeNegative(): R;
    toBePercentage(): R;
    toBeCurrency(expectedValue: number, tolerance?: number): R;

    // String matchers
    toBeValidEmail(): R;
    toBeValidUUID(): R;
    toBeValidSlug(): R;
    toContainNoWhitespace(): R;

    // Array matchers
    toBeNonEmpty(): R;
    toHaveUniqueItems(): R;
    toBeSortedBy<T>(key: keyof T, order?: 'asc' | 'desc'): R;

    // Object matchers
    toHaveRequiredFields(fields: string[]): R;
    toMatchStructure(structure: Record<string, string>): R;

    // API matchers
    toBeSuccessResponse(): R;
    toBeErrorResponse(status?: number): R;
    toPaginatedResponse(): R;

    // Domain matchers
    toBeValidUser(): R;
    toBeValidProject(): R;
    toBeValidTask(): R;
}

// ============================================================================
// Matcher Implementations
// ============================================================================

expect.extend({
    // ========== Date Matchers ==========

    toBeWithinDays(received: Date, days: number) {
        const now = new Date();
        const diff = Math.abs(received.getTime() - now.getTime());
        const diffDays = diff / (1000 * 60 * 60 * 24);
        const pass = diffDays <= days;

        return {
            pass,
            message: () =>
                pass
                    ? `Expected date not to be within ${days} days of now`
                    : `Expected date to be within ${days} days of now, but was ${diffDays.toFixed(1)} days`,
        };
    },

    toBeFutureDate(received: Date) {
        const pass = received > new Date();
        return {
            pass,
            message: () =>
                pass
                    ? `Expected ${received.toISOString()} not to be a future date`
                    : `Expected ${received.toISOString()} to be a future date`,
        };
    },

    toBePastDate(received: Date) {
        const pass = received < new Date();
        return {
            pass,
            message: () =>
                pass
                    ? `Expected ${received.toISOString()} not to be a past date`
                    : `Expected ${received.toISOString()} to be a past date`,
        };
    },

    toBeValidDate(received: unknown) {
        const date = received instanceof Date ? received : new Date(received as string);
        const pass = !isNaN(date.getTime());
        return {
            pass,
            message: () =>
                pass
                    ? `Expected ${received} not to be a valid date`
                    : `Expected ${received} to be a valid date`,
        };
    },

    // ========== Number Matchers ==========

    toBePositive(received: number) {
        const pass = received > 0;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected ${received} not to be positive`
                    : `Expected ${received} to be positive`,
        };
    },

    toBeNegative(received: number) {
        const pass = received < 0;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected ${received} not to be negative`
                    : `Expected ${received} to be negative`,
        };
    },

    toBePercentage(received: number) {
        const pass = received >= 0 && received <= 100;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected ${received} not to be a percentage (0-100)`
                    : `Expected ${received} to be a percentage (0-100)`,
        };
    },

    toBeCurrency(received: number, expectedValue: number, tolerance = 0.01) {
        const diff = Math.abs(received - expectedValue);
        const pass = diff <= tolerance;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected ${received} not to equal ${expectedValue} (±${tolerance})`
                    : `Expected ${received} to equal ${expectedValue} (±${tolerance}), diff was ${diff}`,
        };
    },

    // ========== String Matchers ==========

    toBeValidEmail(received: string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const pass = emailRegex.test(received);
        return {
            pass,
            message: () =>
                pass
                    ? `Expected "${received}" not to be a valid email`
                    : `Expected "${received}" to be a valid email`,
        };
    },

    toBeValidUUID(received: string) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const pass = uuidRegex.test(received);
        return {
            pass,
            message: () =>
                pass
                    ? `Expected "${received}" not to be a valid UUID`
                    : `Expected "${received}" to be a valid UUID`,
        };
    },

    toBeValidSlug(received: string) {
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        const pass = slugRegex.test(received);
        return {
            pass,
            message: () =>
                pass
                    ? `Expected "${received}" not to be a valid slug`
                    : `Expected "${received}" to be a valid slug (lowercase, alphanumeric, hyphens)`,
        };
    },

    toContainNoWhitespace(received: string) {
        const pass = !/\s/.test(received);
        return {
            pass,
            message: () =>
                pass
                    ? `Expected "${received}" to contain whitespace`
                    : `Expected "${received}" not to contain whitespace`,
        };
    },

    // ========== Array Matchers ==========

    toBeNonEmpty(received: unknown[]) {
        const pass = Array.isArray(received) && received.length > 0;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected array to be empty`
                    : `Expected array to be non-empty`,
        };
    },

    toHaveUniqueItems(received: unknown[]) {
        const uniqueCount = new Set(received).size;
        const pass = uniqueCount === received.length;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected array not to have unique items`
                    : `Expected array to have unique items, found ${received.length - uniqueCount} duplicates`,
        };
    },

    toBeSortedBy<T>(received: T[], key: keyof T, order: 'asc' | 'desc' = 'asc') {
        const sorted = [...received].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });

        const pass = JSON.stringify(received) === JSON.stringify(sorted);
        return {
            pass,
            message: () =>
                pass
                    ? `Expected array not to be sorted by ${String(key)} (${order})`
                    : `Expected array to be sorted by ${String(key)} (${order})`,
        };
    },

    // ========== Object Matchers ==========

    toHaveRequiredFields(received: Record<string, unknown>, fields: string[]) {
        const missingFields = fields.filter((f) => !(f in received));
        const pass = missingFields.length === 0;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected object not to have fields: ${fields.join(', ')}`
                    : `Expected object to have fields: ${missingFields.join(', ')}`,
        };
    },

    toMatchStructure(received: Record<string, unknown>, structure: Record<string, string>) {
        const errors: string[] = [];

        for (const [key, expectedType] of Object.entries(structure)) {
            if (!(key in received)) {
                errors.push(`Missing field: ${key}`);
                continue;
            }

            const actualType = typeof received[key];
            if (actualType !== expectedType) {
                errors.push(`Field ${key}: expected ${expectedType}, got ${actualType}`);
            }
        }

        const pass = errors.length === 0;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected object not to match structure`
                    : `Structure mismatch:\n${errors.join('\n')}`,
        };
    },

    // ========== API Response Matchers ==========

    toBeSuccessResponse(received: { status?: number; data?: unknown }) {
        const pass = received.status !== undefined && received.status >= 200 && received.status < 300;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected not to be a success response`
                    : `Expected success response (2xx), got ${received.status}`,
        };
    },

    toBeErrorResponse(received: { status?: number; error?: unknown }, expectedStatus?: number) {
        const isError = received.status !== undefined && received.status >= 400;
        const matchesStatus = expectedStatus === undefined || received.status === expectedStatus;
        const pass = isError && matchesStatus;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected not to be an error response`
                    : `Expected error response${expectedStatus ? ` (${expectedStatus})` : ''}, got ${received.status}`,
        };
    },

    toPaginatedResponse(received: { data?: { items?: unknown[]; pagination?: unknown } }) {
        const hasItems = Array.isArray(received.data?.items);
        const hasPagination = received.data?.pagination !== undefined;
        const pass = hasItems && hasPagination;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected not to be a paginated response`
                    : `Expected paginated response with items and pagination`,
        };
    },

    // ========== Domain Matchers ==========

    toBeValidUser(received: Record<string, unknown>) {
        const requiredFields = ['id', 'email', 'firstName', 'lastName', 'role', 'status'];
        const missingFields = requiredFields.filter((f) => !(f in received));
        const hasValidEmail = typeof received.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(received.email);
        const pass = missingFields.length === 0 && hasValidEmail;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected not to be a valid user`
                    : `Invalid user: ${missingFields.length > 0 ? `missing ${missingFields.join(', ')}` : 'invalid email'}`,
        };
    },

    toBeValidProject(received: Record<string, unknown>) {
        const requiredFields = ['id', 'name', 'status', 'organizationId'];
        const missingFields = requiredFields.filter((f) => !(f in received));
        const validStatuses = ['draft', 'active', 'on_hold', 'completed', 'archived'];
        const hasValidStatus = validStatuses.includes(received.status as string);
        const pass = missingFields.length === 0 && hasValidStatus;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected not to be a valid project`
                    : `Invalid project: ${missingFields.length > 0 ? `missing ${missingFields.join(', ')}` : 'invalid status'}`,
        };
    },

    toBeValidTask(received: Record<string, unknown>) {
        const requiredFields = ['id', 'title', 'status', 'projectId'];
        const missingFields = requiredFields.filter((f) => !(f in received));
        const validStatuses = ['todo', 'in_progress', 'review', 'done', 'blocked'];
        const hasValidStatus = validStatuses.includes(received.status as string);
        const pass = missingFields.length === 0 && hasValidStatus;
        return {
            pass,
            message: () =>
                pass
                    ? `Expected not to be a valid task`
                    : `Invalid task: ${missingFields.length > 0 ? `missing ${missingFields.join(', ')}` : 'invalid status'}`,
        };
    },
});

// ============================================================================
// Assertion Helpers
// ============================================================================

export function assertNever(value: never): never {
    throw new Error(`Unexpected value: ${value}`);
}

export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
    if (value === undefined || value === null) {
        throw new Error(message || 'Expected value to be defined');
    }
}

export function assertType<T>(value: unknown, check: (v: unknown) => v is T, message?: string): asserts value is T {
    if (!check(value)) {
        throw new Error(message || 'Type assertion failed');
    }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

export function isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
}

export function isArray<T>(value: unknown): value is T[] {
    return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Declare Module Augmentation
// ============================================================================

declare module 'vitest' {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Assertion<T = unknown> extends CustomMatchers<T> { }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface AsymmetricMatchersContaining extends CustomMatchers { }
}
