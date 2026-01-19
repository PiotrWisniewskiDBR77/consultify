/**
 * Request Validator Tests
 * Tests for HTTP request validation
 *
 * @module tests/request/request-validator.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Request validator implementation
const createRequestValidator = () => {
  const rules = new Map();

  const validateField = (value, fieldRules, fieldName) => {
    const errors = [];

    if (fieldRules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
      return errors;
    }

    if (value === undefined || value === null) return errors;

    if (fieldRules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== fieldRules.type) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be of type ${fieldRules.type}`,
        });
      }
    }

    if (fieldRules.min !== undefined && typeof value === 'number' && value < fieldRules.min) {
      errors.push({ field: fieldName, message: `${fieldName} must be at least ${fieldRules.min}` });
    }

    if (fieldRules.max !== undefined && typeof value === 'number' && value > fieldRules.max) {
      errors.push({ field: fieldName, message: `${fieldName} must be at most ${fieldRules.max}` });
    }

    if (fieldRules.minLength && typeof value === 'string' && value.length < fieldRules.minLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at least ${fieldRules.minLength} characters`,
      });
    }

    if (fieldRules.maxLength && typeof value === 'string' && value.length > fieldRules.maxLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be at most ${fieldRules.maxLength} characters`,
      });
    }

    if (
      fieldRules.pattern &&
      typeof value === 'string' &&
      !new RegExp(fieldRules.pattern).test(value)
    ) {
      errors.push({ field: fieldName, message: `${fieldName} has invalid format` });
    }

    if (fieldRules.enum && !fieldRules.enum.includes(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be one of: ${fieldRules.enum.join(', ')}`,
      });
    }

    if (fieldRules.custom) {
      const result = fieldRules.custom(value);
      if (result !== true) {
        errors.push({ field: fieldName, message: result || `${fieldName} is invalid` });
      }
    }

    return errors;
  };

  return {
    define: (name, schema) => {
      rules.set(name, schema);
    },

    validate: (name, data) => {
      const schema = rules.get(name);
      if (!schema) throw new Error(`Validation schema not found: ${name}`);

      const errors = [];

      // Validate body
      if (schema.body) {
        for (const [field, fieldRules] of Object.entries(schema.body)) {
          errors.push(...validateField(data.body?.[field], fieldRules, field));
        }
      }

      // Validate query
      if (schema.query) {
        for (const [field, fieldRules] of Object.entries(schema.query)) {
          errors.push(...validateField(data.query?.[field], fieldRules, field));
        }
      }

      // Validate params
      if (schema.params) {
        for (const [field, fieldRules] of Object.entries(schema.params)) {
          errors.push(...validateField(data.params?.[field], fieldRules, field));
        }
      }

      // Validate headers
      if (schema.headers) {
        for (const [field, fieldRules] of Object.entries(schema.headers)) {
          errors.push(...validateField(data.headers?.[field], fieldRules, field));
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    },

    validateBody: (schema, body) => {
      const errors = [];
      for (const [field, fieldRules] of Object.entries(schema)) {
        errors.push(...validateField(body[field], fieldRules, field));
      }
      return { valid: errors.length === 0, errors };
    },

    validateQuery: (schema, query) => {
      const errors = [];
      for (const [field, fieldRules] of Object.entries(schema)) {
        // Query params are always strings, try to coerce types
        let value = query[field];
        if (fieldRules.type === 'number' && typeof value === 'string') {
          value = parseFloat(value);
        }
        if (fieldRules.type === 'boolean' && typeof value === 'string') {
          value = value === 'true';
        }
        errors.push(...validateField(value, fieldRules, field));
      }
      return { valid: errors.length === 0, errors };
    },

    middleware: (name) => {
      return (req, res, next) => {
        const result = this.validate(name, req);
        if (!result.valid) {
          return res.status(400).json({
            error: 'Validation failed',
            details: result.errors,
          });
        }
        next();
      };
    },

    clear: () => {
      rules.clear();
    },
  };
};

// Content type validator
const createContentTypeValidator = () => {
  const allowedTypes = new Set([
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ]);

  return {
    allow: (type) => {
      allowedTypes.add(type);
    },

    disallow: (type) => {
      allowedTypes.delete(type);
    },

    validate: (contentType) => {
      if (!contentType) return { valid: false, message: 'Content-Type header is required' };

      const type = contentType.split(';')[0].trim();

      if (!allowedTypes.has(type)) {
        return { valid: false, message: `Content-Type ${type} is not allowed` };
      }

      return { valid: true };
    },

    isJSON: (contentType) => {
      return contentType?.includes('application/json');
    },

    isFormData: (contentType) => {
      return contentType?.includes('multipart/form-data');
    },
  };
};

describe('Request Validator Tests', () => {
  let validator;

  beforeEach(() => {
    validator = createRequestValidator();
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEFINE AND VALIDATE
  // ═══════════════════════════════════════════════════════════════════

  describe('define and validate', () => {
    it('should define and validate schema', () => {
      validator.define('createUser', {
        body: {
          name: { required: true, type: 'string' },
          email: { required: true, type: 'string' },
        },
      });

      const result = validator.validate('createUser', {
        body: { name: 'John', email: 'john@example.com' },
      });

      expect(result.valid).toBe(true);
    });

    it('should fail for missing required field', () => {
      validator.define('createUser', {
        body: {
          name: { required: true, type: 'string' },
        },
      });

      const result = validator.validate('createUser', { body: {} });

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('name');
    });

    it('should throw for unknown schema', () => {
      expect(() => validator.validate('unknown', {})).toThrow('not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATE BODY
  // ═══════════════════════════════════════════════════════════════════

  describe('validateBody', () => {
    it('should validate type', () => {
      const result = validator.validateBody({ age: { type: 'number' } }, { age: 'not a number' });

      expect(result.valid).toBe(false);
    });

    it('should validate min/max', () => {
      const schema = { age: { type: 'number', min: 18, max: 100 } };

      expect(validator.validateBody(schema, { age: 25 }).valid).toBe(true);
      expect(validator.validateBody(schema, { age: 10 }).valid).toBe(false);
      expect(validator.validateBody(schema, { age: 150 }).valid).toBe(false);
    });

    it('should validate minLength/maxLength', () => {
      const schema = { name: { type: 'string', minLength: 2, maxLength: 50 } };

      expect(validator.validateBody(schema, { name: 'John' }).valid).toBe(true);
      expect(validator.validateBody(schema, { name: 'J' }).valid).toBe(false);
      expect(validator.validateBody(schema, { name: 'X'.repeat(100) }).valid).toBe(false);
    });

    it('should validate pattern', () => {
      const schema = { code: { pattern: '^[A-Z]{3}$' } };

      expect(validator.validateBody(schema, { code: 'ABC' }).valid).toBe(true);
      expect(validator.validateBody(schema, { code: 'abc' }).valid).toBe(false);
      expect(validator.validateBody(schema, { code: 'ABCD' }).valid).toBe(false);
    });

    it('should validate enum', () => {
      const schema = { status: { enum: ['active', 'inactive', 'pending'] } };

      expect(validator.validateBody(schema, { status: 'active' }).valid).toBe(true);
      expect(validator.validateBody(schema, { status: 'unknown' }).valid).toBe(false);
    });

    it('should run custom validator', () => {
      const schema = {
        password: {
          custom: (value) => value.length >= 8 || 'Password too short',
        },
      };

      expect(validator.validateBody(schema, { password: 'longpassword' }).valid).toBe(true);
      expect(validator.validateBody(schema, { password: 'short' }).valid).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATE QUERY
  // ═══════════════════════════════════════════════════════════════════

  describe('validateQuery', () => {
    it('should coerce query string to number', () => {
      const result = validator.validateQuery({ page: { type: 'number', min: 1 } }, { page: '5' });

      expect(result.valid).toBe(true);
    });

    it('should coerce query string to boolean', () => {
      const result = validator.validateQuery({ active: { type: 'boolean' } }, { active: 'true' });

      expect(result.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATE PARAMS AND HEADERS
  // ═══════════════════════════════════════════════════════════════════

  describe('validate params and headers', () => {
    it('should validate params', () => {
      validator.define('getUser', {
        params: { id: { required: true, pattern: '^[0-9a-f-]+$' } },
      });

      const result = validator.validate('getUser', {
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });

      expect(result.valid).toBe(true);
    });

    it('should validate headers', () => {
      validator.define('apiRequest', {
        headers: { 'x-api-key': { required: true } },
      });

      const valid = validator.validate('apiRequest', {
        headers: { 'x-api-key': 'secret123' },
      });
      const invalid = validator.validate('apiRequest', { headers: {} });

      expect(valid.valid).toBe(true);
      expect(invalid.valid).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe('middleware', () => {
    it('should create middleware', () => {
      validator.define('test', { body: { name: { required: true } } });

      const middleware = validator.middleware('test');
      expect(typeof middleware).toBe('function');
    });

    it('should call next on valid request', () => {
      validator.define('test', { body: { name: { required: true } } });

      const middleware = validator.middleware('test');
      const req = { body: { name: 'John' } };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 400 on invalid request', () => {
      validator.define('test', { body: { name: { required: true } } });

      const middleware = validator.middleware('test');
      const req = { body: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

describe('Content Type Validator Tests', () => {
  let contentValidator;

  beforeEach(() => {
    contentValidator = createContentTypeValidator();
  });

  describe('validate', () => {
    it('should validate JSON content type', () => {
      const result = contentValidator.validate('application/json');
      expect(result.valid).toBe(true);
    });

    it('should handle charset in content type', () => {
      const result = contentValidator.validate('application/json; charset=utf-8');
      expect(result.valid).toBe(true);
    });

    it('should reject missing content type', () => {
      const result = contentValidator.validate(null);
      expect(result.valid).toBe(false);
    });

    it('should reject unknown content type', () => {
      const result = contentValidator.validate('text/html');
      expect(result.valid).toBe(false);
    });
  });

  describe('allow and disallow', () => {
    it('should allow new type', () => {
      contentValidator.allow('text/html');

      const result = contentValidator.validate('text/html');
      expect(result.valid).toBe(true);
    });

    it('should disallow type', () => {
      contentValidator.disallow('application/json');

      const result = contentValidator.validate('application/json');
      expect(result.valid).toBe(false);
    });
  });

  describe('helpers', () => {
    it('should check isJSON', () => {
      expect(contentValidator.isJSON('application/json')).toBe(true);
      expect(contentValidator.isJSON('text/html')).toBe(false);
    });

    it('should check isFormData', () => {
      expect(contentValidator.isFormData('multipart/form-data; boundary=---')).toBe(true);
      expect(contentValidator.isFormData('application/json')).toBe(false);
    });
  });
});
