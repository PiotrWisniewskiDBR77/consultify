/**
 * Validation Service Unit Tests
 * Tests data validation, schema checking, and sanitization
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Validation service implementation for testing
const createValidationService = () => {
  const rules = {
    email: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) ? null : 'Invalid email format';
    },
    required: (value) => {
      return value !== undefined && value !== null && value !== '' ? null : 'Field is required';
    },
    minLength: (min) => (value) => {
      return value && value.length >= min ? null : `Minimum length is ${min}`;
    },
    maxLength: (max) => (value) => {
      return value && value.length <= max ? null : `Maximum length is ${max}`;
    },
    pattern: (regex, message) => (value) => {
      return regex.test(value) ? null : message || 'Invalid format';
    },
    number: (value) => {
      return !isNaN(Number(value)) ? null : 'Must be a number';
    },
    integer: (value) => {
      return Number.isInteger(Number(value)) ? null : 'Must be an integer';
    },
    min: (minVal) => (value) => {
      return Number(value) >= minVal ? null : `Minimum value is ${minVal}`;
    },
    max: (maxVal) => (value) => {
      return Number(value) <= maxVal ? null : `Maximum value is ${maxVal}`;
    },
    url: (value) => {
      try {
        new URL(value);
        return null;
      } catch {
        return 'Invalid URL format';
      }
    },
    uuid: (value) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(value) ? null : 'Invalid UUID format';
    },
  };

  return {
    validate: (data, schema) => {
      const errors = {};
      let isValid = true;

      for (const [field, fieldRules] of Object.entries(schema)) {
        const value = data[field];
        const fieldErrors = [];

        for (const rule of fieldRules) {
          let error;
          if (typeof rule === 'string') {
            error = rules[rule]?.(value);
          } else if (typeof rule === 'function') {
            error = rule(value);
          }

          if (error) {
            fieldErrors.push(error);
          }
        }

        if (fieldErrors.length > 0) {
          errors[field] = fieldErrors;
          isValid = false;
        }
      }

      return { isValid, errors };
    },

    validateEmail: (email) => rules.email(email) === null,
    validateUrl: (url) => rules.url(url) === null,
    validateUuid: (uuid) => rules.uuid(uuid) === null,

    sanitize: (value, options = {}) => {
      if (typeof value !== 'string') return value;

      let sanitized = value;

      if (options.trim) sanitized = sanitized.trim();
      if (options.lowercase) sanitized = sanitized.toLowerCase();
      if (options.uppercase) sanitized = sanitized.toUpperCase();
      if (options.stripHtml) sanitized = sanitized.replace(/<[^>]*>/g, '');
      if (options.alphanumeric) sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');

      return sanitized;
    },

    rules,
  };
};

describe('ValidationService', () => {
  let validationService;

  beforeEach(() => {
    validationService = createValidationService();
  });

  describe('Email Validation', () => {
    it('should validate correct email', () => {
      expect(validationService.validateEmail('test@example.com')).toBe(true);
      expect(validationService.validateEmail('user.name@domain.org')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(validationService.validateEmail('invalid')).toBe(false);
      expect(validationService.validateEmail('missing@domain')).toBe(false);
      expect(validationService.validateEmail('@nodomain.com')).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('should validate correct URL', () => {
      expect(validationService.validateUrl('https://example.com')).toBe(true);
      expect(validationService.validateUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject invalid URL', () => {
      expect(validationService.validateUrl('not-a-url')).toBe(false);
      expect(validationService.validateUrl('://missing-protocol')).toBe(false);
    });
  });

  describe('UUID Validation', () => {
    it('should validate correct UUID', () => {
      expect(validationService.validateUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(validationService.validateUuid('not-a-uuid')).toBe(false);
      expect(validationService.validateUuid('12345-12345-12345')).toBe(false);
    });
  });

  describe('Schema Validation', () => {
    it('should validate data against schema', () => {
      const schema = {
        email: ['required', 'email'],
        name: ['required'],
      };

      const result = validationService.validate(
        {
          email: 'test@example.com',
          name: 'John',
        },
        schema
      );

      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should return errors for invalid data', () => {
      const schema = {
        email: ['required', 'email'],
        name: ['required'],
      };

      const result = validationService.validate(
        {
          email: 'invalid-email',
          name: '',
        },
        schema
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.errors.name).toBeDefined();
    });

    it('should validate required fields', () => {
      const schema = {
        field: ['required'],
      };

      const validResult = validationService.validate({ field: 'value' }, schema);
      const invalidResult = validationService.validate({ field: '' }, schema);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Custom Validators', () => {
    it('should support custom validation functions', () => {
      const passwordValidator = (value) => {
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value)) return 'Password must contain uppercase';
        return null;
      };

      const schema = {
        password: [passwordValidator],
      };

      const weakResult = validationService.validate({ password: 'weak' }, schema);
      const strongResult = validationService.validate({ password: 'StrongPass1' }, schema);

      expect(weakResult.isValid).toBe(false);
      expect(strongResult.isValid).toBe(true);
    });
  });

  describe('Sanitization', () => {
    it('should trim whitespace', () => {
      const result = validationService.sanitize('  hello  ', { trim: true });
      expect(result).toBe('hello');
    });

    it('should convert to lowercase', () => {
      const result = validationService.sanitize('HELLO', { lowercase: true });
      expect(result).toBe('hello');
    });

    it('should convert to uppercase', () => {
      const result = validationService.sanitize('hello', { uppercase: true });
      expect(result).toBe('HELLO');
    });

    it('should strip HTML tags', () => {
      const result = validationService.sanitize('<script>alert("xss")</script>Hello', {
        stripHtml: true,
      });
      expect(result).toBe('alert("xss")Hello');
    });

    it('should extract alphanumeric only', () => {
      const result = validationService.sanitize('hello-world_123!', { alphanumeric: true });
      expect(result).toBe('helloworld123');
    });
  });

  describe('Number Validation', () => {
    it('should validate numbers', () => {
      const numberRule = validationService.rules.number;
      expect(numberRule(123)).toBeNull();
      expect(numberRule('456')).toBeNull();
      expect(numberRule('abc')).not.toBeNull();
    });

    it('should validate integers', () => {
      const intRule = validationService.rules.integer;
      expect(intRule(123)).toBeNull();
      expect(intRule(123.5)).not.toBeNull();
    });
  });
});
