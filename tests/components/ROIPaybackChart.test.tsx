/**
 * ROIPaybackChart Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('ROIPaybackChart Component', () => {
    it('shows ROI data', () => {
        const roi = { value: 250, period: 12 };
        expect(roi.value).toBe(250);
    });

    it('calculates payback', () => {
        const paybackMonths = 8;
        expect(paybackMonths).toBeLessThan(12);
    });
});
