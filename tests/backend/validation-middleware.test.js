/**
 * Backend Validation Middleware Tests
 * Tests for request validation middleware
 * 
 * @module tests/backend/validation-middleware.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create validation middleware
const createValidationMiddleware = () => {
    const validate = (schema) => (req, res, next) => {
        const errors = [];

        // Validate body
        if (schema.body) {
            const bodyErrors = validateObject(req.body || {}, schema.body, 'body');
            errors.push(...bodyErrors);
        }

        // Validate query
        if (schema.query) {
            const queryErrors = validateObject(req.query || {}, schema.query, 'query');
            errors.push(...queryErrors);
        }

        // Validate params
        if (schema.params) {
            const paramsErrors = validateObject(req.params || {}, schema.params, 'params');
            errors.push(...paramsErrors);
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors,
            });
        }

        next();
    };

    const validateObject = (obj, schema, location) => {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = obj[field];

            // Required check
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push({
                    field,
                    location,
                    message: `${field} is required`,
                });
                continue;
            }

            // Skip further validation if not present and not required
            if (value === undefined || value === null) {
                continue;
            }

            // Type check
            if (rules.type) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== rules.type) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must be of type ${rules.type}`,
                    });
                }
            }

            // String validations
            if (typeof value === 'string') {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must be at least ${rules.minLength} characters`,
                    });
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must be at most ${rules.maxLength} characters`,
                    });
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push({
                        field,
                        location,
                        message: `${field} has invalid format`,
                    });
                }
                if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must be a valid email`,
                    });
                }
            }

            // Number validations
            if (typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must be at least ${rules.min}`,
                    });
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must be at most ${rules.max}`,
                    });
                }
            }

            // Enum check
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push({
                    field,
                    location,
                    message: `${field} must be one of: ${rules.enum.join(', ')}`,
                });
            }

            // Array validations
            if (Array.isArray(value)) {
                if (rules.minItems && value.length < rules.minItems) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must have at least ${rules.minItems} items`,
                    });
                }
                if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push({
                        field,
                        location,
                        message: `${field} must have at most ${rules.maxItems} items`,
                    });
                }
            }

            // Custom validator
            if (rules.custom && typeof rules.custom === 'function') {
                const customError = rules.custom(value, obj);
                if (customError) {
                    errors.push({
                        field,
                        location,
                        message: customError,
                    });
                }
            }
        }

        return errors;
    };

    return { validate };
};

// Mock request/response
const createMockReq = (body = {}, query = {}, params = {}) => ({
    body,
    query,
    params,
});

const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
    };
    res.status = vi.fn((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = vi.fn((data) => {
        res.body = data;
        return res;
    });
    return res;
};

describe('Validation Middleware Tests', () => {
    let middleware;
    let next;

    beforeEach(() => {
        middleware = createValidationMiddleware();
        next = vi.fn();
        vi.clearAllMocks();
    });

    // ═══════════════════════════════════════════════════════════════════
    // REQUIRED FIELDS
    // ═══════════════════════════════════════════════════════════════════

    describe('Required Fields', () => {
        const schema = {
            body: {
                name: { required: true },
                email: { required: true },
            },
        };

        it('should pass with all required fields', () => {
            const req = createMockReq({ name: 'John', email: 'john@test.com' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should fail missing required field', () => {
            const req = createMockReq({ name: 'John' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.body.details.some(e => e.field === 'email')).toBe(true);
        });

        it('should fail empty required field', () => {
            const req = createMockReq({ name: '', email: 'test@test.com' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TYPE VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Type Validation', () => {
        const schema = {
            body: {
                name: { type: 'string' },
                age: { type: 'number' },
                tags: { type: 'array' },
            },
        };

        it('should pass with correct types', () => {
            const req = createMockReq({ name: 'John', age: 25, tags: ['a', 'b'] });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should fail with wrong string type', () => {
            const req = createMockReq({ name: 123 });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should fail with wrong number type', () => {
            const req = createMockReq({ age: 'twenty' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STRING VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('String Validation', () => {
        it('should validate minLength', () => {
            const schema = { body: { password: { minLength: 8 } } };
            const req = createMockReq({ password: 'short' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should validate maxLength', () => {
            const schema = { body: { name: { maxLength: 5 } } };
            const req = createMockReq({ name: 'toolongname' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should validate email format', () => {
            const schema = { body: { email: { email: true } } };

            const validReq = createMockReq({ email: 'test@test.com' });
            const validRes = createMockRes();
            middleware.validate(schema)(validReq, validRes, next);
            expect(next).toHaveBeenCalled();

            next.mockClear();
            const invalidReq = createMockReq({ email: 'not-an-email' });
            const invalidRes = createMockRes();
            middleware.validate(schema)(invalidReq, invalidRes, next);
            expect(next).not.toHaveBeenCalled();
        });

        it('should validate pattern', () => {
            const schema = { body: { code: { pattern: /^[A-Z]{3}$/ } } };

            const validReq = createMockReq({ code: 'ABC' });
            const validRes = createMockRes();
            middleware.validate(schema)(validReq, validRes, next);
            expect(next).toHaveBeenCalled();

            next.mockClear();
            const invalidReq = createMockReq({ code: 'abc' });
            const invalidRes = createMockRes();
            middleware.validate(schema)(invalidReq, invalidRes, next);
            expect(next).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // NUMBER VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Number Validation', () => {
        it('should validate min', () => {
            const schema = { body: { age: { min: 18 } } };
            const req = createMockReq({ age: 15 });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should validate max', () => {
            const schema = { body: { age: { max: 100 } } };
            const req = createMockReq({ age: 150 });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENUM VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Enum Validation', () => {
        it('should pass with valid enum value', () => {
            const schema = { body: { status: { enum: ['active', 'inactive'] } } };
            const req = createMockReq({ status: 'active' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should fail with invalid enum value', () => {
            const schema = { body: { status: { enum: ['active', 'inactive'] } } };
            const req = createMockReq({ status: 'pending' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ARRAY VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Array Validation', () => {
        it('should validate minItems', () => {
            const schema = { body: { tags: { minItems: 1 } } };
            const req = createMockReq({ tags: [] });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should validate maxItems', () => {
            const schema = { body: { tags: { maxItems: 3 } } };
            const req = createMockReq({ tags: ['a', 'b', 'c', 'd'] });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // QUERY & PARAMS
    // ═══════════════════════════════════════════════════════════════════

    describe('Query & Params Validation', () => {
        it('should validate query params', () => {
            const schema = { query: { page: { required: true } } };
            const req = createMockReq({}, {});
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should validate route params', () => {
            const schema = { params: { id: { required: true } } };
            const req = createMockReq({}, {}, {});
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CUSTOM VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Custom Validation', () => {
        it('should run custom validator', () => {
            const schema = {
                body: {
                    password: {
                        custom: (value) => {
                            if (!/[A-Z]/.test(value)) {
                                return 'Password must contain uppercase letter';
                            }
                            return null;
                        },
                    },
                },
            };
            const req = createMockReq({ password: 'lowercase' });
            const res = createMockRes();

            middleware.validate(schema)(req, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });
});
