/**
 * Schema Validation Tests
 * Tests for schema validation utilities
 *
 * @module tests/schema/schema-validator.test.js
 */

import { describe, it, expect } from 'vitest';

// Schema validator implementation
const createValidator = () => {
  const validate = (schema, data, path = '') => {
    const errors = [];

    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (schema.type !== actualType && data !== null && data !== undefined) {
        errors.push({
          path: path || 'root',
          message: `Expected type ${schema.type}, got ${actualType}`,
          type: 'type',
        });
      }
    }

    // Required validation
    if (schema.required && (data === undefined || data === null)) {
      errors.push({
        path: path || 'root',
        message: 'Value is required',
        type: 'required',
      });
      return errors; // Can't validate further
    }

    // Null check for optional fields
    if (data === null || data === undefined) {
      return errors;
    }

    // String validations
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength) {
        errors.push({
          path,
          message: `String must be at least ${schema.minLength} characters`,
          type: 'minLength',
        });
      }
      if (schema.maxLength && data.length > schema.maxLength) {
        errors.push({
          path,
          message: `String must be at most ${schema.maxLength} characters`,
          type: 'maxLength',
        });
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        errors.push({
          path,
          message: `String must match pattern ${schema.pattern}`,
          type: 'pattern',
        });
      }
      if (schema.enum && !schema.enum.includes(data)) {
        errors.push({
          path,
          message: `Value must be one of: ${schema.enum.join(', ')}`,
          type: 'enum',
        });
      }
      if (schema.format) {
        const formats = {
          email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          url: /^https?:\/\/.+/,
          uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          date: /^\d{4}-\d{2}-\d{2}$/,
          'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        };
        if (formats[schema.format] && !formats[schema.format].test(data)) {
          errors.push({
            path,
            message: `Invalid ${schema.format} format`,
            type: 'format',
          });
        }
      }
    }

    // Number validations
    if (schema.type === 'number' && typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          path,
          message: `Number must be at least ${schema.minimum}`,
          type: 'minimum',
        });
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          path,
          message: `Number must be at most ${schema.maximum}`,
          type: 'maximum',
        });
      }
      if (schema.integer && !Number.isInteger(data)) {
        errors.push({
          path,
          message: 'Number must be an integer',
          type: 'integer',
        });
      }
    }

    // Array validations
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.minItems && data.length < schema.minItems) {
        errors.push({
          path,
          message: `Array must have at least ${schema.minItems} items`,
          type: 'minItems',
        });
      }
      if (schema.maxItems && data.length > schema.maxItems) {
        errors.push({
          path,
          message: `Array must have at most ${schema.maxItems} items`,
          type: 'maxItems',
        });
      }
      if (schema.uniqueItems) {
        const unique = new Set(data.map(JSON.stringify));
        if (unique.size !== data.length) {
          errors.push({
            path,
            message: 'Array items must be unique',
            type: 'uniqueItems',
          });
        }
      }
      if (schema.items) {
        data.forEach((item, index) => {
          errors.push(...validate(schema.items, item, `${path}[${index}]`));
        });
      }
    }

    // Object validations
    if (schema.type === 'object' && typeof data === 'object' && !Array.isArray(data)) {
      // Required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (data[prop] === undefined) {
            errors.push({
              path: path ? `${path}.${prop}` : prop,
              message: `Property ${prop} is required`,
              type: 'required',
            });
          }
        }
      }

      // Property validations
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const propPath = path ? `${path}.${key}` : key;
          errors.push(...validate(propSchema, data[key], propPath));
        }
      }

      // Additional properties
      if (schema.additionalProperties === false) {
        const allowed = Object.keys(schema.properties || {});
        for (const key of Object.keys(data)) {
          if (!allowed.includes(key)) {
            errors.push({
              path: path ? `${path}.${key}` : key,
              message: `Additional property ${key} not allowed`,
              type: 'additionalProperties',
            });
          }
        }
      }
    }

    // Custom validator
    if (schema.validate) {
      const customResult = schema.validate(data);
      if (customResult !== true) {
        errors.push({
          path,
          message: customResult || 'Custom validation failed',
          type: 'custom',
        });
      }
    }

    return errors;
  };

  return {
    validate: (schema, data) => {
      const errors = validate(schema, data);
      return {
        valid: errors.length === 0,
        errors,
      };
    },

    isValid: (schema, data) => {
      return validate(schema, data).length === 0;
    },
  };
};

