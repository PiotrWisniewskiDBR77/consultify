/**
 * Deep Clone Tests
 * Tests for deep cloning utilities
 *
 * @module tests/cloning/deep-clone.test.js
 */

import { describe, it, expect } from 'vitest';

// Deep clone implementation
const deepClone = (obj, seen = new WeakMap()) => {
  // Handle primitives and null
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj)) {
    return seen.get(obj);
  }

  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  // Handle RegExp
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }

  // Handle Array
  if (Array.isArray(obj)) {
    const cloned = [];
    seen.set(obj, cloned);
    obj.forEach((item, index) => {
      cloned[index] = deepClone(item, seen);
    });
    return cloned;
  }

  // Handle Map
  if (obj instanceof Map) {
    const cloned = new Map();
    seen.set(obj, cloned);
    obj.forEach((value, key) => {
      cloned.set(deepClone(key, seen), deepClone(value, seen));
    });
    return cloned;
  }

  // Handle Set
  if (obj instanceof Set) {
    const cloned = new Set();
    seen.set(obj, cloned);
    obj.forEach((value) => {
      cloned.add(deepClone(value, seen));
    });
    return cloned;
  }

  // Handle plain objects
  const cloned = Object.create(Object.getPrototypeOf(obj));
  seen.set(obj, cloned);

  // Copy own properties
  for (const key of Reflect.ownKeys(obj)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor) {
      if ('value' in descriptor) {
        descriptor.value = deepClone(descriptor.value, seen);
      }
      Object.defineProperty(cloned, key, descriptor);
    }
  }

  return cloned;
};

// Deep freeze implementation
const deepFreeze = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return obj;
};

// Deep equal implementation
const deepEqual = (a, b, seen = new WeakMap()) => {
  // Same reference or primitives
  if (a === b) return true;

  // Type check
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;

  // Circular reference check
  if (seen.has(a)) {
    return seen.get(a) === b;
  }
  seen.set(a, b);

  // Array check
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // Date check
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // RegExp check
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  // Map check
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
      if (!b.has(key) || !deepEqual(val, b.get(key), seen)) {
        return false;
      }
    }
    return true;
  }

  // Set check
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const val of a) {
      if (!b.has(val)) return false;
    }
    return true;
  }

  // Object check
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key], seen)
  );
};

describe('Deep Clone Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // PRIMITIVES
  // ═══════════════════════════════════════════════════════════════════

  describe('Primitives', () => {
    it('should clone null', () => {
      expect(deepClone(null)).toBeNull();
    });

    it('should clone undefined', () => {
      expect(deepClone(undefined)).toBeUndefined();
    });

    it('should clone number', () => {
      expect(deepClone(42)).toBe(42);
    });

    it('should clone string', () => {
      expect(deepClone('hello')).toBe('hello');
    });

    it('should clone boolean', () => {
      expect(deepClone(true)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ARRAYS
  // ═══════════════════════════════════════════════════════════════════

  describe('Arrays', () => {
    it('should clone array', () => {
      const arr = [1, 2, 3];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
    });

    it('should clone nested arrays', () => {
      const arr = [
        [1, 2],
        [3, [4, 5]],
      ];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned[1][1]).not.toBe(arr[1][1]);
    });

    it('should not share references', () => {
      const nested = [1, 2];
      const arr = [nested];
      const cloned = deepClone(arr);

      nested.push(3);

      expect(cloned[0]).toEqual([1, 2]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // OBJECTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Objects', () => {
    it('should clone plain object', () => {
      const obj = { a: 1, b: 2 };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('should clone nested objects', () => {
      const obj = { a: { b: { c: 3 } } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.a.b).not.toBe(obj.a.b);
    });

    it('should clone mixed arrays and objects', () => {
      const data = {
        items: [{ id: 1 }, { id: 2 }],
        metadata: { count: 2 },
      };
      const cloned = deepClone(data);

      expect(cloned).toEqual(data);
      expect(cloned.items[0]).not.toBe(data.items[0]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SPECIAL TYPES
  // ═══════════════════════════════════════════════════════════════════

  describe('Special Types', () => {
    it('should clone Date', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
      expect(cloned.getTime()).toBe(date.getTime());
    });

    it('should clone RegExp', () => {
      const regex = /test/gi;
      const cloned = deepClone(regex);

      expect(cloned.source).toBe(regex.source);
      expect(cloned.flags).toBe(regex.flags);
      expect(cloned).not.toBe(regex);
    });

    it('should clone Map', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      const cloned = deepClone(map);

      expect(cloned.get('a')).toBe(1);
      expect(cloned).not.toBe(map);
    });

    it('should clone Set', () => {
      const set = new Set([1, 2, 3]);
      const cloned = deepClone(set);

      expect(cloned.has(1)).toBe(true);
      expect(cloned.size).toBe(3);
      expect(cloned).not.toBe(set);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CIRCULAR REFERENCES
  // ═══════════════════════════════════════════════════════════════════

  describe('Circular References', () => {
    it('should handle circular reference in object', () => {
      const obj = { a: 1 };
      obj.self = obj;

      const cloned = deepClone(obj);

      expect(cloned.a).toBe(1);
      expect(cloned.self).toBe(cloned);
    });

    it('should handle circular reference in array', () => {
      const arr = [1, 2];
      arr.push(arr);

      const cloned = deepClone(arr);

      expect(cloned[0]).toBe(1);
      expect(cloned[2]).toBe(cloned);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEEP FREEZE
  // ═══════════════════════════════════════════════════════════════════

  describe('Deep Freeze', () => {
    it('should freeze object', () => {
      const obj = { a: 1 };
      deepFreeze(obj);

      expect(() => {
        obj.a = 2;
      }).toThrow();
    });

    it('should freeze nested objects', () => {
      const obj = { a: { b: 1 } };
      deepFreeze(obj);

      expect(() => {
        obj.a.b = 2;
      }).toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEEP EQUAL
  // ═══════════════════════════════════════════════════════════════════

  describe('Deep Equal', () => {
    it('should compare primitives', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('a', 'a')).toBe(true);
    });

    it('should compare arrays', () => {
      expect(deepEqual([1, 2], [1, 2])).toBe(true);
      expect(deepEqual([1, 2], [1, 3])).toBe(false);
    });

    it('should compare objects', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('should compare nested structures', () => {
      const a = { x: [1, { y: 2 }] };
      const b = { x: [1, { y: 2 }] };
      const c = { x: [1, { y: 3 }] };

      expect(deepEqual(a, b)).toBe(true);
      expect(deepEqual(a, c)).toBe(false);
    });

    it('should compare Date', () => {
      const d1 = new Date('2024-01-01');
      const d2 = new Date('2024-01-01');
      const d3 = new Date('2024-01-02');

      expect(deepEqual(d1, d2)).toBe(true);
      expect(deepEqual(d1, d3)).toBe(false);
    });
  });
});
