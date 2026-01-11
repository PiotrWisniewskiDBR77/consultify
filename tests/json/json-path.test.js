/**
 * JSON Path and Data Querying Tests
 * Tests for JSON path selectors and querying
 *
 * @module tests/json/json-path.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// JSON Path selector
const createJsonPath = () => {
  return {
    get: (obj, path) => {
      if (!path || path === '$') return obj;

      const parts = path
        .replace(/^\$\.?/, '')
        .split(/\.|\[(\d+)\]/)
        .filter((p) => p !== '' && p !== undefined);

      let current = obj;

      for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
      }

      return current;
    },

    set: (obj, path, value) => {
      if (!path || path === '$') return value;

      const parts = path
        .replace(/^\$\.?/, '')
        .split(/\.|\[(\d+)\]/)
        .filter((p) => p !== '' && p !== undefined);

      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined) {
          current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        }
        current = current[part];
      }

      current[parts[parts.length - 1]] = value;
      return obj;
    },

    has: (obj, path) => {
      return this.get(obj, path) !== undefined;
    },

    delete: (obj, path) => {
      const parts = path
        .replace(/^\$\.?/, '')
        .split(/\.|\[(\d+)\]/)
        .filter((p) => p !== '' && p !== undefined);

      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        if (current === null || current === undefined) return false;
        current = current[parts[i]];
      }

      if (current === null || current === undefined) return false;

      delete current[parts[parts.length - 1]];
      return true;
    },

    query: (obj, predicate, path = '$') => {
      const results = [];

      const traverse = (current, currentPath) => {
        if (current === null || current === undefined) return;

        if (predicate(current, currentPath)) {
          results.push({ path: currentPath, value: current });
        }

        if (Array.isArray(current)) {
          current.forEach((item, i) => traverse(item, `${currentPath}[${i}]`));
        } else if (typeof current === 'object') {
          for (const [key, value] of Object.entries(current)) {
            traverse(value, `${currentPath}.${key}`);
          }
        }
      };

      traverse(obj, path);
      return results;
    },

    flatten: (obj, prefix = '') => {
      const result = {};

      const traverse = (current, path) => {
        if (current === null || typeof current !== 'object') {
          result[path || '$'] = current;
          return;
        }

        if (Array.isArray(current)) {
          current.forEach((item, i) => traverse(item, `${path}[${i}]`));
        } else {
          for (const [key, value] of Object.entries(current)) {
            traverse(value, path ? `${path}.${key}` : key);
          }
        }
      };

      traverse(obj, prefix);
      return result;
    },

    unflatten: (obj) => {
      const result = {};

      for (const [path, value] of Object.entries(obj)) {
        this.set(result, path, value);
      }

      return result;
    },
  };
};

// JSON diff
const createJsonDiff = () => {
  return {
    diff: (obj1, obj2, path = '') => {
      const changes = [];

      const compare = (a, b, currentPath) => {
        if (a === b) return;

        if (typeof a !== typeof b) {
          changes.push({ type: 'change', path: currentPath, from: a, to: b });
          return;
        }

        if (a === null || b === null || typeof a !== 'object') {
          if (a !== b) {
            changes.push({ type: 'change', path: currentPath, from: a, to: b });
          }
          return;
        }

        if (Array.isArray(a) !== Array.isArray(b)) {
          changes.push({ type: 'change', path: currentPath, from: a, to: b });
          return;
        }

        const aKeys = new Set(Object.keys(a));
        const bKeys = new Set(Object.keys(b));

        // Added keys
        for (const key of bKeys) {
          if (!aKeys.has(key)) {
            changes.push({ type: 'add', path: `${currentPath}.${key}`, value: b[key] });
          }
        }

        // Removed keys
        for (const key of aKeys) {
          if (!bKeys.has(key)) {
            changes.push({ type: 'remove', path: `${currentPath}.${key}`, value: a[key] });
          }
        }

        // Changed keys
        for (const key of aKeys) {
          if (bKeys.has(key)) {
            compare(a[key], b[key], `${currentPath}.${key}`);
          }
        }
      };

      compare(obj1, obj2, path || '$');
      return changes;
    },

    apply: (obj, changes) => {
      const jsonPath = createJsonPath();
      const result = JSON.parse(JSON.stringify(obj));

      for (const change of changes) {
        switch (change.type) {
          case 'add':
          case 'change':
            jsonPath.set(result, change.path, change.to ?? change.value);
            break;
          case 'remove':
            jsonPath.delete(result, change.path);
            break;
        }
      }

      return result;
    },
  };
};

// JSON schema validator (simplified)
const createJsonValidator = () => {
  return {
    validate: (data, schema) => {
      const errors = [];

      const check = (value, schemaNode, path) => {
        // Type check
        if (schemaNode.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== schemaNode.type) {
            errors.push({ path, message: `Expected ${schemaNode.type}, got ${actualType}` });
            return;
          }
        }

        // Required properties
        if (schemaNode.required && schemaNode.properties) {
          for (const prop of schemaNode.required) {
            if (value[prop] === undefined) {
              errors.push({ path: `${path}.${prop}`, message: 'Required property missing' });
            }
          }
        }

        // Properties
        if (schemaNode.properties && typeof value === 'object') {
          for (const [key, propSchema] of Object.entries(schemaNode.properties)) {
            if (value[key] !== undefined) {
              check(value[key], propSchema, `${path}.${key}`);
            }
          }
        }

        // Array items
        if (schemaNode.items && Array.isArray(value)) {
          value.forEach((item, i) => {
            check(item, schemaNode.items, `${path}[${i}]`);
          });
        }

        // Enum
        if (schemaNode.enum && !schemaNode.enum.includes(value)) {
          errors.push({ path, message: `Value must be one of: ${schemaNode.enum.join(', ')}` });
        }

        // Min/max
        if (typeof value === 'number') {
          if (schemaNode.minimum !== undefined && value < schemaNode.minimum) {
            errors.push({ path, message: `Value must be >= ${schemaNode.minimum}` });
          }
          if (schemaNode.maximum !== undefined && value > schemaNode.maximum) {
            errors.push({ path, message: `Value must be <= ${schemaNode.maximum}` });
          }
        }
      };

      check(data, schema, '$');
      return { valid: errors.length === 0, errors };
    },
  };
};

describe('JSON Path Tests', () => {
  let jp;
  let data;

  beforeEach(() => {
    jp = createJsonPath();
    data = {
      store: {
        books: [
          { title: 'Book A', price: 10 },
          { title: 'Book B', price: 20 },
        ],
        name: 'Test Store',
      },
    };
  });

  it('should get value', () => {
    expect(jp.get(data, '$.store.name')).toBe('Test Store');
    expect(jp.get(data, 'store.books[0].title')).toBe('Book A');
  });

  it('should set value', () => {
    jp.set(data, '$.store.name', 'New Name');
    expect(data.store.name).toBe('New Name');
  });

  it('should check has', () => {
    expect(jp.has(data, '$.store.name')).toBe(true);
    expect(jp.has(data, '$.store.missing')).toBe(false);
  });

  it('should delete', () => {
    jp.delete(data, '$.store.name');
    expect(data.store.name).toBeUndefined();
  });

  it('should flatten', () => {
    const flat = jp.flatten({ a: { b: 1, c: 2 } });
    expect(flat['a.b']).toBe(1);
    expect(flat['a.c']).toBe(2);
  });
});

describe('JSON Diff Tests', () => {
  let differ;

  beforeEach(() => {
    differ = createJsonDiff();
  });

  it('should detect additions', () => {
    const changes = differ.diff({ a: 1 }, { a: 1, b: 2 });
    expect(changes.find((c) => c.type === 'add' && c.path.includes('b'))).toBeTruthy();
  });

  it('should detect removals', () => {
    const changes = differ.diff({ a: 1, b: 2 }, { a: 1 });
    expect(changes.find((c) => c.type === 'remove' && c.path.includes('b'))).toBeTruthy();
  });

  it('should detect changes', () => {
    const changes = differ.diff({ a: 1 }, { a: 2 });
    expect(changes.find((c) => c.type === 'change')).toBeTruthy();
  });

  it('should apply changes', () => {
    const original = { a: 1 };
    const changes = [{ type: 'add', path: '$.b', value: 2 }];
    const result = differ.apply(original, changes);
    expect(result.b).toBe(2);
  });
});

describe('JSON Validator Tests', () => {
  let validator;

  beforeEach(() => {
    validator = createJsonValidator();
  });

  it('should validate type', () => {
    const schema = { type: 'object' };
    expect(validator.validate({}, schema).valid).toBe(true);
    expect(validator.validate('string', schema).valid).toBe(false);
  });

  it('should validate required', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    };

    expect(validator.validate({}, schema).valid).toBe(false);
    expect(validator.validate({ name: 'test' }, schema).valid).toBe(true);
  });

  it('should validate enum', () => {
    const schema = { enum: ['a', 'b', 'c'] };

    expect(validator.validate('a', schema).valid).toBe(true);
    expect(validator.validate('d', schema).valid).toBe(false);
  });

  it('should validate min/max', () => {
    const schema = { type: 'number', minimum: 0, maximum: 100 };

    expect(validator.validate(50, schema).valid).toBe(true);
    expect(validator.validate(-1, schema).valid).toBe(false);
  });
});
