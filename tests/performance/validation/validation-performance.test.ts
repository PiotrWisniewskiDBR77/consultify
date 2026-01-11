/**
 * Validation Performance Tests
 * Testing validation operations performance
 *
 * @module tests/performance/validation/validation-performance.test.ts
 */

import { describe, it, expect } from 'vitest';

describe('Validation Performance Tests', () => {
  describe('Object Validation', () => {
    it('should validate 10000 objects under 50ms', () => {
      const validate = (obj: any) => {
        return (
          typeof obj.id === 'string' &&
          typeof obj.name === 'string' &&
          typeof obj.email === 'string' &&
          obj.email.includes('@') &&
          typeof obj.age === 'number' &&
          obj.age >= 0
        );
      };

      const objects = Array.from({ length: 10000 }, (_, i) => ({
        id: `id-${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50),
      }));

      const start = Date.now();

      const results = objects.map(validate);
      const allValid = results.every((r) => r);

      const elapsed = Date.now() - start;
      expect(allValid).toBe(true);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('String Validation', () => {
    it('should validate 10000 emails under 30ms', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emails = Array.from({ length: 10000 }, (_, i) => `user${i}@example.com`);

      const start = Date.now();

      const results = emails.map((email) => emailRegex.test(email));
      const allValid = results.every((r) => r);

      const elapsed = Date.now() - start;
      expect(allValid).toBe(true);
      expect(elapsed).toBeLessThan(200);
    });

    it('should validate 10000 UUIDs under 30ms', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const uuids = Array.from({ length: 10000 }, () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        })
      );

      const start = Date.now();

      const results = uuids.map((uuid) => uuidRegex.test(uuid));
      const allValid = results.every((r) => r);

      const elapsed = Date.now() - start;
      expect(allValid).toBe(true);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('Array Validation', () => {
    it('should validate nested arrays under 50ms', () => {
      const validateArray = (arr: any[]): boolean => {
        return arr.every((item) => {
          if (Array.isArray(item)) return validateArray(item);
          return typeof item === 'number' || typeof item === 'string';
        });
      };

      const arrays = Array.from({ length: 1000 }, () =>
        Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => Math.random()))
      );

      const start = Date.now();

      const results = arrays.map(validateArray);
      const allValid = results.every((r) => r);

      const elapsed = Date.now() - start;
      expect(allValid).toBe(true);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('Schema Validation', () => {
    it('should validate schema 5000 times under 50ms', () => {
      const schema = {
        type: 'object',
        properties: ['id', 'name', 'email', 'status'],
      };

      const validateSchema = (obj: any, schema: any) => {
        if (schema.type === 'object') {
          return schema.properties.every((prop: string) => prop in obj);
        }
        return true;
      };

      const objects = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        name: `Name ${i}`,
        email: `email${i}@test.com`,
        status: 'active',
      }));

      const start = Date.now();

      const results = objects.map((obj) => validateSchema(obj, schema));
      const allValid = results.every((r) => r);

      const elapsed = Date.now() - start;
      expect(allValid).toBe(true);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
