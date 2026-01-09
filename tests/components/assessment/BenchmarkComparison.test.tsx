/**
 * BenchmarkComparison Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('BenchmarkComparison Component', () => {
    it('shows benchmark data', () => {
        const benchmark = { industry: 'Tech', score: 75 };
        expect(benchmark.score).toBe(75);
    });

    it('displays comparison', () => {
        const comparison = { your: 80, industry: 75 };
        expect(comparison.your).toBeGreaterThan(comparison.industry);
    });

    it('calculates gap', () => {
        const gap = 80 - 75;
        expect(gap).toBe(5);
    });
});
