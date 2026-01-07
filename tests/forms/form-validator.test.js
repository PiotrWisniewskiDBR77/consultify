/**
 * Form Validator Tests
 * Tests for form validation utility
 * 
 * @module tests/forms/form-validator.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Form validator implementation
const createFormValidator = (schema) => {
    return {
        validate: (data) => {
            const errors = {};
            let isValid = true;

            for (const [field, rules] of Object.entries(schema)) {
                const value = data[field];
                const fieldErrors = [];

                for (const rule of rules) {
                    const error = rule.validate(value, data);
                    if (error) {
                        fieldErrors.push(error);
                        isValid = false;
                    }
                }

                if (fieldErrors.length > 0) {
                    errors[field] = fieldErrors;
                }
            }

            return { isValid, errors };
        },

        validateField: (field, value, data = {}) => {
            const rules = schema[field];
            if (!rules) return { isValid: true, errors: [] };

            const errors = [];
            for (const rule of rules) {
                const error = rule.validate(value, { ...data, [field]: value });
                if (error) errors.push(error);
            }

            return { isValid: errors.length === 0, errors };
        },
    };
};

// Validation rules
const rules = {
    required: (message = 'This field is required') => ({
        validate: (value) => {
            if (value === undefined || value === null || value === '') {
                return message;
            }
            return null;
        },
    }),

    minLength: (min, message) => ({
        validate: (value) => {
            if (value && value.length < min) {
                return message || `Must be at least ${min} characters`;
            }
            return null;
        },
    }),

    maxLength: (max, message) => ({
        validate: (value) => {
            if (value && value.length > max) {
                return message || `Must be at most ${max} characters`;
            }
            return null;
        },
    }),

    email: (message = 'Invalid email address') => ({
        validate: (value) => {
            if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return message;
            }
            return null;
        },
    }),

    pattern: (regex, message = 'Invalid format') => ({
        validate: (value) => {
            if (value && !regex.test(value)) {
                return message;
            }
            return null;
        },
    }),

    min: (min, message) => ({
        validate: (value) => {
            if (value !== undefined && value !== null && Number(value) < min) {
                return message || `Must be at least ${min}`;
            }
            return null;
        },
    }),

    max: (max, message) => ({
        validate: (value) => {
            if (value !== undefined && value !== null && Number(value) > max) {
                return message || `Must be at most ${max}`;
            }
            return null;
        },
    }),

    match: (field, message) => ({
        validate: (value, data) => {
            if (value !== data[field]) {
                return message || `Must match ${field}`;
            }
            return null;
        },
    }),

    custom: (fn, message) => ({
        validate: (value, data) => {
            if (!fn(value, data)) {
                return message;
            }
            return null;
        },
    }),
};

describe('Form Validator Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // REQUIRED
    // ═══════════════════════════════════════════════════════════════════

    describe('Required Rule', () => {
        let validator;

        beforeEach(() => {
            validator = createFormValidator({
                name: [rules.required()],
            });
        });

        it('should fail for empty string', () => {
            const result = validator.validate({ name: '' });
            expect(result.isValid).toBe(false);
            expect(result.errors.name).toContain('This field is required');
        });

        it('should fail for undefined', () => {
            const result = validator.validate({});
            expect(result.isValid).toBe(false);
        });

        it('should pass for valid value', () => {
            const result = validator.validate({ name: 'John' });
            expect(result.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MIN/MAX LENGTH
    // ═══════════════════════════════════════════════════════════════════

    describe('Length Rules', () => {
        let validator;

        beforeEach(() => {
            validator = createFormValidator({
                password: [
                    rules.minLength(8),
                    rules.maxLength(20),
                ],
            });
        });

        it('should fail for too short', () => {
            const result = validator.validate({ password: 'short' });
            expect(result.isValid).toBe(false);
        });

        it('should fail for too long', () => {
            const result = validator.validate({ password: 'a'.repeat(25) });
            expect(result.isValid).toBe(false);
        });

        it('should pass for valid length', () => {
            const result = validator.validate({ password: 'validPassword123' });
            expect(result.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EMAIL
    // ═══════════════════════════════════════════════════════════════════

    describe('Email Rule', () => {
        let validator;

        beforeEach(() => {
            validator = createFormValidator({
                email: [rules.email()],
            });
        });

        it('should fail for invalid email', () => {
            const result = validator.validate({ email: 'notanemail' });
            expect(result.isValid).toBe(false);
        });

        it('should pass for valid email', () => {
            const result = validator.validate({ email: 'test@example.com' });
            expect(result.isValid).toBe(true);
        });

        it('should skip empty value', () => {
            const result = validator.validate({ email: '' });
            expect(result.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PATTERN
    // ═══════════════════════════════════════════════════════════════════

    describe('Pattern Rule', () => {
        let validator;

        beforeEach(() => {
            validator = createFormValidator({
                phone: [rules.pattern(/^\d{3}-\d{3}-\d{4}$/, 'Invalid phone format')],
            });
        });

        it('should fail for invalid pattern', () => {
            const result = validator.validate({ phone: '1234567890' });
            expect(result.isValid).toBe(false);
            expect(result.errors.phone).toContain('Invalid phone format');
        });

        it('should pass for valid pattern', () => {
            const result = validator.validate({ phone: '123-456-7890' });
            expect(result.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MIN/MAX NUMBER
    // ═══════════════════════════════════════════════════════════════════

    describe('Number Range Rules', () => {
        let validator;

        beforeEach(() => {
            validator = createFormValidator({
                age: [
                    rules.min(18, 'Must be 18 or older'),
                    rules.max(120, 'Invalid age'),
                ],
            });
        });

        it('should fail for below min', () => {
            const result = validator.validate({ age: 15 });
            expect(result.isValid).toBe(false);
            expect(result.errors.age).toContain('Must be 18 or older');
        });

        it('should fail for above max', () => {
            const result = validator.validate({ age: 150 });
            expect(result.isValid).toBe(false);
        });

        it('should pass for valid number', () => {
            const result = validator.validate({ age: 25 });
            expect(result.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MATCH
    // ═══════════════════════════════════════════════════════════════════

    describe('Match Rule', () => {
        let validator;

        beforeEach(() => {
            validator = createFormValidator({
                password: [rules.required()],
                confirmPassword: [rules.match('password', 'Passwords do not match')],
            });
        });

        it('should fail when fields do not match', () => {
            const result = validator.validate({
                password: 'secret123',
                confirmPassword: 'secret456',
            });
            expect(result.isValid).toBe(false);
            expect(result.errors.confirmPassword).toContain('Passwords do not match');
        });

        it('should pass when fields match', () => {
            const result = validator.validate({
                password: 'secret123',
                confirmPassword: 'secret123',
            });
            expect(result.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CUSTOM
    // ═══════════════════════════════════════════════════════════════════

    describe('Custom Rule', () => {
        it('should use custom validation function', () => {
            const validator = createFormValidator({
                username: [
                    rules.custom(
                        value => !value.includes(' '),
                        'Username cannot contain spaces'
                    ),
                ],
            });

            const invalid = validator.validate({ username: 'john doe' });
            expect(invalid.isValid).toBe(false);

            const valid = validator.validate({ username: 'johndoe' });
            expect(valid.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // VALIDATE FIELD
    // ═══════════════════════════════════════════════════════════════════

    describe('Validate Field', () => {
        it('should validate single field', () => {
            const validator = createFormValidator({
                email: [rules.required(), rules.email()],
                name: [rules.required()],
            });

            const result = validator.validateField('email', 'invalid');

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid email address');
        });

        it('should return valid for unknown field', () => {
            const validator = createFormValidator({
                email: [rules.email()],
            });

            const result = validator.validateField('unknown', 'value');

            expect(result.isValid).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MULTIPLE ERRORS
    // ═══════════════════════════════════════════════════════════════════

    describe('Multiple Errors', () => {
        it('should collect all errors for a field', () => {
            const validator = createFormValidator({
                password: [
                    rules.required('Password is required'),
                    rules.minLength(8, 'Too short'),
                    rules.pattern(/[A-Z]/, 'Must contain uppercase'),
                ],
            });

            const result = validator.validate({ password: 'abc' });

            expect(result.errors.password.length).toBe(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MULTIPLE FIELDS
    // ═══════════════════════════════════════════════════════════════════

    describe('Multiple Fields', () => {
        it('should validate all fields', () => {
            const validator = createFormValidator({
                email: [rules.required(), rules.email()],
                password: [rules.required(), rules.minLength(8)],
            });

            const result = validator.validate({ email: '', password: '123' });

            expect(result.isValid).toBe(false);
            expect(result.errors.email).toBeDefined();
            expect(result.errors.password).toBeDefined();
        });
    });
});
