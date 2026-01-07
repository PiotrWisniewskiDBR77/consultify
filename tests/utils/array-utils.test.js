/**
 * Array Utils Tests
 * Tests for array utility functions
 * 
 * @module tests/utils/array-utils.test.js
 */

import { describe, it, expect } from 'vitest';

// Array utilities implementation
const arrayUtils = {
    unique: (arr) => [...new Set(arr)],

    uniqueBy: (arr, key) => {
        const seen = new Set();
        return arr.filter(item => {
            const k = typeof key === 'function' ? key(item) : item[key];
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    },

    flatten: (arr, depth = 1) => arr.flat(depth),
    flattenDeep: (arr) => arr.flat(Infinity),

    chunk: (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    },

    groupBy: (arr, key) => {
        return arr.reduce((groups, item) => {
            const k = typeof key === 'function' ? key(item) : item[key];
            groups[k] = groups[k] || [];
            groups[k].push(item);
            return groups;
        }, {});
    },

    partition: (arr, predicate) => {
        const truthy = [];
        const falsy = [];
        arr.forEach(item => {
            if (predicate(item)) truthy.push(item);
            else falsy.push(item);
        });
        return [truthy, falsy];
    },

    shuffle: (arr) => {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },

    sample: (arr, n = 1) => {
        const shuffled = arrayUtils.shuffle(arr);
        return n === 1 ? shuffled[0] : shuffled.slice(0, n);
    },

    first: (arr, n) => n === undefined ? arr[0] : arr.slice(0, n),
    last: (arr, n) => n === undefined ? arr[arr.length - 1] : arr.slice(-n),

    compact: (arr) => arr.filter(Boolean),

    without: (arr, ...values) => arr.filter(v => !values.includes(v)),

    intersection: (arr1, arr2) => arr1.filter(v => arr2.includes(v)),

    union: (arr1, arr2) => [...new Set([...arr1, ...arr2])],

    difference: (arr1, arr2) => arr1.filter(v => !arr2.includes(v)),

    zip: (...arrays) => {
        const maxLen = Math.max(...arrays.map(a => a.length));
        return Array.from({ length: maxLen }, (_, i) =>
            arrays.map(a => a[i])
        );
    },

    unzip: (arr) => {
        if (arr.length === 0) return [];
        const len = arr[0].length;
        return Array.from({ length: len }, (_, i) =>
            arr.map(subArr => subArr[i])
        );
    },

    range: (start, end, step = 1) => {
        const result = [];
        for (let i = start; i < end; i += step) {
            result.push(i);
        }
        return result;
    },

    sortBy: (arr, key) => {
        return [...arr].sort((a, b) => {
            const valA = typeof key === 'function' ? key(a) : a[key];
            const valB = typeof key === 'function' ? key(b) : b[key];
            if (valA < valB) return -1;
            if (valA > valB) return 1;
            return 0;
        });
    },

    sum: (arr) => arr.reduce((a, b) => a + b, 0),
    avg: (arr) => arr.length ? arrayUtils.sum(arr) / arr.length : 0,
    min: (arr) => Math.min(...arr),
    max: (arr) => Math.max(...arr),

    countBy: (arr, key) => {
        return arr.reduce((counts, item) => {
            const k = typeof key === 'function' ? key(item) : item[key];
            counts[k] = (counts[k] || 0) + 1;
            return counts;
        }, {});
    },

    keyBy: (arr, key) => {
        return arr.reduce((result, item) => {
            const k = typeof key === 'function' ? key(item) : item[key];
            result[k] = item;
            return result;
        }, {});
    },

    move: (arr, from, to) => {
        const result = [...arr];
        const item = result.splice(from, 1)[0];
        result.splice(to, 0, item);
        return result;
    },

    isEmpty: (arr) => !arr || arr.length === 0,
};

describe('Array Utils Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // UNIQUE
    // ═══════════════════════════════════════════════════════════════════

    describe('unique', () => {
        it('should remove duplicates', () => {
            expect(arrayUtils.unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
        });

        it('should handle strings', () => {
            expect(arrayUtils.unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
        });
    });

    describe('uniqueBy', () => {
        it('should unique by key', () => {
            const arr = [{ id: 1, name: 'a' }, { id: 1, name: 'b' }, { id: 2, name: 'c' }];
            const result = arrayUtils.uniqueBy(arr, 'id');

            expect(result.length).toBe(2);
        });

        it('should unique by function', () => {
            const arr = [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 4 }];
            const result = arrayUtils.uniqueBy(arr, item => item.x);

            expect(result.length).toBe(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FLATTEN
    // ═══════════════════════════════════════════════════════════════════

    describe('flatten', () => {
        it('should flatten one level', () => {
            expect(arrayUtils.flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
        });

        it('should flatten with depth', () => {
            expect(arrayUtils.flatten([[[1, 2]], [[3, 4]]], 2)).toEqual([1, 2, 3, 4]);
        });
    });

    describe('flattenDeep', () => {
        it('should flatten all levels', () => {
            expect(arrayUtils.flattenDeep([[1, [2, [3, [4]]]]])).toEqual([1, 2, 3, 4]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CHUNK
    // ═══════════════════════════════════════════════════════════════════

    describe('chunk', () => {
        it('should split into chunks', () => {
            expect(arrayUtils.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        });

        it('should handle even division', () => {
            expect(arrayUtils.chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GROUP BY
    // ═══════════════════════════════════════════════════════════════════

    describe('groupBy', () => {
        it('should group by key', () => {
            const arr = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }];
            const result = arrayUtils.groupBy(arr, 'type');

            expect(Object.keys(result)).toHaveLength(2);
            expect(result.a).toHaveLength(2);
            expect(result.b).toHaveLength(1);
        });

        it('should group by function', () => {
            const arr = [1, 2, 3, 4, 5];
            const result = arrayUtils.groupBy(arr, n => n % 2 === 0 ? 'even' : 'odd');

            expect(result.even).toEqual([2, 4]);
            expect(result.odd).toEqual([1, 3, 5]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PARTITION
    // ═══════════════════════════════════════════════════════════════════

    describe('partition', () => {
        it('should partition by predicate', () => {
            const [evens, odds] = arrayUtils.partition([1, 2, 3, 4], n => n % 2 === 0);

            expect(evens).toEqual([2, 4]);
            expect(odds).toEqual([1, 3]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SAMPLE & SHUFFLE
    // ═══════════════════════════════════════════════════════════════════

    describe('shuffle', () => {
        it('should return same length', () => {
            const arr = [1, 2, 3, 4, 5];
            expect(arrayUtils.shuffle(arr).length).toBe(5);
        });

        it('should contain same elements', () => {
            const arr = [1, 2, 3, 4, 5];
            const shuffled = arrayUtils.shuffle(arr);

            arr.forEach(n => expect(shuffled).toContain(n));
        });
    });

    describe('sample', () => {
        it('should return single item', () => {
            const arr = [1, 2, 3];
            expect(arr).toContain(arrayUtils.sample(arr));
        });

        it('should return n items', () => {
            const arr = [1, 2, 3, 4, 5];
            expect(arrayUtils.sample(arr, 3).length).toBe(3);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FIRST & LAST
    // ═══════════════════════════════════════════════════════════════════

    describe('first', () => {
        it('should return first element', () => {
            expect(arrayUtils.first([1, 2, 3])).toBe(1);
        });

        it('should return first n elements', () => {
            expect(arrayUtils.first([1, 2, 3], 2)).toEqual([1, 2]);
        });
    });

    describe('last', () => {
        it('should return last element', () => {
            expect(arrayUtils.last([1, 2, 3])).toBe(3);
        });

        it('should return last n elements', () => {
            expect(arrayUtils.last([1, 2, 3], 2)).toEqual([2, 3]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SET OPERATIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('compact', () => {
        it('should remove falsy values', () => {
            expect(arrayUtils.compact([0, 1, false, 2, '', 3, null, undefined])).toEqual([1, 2, 3]);
        });
    });

    describe('without', () => {
        it('should remove values', () => {
            expect(arrayUtils.without([1, 2, 3, 4], 2, 4)).toEqual([1, 3]);
        });
    });

    describe('intersection', () => {
        it('should find common elements', () => {
            expect(arrayUtils.intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
        });
    });

    describe('union', () => {
        it('should combine unique elements', () => {
            expect(arrayUtils.union([1, 2], [2, 3])).toEqual([1, 2, 3]);
        });
    });

    describe('difference', () => {
        it('should find difference', () => {
            expect(arrayUtils.difference([1, 2, 3], [2])).toEqual([1, 3]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ZIP & UNZIP
    // ═══════════════════════════════════════════════════════════════════

    describe('zip', () => {
        it('should zip arrays', () => {
            expect(arrayUtils.zip([1, 2], ['a', 'b'])).toEqual([[1, 'a'], [2, 'b']]);
        });
    });

    describe('unzip', () => {
        it('should unzip arrays', () => {
            expect(arrayUtils.unzip([[1, 'a'], [2, 'b']])).toEqual([[1, 2], ['a', 'b']]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RANGE
    // ═══════════════════════════════════════════════════════════════════

    describe('range', () => {
        it('should generate range', () => {
            expect(arrayUtils.range(0, 5)).toEqual([0, 1, 2, 3, 4]);
        });

        it('should use step', () => {
            expect(arrayUtils.range(0, 10, 2)).toEqual([0, 2, 4, 6, 8]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SORT BY
    // ═══════════════════════════════════════════════════════════════════

    describe('sortBy', () => {
        it('should sort by key', () => {
            const arr = [{ n: 3 }, { n: 1 }, { n: 2 }];
            expect(arrayUtils.sortBy(arr, 'n')).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
        });

        it('should sort by function', () => {
            const arr = ['ccc', 'a', 'bb'];
            expect(arrayUtils.sortBy(arr, s => s.length)).toEqual(['a', 'bb', 'ccc']);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // AGGREGATIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('sum', () => {
        it('should sum numbers', () => {
            expect(arrayUtils.sum([1, 2, 3, 4, 5])).toBe(15);
        });
    });

    describe('avg', () => {
        it('should calculate average', () => {
            expect(arrayUtils.avg([1, 2, 3, 4, 5])).toBe(3);
        });

        it('should handle empty array', () => {
            expect(arrayUtils.avg([])).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // COUNT BY & KEY BY
    // ═══════════════════════════════════════════════════════════════════

    describe('countBy', () => {
        it('should count by key', () => {
            const arr = [{ type: 'a' }, { type: 'b' }, { type: 'a' }];
            expect(arrayUtils.countBy(arr, 'type')).toEqual({ a: 2, b: 1 });
        });
    });

    describe('keyBy', () => {
        it('should key by property', () => {
            const arr = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
            const result = arrayUtils.keyBy(arr, 'id');

            expect(result[1].name).toBe('a');
            expect(result[2].name).toBe('b');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MOVE & EMPTY
    // ═══════════════════════════════════════════════════════════════════

    describe('move', () => {
        it('should move item', () => {
            expect(arrayUtils.move([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
        });
    });

    describe('isEmpty', () => {
        it('should return true for empty', () => {
            expect(arrayUtils.isEmpty([])).toBe(true);
        });

        it('should return false for non-empty', () => {
            expect(arrayUtils.isEmpty([1])).toBe(false);
        });

        it('should return true for null', () => {
            expect(arrayUtils.isEmpty(null)).toBe(true);
        });
    });
});
