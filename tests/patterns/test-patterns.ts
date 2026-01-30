/**
 * Professional Test Patterns & Best Practices
 *
 * Reusable test patterns for common scenarios
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Test Suite Patterns
// ============================================================================

/**
 * Pattern: CRUD Operations Test Suite
 */
export function describeCrudOperations<T extends { id: string }>(
    name: string,
    options: {
        create: () => Promise<T>;
        read: (id: string) => Promise<T | null>;
        update: (id: string, data: Partial<T>) => Promise<T>;
        delete: (id: string) => Promise<void>;
        list: () => Promise<T[]>;
    }
): void {
    describe(`${name} CRUD Operations`, () => {
        let createdItem: T;

        beforeEach(async () => {
            createdItem = await options.create();
        });

        afterEach(async () => {
            try {
                await options.delete(createdItem.id);
            } catch {
                // Item may already be deleted
            }
        });

        it('should create item', async () => {
            expect(createdItem).toBeDefined();
            expect(createdItem.id).toBeTruthy();
        });

        it('should read item by id', async () => {
            const item = await options.read(createdItem.id);
            expect(item).toBeDefined();
            expect(item?.id).toBe(createdItem.id);
        });

        it('should return null for non-existent id', async () => {
            const item = await options.read('non-existent-id');
            expect(item).toBeNull();
        });

        it('should update item', async () => {
            const updates = {} as Partial<T>;
            const updated = await options.update(createdItem.id, updates);
            expect(updated.id).toBe(createdItem.id);
        });

        it('should delete item', async () => {
            await options.delete(createdItem.id);
            const item = await options.read(createdItem.id);
            expect(item).toBeNull();
        });

        it('should list items', async () => {
            const items = await options.list();
            expect(Array.isArray(items)).toBe(true);
            expect(items.some((i) => i.id === createdItem.id)).toBe(true);
        });
    });
}

/**
 * Pattern: Validation Test Suite
 */
export function describeValidation<T>(
    name: string,
    options: {
        validate: (data: T) => { valid: boolean; errors?: string[] };
        validCases: { name: string; data: T }[];
        invalidCases: { name: string; data: T; expectedErrors: string[] }[];
    }
): void {
    describe(`${name} Validation`, () => {
        describe('valid cases', () => {
            for (const { name: caseName, data } of options.validCases) {
                it(`should accept: ${caseName}`, () => {
                    const result = options.validate(data);
                    expect(result.valid).toBe(true);
                    expect(result.errors || []).toHaveLength(0);
                });
            }
        });

        describe('invalid cases', () => {
            for (const { name: caseName, data, expectedErrors } of options.invalidCases) {
                it(`should reject: ${caseName}`, () => {
                    const result = options.validate(data);
                    expect(result.valid).toBe(false);
                    for (const error of expectedErrors) {
                        expect(result.errors).toContain(error);
                    }
                });
            }
        });
    });
}

/**
 * Pattern: Async Service Test Suite
 */
export function describeAsyncService<T>(
    name: string,
    options: {
        getInstance: () => T;
        methods: {
            name: string;
            call: (instance: T) => Promise<unknown>;
            expectedResult?: unknown;
            shouldThrow?: boolean;
            errorMessage?: string;
        }[];
    }
): void {
    describe(`${name} Service`, () => {
        let instance: T;

        beforeEach(() => {
            instance = options.getInstance();
        });

        for (const method of options.methods) {
            if (method.shouldThrow) {
                it(`${method.name} should throw`, async () => {
                    await expect(method.call(instance)).rejects.toThrow(method.errorMessage);
                });
            } else {
                it(`${method.name} should succeed`, async () => {
                    const result = await method.call(instance);
                    if (method.expectedResult !== undefined) {
                        expect(result).toEqual(method.expectedResult);
                    }
                });
            }
        }
    });
}

// ============================================================================
// Test Decorators
// ============================================================================

/**
 * Skip test in certain environments
 */
export function skipIf(condition: boolean, reason: string) {
    return (
        fn: () => void | Promise<void>
    ): (() => void | Promise<void>) | undefined => {
        if (condition) {
            return undefined; // Test will be skipped
        }
        return fn;
    };
}

/**
 * Run test only in certain environments
 */
export function onlyIf(condition: boolean) {
    return (fn: () => void | Promise<void>): (() => void | Promise<void>) | undefined => {
        if (!condition) {
            return undefined;
        }
        return fn;
    };
}

// ============================================================================
// Test Data Patterns
// ============================================================================

/**
 * Pattern: Generate boundary test cases
 */
