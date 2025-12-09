import { describe, it, expect } from 'vitest';

// Example Utility Function: Calculate ROI
export const calculateROI = (gain: number, cost: number): number => {
    if (cost === 0) return 0;
    return ((gain - cost) / cost) * 100;
};

describe('Unit Test: ROI Calculation', () => {
    it('should calculate ROI correctly for positive values', () => {
        const roi = calculateROI(1500, 1000); // 500 gain on 1000 cost = 50%
        expect(roi).toBe(50);
    });

    it('should handle zero cost to avoid infinity', () => {
        const roi = calculateROI(1000, 0);
        expect(roi).toBe(0);
    });

    it('should return 0 for break-even', () => {
        const roi = calculateROI(1000, 1000);
        expect(roi).toBe(0);
    });
});
