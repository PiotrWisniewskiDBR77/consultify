/**
 * Object Utils Tests
 * Tests for object utility functions
 *
 * @module tests/utils/object-utils.test.js
 */

import { describe, it, expect } from 'vitest';

// Object utilities implementation
const objectUtils = {
  deepClone: (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => objectUtils.deepClone(item));
    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = objectUtils.deepClone(obj[key]);
      }
    }
    return cloned;
  },

  deepMerge: (target, source) => {
    const result = { ...target };
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = objectUtils.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    return result;
  },

  pick: (obj, keys) => {
    const result = {};
    keys.forEach((key) => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  },

  omit: (obj, keys) => {
    const result = { ...obj };
    keys.forEach((key) => delete result[key]);
    return result;
  },

  get: (obj, path, defaultValue = undefined) => {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result === null || result === undefined) return defaultValue;
      result = result[key];
    }
    return result === undefined ? defaultValue : result;
  },

  set: (obj, path, value) => {
    const keys = path.split('.');
    const result = objectUtils.deepClone(obj);
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return result;
  },

  has: (obj, path) => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (!current || !(key in current)) return false;
      current = current[key];
    }
    return true;
  },

  isEmpty: (obj) => {
    if (!obj) return true;
    return Object.keys(obj).length === 0;
  },

  keys: (obj) => Object.keys(obj || {}),
  values: (obj) => Object.values(obj || {}),
  entries: (obj) => Object.entries(obj || {}),

  fromEntries: (entries) => Object.fromEntries(entries),

  mapKeys: (obj, fn) => {
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
      result[fn(key, value)] = value;
    });
    return result;
  },

  mapValues: (obj, fn) => {
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
      result[key] = fn(value, key);
    });
    return result;
  },

  filter: (obj, predicate) => {
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (predicate(value, key)) {
        result[key] = value;
      }
    });
    return result;
  },

  invert: (obj) => {
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
      result[String(value)] = key;
    });
    return result;
  },

  flatten: (obj, prefix = '') => {
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, objectUtils.flatten(value, newKey));
      } else {
        result[newKey] = value;
      }
    });
    return result;
  },

  unflatten: (obj) => {
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
      const keys = key.split('.');
      let current = result;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    });
    return result;
  },

  isEqual: (a, b) => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => objectUtils.isEqual(a[key], b[key]));
  },
};

