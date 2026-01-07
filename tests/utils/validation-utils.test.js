/**
 * Validation Utils Tests
 * Tests for validation utility functions
 * 
 * @module tests/utils/validation-utils.test.js
 */

import { describe, it, expect } from 'vitest';

// Validation utilities implementation
const validationUtils = {
    // Type Checks
    isString: (v) => typeof v === 'string',
    isNumber: (v) => typeof v === 'number' && !isNaN(v),
    isBoolean: (v) => typeof v === 'boolean',
    isArray: (v) => Array.isArray(v),
    isObject: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    isFunction: (v) => typeof v === 'function',
    isNull: (v) => v === null,
    isUndefined: (v) => v === undefined,
    isNil: (v) => v === null || v === undefined,

    // String Validations
    isEmail: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    isUrl: (v) => {
        try {
            new URL(v);
            return true;
        } catch {
            return false;
        }
    },
    isUUID: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
    isSlug: (v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
    isAlpha: (v) => /^[a-zA-Z]+$/.test(v),
    isAlphaNumeric: (v) => /^[a-zA-Z0-9]+$/.test(v),
    isNumeric: (v) => /^-?\d+\.?\d*$/.test(v),
    isHex: (v) => /^[0-9a-fA-F]+$/.test(v),
    isHexColor: (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v),
    isIP: (v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v),
    isIPv6: (v) => /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v),
    isPhone: (v) => /^\+?[\d\s-()]{10,}$/.test(v),
    isCreditCard: (v) => /^\d{13,19}$/.test(v.replace(/\s|-/g, '')),
    isPostalCode: (v, country = 'US') => {
        const patterns = {
            US: /^\d{5}(-\d{4})?$/,
            UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
            PL: /^\d{2}-\d{3}$/,
        };
        return patterns[country]?.test(v) ?? false;
    },

    // Length/Range
    hasLength: (v, min, max) => {
        const len = v?.length ?? 0;
        if (max === undefined) return len === min;
        return len >= min && len <= max;
    },
    inRange: (v, min, max) => v >= min && v <= max,
    minLength: (v, min) => (v?.length ?? 0) >= min,
    maxLength: (v, max) => (v?.length ?? 0) <= max,

    // Password Strength
    isStrongPassword: (v) => {
        if (!v || v.length < 8) return false;
        const hasUpper = /[A-Z]/.test(v);
        const hasLower = /[a-z]/.test(v);
        const hasNumber = /\d/.test(v);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(v);
        return hasUpper && hasLower && hasNumber && hasSpecial;
    },

    getPasswordStrength: (v) => {
        if (!v) return 0;
        let score = 0;
        if (v.length >= 8) score++;
        if (v.length >= 12) score++;
        if (/[A-Z]/.test(v)) score++;
        if (/[a-z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(v)) score++;
        return Math.min(score, 5);
    },

    // Date Validations
    isDate: (v) => v instanceof Date && !isNaN(v),
    isDateString: (v) => !isNaN(Date.parse(v)),
    isFutureDate: (v) => new Date(v) > new Date(),
    isPastDate: (v) => new Date(v) < new Date(),

    // Empty Checks
    isEmpty: (v) => {
        if (v === null || v === undefined) return true;
        if (typeof v === 'string') return v.trim().length === 0;
        if (Array.isArray(v)) return v.length === 0;
        if (typeof v === 'object') return Object.keys(v).length === 0;
        return false;
    },
    isNotEmpty: (v) => !validationUtils.isEmpty(v),

    // Match Checks
    matches: (v, pattern) => pattern.test(v),
    equals: (v1, v2) => v1 === v2,
    isOneOf: (v, options) => options.includes(v),

    // JSON
    isJSON: (v) => {
        try {
            JSON.parse(v);
            return true;
        } catch {
            return false;
        }
    },

    // Custom
    validate: (value, rules) => {
        const errors = [];
        for (const [rule, param] of Object.entries(rules)) {
            const validator = validationUtils[rule];
            if (validator && !validator(value, param)) {
                errors.push(rule);
            }
        }
        return { valid: errors.length === 0, errors };
    },
};

describe('Validation Utils Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // TYPE CHECKS
    // ═══════════════════════════════════════════════════════════════════

    describe('Type Checks', () => {
        it('isString', () => {
            expect(validationUtils.isString('hello')).toBe(true);
            expect(validationUtils.isString(123)).toBe(false);
        });

        it('isNumber', () => {
            expect(validationUtils.isNumber(123)).toBe(true);
            expect(validationUtils.isNumber(NaN)).toBe(false);
            expect(validationUtils.isNumber('123')).toBe(false);
        });

        it('isBoolean', () => {
            expect(validationUtils.isBoolean(true)).toBe(true);
            expect(validationUtils.isBoolean(1)).toBe(false);
        });

        it('isArray', () => {
            expect(validationUtils.isArray([])).toBe(true);
            expect(validationUtils.isArray({})).toBe(false);
        });

        it('isObject', () => {
            expect(validationUtils.isObject({})).toBe(true);
            expect(validationUtils.isObject([])).toBe(false);
            expect(validationUtils.isObject(null)).toBe(false);
        });

        it('isNil', () => {
            expect(validationUtils.isNil(null)).toBe(true);
            expect(validationUtils.isNil(undefined)).toBe(true);
            expect(validationUtils.isNil(0)).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STRING VALIDATIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('String Validations', () => {
        it('isEmail', () => {
            expect(validationUtils.isEmail('test@test.com')).toBe(true);
            expect(validationUtils.isEmail('invalid')).toBe(false);
        });

        it('isUrl', () => {
            expect(validationUtils.isUrl('https://example.com')).toBe(true);
            expect(validationUtils.isUrl('not-a-url')).toBe(false);
        });

        it('isUUID', () => {
            expect(validationUtils.isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
            expect(validationUtils.isUUID('not-a-uuid')).toBe(false);
        });

        it('isSlug', () => {
            expect(validationUtils.isSlug('my-slug')).toBe(true);
            expect(validationUtils.isSlug('My Slug')).toBe(false);
        });

        it('isAlpha', () => {
            expect(validationUtils.isAlpha('abc')).toBe(true);
            expect(validationUtils.isAlpha('abc123')).toBe(false);
        });

        it('isAlphaNumeric', () => {
            expect(validationUtils.isAlphaNumeric('abc123')).toBe(true);
            expect(validationUtils.isAlphaNumeric('abc-123')).toBe(false);
        });

        it('isHexColor', () => {
            expect(validationUtils.isHexColor('#fff')).toBe(true);
            expect(validationUtils.isHexColor('#ffffff')).toBe(true);
            expect(validationUtils.isHexColor('red')).toBe(false);
        });

        it('isPhone', () => {
            expect(validationUtils.isPhone('+1 234 567 8900')).toBe(true);
            expect(validationUtils.isPhone('123')).toBe(false);
        });

        it('isPostalCode', () => {
            expect(validationUtils.isPostalCode('12345', 'US')).toBe(true);
            expect(validationUtils.isPostalCode('12-345', 'PL')).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LENGTH/RANGE
    // ═══════════════════════════════════════════════════════════════════

    describe('Length/Range', () => {
        it('hasLength', () => {
            expect(validationUtils.hasLength('abc', 3)).toBe(true);
            expect(validationUtils.hasLength('abc', 2, 5)).toBe(true);
        });

        it('inRange', () => {
            expect(validationUtils.inRange(5, 1, 10)).toBe(true);
            expect(validationUtils.inRange(15, 1, 10)).toBe(false);
        });

        it('minLength', () => {
            expect(validationUtils.minLength('hello', 3)).toBe(true);
            expect(validationUtils.minLength('hi', 3)).toBe(false);
        });

        it('maxLength', () => {
            expect(validationUtils.maxLength('hi', 5)).toBe(true);
            expect(validationUtils.maxLength('hello world', 5)).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PASSWORD
    // ═══════════════════════════════════════════════════════════════════

    describe('Password Validation', () => {
        it('isStrongPassword', () => {
            expect(validationUtils.isStrongPassword('Passw0rd!')).toBe(true);
            expect(validationUtils.isStrongPassword('weak')).toBe(false);
            expect(validationUtils.isStrongPassword('password123')).toBe(false);
        });

        it('getPasswordStrength', () => {
            expect(validationUtils.getPasswordStrength('a')).toBeLessThan(3);
            expect(validationUtils.getPasswordStrength('Passw0rd!')).toBeGreaterThanOrEqual(4);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DATE VALIDATIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('Date Validations', () => {
        it('isDate', () => {
            expect(validationUtils.isDate(new Date())).toBe(true);
            expect(validationUtils.isDate('2024-01-01')).toBe(false);
        });

        it('isDateString', () => {
            expect(validationUtils.isDateString('2024-01-15')).toBe(true);
            expect(validationUtils.isDateString('not-a-date')).toBe(false);
        });

        it('isFutureDate', () => {
            const future = new Date();
            future.setDate(future.getDate() + 1);
            expect(validationUtils.isFutureDate(future)).toBe(true);
        });

        it('isPastDate', () => {
            const past = new Date();
            past.setDate(past.getDate() - 1);
            expect(validationUtils.isPastDate(past)).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EMPTY CHECKS
    // ═══════════════════════════════════════════════════════════════════

    describe('Empty Checks', () => {
        it('isEmpty', () => {
            expect(validationUtils.isEmpty('')).toBe(true);
            expect(validationUtils.isEmpty('  ')).toBe(true);
            expect(validationUtils.isEmpty([])).toBe(true);
            expect(validationUtils.isEmpty({})).toBe(true);
            expect(validationUtils.isEmpty(null)).toBe(true);
            expect(validationUtils.isEmpty('hello')).toBe(false);
        });

        it('isNotEmpty', () => {
            expect(validationUtils.isNotEmpty('hello')).toBe(true);
            expect(validationUtils.isNotEmpty('')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MATCH CHECKS
    // ═══════════════════════════════════════════════════════════════════

    describe('Match Checks', () => {
        it('matches', () => {
            expect(validationUtils.matches('abc123', /[a-z]+\d+/)).toBe(true);
        });

        it('equals', () => {
            expect(validationUtils.equals(1, 1)).toBe(true);
            expect(validationUtils.equals(1, '1')).toBe(false);
        });

        it('isOneOf', () => {
            expect(validationUtils.isOneOf('red', ['red', 'green', 'blue'])).toBe(true);
            expect(validationUtils.isOneOf('yellow', ['red', 'green', 'blue'])).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // JSON
    // ═══════════════════════════════════════════════════════════════════

    describe('JSON', () => {
        it('isJSON', () => {
            expect(validationUtils.isJSON('{"a":1}')).toBe(true);
            expect(validationUtils.isJSON('not json')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // VALIDATE
    // ═══════════════════════════════════════════════════════════════════

    describe('validate', () => {
        it('should validate with multiple rules', () => {
            const result = validationUtils.validate('test@test.com', {
                isEmail: true,
                minLength: 5,
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should return errors for failed rules', () => {
            const result = validationUtils.validate('ab', {
                isEmail: true,
                minLength: 5,
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('isEmail');
            expect(result.errors).toContain('minLength');
        });
    });
});
