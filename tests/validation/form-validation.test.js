/**
 * Form Validation Tests
 * Tests for form validation and schema validation
 * 
 * @module tests/validation/form-validation.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Schema validator
const createSchemaValidator = () => {
    const validators = {
        string: (value) => typeof value === 'string',
        number: (value) => typeof value === 'number' && !isNaN(value),
        boolean: (value) => typeof value === 'boolean',
        array: (value) => Array.isArray(value),
        object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        url: (value) => {
            try { new URL(value); return true; } catch { return false; }
        },
        date: (value) => !isNaN(Date.parse(value)),
        uuid: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
    };

    return {
        validate: (schema, data) => {
            const errors = [];

            for (const [field, rules] of Object.entries(schema)) {
                const value = data[field];

                // Required check
                if (rules.required && (value === undefined || value === null || value === '')) {
                    errors.push({ field, message: `${field} is required` });
                    continue;
                }

                if (value === undefined || value === null) continue;

                // Type check
                if (rules.type && !validators[rules.type]?.(value)) {
                    errors.push({ field, message: `${field} must be a ${rules.type}` });
                }

                // Min/max for numbers
                if (typeof value === 'number') {
                    if (rules.min !== undefined && value < rules.min) {
                        errors.push({ field, message: `${field} must be at least ${rules.min}` });
                    }
                    if (rules.max !== undefined && value > rules.max) {
                        errors.push({ field, message: `${field} must be at most ${rules.max}` });
                    }
                }

                // Min/max length for strings
                if (typeof value === 'string') {
                    if (rules.minLength !== undefined && value.length < rules.minLength) {
                        errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
                    }
                    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                        errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
                    }
                    if (rules.pattern && !rules.pattern.test(value)) {
                        errors.push({ field, message: `${field} has invalid format` });
                    }
                }

                // Enum check
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
                }

                // Custom validator
                if (rules.validate) {
                    const result = rules.validate(value, data);
                    if (result !== true) {
                        errors.push({ field, message: result || `${field} is invalid` });
                    }
                }
            }

            return {
                valid: errors.length === 0,
                errors,
            };
        },

        addValidator: (name, fn) => {
            validators[name] = fn;
        },
    };
};

// Form state manager
const createFormState = (initialValues = {}) => {
    let values = { ...initialValues };
    let touched = {};
    let errors = {};
    const listeners = [];

    const emit = () => {
        listeners.forEach(fn => fn({ values, touched, errors }));
    };

    return {
        getValue: (field) => values[field],

        getValues: () => ({ ...values }),

        setValue: (field, value) => {
            values[field] = value;
            touched[field] = true;
            emit();
        },

        setValues: (newValues) => {
            values = { ...values, ...newValues };
            emit();
        },

        getTouched: (field) => touched[field] || false,

        setTouched: (field, isTouched = true) => {
            touched[field] = isTouched;
            emit();
        },

        getError: (field) => errors[field],

        getErrors: () => ({ ...errors }),

        setError: (field, message) => {
            errors[field] = message;
            emit();
        },

        setErrors: (newErrors) => {
            errors = { ...newErrors };
            emit();
        },

        clearError: (field) => {
            delete errors[field];
            emit();
        },

        clearErrors: () => {
            errors = {};
            emit();
        },

        reset: () => {
            values = { ...initialValues };
            touched = {};
            errors = {};
            emit();
        },

        isDirty: () => {
            return JSON.stringify(values) !== JSON.stringify(initialValues);
        },

        isValid: () => Object.keys(errors).length === 0,

        subscribe: (listener) => {
            listeners.push(listener);
            return () => {
                const idx = listeners.indexOf(listener);
                if (idx !== -1) listeners.splice(idx, 1);
            };
        },
    };
};

// Field validator
const createFieldValidator = () => {
    return {
        required: (message = 'This field is required') =>
            (value) => (value !== undefined && value !== null && value !== '') || message,

        minLength: (min, message) =>
            (value) => !value || value.length >= min || message || `Minimum ${min} characters`,

        maxLength: (max, message) =>
            (value) => !value || value.length <= max || message || `Maximum ${max} characters`,

        min: (minVal, message) =>
            (value) => value === undefined || value >= minVal || message || `Minimum value is ${minVal}`,

        max: (maxVal, message) =>
            (value) => value === undefined || value <= maxVal || message || `Maximum value is ${maxVal}`,

        pattern: (regex, message = 'Invalid format') =>
            (value) => !value || regex.test(value) || message,

        email: (message = 'Invalid email address') =>
            (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || message,

        matches: (field, message) =>
            (value, values) => value === values[field] || message || `Must match ${field}`,

        compose: (...validators) =>
            (value, values) => {
                for (const validator of validators) {
                    const result = validator(value, values);
                    if (result !== true) return result;
                }
                return true;
            },
    };
};

describe('Schema Validator Tests', () => {
    let validator;

    beforeEach(() => {
        validator = createSchemaValidator();
    });

    it('should validate required fields', () => {
        const schema = { name: { required: true } };

        expect(validator.validate(schema, {}).valid).toBe(false);
        expect(validator.validate(schema, { name: 'John' }).valid).toBe(true);
    });

    it('should validate types', () => {
        const schema = {
            age: { type: 'number' },
            email: { type: 'email' },
        };

        expect(validator.validate(schema, { age: 'not a number' }).valid).toBe(false);
        expect(validator.validate(schema, { age: 25, email: 'test@test.com' }).valid).toBe(true);
    });

    it('should validate min/max', () => {
        const schema = { score: { type: 'number', min: 0, max: 100 } };

        expect(validator.validate(schema, { score: -1 }).valid).toBe(false);
        expect(validator.validate(schema, { score: 101 }).valid).toBe(false);
        expect(validator.validate(schema, { score: 50 }).valid).toBe(true);
    });

    it('should validate string length', () => {
        const schema = { password: { minLength: 8, maxLength: 20 } };

        expect(validator.validate(schema, { password: 'short' }).valid).toBe(false);
        expect(validator.validate(schema, { password: 'validpassword' }).valid).toBe(true);
    });

    it('should validate enum', () => {
        const schema = { status: { enum: ['active', 'inactive'] } };

        expect(validator.validate(schema, { status: 'pending' }).valid).toBe(false);
        expect(validator.validate(schema, { status: 'active' }).valid).toBe(true);
    });

    it('should run custom validators', () => {
        const schema = {
            password: {
                validate: (value) => value?.includes('!') || 'Must contain !',
            },
        };

        expect(validator.validate(schema, { password: 'test' }).valid).toBe(false);
        expect(validator.validate(schema, { password: 'test!' }).valid).toBe(true);
    });
});

describe('Form State Tests', () => {
    let form;

    beforeEach(() => {
        form = createFormState({ name: '', email: '' });
    });

    it('should get and set values', () => {
        form.setValue('name', 'John');

        expect(form.getValue('name')).toBe('John');
    });

    it('should track touched fields', () => {
        expect(form.getTouched('name')).toBe(false);

        form.setValue('name', 'John');

        expect(form.getTouched('name')).toBe(true);
    });

    it('should manage errors', () => {
        form.setError('email', 'Invalid email');

        expect(form.getError('email')).toBe('Invalid email');
        expect(form.isValid()).toBe(false);

        form.clearError('email');

        expect(form.isValid()).toBe(true);
    });

    it('should detect dirty state', () => {
        expect(form.isDirty()).toBe(false);

        form.setValue('name', 'Changed');

        expect(form.isDirty()).toBe(true);
    });

    it('should reset form', () => {
        form.setValue('name', 'Changed');
        form.setError('name', 'Error');
        form.reset();

        expect(form.getValue('name')).toBe('');
        expect(form.getError('name')).toBeUndefined();
    });

    it('should notify subscribers', () => {
        const handler = vi.fn();
        form.subscribe(handler);

        form.setValue('name', 'Test');

        expect(handler).toHaveBeenCalled();
    });
});

describe('Field Validator Tests', () => {
    let v;

    beforeEach(() => {
        v = createFieldValidator();
    });

    it('should validate required', () => {
        const required = v.required();

        expect(required('')).not.toBe(true);
        expect(required('value')).toBe(true);
    });

    it('should validate length', () => {
        const minLength = v.minLength(3);
        const maxLength = v.maxLength(10);

        expect(minLength('ab')).not.toBe(true);
        expect(minLength('abc')).toBe(true);
        expect(maxLength('12345678901')).not.toBe(true);
    });

    it('should validate email', () => {
        const email = v.email();

        expect(email('invalid')).not.toBe(true);
        expect(email('test@test.com')).toBe(true);
    });

    it('should validate matches', () => {
        const matches = v.matches('password', 'Passwords must match');

        expect(matches('test', { password: 'different' })).not.toBe(true);
        expect(matches('test', { password: 'test' })).toBe(true);
    });

    it('should compose validators', () => {
        const validate = v.compose(
            v.required(),
            v.minLength(8),
            v.pattern(/[A-Z]/, 'Must contain uppercase')
        );

        expect(validate('')).not.toBe(true);
        expect(validate('short')).not.toBe(true);
        expect(validate('longnouppercase')).not.toBe(true);
        expect(validate('ValidPassword123')).toBe(true);
    });
});