describe('Object Utils Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // DEEP CLONE
  // ═══════════════════════════════════════════════════════════════════

  describe('deepClone', () => {
    it('should clone object', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = objectUtils.deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should clone arrays', () => {
      const arr = [1, { a: 2 }, [3, 4]];
      const cloned = objectUtils.deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
    });

    it('should handle primitives', () => {
      expect(objectUtils.deepClone(5)).toBe(5);
      expect(objectUtils.deepClone('test')).toBe('test');
      expect(objectUtils.deepClone(null)).toBe(null);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEEP MERGE
  // ═══════════════════════════════════════════════════════════════════

  describe('deepMerge', () => {
    it('should merge objects', () => {
      const a = { x: 1, nested: { a: 1 } };
      const b = { y: 2, nested: { b: 2 } };

      const result = objectUtils.deepMerge(a, b);

      expect(result).toEqual({ x: 1, y: 2, nested: { a: 1, b: 2 } });
    });

    it('should override with source values', () => {
      const a = { x: 1 };
      const b = { x: 2 };

      expect(objectUtils.deepMerge(a, b)).toEqual({ x: 2 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PICK & OMIT
  // ═══════════════════════════════════════════════════════════════════

  describe('pick', () => {
    it('should pick keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(objectUtils.pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('should ignore missing keys', () => {
      const obj = { a: 1 };
      expect(objectUtils.pick(obj, ['a', 'b'])).toEqual({ a: 1 });
    });
  });

  describe('omit', () => {
    it('should omit keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(objectUtils.omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET & SET & HAS
  // ═══════════════════════════════════════════════════════════════════

  describe('get', () => {
    it('should get nested value', () => {
      const obj = { a: { b: { c: 3 } } };
      expect(objectUtils.get(obj, 'a.b.c')).toBe(3);
    });

    it('should return default for missing path', () => {
      const obj = { a: 1 };
      expect(objectUtils.get(obj, 'b.c', 'default')).toBe('default');
    });
  });

  describe('set', () => {
    it('should set nested value', () => {
      const obj = { a: { b: 1 } };
      const result = objectUtils.set(obj, 'a.b', 2);

      expect(result.a.b).toBe(2);
      expect(obj.a.b).toBe(1); // Original unchanged
    });

    it('should create path if not exists', () => {
      const obj = {};
      const result = objectUtils.set(obj, 'a.b.c', 3);

      expect(result.a.b.c).toBe(3);
    });
  });

  describe('has', () => {
    it('should check if path exists', () => {
      const obj = { a: { b: 1 } };

      expect(objectUtils.has(obj, 'a.b')).toBe(true);
      expect(objectUtils.has(obj, 'a.c')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EMPTY CHECK
  // ═══════════════════════════════════════════════════════════════════

  describe('isEmpty', () => {
    it('should return true for empty object', () => {
      expect(objectUtils.isEmpty({})).toBe(true);
    });

    it('should return false for non-empty', () => {
      expect(objectUtils.isEmpty({ a: 1 })).toBe(false);
    });

    it('should return true for null', () => {
      expect(objectUtils.isEmpty(null)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MAP KEYS & VALUES
  // ═══════════════════════════════════════════════════════════════════

  describe('mapKeys', () => {
    it('should map keys', () => {
      const obj = { a: 1, b: 2 };
      const result = objectUtils.mapKeys(obj, (k) => k.toUpperCase());

      expect(result).toEqual({ A: 1, B: 2 });
    });
  });

  describe('mapValues', () => {
    it('should map values', () => {
      const obj = { a: 1, b: 2 };
      const result = objectUtils.mapValues(obj, (v) => v * 2);

      expect(result).toEqual({ a: 2, b: 4 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FILTER
  // ═══════════════════════════════════════════════════════════════════

  describe('filter', () => {
    it('should filter by value', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = objectUtils.filter(obj, (v) => v > 1);

      expect(result).toEqual({ b: 2, c: 3 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // INVERT
  // ═══════════════════════════════════════════════════════════════════

  describe('invert', () => {
    it('should invert keys and values', () => {
      const obj = { a: '1', b: '2' };
      expect(objectUtils.invert(obj)).toEqual({ 1: 'a', 2: 'b' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FLATTEN & UNFLATTEN
  // ═══════════════════════════════════════════════════════════════════

  describe('flatten', () => {
    it('should flatten nested object', () => {
      const obj = { a: { b: { c: 1 } }, d: 2 };
      const result = objectUtils.flatten(obj);

      expect(result).toEqual({ 'a.b.c': 1, d: 2 });
    });
  });

  describe('unflatten', () => {
    it('should unflatten dotted keys', () => {
      const obj = { 'a.b.c': 1, d: 2 };
      const result = objectUtils.unflatten(obj);

      expect(result).toEqual({ a: { b: { c: 1 } }, d: 2 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // IS EQUAL
  // ═══════════════════════════════════════════════════════════════════

  describe('isEqual', () => {
    it('should compare equal objects', () => {
      expect(objectUtils.isEqual({ a: 1 }, { a: 1 })).toBe(true);
    });

    it('should compare nested objects', () => {
      expect(objectUtils.isEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    });

    it('should detect differences', () => {
      expect(objectUtils.isEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('should compare primitives', () => {
      expect(objectUtils.isEqual(5, 5)).toBe(true);
      expect(objectUtils.isEqual(5, '5')).toBe(false);
    });
  });
});
