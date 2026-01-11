/**
 * Data Aggregation Tests
 * Tests for data aggregation utilities
 *
 * @module tests/aggregation/aggregator.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Aggregator implementation
const createAggregator = () => {
  return {
    // Sum
    sum: (data, key) => {
      if (!Array.isArray(data)) return 0;
      return data.reduce((acc, item) => {
        const value = key ? item[key] : item;
        return acc + (typeof value === 'number' ? value : 0);
      }, 0);
    },

    // Average
    avg: (data, key) => {
      if (!Array.isArray(data) || data.length === 0) return 0;
      return this.sum(data, key) / data.length;
    },

    // Min
    min: (data, key) => {
      if (!Array.isArray(data) || data.length === 0) return null;
      return data.reduce((min, item) => {
        const value = key ? item[key] : item;
        return min === null || value < min ? value : min;
      }, null);
    },

    // Max
    max: (data, key) => {
      if (!Array.isArray(data) || data.length === 0) return null;
      return data.reduce((max, item) => {
        const value = key ? item[key] : item;
        return max === null || value > max ? value : max;
      }, null);
    },

    // Count
    count: (data, predicate) => {
      if (!Array.isArray(data)) return 0;
      if (!predicate) return data.length;
      return data.filter(predicate).length;
    },

    // Group By
    groupBy: (data, key) => {
      if (!Array.isArray(data)) return {};
      return data.reduce((acc, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        (acc[groupKey] = acc[groupKey] || []).push(item);
        return acc;
      }, {});
    },

    // Aggregate by group
    aggregateBy: (data, groupKey, aggregations) => {
      const groups = this.groupBy(data, groupKey);
      const result = {};

      for (const [key, items] of Object.entries(groups)) {
        result[key] = {};
        for (const [aggName, config] of Object.entries(aggregations)) {
          const { type, field } = config;
          switch (type) {
            case 'sum':
              result[key][aggName] = this.sum(items, field);
              break;
            case 'avg':
              result[key][aggName] = this.avg(items, field);
              break;
            case 'min':
              result[key][aggName] = this.min(items, field);
              break;
            case 'max':
              result[key][aggName] = this.max(items, field);
              break;
            case 'count':
              result[key][aggName] = items.length;
              break;
          }
        }
      }

      return result;
    },

    // Percentile
    percentile: (data, p, key) => {
      if (!Array.isArray(data) || data.length === 0) return null;

      const values = key ? data.map((item) => item[key]) : data;
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.ceil((p / 100) * sorted.length) - 1;

      return sorted[Math.max(0, index)];
    },

    // Median
    median: (data, key) => {
      return this.percentile(data, 50, key);
    },

    // Mode
    mode: (data, key) => {
      if (!Array.isArray(data) || data.length === 0) return null;

      const values = key ? data.map((item) => item[key]) : data;
      const frequency = {};

      for (const value of values) {
        frequency[value] = (frequency[value] || 0) + 1;
      }

      let maxFreq = 0;
      let modeValue = null;

      for (const [value, freq] of Object.entries(frequency)) {
        if (freq > maxFreq) {
          maxFreq = freq;
          modeValue = isNaN(Number(value)) ? value : Number(value);
        }
      }

      return modeValue;
    },

    // Standard deviation
    stdDev: (data, key) => {
      if (!Array.isArray(data) || data.length === 0) return 0;

      const mean = this.avg(data, key);
      const values = key ? data.map((item) => item[key]) : data;
      const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

      return Math.sqrt(avgSquaredDiff);
    },

    // Distinct values
    distinct: (data, key) => {
      if (!Array.isArray(data)) return [];
      const values = key ? data.map((item) => item[key]) : data;
      return [...new Set(values)];
    },

    // Top N
    topN: (data, n, key, descending = true) => {
      if (!Array.isArray(data)) return [];

      return [...data]
        .sort((a, b) => {
          const valA = key ? a[key] : a;
          const valB = key ? b[key] : b;
          return descending ? valB - valA : valA - valB;
        })
        .slice(0, n);
    },
  };
};

describe('Data Aggregation Tests', () => {
  let aggregator;
  let testData;

  beforeEach(() => {
    aggregator = createAggregator();
    testData = [
      { category: 'A', value: 10, count: 1 },
      { category: 'A', value: 20, count: 2 },
      { category: 'B', value: 30, count: 3 },
      { category: 'B', value: 40, count: 4 },
      { category: 'C', value: 50, count: 5 },
    ];
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUM
  // ═══════════════════════════════════════════════════════════════════

  describe('sum', () => {
    it('should sum array of numbers', () => {
      expect(aggregator.sum([1, 2, 3, 4, 5])).toBe(15);
    });

    it('should sum by key', () => {
      expect(aggregator.sum(testData, 'value')).toBe(150);
    });

    it('should return 0 for empty array', () => {
      expect(aggregator.sum([])).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // AVG
  // ═══════════════════════════════════════════════════════════════════

  describe('avg', () => {
    it('should calculate average', () => {
      expect(aggregator.avg([2, 4, 6])).toBe(4);
    });

    it('should calculate average by key', () => {
      expect(aggregator.avg(testData, 'value')).toBe(30);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MIN / MAX
  // ═══════════════════════════════════════════════════════════════════

  describe('min / max', () => {
    it('should find min', () => {
      expect(aggregator.min([5, 2, 8, 1, 9])).toBe(1);
    });

    it('should find max', () => {
      expect(aggregator.max([5, 2, 8, 1, 9])).toBe(9);
    });

    it('should find min by key', () => {
      expect(aggregator.min(testData, 'value')).toBe(10);
    });

    it('should find max by key', () => {
      expect(aggregator.max(testData, 'value')).toBe(50);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // COUNT
  // ═══════════════════════════════════════════════════════════════════

  describe('count', () => {
    it('should count all items', () => {
      expect(aggregator.count(testData)).toBe(5);
    });

    it('should count with predicate', () => {
      expect(aggregator.count(testData, (item) => item.value > 20)).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GROUP BY
  // ═══════════════════════════════════════════════════════════════════

  describe('groupBy', () => {
    it('should group by key', () => {
      const grouped = aggregator.groupBy(testData, 'category');

      expect(grouped.A.length).toBe(2);
      expect(grouped.B.length).toBe(2);
      expect(grouped.C.length).toBe(1);
    });

    it('should group by function', () => {
      const grouped = aggregator.groupBy(testData, (item) => (item.value > 25 ? 'high' : 'low'));

      expect(grouped.high.length).toBe(3);
      expect(grouped.low.length).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // AGGREGATE BY
  // ═══════════════════════════════════════════════════════════════════

  describe('aggregateBy', () => {
    it('should aggregate by group', () => {
      const result = aggregator.aggregateBy(testData, 'category', {
        total: { type: 'sum', field: 'value' },
        average: { type: 'avg', field: 'value' },
        items: { type: 'count' },
      });

      expect(result.A.total).toBe(30);
      expect(result.A.average).toBe(15);
      expect(result.A.items).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PERCENTILE / MEDIAN / MODE
  // ═══════════════════════════════════════════════════════════════════

  describe('percentile / median / mode', () => {
    it('should calculate percentile', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      expect(aggregator.percentile(data, 50)).toBe(5);
      expect(aggregator.percentile(data, 90)).toBe(9);
    });

    it('should calculate median', () => {
      expect(aggregator.median([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should calculate mode', () => {
      expect(aggregator.mode([1, 2, 2, 3, 3, 3, 4])).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STD DEV
  // ═══════════════════════════════════════════════════════════════════

  describe('stdDev', () => {
    it('should calculate standard deviation', () => {
      const data = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = aggregator.stdDev(data);

      expect(stdDev).toBeCloseTo(2, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DISTINCT
  // ═══════════════════════════════════════════════════════════════════

  describe('distinct', () => {
    it('should return distinct values', () => {
      const distinct = aggregator.distinct(testData, 'category');

      expect(distinct).toEqual(['A', 'B', 'C']);
    });

    it('should return distinct primitives', () => {
      const distinct = aggregator.distinct([1, 2, 2, 3, 3, 3]);

      expect(distinct).toEqual([1, 2, 3]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TOP N
  // ═══════════════════════════════════════════════════════════════════

  describe('topN', () => {
    it('should return top N descending', () => {
      const top = aggregator.topN(testData, 2, 'value');

      expect(top[0].value).toBe(50);
      expect(top[1].value).toBe(40);
    });

    it('should return top N ascending', () => {
      const top = aggregator.topN(testData, 2, 'value', false);

      expect(top[0].value).toBe(10);
      expect(top[1].value).toBe(20);
    });
  });
});
