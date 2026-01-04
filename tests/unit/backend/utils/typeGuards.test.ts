/**
 * Type Guards Tests
 *
 * Tests for runtime type checking, database result validation, and API response validation.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Import type guards - using dynamic import for ESM
let typeGuards: any;

describe('Type Guards', () => {
    beforeAll(async () => {
        // Dynamic import for ESM compatibility
        const module = await import('../../../../server/src/utils/typeGuards.ts');
        typeGuards = module;
    });

    describe('Database Result Type Guards', () => {
        describe('isDatabaseRow()', () => {
            it('should return true for valid database row objects', () => {
                const validRow = { id: 1, name: 'test', created_at: '2024-01-01' };
                expect(typeGuards.isDatabaseRow(validRow)).toBe(true);
            });

            it('should return false for arrays', () => {
                const array = [{ id: 1 }];
                expect(typeGuards.isDatabaseRow(array)).toBe(false);
            });

            it('should return false for primitives', () => {
                expect(typeGuards.isDatabaseRow('string')).toBe(false);
                expect(typeGuards.isDatabaseRow(123)).toBe(false);
                expect(typeGuards.isDatabaseRow(null)).toBe(false);
                expect(typeGuards.isDatabaseRow(undefined)).toBe(false);
            });

            it('should return false for functions and symbols', () => {
                expect(typeGuards.isDatabaseRow(() => {})).toBe(false);
                expect(typeGuards.isDatabaseRow(Symbol('test'))).toBe(false);
            });
        });

        describe('isDatabaseRows()', () => {
            it('should return true for arrays of valid database rows', () => {
                const validRows = [
                    { id: 1, name: 'test1' },
                    { id: 2, name: 'test2' }
                ];
                expect(typeGuards.isDatabaseRows(validRows)).toBe(true);
            });

            it('should return false for arrays containing non-objects', () => {
                const invalidRows = [{ id: 1 }, 'string', 123];
                expect(typeGuards.isDatabaseRows(invalidRows)).toBe(false);
            });

            it('should return false for non-arrays', () => {
                expect(typeGuards.isDatabaseRows({})).toBe(false);
                expect(typeGuards.isDatabaseRows('string')).toBe(false);
                expect(typeGuards.isDatabaseRows(null)).toBe(false);
            });

            it('should return false for empty arrays', () => {
                expect(typeGuards.isDatabaseRows([])).toBe(true); // Empty array is valid
            });
        });

        describe('isDatabaseRunResult()', () => {
            it('should return true for valid run results with changes', () => {
                const validResult = { changes: 5, lastID: 123 };
                expect(typeGuards.isDatabaseRunResult(validResult)).toBe(true);
            });

            it('should return true for run results without lastID', () => {
                const validResult = { changes: 0 };
                expect(typeGuards.isDatabaseRunResult(validResult)).toBe(true);
            });

            it('should return false for objects without changes property', () => {
                const invalidResult = { lastID: 123 };
                expect(typeGuards.isDatabaseRunResult(invalidResult)).toBe(false);
            });

            it('should return false for non-numeric changes', () => {
                const invalidResult = { changes: '5' };
                expect(typeGuards.isDatabaseRunResult(invalidResult)).toBe(false);
            });

            it('should return false for non-objects', () => {
                expect(typeGuards.isDatabaseRunResult(null)).toBe(false);
                expect(typeGuards.isDatabaseRunResult('string')).toBe(false);
                expect(typeGuards.isDatabaseRunResult(123)).toBe(false);
            });
        });

        describe('validateDatabaseRow()', () => {
            const userSchema = z.object({
                id: z.number(),
                name: z.string(),
                email: z.string().email(),
                created_at: z.string().optional()
            });

            it('should validate and return parsed row for valid data', () => {
                const validRow = {
                    id: 1,
                    name: 'John Doe',
                    email: 'john@example.com',
                    created_at: '2024-01-01'
                };

                const result = typeGuards.validateDatabaseRow(validRow, userSchema);
                expect(result).toEqual(validRow);
                expect(typeof result.id).toBe('number');
            });

            it('should throw error for invalid data', () => {
                const invalidRow = {
                    id: 'not-a-number',
                    name: 'John Doe',
                    email: 'invalid-email'
                };

                expect(() => {
                    typeGuards.validateDatabaseRow(invalidRow, userSchema);
                }).toThrow();
            });

            it('should handle missing optional fields', () => {
                const rowWithoutOptional = {
                    id: 1,
                    name: 'John Doe',
                    email: 'john@example.com'
                };

                const result = typeGuards.validateDatabaseRow(rowWithoutOptional, userSchema);
                expect(result.created_at).toBeUndefined();
            });
        });

        describe('validateDatabaseRows()', () => {
            const userSchema = z.object({
                id: z.number(),
                name: z.string()
            });

            it('should validate and return array of parsed rows', () => {
                const validRows = [
                    { id: 1, name: 'User 1' },
                    { id: 2, name: 'User 2' }
                ];

                const result = typeGuards.validateDatabaseRows(validRows, userSchema);
                expect(result).toHaveLength(2);
                expect(result[0].id).toBe(1);
                expect(result[1].name).toBe('User 2');
            });

            it('should throw error for non-array input', () => {
                expect(() => {
                    typeGuards.validateDatabaseRows({}, userSchema);
                }).toThrow('Expected array of database rows');
            });

            it('should throw error when any row is invalid', () => {
                const rowsWithInvalid = [
                    { id: 1, name: 'Valid User' },
                    { id: 'invalid', name: 'Invalid User' }
                ];

                expect(() => {
                    typeGuards.validateDatabaseRows(rowsWithInvalid, userSchema);
                }).toThrow();
            });
        });
    });

    describe('API Response Type Guards', () => {
        describe('isSuccessResponse()', () => {
            it('should return true for valid success responses', () => {
                const successResponse = { success: true, data: { id: 1 } };
                expect(typeGuards.isSuccessResponse(successResponse)).toBe(true);
            });

            it('should return true for success responses without data', () => {
                const successResponse = { success: true };
                expect(typeGuards.isSuccessResponse(successResponse)).toBe(true);
            });

            it('should return false for responses with success: false', () => {
                const errorResponse = { success: false, error: 'Something went wrong' };
                expect(typeGuards.isSuccessResponse(errorResponse)).toBe(false);
            });

            it('should return false for objects without success property', () => {
                const invalidResponse = { data: { id: 1 } };
                expect(typeGuards.isSuccessResponse(invalidResponse)).toBe(false);
            });

            it('should return false for non-objects', () => {
                expect(typeGuards.isSuccessResponse('string')).toBe(false);
                expect(typeGuards.isSuccessResponse(null)).toBe(false);
            });
        });

        describe('isErrorResponse()', () => {
            it('should return true for valid error responses', () => {
                const errorResponse = {
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR'
                };
                expect(typeGuards.isErrorResponse(errorResponse)).toBe(true);
            });

            it('should return true for error responses without code', () => {
                const errorResponse = { success: false, error: 'Server error' };
                expect(typeGuards.isErrorResponse(errorResponse)).toBe(true);
            });

            it('should return false for responses with success: true', () => {
                const successResponse = { success: true, data: {} };
                expect(typeGuards.isErrorResponse(successResponse)).toBe(false);
            });

            it('should return false for error responses with non-string error', () => {
                const invalidErrorResponse = { success: false, error: 123 };
                expect(typeGuards.isErrorResponse(invalidErrorResponse)).toBe(false);
            });
        });

        describe('isPaginatedResponse()', () => {
            it('should return true for valid paginated responses', () => {
                const paginatedResponse = {
                    data: [{ id: 1 }, { id: 2 }],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 25,
                        totalPages: 3
                    }
                };
                expect(typeGuards.isPaginatedResponse(paginatedResponse)).toBe(true);
            });

            it('should return false for responses without data array', () => {
                const invalidResponse = {
                    pagination: { page: 1, pageSize: 10, total: 25, totalPages: 3 }
                };
                expect(typeGuards.isPaginatedResponse(invalidResponse)).toBe(false);
            });

            it('should return false for responses with incomplete pagination', () => {
                const invalidResponse = {
                    data: [{ id: 1 }],
                    pagination: { page: 1, total: 25 } // missing pageSize, totalPages
                };
                expect(typeGuards.isPaginatedResponse(invalidResponse)).toBe(false);
            });

            it('should return false for non-objects', () => {
                expect(typeGuards.isPaginatedResponse(null)).toBe(false);
                expect(typeGuards.isPaginatedResponse([])).toBe(false);
            });
        });
    });

    describe('External Service Response Guards', () => {
        describe('isValidExternalServiceResponse()', () => {
            it('should return true for valid external responses', () => {
                const validResponse = {
                    status: 'success',
                    data: { result: 'ok' },
                    timestamp: '2024-01-01T12:00:00Z'
                };
                expect(typeGuards.isValidExternalServiceResponse(validResponse)).toBe(true);
            });

            it('should return false for responses without required fields', () => {
                const invalidResponse = { data: { result: 'ok' } };
                expect(typeGuards.isValidExternalServiceResponse(invalidResponse)).toBe(false);
            });

            it('should return false for error status responses', () => {
                const errorResponse = {
                    status: 'error',
                    error: 'Service unavailable',
                    timestamp: '2024-01-01T12:00:00Z'
                };
                expect(typeGuards.isValidExternalServiceResponse(errorResponse)).toBe(false);
            });
        });

        describe('isExternalServiceError()', () => {
            it('should return true for valid external error responses', () => {
                const errorResponse = {
                    status: 'error',
                    error: 'Rate limit exceeded',
                    code: 'RATE_LIMIT',
                    timestamp: '2024-01-01T12:00:00Z'
                };
                expect(typeGuards.isExternalServiceError(errorResponse)).toBe(true);
            });

            it('should return false for success responses', () => {
                const successResponse = {
                    status: 'success',
                    data: {},
                    timestamp: '2024-01-01T12:00:00Z'
                };
                expect(typeGuards.isExternalServiceError(successResponse)).toBe(false);
            });
        });
    });

    describe('Utility Functions', () => {
        describe('safeJsonParse()', () => {
            it('should parse valid JSON strings', () => {
                const jsonString = '{"name": "test", "value": 123}';
                const result = typeGuards.safeJsonParse(jsonString);
                expect(result).toEqual({ name: 'test', value: 123 });
            });

            it('should return fallback for invalid JSON', () => {
                const invalidJson = '{"name": "test", invalid}';
                const result = typeGuards.safeJsonParse(invalidJson, { default: true });
                expect(result).toEqual({ default: true });
            });

            it('should return null as default fallback', () => {
                const invalidJson = 'not json';
                const result = typeGuards.safeJsonParse(invalidJson);
                expect(result).toBeNull();
            });
        });

        describe('isNonEmptyString()', () => {
            it('should return true for non-empty strings', () => {
                expect(typeGuards.isNonEmptyString('hello')).toBe(true);
                expect(typeGuards.isNonEmptyString(' ')).toBe(true); // space is non-empty
            });

            it('should return false for empty strings', () => {
                expect(typeGuards.isNonEmptyString('')).toBe(false);
            });

            it('should return false for non-strings', () => {
                expect(typeGuards.isNonEmptyString(null)).toBe(false);
                expect(typeGuards.isNonEmptyString(undefined)).toBe(false);
                expect(typeGuards.isNonEmptyString(123)).toBe(false);
                expect(typeGuards.isNonEmptyString({})).toBe(false);
            });
        });

        describe('isEmail()', () => {
            it('should return true for valid email addresses', () => {
                expect(typeGuards.isEmail('user@example.com')).toBe(true);
                expect(typeGuards.isEmail('test.email+tag@domain.co.uk')).toBe(true);
            });

            it('should return false for invalid email addresses', () => {
                expect(typeGuards.isEmail('invalid-email')).toBe(false);
                expect(typeGuards.isEmail('@example.com')).toBe(false);
                expect(typeGuards.isEmail('user@')).toBe(false);
            });

            it('should return false for non-strings', () => {
                expect(typeGuards.isEmail(null)).toBe(false);
                expect(typeGuards.isEmail(123)).toBe(false);
            });
        });

        describe('isUUID()', () => {
            it('should return true for valid UUIDs', () => {
                const validUUID = '123e4567-e89b-12d3-a456-426614174000';
                expect(typeGuards.isUUID(validUUID)).toBe(true);
            });

            it('should return false for invalid UUIDs', () => {
                expect(typeGuards.isUUID('not-a-uuid')).toBe(false);
                expect(typeGuards.isUUID('123-456-789')).toBe(false);
            });

            it('should return false for non-strings', () => {
                expect(typeGuards.isUUID(null)).toBe(false);
                expect(typeGuards.isUUID(123)).toBe(false);
            });
        });
    });

    describe('Integration with Zod', () => {
        it('should work seamlessly with Zod schemas for complex validation', () => {
            const complexSchema = z.object({
                user: z.object({
                    id: z.number(),
                    email: z.string().email(),
                    profile: z.object({
                        firstName: z.string(),
                        lastName: z.string()
                    }).optional()
                }),
                metadata: z.record(z.unknown())
            });

            const validData = {
                user: {
                    id: 123,
                    email: 'user@example.com',
                    profile: {
                        firstName: 'John',
                        lastName: 'Doe'
                    }
                },
                metadata: {
                    source: 'api',
                    version: '1.0'
                }
            };

            // First check if it's a valid database row
            expect(typeGuards.isDatabaseRow(validData)).toBe(true);

            // Then validate with schema
            const result = typeGuards.validateDatabaseRow(validData, complexSchema);
            expect(result.user.id).toBe(123);
            expect(result.metadata.source).toBe('api');
        });

        it('should handle schema validation errors gracefully', () => {
            const userSchema = z.object({
                id: z.number(),
                email: z.string().email().endsWith('@company.com')
            });

            const invalidData = {
                id: 'not-a-number',
                email: 'user@gmail.com' // wrong domain
            };

            expect(() => {
                typeGuards.validateDatabaseRow(invalidData, userSchema);
            }).toThrow();
        });
    });
});
