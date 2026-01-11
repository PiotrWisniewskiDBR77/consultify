/**
 * Data Transformation Tests
 * Tests for data transformation utilities
 *
 * @module tests/transform/data-transformer.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Data transformer implementation
const createTransformer = () => {
  const transforms = [];

  return {
    // Chain transforms
    pipe: (...fns) => {
      transforms.push(...fns);
      return this;
    },

    // Apply transforms
    apply: (data) => {
      return transforms.reduce((result, fn) => fn(result), data);
    },

    // Reset transforms
    reset: () => {
      transforms.length = 0;
      return this;
    },

    // Common transforms
    map: (fn) => {
      transforms.push((data) => {
        if (Array.isArray(data)) return data.map(fn);
        if (typeof data === 'object' && data !== null) {
          return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fn(v, k)]));
        }
        return fn(data);
      });
      return this;
    },

    filter: (predicate) => {
      transforms.push((data) => {
        if (Array.isArray(data)) return data.filter(predicate);
        if (typeof data === 'object' && data !== null) {
          return Object.fromEntries(Object.entries(data).filter(([k, v]) => predicate(v, k)));
        }
        return predicate(data) ? data : undefined;
      });
      return this;
    },

    pick: (...keys) => {
      transforms.push((data) => {
        if (typeof data !== 'object' || data === null) return data;
        return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
      });
      return this;
    },

    omit: (...keys) => {
      transforms.push((data) => {
        if (typeof data !== 'object' || data === null) return data;
        return Object.fromEntries(Object.entries(data).filter(([k]) => !keys.includes(k)));
      });
      return this;
    },

    rename: (mapping) => {
      transforms.push((data) => {
        if (typeof data !== 'object' || data === null) return data;
        return Object.fromEntries(Object.entries(data).map(([k, v]) => [mapping[k] || k, v]));
      });
      return this;
    },

    defaults: (defaults) => {
      transforms.push((data) => {
        if (typeof data !== 'object' || data === null) return data;
        return { ...defaults, ...data };
      });
      return this;
    },

    flatten: (depth = 1) => {
      transforms.push((data) => {
        if (!Array.isArray(data)) return data;
        return data.flat(depth);
      });
      return this;
    },

    unique: () => {
      transforms.push((data) => {
        if (!Array.isArray(data)) return data;
        return [...new Set(data)];
      });
      return this;
    },

    sort: (compareFn) => {
      transforms.push((data) => {
        if (!Array.isArray(data)) return data;
        return [...data].sort(compareFn);
      });
      return this;
    },

    groupBy: (keyFn) => {
      transforms.push((data) => {
        if (!Array.isArray(data)) return data;
        return data.reduce((acc, item) => {
          const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
          (acc[key] = acc[key] || []).push(item);
          return acc;
        }, {});
      });
      return this;
    },

    keyBy: (keyFn) => {
      transforms.push((data) => {
        if (!Array.isArray(data)) return data;
        return data.reduce((acc, item) => {
          const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
          acc[key] = item;
          return acc;
        }, {});
      });
      return this;
    },
  };
};

// Field transformer
const fieldTransformers = {
  trim: (value) => (typeof value === 'string' ? value.trim() : value),
  lowercase: (value) => (typeof value === 'string' ? value.toLowerCase() : value),
  uppercase: (value) => (typeof value === 'string' ? value.toUpperCase() : value),
  capitalize: (value) =>
    typeof value === 'string'
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : value,
  toNumber: (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  },
  toBoolean: (value) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return Boolean(value);
  },
  toDate: (value) => {
    if (value instanceof Date) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date;
  },
  toArray: (value) => (Array.isArray(value) ? value : [value]),
  compact: (value) => (Array.isArray(value) ? value.filter(Boolean) : value),
  uniq: (value) => (Array.isArray(value) ? [...new Set(value)] : value),
};

describe('Data Transformer Tests', () => {
  let transformer;

  beforeEach(() => {
    transformer = createTransformer();
  });

  // ═══════════════════════════════════════════════════════════════════
  // PIPE
  // ═══════════════════════════════════════════════════════════════════

  describe('pipe', () => {
    it('should chain transforms', () => {
      const result = transformer
        .pipe(
          (x) => x * 2,
          (x) => x + 10,
          (x) => x.toString()
        )
        .apply(5);

      expect(result).toBe('20');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MAP
  // ═══════════════════════════════════════════════════════════════════

  describe('map', () => {
    it('should map array', () => {
      const result = transformer.map((x) => x * 2).apply([1, 2, 3]);

      expect(result).toEqual([2, 4, 6]);
    });

    it('should map object values', () => {
      const result = transformer.map((x) => x * 2).apply({ a: 1, b: 2 });

      expect(result).toEqual({ a: 2, b: 4 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FILTER
  // ═══════════════════════════════════════════════════════════════════

  describe('filter', () => {
    it('should filter array', () => {
      const result = transformer.filter((x) => x > 2).apply([1, 2, 3, 4]);

      expect(result).toEqual([3, 4]);
    });

    it('should filter object', () => {
      const result = transformer.filter((v) => v > 1).apply({ a: 1, b: 2, c: 3 });

      expect(result).toEqual({ b: 2, c: 3 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PICK / OMIT
  // ═══════════════════════════════════════════════════════════════════

  describe('pick / omit', () => {
    it('should pick keys', () => {
      const result = transformer.pick('a', 'c').apply({ a: 1, b: 2, c: 3 });

      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should omit keys', () => {
      const result = transformer.omit('b').apply({ a: 1, b: 2, c: 3 });

      expect(result).toEqual({ a: 1, c: 3 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RENAME
  // ═══════════════════════════════════════════════════════════════════

  describe('rename', () => {
    it('should rename keys', () => {
      const result = transformer
        .rename({ oldName: 'newName' })
        .apply({ oldName: 'value', other: 'stays' });

      expect(result).toEqual({ newName: 'value', other: 'stays' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEFAULTS
  // ═══════════════════════════════════════════════════════════════════

  describe('defaults', () => {
    it('should apply defaults', () => {
      const result = transformer.defaults({ a: 1, b: 2 }).apply({ b: 3, c: 4 });

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FLATTEN
  // ═══════════════════════════════════════════════════════════════════

  describe('flatten', () => {
    it('should flatten array', () => {
      const result = transformer.flatten().apply([
        [1, 2],
        [3, 4],
      ]);

      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should flatten to depth', () => {
      const result = transformer.flatten(2).apply([[[1]], [[2]]]);

      expect(result).toEqual([1, 2]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UNIQUE
  // ═══════════════════════════════════════════════════════════════════

  describe('unique', () => {
    it('should remove duplicates', () => {
      const result = transformer.unique().apply([1, 2, 2, 3, 3, 3]);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SORT
  // ═══════════════════════════════════════════════════════════════════

  describe('sort', () => {
    it('should sort array', () => {
      const result = transformer.sort((a, b) => b - a).apply([3, 1, 2]);

      expect(result).toEqual([3, 2, 1]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GROUP BY
  // ═══════════════════════════════════════════════════════════════════

  describe('groupBy', () => {
    it('should group by key', () => {
      const result = transformer.groupBy('type').apply([
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ]);

      expect(result.a.length).toBe(2);
      expect(result.b.length).toBe(1);
    });

    it('should group by function', () => {
      const result = transformer.groupBy((x) => (x > 5 ? 'high' : 'low')).apply([1, 3, 7, 9]);

      expect(result.low).toEqual([1, 3]);
      expect(result.high).toEqual([7, 9]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // KEY BY
  // ═══════════════════════════════════════════════════════════════════

  describe('keyBy', () => {
    it('should key by field', () => {
      const result = transformer.keyBy('id').apply([
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ]);

      expect(result.a.name).toBe('Alice');
      expect(result.b.name).toBe('Bob');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════

  describe('reset', () => {
    it('should reset transforms', () => {
      transformer.map((x) => x * 2);
      transformer.reset();

      const result = transformer.apply([1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });
  });
});

describe('Field Transformers Tests', () => {
  describe('string transforms', () => {
    it('should trim', () => {
      expect(fieldTransformers.trim('  hello  ')).toBe('hello');
    });

    it('should lowercase', () => {
      expect(fieldTransformers.lowercase('HELLO')).toBe('hello');
    });

    it('should uppercase', () => {
      expect(fieldTransformers.uppercase('hello')).toBe('HELLO');
    });

    it('should capitalize', () => {
      expect(fieldTransformers.capitalize('hELLO')).toBe('Hello');
    });
  });

  describe('type coercion', () => {
    it('should convert to number', () => {
      expect(fieldTransformers.toNumber('42')).toBe(42);
      expect(fieldTransformers.toNumber('3.14')).toBe(3.14);
      expect(fieldTransformers.toNumber('abc')).toBe('abc');
    });

    it('should convert to boolean', () => {
      expect(fieldTransformers.toBoolean('true')).toBe(true);
      expect(fieldTransformers.toBoolean('false')).toBe(false);
      expect(fieldTransformers.toBoolean('1')).toBe(true);
    });

    it('should convert to date', () => {
      const result = fieldTransformers.toDate('2024-01-15');
      expect(result).toBeInstanceOf(Date);
    });

    it('should convert to array', () => {
      expect(fieldTransformers.toArray('item')).toEqual(['item']);
      expect(fieldTransformers.toArray([1, 2])).toEqual([1, 2]);
    });
  });

  describe('array transforms', () => {
    it('should compact', () => {
      expect(fieldTransformers.compact([1, 0, null, 2, '', 3])).toEqual([1, 2, 3]);
    });

    it('should uniq', () => {
      expect(fieldTransformers.uniq([1, 2, 2, 3])).toEqual([1, 2, 3]);
    });
  });
});