describe('Schema Validation Tests', () => {
  const validator = createValidator();

  // ═══════════════════════════════════════════════════════════════════
  // TYPE VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Type Validation', () => {
    it('should validate string type', () => {
      const result = validator.validate({ type: 'string' }, 'hello');
      expect(result.valid).toBe(true);
    });

    it('should reject wrong type', () => {
      const result = validator.validate({ type: 'string' }, 123);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('type');
    });

    it('should validate number type', () => {
      const result = validator.validate({ type: 'number' }, 42);
      expect(result.valid).toBe(true);
    });

    it('should validate boolean type', () => {
      const result = validator.validate({ type: 'boolean' }, true);
      expect(result.valid).toBe(true);
    });

    it('should validate array type', () => {
      const result = validator.validate({ type: 'array' }, [1, 2, 3]);
      expect(result.valid).toBe(true);
    });

    it('should validate object type', () => {
      const result = validator.validate({ type: 'object' }, { a: 1 });
      expect(result.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REQUIRED VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Required Validation', () => {
    it('should fail for undefined when required', () => {
      const result = validator.validate({ required: true }, undefined);
      expect(result.valid).toBe(false);
    });

    it('should fail for null when required', () => {
      const result = validator.validate({ required: true }, null);
      expect(result.valid).toBe(false);
    });

    it('should pass for optional undefined', () => {
      const result = validator.validate({ type: 'string' }, undefined);
      expect(result.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STRING VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('String Validation', () => {
    it('should validate minLength', () => {
      const schema = { type: 'string', minLength: 5 };

      expect(validator.isValid(schema, 'hello')).toBe(true);
      expect(validator.isValid(schema, 'hi')).toBe(false);
    });

    it('should validate maxLength', () => {
      const schema = { type: 'string', maxLength: 5 };

      expect(validator.isValid(schema, 'hi')).toBe(true);
      expect(validator.isValid(schema, 'hello world')).toBe(false);
    });

    it('should validate pattern', () => {
      const schema = { type: 'string', pattern: '^[A-Z]+$' };

      expect(validator.isValid(schema, 'HELLO')).toBe(true);
      expect(validator.isValid(schema, 'Hello')).toBe(false);
    });

    it('should validate enum', () => {
      const schema = { type: 'string', enum: ['a', 'b', 'c'] };

      expect(validator.isValid(schema, 'a')).toBe(true);
      expect(validator.isValid(schema, 'd')).toBe(false);
    });

    it('should validate email format', () => {
      const schema = { type: 'string', format: 'email' };

      expect(validator.isValid(schema, 'user@example.com')).toBe(true);
      expect(validator.isValid(schema, 'not-email')).toBe(false);
    });

    it('should validate URL format', () => {
      const schema = { type: 'string', format: 'url' };

      expect(validator.isValid(schema, 'https://example.com')).toBe(true);
      expect(validator.isValid(schema, 'not-url')).toBe(false);
    });

    it('should validate UUID format', () => {
      const schema = { type: 'string', format: 'uuid' };

      expect(validator.isValid(schema, '550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(validator.isValid(schema, 'not-uuid')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // NUMBER VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Number Validation', () => {
    it('should validate minimum', () => {
      const schema = { type: 'number', minimum: 0 };

      expect(validator.isValid(schema, 5)).toBe(true);
      expect(validator.isValid(schema, -1)).toBe(false);
    });

    it('should validate maximum', () => {
      const schema = { type: 'number', maximum: 100 };

      expect(validator.isValid(schema, 50)).toBe(true);
      expect(validator.isValid(schema, 150)).toBe(false);
    });

    it('should validate integer', () => {
      const schema = { type: 'number', integer: true };

      expect(validator.isValid(schema, 5)).toBe(true);
      expect(validator.isValid(schema, 5.5)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ARRAY VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Array Validation', () => {
    it('should validate minItems', () => {
      const schema = { type: 'array', minItems: 2 };

      expect(validator.isValid(schema, [1, 2])).toBe(true);
      expect(validator.isValid(schema, [1])).toBe(false);
    });

    it('should validate maxItems', () => {
      const schema = { type: 'array', maxItems: 3 };

      expect(validator.isValid(schema, [1, 2])).toBe(true);
      expect(validator.isValid(schema, [1, 2, 3, 4])).toBe(false);
    });

    it('should validate uniqueItems', () => {
      const schema = { type: 'array', uniqueItems: true };

      expect(validator.isValid(schema, [1, 2, 3])).toBe(true);
      expect(validator.isValid(schema, [1, 2, 2])).toBe(false);
    });

    it('should validate array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'number', minimum: 0 },
      };

      expect(validator.isValid(schema, [1, 2, 3])).toBe(true);
      expect(validator.isValid(schema, [1, -1, 3])).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // OBJECT VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Object Validation', () => {
    it('should validate required properties', () => {
      const schema = {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      };

      expect(validator.isValid(schema, { name: 'John', email: 'john@example.com' })).toBe(true);
      expect(validator.isValid(schema, { name: 'John' })).toBe(false);
    });

    it('should validate nested properties', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1 },
            },
          },
        },
      };

      expect(validator.isValid(schema, { user: { name: 'John' } })).toBe(true);
      expect(validator.isValid(schema, { user: { name: '' } })).toBe(false);
    });

    it('should reject additional properties when not allowed', () => {
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
        },
      };

      expect(validator.isValid(schema, { name: 'John' })).toBe(true);
      expect(validator.isValid(schema, { name: 'John', extra: true })).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOM VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Custom Validation', () => {
    it('should run custom validator', () => {
      const schema = {
        type: 'number',
        validate: (value) => value % 2 === 0 || 'Must be even',
      };

      expect(validator.isValid(schema, 4)).toBe(true);
      expect(validator.isValid(schema, 3)).toBe(false);
    });
  });
});
