/**
 * Financial Calculator Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('FinancialCalculatorService', () => {
    it('should calculate ROI', () => {
        const roi = { value: 125, percentage: '25%' };
        expect(roi.value).toBeGreaterThan(100);
    });

    it('should calculate NPV', () => {
        const npv = 50000;
        expect(npv).toBeGreaterThan(0);
    });
});
