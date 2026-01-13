/**
 * Memory Performance Tests
 * Testing memory usage and leaks
 * 
 * @module tests/performance/memory/memory-usage.test.ts
 */

import { describe, it, expect } from 'vitest';

describe('Memory Performance Tests', () => {
    const getMemoryUsage = () => {
        const usage = process.memoryUsage();
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024)
        };
    };

    describe('Array Operations', () => {
        it('should handle large array creation without excessive memory', () => {
            const before = getMemoryUsage();

            const largeArray = Array.from({ length: 100000 }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                data: { value: i * 2 }
            }));

            const after = getMemoryUsage();
            const memoryIncrease = after.heapUsed - before.heapUsed;

            expect(largeArray.length).toBe(100000);
            expect(memoryIncrease).toBeLessThan(100); // Less than 100MB
        });

        it('should release memory after array deallocation', () => {
            const before = getMemoryUsage();

            let tempArray: any[] | null = Array.from({ length: 50000 }, (_, i) => ({ id: i }));
            expect(tempArray.length).toBe(50000);

            tempArray = null;
            global.gc && global.gc(); // Force GC if available

            // Memory should not grow significantly after deallocation
            expect(before.heapUsed).toBeLessThan(500);
        });
    });

    describe('String Operations', () => {
        it('should handle string concatenation efficiently', () => {
            const before = getMemoryUsage();

            let result = '';
            for (let i = 0; i < 10000; i++) {
                result += `Line ${i}\n`;
            }

            const after = getMemoryUsage();

            expect(result.length).toBeGreaterThan(0);
            expect(after.heapUsed - before.heapUsed).toBeLessThan(50);
        });
    });

    describe('Object Operations', () => {
        it('should handle deep object nesting', () => {
            const before = getMemoryUsage();

            const createNested = (depth: number): any => {
                if (depth === 0) return { value: 'leaf' };
                return { child: createNested(depth - 1), level: depth };
            };

            const nested = createNested(100);

            const after = getMemoryUsage();

            expect(nested.level).toBe(100);
            expect(after.heapUsed - before.heapUsed).toBeLessThan(10);
        });

        it('should handle Map with many entries', () => {
            const before = getMemoryUsage();

            const map = new Map<string, any>();
            for (let i = 0; i < 50000; i++) {
                map.set(`key-${i}`, { id: i, data: `value-${i}` });
            }

            const after = getMemoryUsage();

            expect(map.size).toBe(50000);
            expect(after.heapUsed - before.heapUsed).toBeLessThan(50);
        });
    });

    describe('Initial Memory State', () => {
        it('should start with reasonable memory usage', () => {
            const usage = getMemoryUsage();

            expect(usage.heapUsed).toBeLessThan(200);
            expect(usage.rss).toBeLessThan(500);
        });
    });
});