export function generateBoundaryCases<T>(
    options: {
        min?: T;
        max?: T;
        belowMin?: T;
        aboveMax?: T;
        typical?: T;
    }
): { name: string; value: T; shouldPass: boolean }[] {
    const cases: { name: string; value: T; shouldPass: boolean }[] = [];

    if (options.min !== undefined) {
        cases.push({ name: 'minimum value', value: options.min, shouldPass: true });
    }
    if (options.max !== undefined) {
        cases.push({ name: 'maximum value', value: options.max, shouldPass: true });
    }
    if (options.belowMin !== undefined) {
        cases.push({ name: 'below minimum', value: options.belowMin, shouldPass: false });
    }
    if (options.aboveMax !== undefined) {
        cases.push({ name: 'above maximum', value: options.aboveMax, shouldPass: false });
    }
    if (options.typical !== undefined) {
        cases.push({ name: 'typical value', value: options.typical, shouldPass: true });
    }

    return cases;
}

/**
 * Pattern: Generate edge cases for strings
 */
export function generateStringEdgeCases(): { name: string; value: string }[] {
    return [
        { name: 'empty string', value: '' },
        { name: 'single character', value: 'a' },
        { name: 'whitespace only', value: '   ' },
        { name: 'with leading whitespace', value: '  test' },
        { name: 'with trailing whitespace', value: 'test  ' },
        { name: 'with special characters', value: 'test!@#$%' },
        { name: 'with unicode', value: 'test🎉' },
        { name: 'with newlines', value: 'test\nvalue' },
        { name: 'very long string', value: 'a'.repeat(1000) },
        { name: 'with HTML', value: '<script>alert("xss")</script>' },
        { name: 'with SQL injection attempt', value: "'; DROP TABLE users; --" },
    ];
}

/**
 * Pattern: Generate date edge cases
 */
export function generateDateEdgeCases(): { name: string; value: Date }[] {
    const now = new Date();
    return [
        { name: 'now', value: now },
        { name: 'yesterday', value: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        { name: 'tomorrow', value: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        { name: 'year ago', value: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) },
        { name: 'year from now', value: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) },
        { name: 'start of day', value: new Date(now.setHours(0, 0, 0, 0)) },
        { name: 'end of day', value: new Date(now.setHours(23, 59, 59, 999)) },
        { name: 'leap year date', value: new Date('2024-02-29') },
        { name: 'DST transition', value: new Date('2024-03-10T02:30:00') },
    ];
}

// ============================================================================
// Assertion Patterns
// ============================================================================

/**
 * Pattern: Assert array contains expected items
 */
export function assertArrayContains<T>(
    actual: T[],
    expected: T[],
    comparator?: (a: T, b: T) => boolean
): void {
    const compare = comparator || ((a, b) => JSON.stringify(a) === JSON.stringify(b));

    for (const expectedItem of expected) {
        const found = actual.some((actualItem) => compare(actualItem, expectedItem));
        if (!found) {
            throw new Error(
                `Expected array to contain: ${JSON.stringify(expectedItem)}\nActual: ${JSON.stringify(actual)}`
            );
        }
    }
}

/**
 * Pattern: Assert object shape
 */
export function assertShape<T extends object>(
    obj: unknown,
    shape: { [K in keyof T]: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function' | 'any' }
): asserts obj is T {
    if (typeof obj !== 'object' || obj === null) {
        throw new Error('Expected an object');
    }

    for (const [key, expectedType] of Object.entries(shape)) {
        const value = (obj as Record<string, unknown>)[key];

        if (expectedType === 'any') continue;

        if (expectedType === 'array') {
            if (!Array.isArray(value)) {
                throw new Error(`Expected ${key} to be an array`);
            }
        } else if (typeof value !== expectedType) {
            throw new Error(`Expected ${key} to be ${expectedType}, got ${typeof value}`);
        }
    }
}

/**
 * Pattern: Assert eventual consistency
 */
export async function assertEventually(
    assertion: () => void | Promise<void>,
    options: { timeout?: number; interval?: number } = {}
): Promise<void> {
    const { timeout = 5000, interval = 100 } = options;
    const startTime = Date.now();
    let lastError: Error | undefined;

    while (Date.now() - startTime < timeout) {
        try {
            await assertion();
            return;
        } catch (error) {
            lastError = error as Error;
            await new Promise((r) => setTimeout(r, interval));
        }
    }

    throw lastError || new Error('Assertion never passed');
}

// ============================================================================
// Mock Patterns
// ============================================================================

/**
 * Pattern: Create spy with implementation
 */
export function createSpyWithImpl<T extends (...args: unknown[]) => unknown>(
    impl: T
): ReturnType<typeof vi.fn<T>> & { impl: T } {
    const spy = vi.fn(impl) as ReturnType<typeof vi.fn<T>> & { impl: T };
    spy.impl = impl;
    return spy;
}

/**
 * Pattern: Create sequence mock
 */
export function createSequenceMock<T>(values: T[]): () => T {
    let index = 0;
    return () => {
        const value = values[index % values.length];
        index++;
        return value;
    };
}

/**
 * Pattern: Create conditional mock
 */
export function createConditionalMock<A extends unknown[], R>(
    conditions: { when: (...args: A) => boolean; then: R }[],
    defaultValue: R
): (...args: A) => R {
    return (...args: A) => {
        for (const { when, then } of conditions) {
            if (when(...args)) {
                return then;
            }
        }
        return defaultValue;
    };
}
