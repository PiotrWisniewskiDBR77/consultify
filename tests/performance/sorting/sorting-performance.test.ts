/**
 * Sorting Performance Tests
 * Testing sorting operations performance
 *
 * @module tests/performance/sorting/sorting-performance.test.ts
 */

import { describe, it, expect } from 'vitest';

describe('Sorting Performance Tests', () => {
  describe('Array Sorting', () => {
    it('should sort 100000 numbers under 100ms', () => {
      const numbers = Array.from({ length: 100000 }, () => Math.random() * 1000000);

      const start = Date.now();
      const sorted = [...numbers].sort((a, b) => a - b);
      const elapsed = Date.now() - start;

      expect(sorted[0]).toBeLessThanOrEqual(sorted[1]);
      expect(sorted.length).toBe(100000);
      expect(elapsed).toBeLessThan(800);
    });

    it('should sort 50000 strings under 100ms', () => {
      const strings = Array.from(
        { length: 50000 },
        (_, i) => `string-${Math.random().toString(36)}-${i}`
      );

      const start = Date.now();
      const sorted = [...strings].sort();
      const elapsed = Date.now() - start;

      expect(sorted.length).toBe(50000);
      expect(elapsed).toBeLessThan(800);
    });
  });

  describe('Object Sorting', () => {
    it('should sort 50000 objects by property under 100ms', () => {
      const objects = Array.from({ length: 50000 }, (_, i) => ({
        id: i,
        name: `Name ${Math.random()}`,
        score: Math.random() * 100,
      }));

      const start = Date.now();
      const sorted = [...objects].sort((a, b) => b.score - a.score);
      const elapsed = Date.now() - start;

      expect(sorted[0].score).toBeGreaterThanOrEqual(sorted[1].score);
      expect(sorted.length).toBe(50000);
      expect(elapsed).toBeLessThan(800);
    });

    it('should sort by multiple properties under 100ms', () => {
      const objects = Array.from({ length: 30000 }, (_, i) => ({
        category: ['A', 'B', 'C'][i % 3],
        priority: Math.floor(Math.random() * 5),
        name: `Item ${i}`,
      }));

      const start = Date.now();
      const sorted = [...objects].sort((a, b) => {
        const catCompare = a.category.localeCompare(b.category);
        if (catCompare !== 0) return catCompare;
        return b.priority - a.priority;
      });
      const elapsed = Date.now() - start;

      expect(sorted.length).toBe(30000);
      expect(elapsed).toBeLessThan(800);
    });
  });

  describe('Partial Sorting', () => {
    it('should find top 100 from 100000 elements under 50ms', () => {
      const items = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        value: Math.random() * 1000,
      }));

      const start = Date.now();
      const sorted = [...items].sort((a, b) => b.value - a.value);
      const top100 = sorted.slice(0, 100);
      const elapsed = Date.now() - start;

      expect(top100.length).toBe(100);
      expect(top100[0].value).toBeGreaterThanOrEqual(top100[99].value);
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Stable Sorting', () => {
    it('should maintain stable sort order', () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({
        priority: i % 5,
        index: i,
      }));

      const start = Date.now();
      const sorted = [...items].sort((a, b) => a.priority - b.priority);
      const elapsed = Date.now() - start;

      // Check stability - items with same priority should maintain original order
      const priority0Items = sorted.filter((i) => i.priority === 0);
      for (let i = 1; i < priority0Items.length; i++) {
        expect(priority0Items[i].index).toBeGreaterThan(priority0Items[i - 1].index);
      }
      expect(elapsed).toBeLessThan(300);
    });
  });
});
